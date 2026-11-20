import time

from fastapi import APIRouter, Body, Depends, HTTPException, status
import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import require_roles
from app.db import get_db
from app.models import AuditLog, ProviderConfig, User, UserRole, WorkspaceSettings, utcnow
from app.providers.discovery import PROVIDER_CATALOG, discover_provider_models
from app.schemas.settings import (
    DiscoveredModelOut,
    GpuTestRequest,
    GpuTestResult,
    ProviderConfigOut,
    ProviderConfigUpsert,
    ProviderDiscoverRequest,
    ProviderDiscoveryResult,
    ProviderId,
    WorkspaceSettingsOut,
    WorkspaceSettingsUpdate,
)
from app.security import decrypt_secret, encrypt_secret, get_secret_fernet, mask_api_key

router = APIRouter(prefix="/settings", tags=["settings"])


def _is_provider_configured(provider: str, row: ProviderConfig | None) -> bool:
    spec = PROVIDER_CATALOG[provider]
    if not spec.requires_api_key:
        if provider == "openai_compatible":
            return bool(row and row.base_url)
        return True
    return bool(row and row.encrypted_api_key)


def _serialize_provider(provider: str, row: ProviderConfig | None) -> ProviderConfigOut:
    spec = PROVIDER_CATALOG[provider]
    return ProviderConfigOut(
        provider=provider,
        label=spec.label,
        requires_api_key=spec.requires_api_key,
        is_configured=_is_provider_configured(provider, row),
        key_hint=row.key_hint if row else None,
        base_url=row.base_url if row else None,
        enabled=row.enabled if row else False,
        enabled_models=list(row.enabled_models) if row else [],
        updated_at=row.updated_at if row else None,
    )


@router.get("/providers", response_model=list[ProviderConfigOut])
def list_provider_configs(
    _owner: User = Depends(require_roles(UserRole.OWNER)),
    db: Session = Depends(get_db),
) -> list[ProviderConfigOut]:
    """List all supported AI providers and their safe configuration status (owner only)."""
    rows = {row.provider: row for row in db.scalars(select(ProviderConfig))}
    return [_serialize_provider(pid, rows.get(pid)) for pid in PROVIDER_CATALOG]


@router.put("/providers/{provider}", response_model=ProviderConfigOut)
def upsert_provider_config(
    provider: ProviderId,
    payload: ProviderConfigUpsert,
    owner: User = Depends(require_roles(UserRole.OWNER)),
    db: Session = Depends(get_db),
) -> ProviderConfigOut:
    """Save or update a provider's encrypted API key and enabled model list (owner only)."""
    row = db.scalar(select(ProviderConfig).where(ProviderConfig.provider == provider))
    now = utcnow()
    if row is None:
        row = ProviderConfig(provider=provider, updated_at=now)
        db.add(row)

    fernet = get_secret_fernet()
    if payload.clear_api_key:
        row.encrypted_api_key = None
        row.key_hint = None
    elif payload.api_key is not None and payload.api_key.strip():
        cleaned_key = payload.api_key.strip()
        row.encrypted_api_key = encrypt_secret(cleaned_key, fernet)
        row.key_hint = mask_api_key(cleaned_key)

    row.base_url = payload.base_url
    row.enabled = payload.enabled
    row.enabled_models = payload.enabled_models
    row.updated_at = now

    db.add(
        AuditLog(
            user_id=owner.id,
            action="settings.provider_updated",
            provider=provider,
        )
    )
    db.commit()
    db.refresh(row)
    return _serialize_provider(provider, row)


@router.post("/providers/{provider}/discover", response_model=ProviderDiscoveryResult)
def discover_models_for_provider(
    provider: ProviderId,
    payload: ProviderDiscoverRequest | None = Body(default=None),
    _owner: User = Depends(require_roles(UserRole.OWNER)),
    db: Session = Depends(get_db),
) -> ProviderDiscoveryResult:
    """Discover available models for a provider using draft or saved credentials (owner only)."""
    row = db.scalar(select(ProviderConfig).where(ProviderConfig.provider == provider))
    raw_key: str | None = None
    if payload and payload.api_key and payload.api_key.strip():
        raw_key = payload.api_key.strip()
    elif row and row.encrypted_api_key:
        raw_key = decrypt_secret(row.encrypted_api_key, get_secret_fernet())

    effective_base_url = (
        payload.base_url
        if payload and payload.base_url
        else (row.base_url if row else None)
    )

    models, source = discover_provider_models(
        provider=provider,
        api_key=raw_key,
        base_url=effective_base_url,
    )
    return ProviderDiscoveryResult(
        provider=provider,
        source=source,  # type: ignore[arg-type]
        models=[
            DiscoveredModelOut(
                provider=item.provider,
                provider_label=item.provider_label,
                model_id=item.model_id,
                display_name=item.display_name,
                supports_thinking=item.supports_thinking,
                thinking_efforts=list(item.thinking_efforts),
            )
            for item in models
        ],
    )


def _get_or_create_workspace_settings(db: Session) -> WorkspaceSettings:
    settings_row = db.get(WorkspaceSettings, "default")
    if settings_row is None:
        settings_row = WorkspaceSettings(id="default")
        db.add(settings_row)
        db.commit()
        db.refresh(settings_row)
    return settings_row


def _serialize_workspace_settings(row: WorkspaceSettings) -> WorkspaceSettingsOut:
    return WorkspaceSettingsOut(
        allow_auto_review=row.allow_auto_review,
        default_review_mode=row.default_review_mode,  # type: ignore[arg-type]
        default_provider=row.default_provider,
        default_model=row.default_model,
        default_thinking_effort=row.default_thinking_effort,  # type: ignore[arg-type]
        rulebook_prompt=row.rulebook_prompt,
        gpu_llm_enabled=row.gpu_llm_enabled,
        gpu_llm_endpoint=row.gpu_llm_endpoint,
        gpu_llm_model=row.gpu_llm_model,
        gpu_llm_key_configured=bool(row.encrypted_gpu_llm_api_key),
        gpu_llm_key_hint=row.gpu_llm_key_hint,
        updated_at=row.updated_at,
    )


@router.get("/workspace", response_model=WorkspaceSettingsOut)
def get_workspace_settings(
    _owner: User = Depends(require_roles(UserRole.OWNER)),
    db: Session = Depends(get_db),
) -> WorkspaceSettingsOut:
    """Return review mode defaults and rulebook settings (owner only)."""
    return _serialize_workspace_settings(_get_or_create_workspace_settings(db))


@router.put("/workspace", response_model=WorkspaceSettingsOut)
def update_workspace_settings(
    payload: WorkspaceSettingsUpdate,
    owner: User = Depends(require_roles(UserRole.OWNER)),
    db: Session = Depends(get_db),
) -> WorkspaceSettingsOut:
    """Update workspace review defaults, thinking effort, and rulebook prompt (owner only)."""
    if not payload.allow_auto_review and payload.default_review_mode == "auto":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Default review mode cannot be 'auto' when auto review is disabled",
        )

    settings_row = _get_or_create_workspace_settings(db)
    settings_row.allow_auto_review = payload.allow_auto_review
    settings_row.default_review_mode = payload.default_review_mode
    settings_row.default_provider = payload.default_provider
    settings_row.default_model = payload.default_model
    settings_row.default_thinking_effort = payload.default_thinking_effort
    settings_row.rulebook_prompt = payload.rulebook_prompt
    settings_row.gpu_llm_enabled = payload.gpu_llm_enabled
    settings_row.gpu_llm_endpoint = payload.gpu_llm_endpoint
    settings_row.gpu_llm_model = payload.gpu_llm_model or "Qwen/Qwen2.5-7B-Instruct-AWQ"

    if payload.clear_gpu_llm_api_key:
        settings_row.encrypted_gpu_llm_api_key = None
        settings_row.gpu_llm_key_hint = None
    elif payload.gpu_llm_api_key is not None and payload.gpu_llm_api_key.strip():
        cleaned_key = payload.gpu_llm_api_key.strip()
        settings_row.encrypted_gpu_llm_api_key = encrypt_secret(cleaned_key, get_secret_fernet())
        settings_row.gpu_llm_key_hint = mask_api_key(cleaned_key)

    settings_row.updated_at = utcnow()

    db.add(AuditLog(user_id=owner.id, action="settings.workspace_updated"))
    db.commit()
    db.refresh(settings_row)
    return _serialize_workspace_settings(settings_row)


@router.post("/workspace/test-gpu", response_model=GpuTestResult)
def test_gpu_slm_connection(
    payload: GpuTestRequest | None = Body(default=None),
    _owner: User = Depends(require_roles(UserRole.OWNER)),
    db: Session = Depends(get_db),
) -> GpuTestResult:
    """Probe the configured (or draft) OpenAI-compatible GPU SLM endpoint (owner only)."""
    settings_row = _get_or_create_workspace_settings(db)
    endpoint = (
        payload.gpu_llm_endpoint
        if payload and payload.gpu_llm_endpoint
        else settings_row.gpu_llm_endpoint
    )
    model = (
        payload.gpu_llm_model
        if payload and payload.gpu_llm_model
        else (settings_row.gpu_llm_model or "Qwen/Qwen2.5-7B-Instruct-AWQ")
    )

    if not endpoint:
        return GpuTestResult(
            ok=False,
            endpoint="",
            model=model,
            detail="GPU SLM endpoint URL is required.",
        )

    cleaned_endpoint = endpoint.rstrip("/")
    if cleaned_endpoint.endswith("/chat/completions"):
        models_url = f"{cleaned_endpoint.removesuffix('/chat/completions')}/models"
    else:
        models_url = f"{cleaned_endpoint}/models"

    api_key: str | None = None
    if payload and payload.gpu_llm_api_key and payload.gpu_llm_api_key.strip():
        api_key = payload.gpu_llm_api_key.strip()
    elif not (payload and payload.clear_gpu_llm_api_key) and settings_row.encrypted_gpu_llm_api_key:
        api_key = decrypt_secret(settings_row.encrypted_gpu_llm_api_key, get_secret_fernet())

    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    started = time.perf_counter()
    try:
        resp = httpx.get(models_url, headers=headers, timeout=8.0)
        latency_ms = int((time.perf_counter() - started) * 1000)
        resp.raise_for_status()
        data = resp.json()
        available_models = [
            str(item["id"])
            for item in data.get("data", [])
            if isinstance(item, dict) and isinstance(item.get("id"), str)
        ]
        model_found = model in available_models if available_models else True
        detail = (
            f"Connected in {latency_ms}ms. Model '{model}' is ready."
            if model_found
            else f"Connected in {latency_ms}ms, but '{model}' was not in /models ({', '.join(available_models[:4]) or 'none'})."
        )
        return GpuTestResult(
            ok=model_found,
            endpoint=cleaned_endpoint,
            model=model,
            latency_ms=latency_ms,
            available_models=available_models,
            model_found=model_found,
            detail=detail,
        )
    except httpx.HTTPStatusError as exc:
        latency_ms = int((time.perf_counter() - started) * 1000)
        return GpuTestResult(
            ok=False,
            endpoint=cleaned_endpoint,
            model=model,
            latency_ms=latency_ms,
            detail=f"Endpoint returned HTTP {exc.response.status_code}. Check API key or URL.",
        )
    except Exception as exc:  # noqa: BLE001 — return actionable probe failure instead of 500
        return GpuTestResult(
            ok=False,
            endpoint=cleaned_endpoint,
            model=model,
            detail=f"Could not reach GPU endpoint: {type(exc).__name__}",
        )
