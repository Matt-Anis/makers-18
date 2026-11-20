from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db import get_db
from app.models import ProviderConfig, User, WorkspaceSettings
from app.providers.discovery import PROVIDER_CATALOG, _to_model_info
from app.schemas.settings import DiscoveredModelOut, ModelDiscoveryResponse

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("/models", response_model=ModelDiscoveryResponse)
def list_available_models(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ModelDiscoveryResponse:
    """Return Owner-enabled models and review/thinking defaults for authenticated users."""
    configs = list(db.scalars(select(ProviderConfig).where(ProviderConfig.enabled.is_(True))))
    discovered: list[DiscoveredModelOut] = []

    for cfg in configs:
        spec = PROVIDER_CATALOG.get(cfg.provider)
        if spec is None:
            continue
        if spec.requires_api_key and not cfg.encrypted_api_key:
            continue
        if cfg.provider == "openai_compatible" and not cfg.base_url:
            continue

        fallback_by_id = {m.model_id: m for m in spec.fallback_models}
        model_ids = cfg.enabled_models or [m.model_id for m in spec.fallback_models]
        for model_id in model_ids:
            info = fallback_by_id.get(model_id) or _to_model_info(cfg.provider, model_id)
            discovered.append(
                DiscoveredModelOut(
                    provider=info.provider,
                    provider_label=info.provider_label,
                    model_id=info.model_id,
                    display_name=info.display_name,
                    supports_thinking=info.supports_thinking,
                    thinking_efforts=list(info.thinking_efforts),
                )
            )

    ws = db.get(WorkspaceSettings, "default")
    allow_auto = ws.allow_auto_review if ws else True
    default_mode = ws.default_review_mode if ws else "manual"
    if not allow_auto and default_mode == "auto":
        default_mode = "manual"

    return ModelDiscoveryResponse(
        models=discovered,
        allow_auto_review=allow_auto,
        default_review_mode=default_mode,  # type: ignore[arg-type]
        default_provider=ws.default_provider if ws else "mock",
        default_model=ws.default_model if ws else "nyxora-mock-v1",
        default_thinking_effort=(ws.default_thinking_effort if ws else "medium"),  # type: ignore[arg-type]
    )
