from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import require_roles
from app.db import get_db
from app.models import AuditLog, ProviderConfig, User, UserRole, WorkspaceSettings, utcnow
from app.providers.discovery import PROVIDER_CATALOG, discover_provider_models
from app.schemas.settings import (
    DiscoveredModelOut,
    ProviderConfigOut,
    ProviderConfigUpsert,
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
    _owner: User = Depends(require_roles(UserRole.OWNER)),
    db: Session = Depends(get_db),
) -> ProviderDiscoveryResult:
    """Discover available models for a configured provider (owner only)."""
    row = db.scalar(select(ProviderConfig).where(ProviderConfig.provider == provider))
    raw_key: str | None = None
    if row and row.encrypted_api_key:
        raw_key = decrypt_secret(row.encrypted_api_key, get_secret_fernet())

    models, source = discover_provider_models(
        provider=provider,
        api_key=raw_key,
        base_url=row.base_url if row else None,
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


@router.get("/workspace", response_model=WorkspaceSettingsOut)
def get_workspace_settings(
    _owner: User = Depends(require_roles(UserRole.OWNER)),
    db: Session = Depends(get_db),
) -> WorkspaceSettings:
    """Return review mode defaults and rulebook settings (owner only)."""
    return _get_or_create_workspace_settings(db)


@router.put("/workspace", response_model=WorkspaceSettingsOut)
def update_workspace_settings(
    payload: WorkspaceSettingsUpdate,
    owner: User = Depends(require_roles(UserRole.OWNER)),
    db: Session = Depends(get_db),
) -> WorkspaceSettings:
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
    settings_row.updated_at = utcnow()

    db.add(AuditLog(user_id=owner.id, action="settings.workspace_updated"))
    db.commit()
    db.refresh(settings_row)
    return settings_row
