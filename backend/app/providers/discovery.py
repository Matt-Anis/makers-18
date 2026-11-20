from dataclasses import dataclass
import logging

import httpx

logger = logging.getLogger(__name__)

THINKING_EFFORTS = ["low", "medium", "high"]


@dataclass(frozen=True)
class ModelInfo:
    """Normalized model metadata returned by provider discovery."""

    provider: str
    provider_label: str
    model_id: str
    display_name: str
    supports_thinking: bool = False
    thinking_efforts: tuple[str, ...] = ()


@dataclass(frozen=True)
class ProviderSpec:
    """Static metadata and fallback catalog for a supported provider."""

    id: str
    label: str
    requires_api_key: bool
    fallback_models: tuple[ModelInfo, ...]


PROVIDER_CATALOG: dict[str, ProviderSpec] = {
    "openai": ProviderSpec(
        id="openai",
        label="OpenAI",
        requires_api_key=True,
        fallback_models=(
            ModelInfo("openai", "OpenAI", "gpt-4o", "GPT-4o", False, ()),
            ModelInfo("openai", "OpenAI", "gpt-4.1", "GPT-4.1", False, ()),
            ModelInfo("openai", "OpenAI", "o3-mini", "o3-mini", True, tuple(THINKING_EFFORTS)),
        ),
    ),
    "anthropic": ProviderSpec(
        id="anthropic",
        label="Anthropic",
        requires_api_key=True,
        fallback_models=(
            ModelInfo(
                "anthropic",
                "Anthropic",
                "claude-3-7-sonnet-latest",
                "Claude 3.7 Sonnet",
                True,
                tuple(THINKING_EFFORTS),
            ),
            ModelInfo(
                "anthropic",
                "Anthropic",
                "claude-3-5-sonnet-latest",
                "Claude 3.5 Sonnet",
                False,
                (),
            ),
            ModelInfo(
                "anthropic",
                "Anthropic",
                "claude-3-5-haiku-latest",
                "Claude 3.5 Haiku",
                False,
                (),
            ),
        ),
    ),
    "gemini": ProviderSpec(
        id="gemini",
        label="Google Gemini",
        requires_api_key=True,
        fallback_models=(
            ModelInfo(
                "gemini",
                "Google Gemini",
                "gemini-2.5-pro",
                "Gemini 2.5 Pro",
                True,
                tuple(THINKING_EFFORTS),
            ),
            ModelInfo(
                "gemini",
                "Google Gemini",
                "gemini-2.5-flash",
                "Gemini 2.5 Flash",
                True,
                tuple(THINKING_EFFORTS),
            ),
        ),
    ),
    "openai_compatible": ProviderSpec(
        id="openai_compatible",
        label="OpenAI-Compatible",
        requires_api_key=False,
        fallback_models=(),
    ),
    "mock": ProviderSpec(
        id="mock",
        label="Local Mock Provider",
        requires_api_key=False,
        fallback_models=(
            ModelInfo(
                "mock",
                "Local Mock Provider",
                "nyxora-mock-v1",
                "NYXORA Mock Model",
                True,
                tuple(THINKING_EFFORTS),
            ),
        ),
    ),
}


def _supports_thinking(provider: str, model_id: str) -> bool:
    lowered = model_id.lower()
    if provider == "openai":
        return lowered.startswith(("o1", "o3", "o4", "gpt-5"))
    if provider == "anthropic":
        return "3-7" in lowered or "sonnet-4" in lowered or "opus-4" in lowered
    if provider == "gemini":
        return "2.5" in lowered or "thinking" in lowered
    if provider == "mock":
        return True
    return False


def _to_model_info(provider: str, model_id: str, display_name: str | None = None) -> ModelInfo:
    spec = PROVIDER_CATALOG[provider]
    thinking = _supports_thinking(provider, model_id)
    return ModelInfo(
        provider=provider,
        provider_label=spec.label,
        model_id=model_id,
        display_name=display_name or model_id,
        supports_thinking=thinking,
        thinking_efforts=tuple(THINKING_EFFORTS) if thinking else (),
    )


def discover_provider_models(
    provider: str,
    api_key: str | None = None,
    base_url: str | None = None,
) -> tuple[list[ModelInfo], str]:
    """
    Query a provider's live models endpoint when credentials/URL are available,
    falling back gracefully to the curated catalog when offline or unconfigured.
    Returns (models, source) where source is 'live' or 'fallback'.
    """
    spec = PROVIDER_CATALOG.get(provider)
    if spec is None:
        return [], "fallback"

    if provider == "mock":
        return list(spec.fallback_models), "live"

    if spec.requires_api_key and not api_key:
        return list(spec.fallback_models), "fallback"

    try:
        if provider == "openai":
            url = f"{(base_url or 'https://api.openai.com/v1').rstrip('/')}/models"
            resp = httpx.get(url, headers={"Authorization": f"Bearer {api_key}"}, timeout=5.0)
            resp.raise_for_status()
            ids = sorted(
                item["id"]
                for item in resp.json().get("data", [])
                if isinstance(item, dict)
                and isinstance(item.get("id"), str)
                and item["id"].startswith(("gpt-", "o1", "o3", "o4"))
            )
            if ids:
                return [_to_model_info("openai", mid) for mid in ids], "live"

        elif provider == "anthropic":
            url = f"{(base_url or 'https://api.anthropic.com/v1').rstrip('/')}/models"
            resp = httpx.get(
                url,
                headers={"x-api-key": api_key or "", "anthropic-version": "2023-06-01"},
                timeout=5.0,
            )
            resp.raise_for_status()
            models = [
                _to_model_info("anthropic", item["id"], item.get("display_name"))
                for item in resp.json().get("data", [])
                if isinstance(item, dict) and isinstance(item.get("id"), str)
            ]
            if models:
                return models, "live"

        elif provider == "gemini":
            url = f"{(base_url or 'https://generativelanguage.googleapis.com/v1beta').rstrip('/')}/models"
            resp = httpx.get(url, params={"key": api_key or ""}, timeout=5.0)
            resp.raise_for_status()
            models = []
            for item in resp.json().get("models", []):
                if not isinstance(item, dict):
                    continue
                methods = item.get("supportedGenerationMethods", [])
                if "generateContent" not in methods:
                    continue
                raw_name = str(item.get("name", ""))
                model_id = raw_name.removeprefix("models/")
                if model_id:
                    models.append(_to_model_info("gemini", model_id, item.get("displayName")))
            if models:
                return models, "live"

        elif provider == "openai_compatible" and base_url:
            url = f"{base_url.rstrip('/')}/models"
            headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
            resp = httpx.get(url, headers=headers, timeout=5.0)
            resp.raise_for_status()
            models = [
                _to_model_info("openai_compatible", item["id"])
                for item in resp.json().get("data", [])
                if isinstance(item, dict) and isinstance(item.get("id"), str)
            ]
            if models:
                return models, "live"
    except Exception as exc:  # noqa: BLE001 — network/provider errors fall back cleanly
        logger.warning("Live model discovery failed for %s: %s", provider, exc)

    return list(spec.fallback_models), "fallback"
