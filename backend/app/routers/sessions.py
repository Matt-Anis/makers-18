from collections import Counter
from dataclasses import asdict
from datetime import timedelta
import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import ensure_utc, get_current_user
from app.config import Settings, get_settings
from app.db import get_db
from app.detection.pipeline import (
    DetectedFinding,
    apply_mask,
    commit_findings_to_vault,
    detect_sensitive_entities,
)
from app.detection.presidio_detector import get_presidio_detector
from app.detection.slm_client import OpenAICompatibleSLMDetector
from app.models import (
    AuditLog,
    CustomRule,
    GatewaySession,
    GatewaySessionStatus,
    MaskedMessage,
    PendingReview,
    ProviderConfig,
    SessionVaultSnapshot,
    User,
    WorkspaceSettings,
    utcnow,
)
from app.providers.client import ProviderCallError, send_masked_chat
from app.providers.discovery import PROVIDER_CATALOG
from app.schemas.sessions import (
    CreateGatewaySessionRequest,
    FindingOut,
    GatewaySessionDetailOut,
    GatewaySessionOut,
    MaskedMessageOut,
    PendingReviewOut,
    ReviewRejectResponse,
    SendMessageRequest,
    SendMessageResponse,
    SessionInspectorOut,
    VaultIndexEntryOut,
)
from app.security import decrypt_secret, encrypt_secret, get_secret_fernet
from app.vault.store import (
    VaultData,
    VaultStore,
    delete_session_vault,
    get_vault_store,
    load_session_vault,
    save_session_vault,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _get_owned_session(
    db: Session,
    session_id: str,
    owner_user_id: str,
    *,
    with_messages: bool = False,
) -> GatewaySession:
    stmt = select(GatewaySession).where(
        GatewaySession.id == session_id,
        GatewaySession.owner_user_id == owner_user_id,
    )
    if with_messages:
        stmt = stmt.options(joinedload(GatewaySession.masked_messages))

    gateway_session = db.scalar(stmt)
    if gateway_session is None:
        # Return 404 for both missing and non-owned IDs to avoid leaking session existence.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return gateway_session


@router.post("", response_model=GatewaySessionOut, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: CreateGatewaySessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    vault_store: VaultStore = Depends(get_vault_store),
    settings: Settings = Depends(get_settings),
) -> GatewaySession:
    """Create a user-owned gateway session and initialize its encrypted vault."""
    now = utcnow()
    gateway_session = GatewaySession(
        owner_user_id=current_user.id,
        title=payload.title,
        provider=payload.provider,
        status=GatewaySessionStatus.ACTIVE.value,
        created_at=now,
        updated_at=now,
        expires_at=now + timedelta(seconds=settings.vault_ttl_seconds),
    )
    db.add(gateway_session)
    db.flush()

    save_session_vault(
        db,
        vault_store,
        gateway_session.id,
        VaultData(),
        ttl_seconds=settings.vault_ttl_seconds,
        ephemeral_only=settings.ephemeral_vaults_only,
    )

    db.add(
        AuditLog(
            user_id=current_user.id,
            gateway_session_id=gateway_session.id,
            action="session.created",
            provider=gateway_session.provider,
        )
    )
    db.commit()
    db.refresh(gateway_session)
    return gateway_session


@router.get("", response_model=list[GatewaySessionOut])
def list_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> list[GatewaySession]:
    """List active gateway sessions owned by the current user."""
    now = utcnow()
    sessions = list(
        db.scalars(
            select(GatewaySession)
            .where(
                GatewaySession.owner_user_id == current_user.id,
                GatewaySession.status == GatewaySessionStatus.ACTIVE.value,
            )
            .order_by(GatewaySession.updated_at.desc())
        )
    )
    if settings.ephemeral_vaults_only:
        return [item for item in sessions if ensure_utc(item.expires_at) > now]
    return sessions


@router.get("/{session_id}", response_model=GatewaySessionDetailOut)
def get_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    vault_store: VaultStore = Depends(get_vault_store),
    settings: Settings = Depends(get_settings),
) -> GatewaySessionDetailOut:
    """Fetch a single gateway session owned by the current user along with restored history."""
    gateway_session = _get_owned_session(
        db,
        session_id,
        current_user.id,
        with_messages=True,
    )
    vault = load_session_vault(
        db,
        vault_store,
        gateway_session.id,
        ttl_seconds=settings.vault_ttl_seconds,
        ephemeral_only=settings.ephemeral_vaults_only,
    )
    messages = [
        MaskedMessageOut(
            id=msg.id,
            role=msg.role,
            masked_content=msg.masked_content,
            unmasked_content=vault.unmask_text(msg.masked_content) if vault else msg.masked_content,
            created_at=msg.created_at,
        )
        for msg in gateway_session.masked_messages
    ]
    pending_review_out: PendingReviewOut | None = None
    active_pending = db.scalar(
        select(PendingReview)
        .where(
            PendingReview.gateway_session_id == gateway_session.id,
            PendingReview.owner_user_id == current_user.id,
            PendingReview.status == "pending",
        )
        .order_by(PendingReview.created_at.desc())
    )
    if active_pending is not None and active_pending.encrypted_payload:
        try:
            raw_text, pending_findings = _decode_pending_payload(active_pending)
            pending_review_out = PendingReviewOut(
                review_id=active_pending.id,
                provider=active_pending.provider,
                model=active_pending.model,
                thinking_effort=active_pending.thinking_effort,
                raw_text=raw_text,
                findings=[_to_finding_out(item) for item in pending_findings],
                masked_preview=apply_mask(raw_text, pending_findings),
                created_at=active_pending.created_at,
            )
        except HTTPException:
            pending_review_out = None

    return GatewaySessionDetailOut(
        id=gateway_session.id,
        owner_user_id=gateway_session.owner_user_id,
        title=gateway_session.title,
        provider=gateway_session.provider,
        status=GatewaySessionStatus(gateway_session.status),
        created_at=gateway_session.created_at,
        updated_at=gateway_session.updated_at,
        expires_at=gateway_session.expires_at,
        ended_at=gateway_session.ended_at,
        vault_active=vault is not None,
        masked_messages=messages,
        pending_review=pending_review_out,
    )


@router.get("/{session_id}/inspector", response_model=SessionInspectorOut)
def inspect_session_vault(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    vault_store: VaultStore = Depends(get_vault_store),
    settings: Settings = Depends(get_settings),
) -> SessionInspectorOut:
    """Return the owner's live session vault index, obfuscated turns, and Fernet cipher proof."""
    gateway_session = _get_owned_session(
        db,
        session_id,
        current_user.id,
        with_messages=True,
    )
    redis_cached = vault_store.exists(gateway_session.id)
    snapshot = db.get(SessionVaultSnapshot, gateway_session.id)
    vault = load_session_vault(
        db,
        vault_store,
        gateway_session.id,
        ttl_seconds=settings.vault_ttl_seconds,
        ephemeral_only=settings.ephemeral_vaults_only,
    )

    combined_masked = "\n".join(msg.masked_content.lower() for msg in gateway_session.masked_messages)
    entries: list[VaultIndexEntryOut] = []
    if vault is not None:
        for idx, (placeholder, original_value) in enumerate(vault.to_real.items(), start=1):
            entity_type = placeholder.strip("[]").split("_", 1)[0] or "CUSTOM"
            occurrences = combined_masked.count(placeholder.lower()) if combined_masked else 0
            entries.append(
                VaultIndexEntryOut(
                    index=idx,
                    placeholder=placeholder,
                    entity_type=entity_type,
                    original_value=original_value,
                    occurrences=occurrences,
                )
            )

    cipher_blob: str | None = None
    if snapshot is not None and snapshot.encrypted_blob:
        cipher_blob = snapshot.encrypted_blob
    elif vault is not None:
        cipher_blob = vault_store.encrypt_bytes(vault)

    cipher_preview = (
        f"{cipher_blob[:64]}..." if cipher_blob and len(cipher_blob) > 64 else cipher_blob
    )
    messages = [
        MaskedMessageOut(
            id=msg.id,
            role=msg.role,
            masked_content=msg.masked_content,
            unmasked_content=vault.unmask_text(msg.masked_content) if vault else msg.masked_content,
            created_at=msg.created_at,
        )
        for msg in gateway_session.masked_messages
    ]

    return SessionInspectorOut(
        session_id=gateway_session.id,
        title=gateway_session.title,
        provider=gateway_session.provider,
        status=GatewaySessionStatus(gateway_session.status),
        vault_active=vault is not None,
        redis_cached=redis_cached,
        snapshot_persisted=snapshot is not None,
        ephemeral_only=settings.ephemeral_vaults_only,
        expires_at=gateway_session.expires_at,
        cipher_preview=cipher_preview,
        cipher_bytes=len(cipher_blob.encode("utf-8")) if cipher_blob else 0,
        entry_count=len(entries),
        entries=entries,
        messages=messages,
    )


@router.delete("/{session_id}")
def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    vault_store: VaultStore = Depends(get_vault_store),
) -> dict[str, str]:
    """End a gateway session, wipe its encrypted vault and masked messages, and log metadata."""
    gateway_session = _get_owned_session(db, session_id, current_user.id)
    delete_session_vault(db, vault_store, gateway_session.id)

    now = utcnow()
    gateway_session.status = GatewaySessionStatus.ENDED.value
    gateway_session.ended_at = now
    gateway_session.updated_at = now
    gateway_session.masked_messages.clear()

    pending = list(
        db.scalars(
            select(PendingReview).where(PendingReview.gateway_session_id == gateway_session.id)
        )
    )
    for review in pending:
        db.delete(review)

    db.add(
        AuditLog(
            user_id=current_user.id,
            gateway_session_id=gateway_session.id,
            action="session.ended",
            provider=gateway_session.provider,
        )
    )
    db.commit()
    return {"status": "ended"}


def _get_workspace_settings(db: Session) -> WorkspaceSettings:
    row = db.get(WorkspaceSettings, "default")
    if row is None:
        row = WorkspaceSettings(id="default")
        db.add(row)
        db.flush()
    return row


def _resolve_provider_credentials(
    db: Session,
    provider: str,
) -> tuple[ProviderConfig | None, str | None, str | None]:
    spec = PROVIDER_CATALOG.get(provider)
    if spec is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported provider '{provider}'",
        )

    config_row = db.scalar(select(ProviderConfig).where(ProviderConfig.provider == provider))
    if provider == "mock":
        if config_row is not None and not config_row.enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Provider 'mock' is disabled",
            )
        return config_row, None, None

    if config_row is None or not config_row.enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Provider '{provider}' is not enabled",
        )

    fernet = get_secret_fernet()
    api_key: str | None = None
    if config_row.encrypted_api_key:
        api_key = decrypt_secret(config_row.encrypted_api_key, fernet)
    elif spec.requires_api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Provider '{provider}' API key is not configured",
        )

    if provider == "openai_compatible" and not config_row.base_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Base URL is required for openai_compatible provider",
        )
    return config_row, api_key, config_row.base_url


def _resolve_model(
    provider: str,
    requested_model: str | None,
    settings_row: WorkspaceSettings,
    config_row: ProviderConfig | None,
) -> str:
    if requested_model and requested_model.strip():
        return requested_model.strip()
    if provider == settings_row.default_provider and settings_row.default_model:
        return settings_row.default_model
    if config_row and config_row.enabled_models:
        return config_row.enabled_models[0]
    fallback = PROVIDER_CATALOG[provider].fallback_models
    if fallback:
        return fallback[0].model_id
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"No model selected for provider '{provider}'",
    )


def _to_finding_out(finding: DetectedFinding) -> FindingOut:
    return FindingOut(
        id=finding.id,
        type=finding.type,
        text=finding.text,
        start=finding.start,
        end=finding.end,
        source=finding.source,
        confidence=finding.confidence,
        placeholder=finding.placeholder,
    )


def _serialize_message(msg: MaskedMessage, vault: VaultData) -> MaskedMessageOut:
    return MaskedMessageOut(
        id=msg.id,
        role=msg.role,
        masked_content=msg.masked_content,
        unmasked_content=vault.unmask_text(msg.masked_content),
        created_at=msg.created_at,
    )


def window_masked_history(
    masked_messages: list[tuple[str, str]],
    newest_user_text: str,
    *,
    max_messages: int,
    max_chars: int,
) -> list[tuple[str, str]]:
    """
    Build a bounded masked history ending with newest_user_text.
    Preserves the opening (user, assistant) pair when budget allows, fills remaining budget
    with the most recent turns, and guarantees user-first role alternation.
    """
    newest_turn = ("user", newest_user_text)
    if max_messages <= 1 or max_chars <= len(newest_user_text) or not masked_messages:
        return [newest_turn]

    turns: list[list[tuple[str, str]]] = []
    idx = 0
    while idx < len(masked_messages):
        role, content = masked_messages[idx]
        if (
            role == "user"
            and idx + 1 < len(masked_messages)
            and masked_messages[idx + 1][0] == "assistant"
        ):
            turns.append([(role, content), masked_messages[idx + 1]])
            idx += 2
        else:
            idx += 1

    if not turns:
        return [newest_turn]

    remaining_msgs = max_messages - 1
    remaining_chars = max_chars - len(newest_user_text)

    anchor: list[tuple[str, str]] = []
    tail_candidates = turns
    if len(turns) > 1:
        first_turn = turns[0]
        first_chars = sum(len(text) for _, text in first_turn)
        if remaining_msgs >= len(first_turn) and remaining_chars >= first_chars:
            anchor = first_turn
            remaining_msgs -= len(first_turn)
            remaining_chars -= first_chars
            tail_candidates = turns[1:]

    recent: list[tuple[str, str]] = []
    for turn in reversed(tail_candidates):
        turn_chars = sum(len(text) for _, text in turn)
        if remaining_msgs >= len(turn) and remaining_chars >= turn_chars:
            recent = turn + recent
            remaining_msgs -= len(turn)
            remaining_chars -= turn_chars
        else:
            break

    return anchor + recent + [newest_turn]


def _dispatch_and_persist(
    db: Session,
    vault_store: VaultStore,
    settings: Settings,
    *,
    gateway_session: GatewaySession,
    user_id: str,
    vault: VaultData,
    raw_text: str,
    findings: list[DetectedFinding],
    provider: str,
    model: str,
    thinking_effort: str,
    api_key: str | None,
    base_url: str | None,
    review_id: str | None = None,
) -> SendMessageResponse:
    commit_findings_to_vault(vault, findings)
    masked_user_text = apply_mask(raw_text, findings)

    history = window_masked_history(
        [(msg.role, msg.masked_content) for msg in gateway_session.masked_messages],
        masked_user_text,
        max_messages=settings.history_max_messages,
        max_chars=settings.history_max_chars,
    )

    try:
        masked_reply = send_masked_chat(
            provider,
            model,
            history,
            api_key=api_key,
            base_url=base_url,
            thinking_effort=thinking_effort,
        )
    except ProviderCallError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    save_session_vault(
        db,
        vault_store,
        gateway_session.id,
        vault,
        ttl_seconds=settings.vault_ttl_seconds,
        ephemeral_only=settings.ephemeral_vaults_only,
    )

    now = utcnow()
    assistant_time = now + timedelta(milliseconds=1)
    user_msg = MaskedMessage(
        gateway_session_id=gateway_session.id,
        role="user",
        masked_content=masked_user_text,
        created_at=now,
    )
    assistant_msg = MaskedMessage(
        gateway_session_id=gateway_session.id,
        role="assistant",
        masked_content=masked_reply,
        created_at=assistant_time,
    )
    db.add(user_msg)
    db.add(assistant_msg)

    gateway_session.updated_at = assistant_time
    gateway_session.expires_at = assistant_time + timedelta(seconds=settings.vault_ttl_seconds)

    entity_counts = dict(Counter(item.type for item in findings))
    db.add(
        AuditLog(
            user_id=user_id,
            gateway_session_id=gateway_session.id,
            action="message.sent",
            provider=provider,
            approved=True,
            entity_counts=entity_counts or None,
        )
    )
    db.commit()
    db.refresh(user_msg)
    db.refresh(assistant_msg)

    return SendMessageResponse(
        status="sent",
        review_id=review_id,
        provider=provider,
        model=model,
        thinking_effort=thinking_effort,
        findings=[_to_finding_out(item) for item in findings],
        masked_preview=masked_user_text,
        user_message=_serialize_message(user_msg, vault),
        assistant_message=_serialize_message(assistant_msg, vault),
    )


@router.post("/{session_id}/messages", response_model=SendMessageResponse)
def send_session_message(
    session_id: str,
    payload: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    vault_store: VaultStore = Depends(get_vault_store),
    settings: Settings = Depends(get_settings),
) -> SendMessageResponse:
    """Filter the newest user prompt and either hold for manual review or dispatch immediately."""
    gateway_session = _get_owned_session(
        db,
        session_id,
        current_user.id,
        with_messages=True,
    )
    if gateway_session.status != GatewaySessionStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot send messages to an ended session",
        )

    settings_row = _get_workspace_settings(db)
    if payload.mode == "auto" and not settings_row.allow_auto_review:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Auto-review mode is disabled by workspace policy",
        )

    effective_mode = (
        payload.mode
        if payload.mode is not None
        else ("manual" if not settings_row.allow_auto_review else settings_row.default_review_mode)
    )

    provider = (payload.provider or gateway_session.provider or settings_row.default_provider).strip()
    config_row, api_key, base_url = _resolve_provider_credentials(db, provider)
    model = _resolve_model(provider, payload.model, settings_row, config_row)
    thinking_effort = payload.thinking_effort or settings_row.default_thinking_effort or "medium"

    vault = load_session_vault(
        db,
        vault_store,
        gateway_session.id,
        ttl_seconds=settings.vault_ttl_seconds,
        ephemeral_only=settings.ephemeral_vaults_only,
    )
    if vault is None:
        vault = VaultData()

    custom_rules = list(
        db.scalars(
            select(CustomRule)
            .where(CustomRule.enabled.is_(True))
            .order_by(CustomRule.created_at.asc())
        )
    )
    extra_detectors = []
    if settings.presidio_enabled:
        presidio = get_presidio_detector(
            model_name=settings.presidio_model,
            min_score=settings.presidio_min_score,
        )
        if presidio is not None:
            extra_detectors.append(presidio)
    if settings_row.gpu_llm_enabled and settings_row.gpu_llm_endpoint:
        slm_api_key: str | None = None
        if settings_row.encrypted_gpu_llm_api_key:
            slm_api_key = decrypt_secret(settings_row.encrypted_gpu_llm_api_key, get_secret_fernet())
        extra_detectors.append(
            OpenAICompatibleSLMDetector(
                settings_row.gpu_llm_endpoint,
                rulebook_prompt=settings_row.rulebook_prompt,
                model=settings_row.gpu_llm_model or "Qwen/Qwen2.5-7B-Instruct-AWQ",
                api_key=slm_api_key,
            )
        )

    findings = detect_sensitive_entities(
        payload.content,
        vault=vault,
        custom_rules=custom_rules,
        extra_detectors=extra_detectors,
    )

    if effective_mode == "manual" and findings:
        stale_pending = list(
            db.scalars(
                select(PendingReview).where(
                    PendingReview.gateway_session_id == gateway_session.id,
                    PendingReview.owner_user_id == current_user.id,
                    PendingReview.status == "pending",
                )
            )
        )
        superseded_at = utcnow()
        for stale in stale_pending:
            stale.status = "superseded"
            stale.resolved_at = superseded_at
            stale.encrypted_payload = ""

        masked_preview = apply_mask(payload.content, findings)
        raw_envelope = json.dumps(
            {
                "raw_text": payload.content,
                "findings": [asdict(item) for item in findings],
            }
        )
        review = PendingReview(
            gateway_session_id=gateway_session.id,
            owner_user_id=current_user.id,
            provider=provider,
            model=model,
            thinking_effort=thinking_effort,
            encrypted_payload=encrypt_secret(raw_envelope, get_secret_fernet()),
            status="pending",
        )
        db.add(review)
        db.commit()
        db.refresh(review)

        return SendMessageResponse(
            status="needs_review",
            review_id=review.id,
            provider=provider,
            model=model,
            thinking_effort=thinking_effort,
            findings=[_to_finding_out(item) for item in findings],
            masked_preview=masked_preview,
        )

    return _dispatch_and_persist(
        db,
        vault_store,
        settings,
        gateway_session=gateway_session,
        user_id=current_user.id,
        vault=vault,
        raw_text=payload.content,
        findings=findings,
        provider=provider,
        model=model,
        thinking_effort=thinking_effort,
        api_key=api_key,
        base_url=base_url,
    )


def _get_owned_pending_review(
    db: Session,
    session_id: str,
    review_id: str,
    owner_user_id: str,
) -> PendingReview:
    review = db.scalar(
        select(PendingReview).where(
            PendingReview.id == review_id,
            PendingReview.gateway_session_id == session_id,
            PendingReview.owner_user_id == owner_user_id,
        )
    )
    if review is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pending review not found")
    if review.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Review has already been {review.status}",
        )
    return review


def _decode_pending_payload(review: PendingReview) -> tuple[str, list[DetectedFinding]]:
    try:
        decoded = decrypt_secret(review.encrypted_payload, get_secret_fernet())
        data = json.loads(decoded)
        findings = [DetectedFinding(**item) for item in data.get("findings", [])]
        return str(data["raw_text"]), findings
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pending review payload could not be decrypted",
        ) from exc


@router.post("/{session_id}/reviews/{review_id}/approve", response_model=SendMessageResponse)
def approve_pending_review(
    session_id: str,
    review_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    vault_store: VaultStore = Depends(get_vault_store),
    settings: Settings = Depends(get_settings),
) -> SendMessageResponse:
    """Approve a held prompt, commit its vault placeholders, send to AI, and unmask reply."""
    gateway_session = _get_owned_session(
        db,
        session_id,
        current_user.id,
        with_messages=True,
    )
    if gateway_session.status != GatewaySessionStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot approve a review on an ended session",
        )

    review = _get_owned_pending_review(db, session_id, review_id, current_user.id)
    raw_text, findings = _decode_pending_payload(review)
    _config_row, api_key, base_url = _resolve_provider_credentials(db, review.provider)

    vault = load_session_vault(
        db,
        vault_store,
        gateway_session.id,
        ttl_seconds=settings.vault_ttl_seconds,
        ephemeral_only=settings.ephemeral_vaults_only,
    )
    if vault is None:
        vault = VaultData()

    review.status = "approved"
    review.resolved_at = utcnow()
    review.encrypted_payload = ""

    return _dispatch_and_persist(
        db,
        vault_store,
        settings,
        gateway_session=gateway_session,
        user_id=current_user.id,
        vault=vault,
        raw_text=raw_text,
        findings=findings,
        provider=review.provider,
        model=review.model,
        thinking_effort=review.thinking_effort,
        api_key=api_key,
        base_url=base_url,
        review_id=review.id,
    )


@router.post("/{session_id}/reviews/{review_id}/reject", response_model=ReviewRejectResponse)
def reject_pending_review(
    session_id: str,
    review_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReviewRejectResponse:
    """Deny a held prompt: wipe its encrypted payload, block external call, and log audit."""
    _get_owned_session(db, session_id, current_user.id)
    review = _get_owned_pending_review(db, session_id, review_id, current_user.id)

    entity_counts: dict[str, int] = {}
    if review.encrypted_payload:
        _raw_text, findings = _decode_pending_payload(review)
        entity_counts = dict(Counter(item.type for item in findings))

    review.status = "rejected"
    review.resolved_at = utcnow()
    review.encrypted_payload = ""

    db.add(
        AuditLog(
            user_id=current_user.id,
            gateway_session_id=session_id,
            action="message.rejected",
            provider=review.provider,
            approved=False,
            entity_counts=entity_counts or None,
        )
    )
    db.commit()
    return ReviewRejectResponse(status="rejected", review_id=review.id)

