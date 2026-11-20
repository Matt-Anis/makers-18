from datetime import datetime
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

ProviderId = Literal["openai", "anthropic", "gemini", "openai_compatible", "mock"]
ReviewMode = Literal["manual", "auto"]
ThinkingEffort = Literal["low", "medium", "high"]
EntityType = Literal["PERSON", "COMPANY", "EMAIL", "PHONE", "ADDRESS", "ID", "BANK", "CUSTOM"]


class ProviderConfigUpsert(BaseModel):
    """Owner payload to configure a provider's encrypted API key and enabled models."""

    api_key: str | None = Field(default=None, max_length=512)
    clear_api_key: bool = False
    base_url: str | None = Field(default=None, max_length=255)
    enabled: bool = True
    enabled_models: list[str] = Field(default_factory=list)

    @field_validator("base_url")
    @classmethod
    def clean_base_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("enabled_models")
    @classmethod
    def dedupe_models(cls, values: list[str]) -> list[str]:
        seen: set[str] = set()
        result: list[str] = []
        for item in values:
            cleaned = item.strip()
            if cleaned and cleaned not in seen:
                seen.add(cleaned)
                result.append(cleaned)
        return result


class ProviderConfigOut(BaseModel):
    """Safe provider configuration view for the Owner (never returns the raw API key)."""

    provider: str
    label: str
    requires_api_key: bool
    is_configured: bool
    key_hint: str | None = None
    base_url: str | None = None
    enabled: bool
    enabled_models: list[str]
    updated_at: datetime | None = None


class DiscoveredModelOut(BaseModel):
    """Normalized model entry returned by discovery endpoints."""

    provider: str
    provider_label: str
    model_id: str
    display_name: str
    supports_thinking: bool
    thinking_efforts: list[str]


class ProviderDiscoveryResult(BaseModel):
    """Owner-triggered live/fallback discovery response for a single provider."""

    provider: str
    source: Literal["live", "fallback"]
    models: list[DiscoveredModelOut]


class ModelDiscoveryResponse(BaseModel):
    """Enabled models and workspace defaults exposed to authenticated chat users."""

    models: list[DiscoveredModelOut]
    allow_auto_review: bool
    default_review_mode: ReviewMode
    default_provider: str | None
    default_model: str | None
    default_thinking_effort: ThinkingEffort


class WorkspaceSettingsUpdate(BaseModel):
    """Owner payload to update review defaults and local rulebook settings."""

    allow_auto_review: bool = True
    default_review_mode: ReviewMode = "manual"
    default_provider: str | None = Field(default=None, max_length=64)
    default_model: str | None = Field(default=None, max_length=128)
    default_thinking_effort: ThinkingEffort = "medium"
    rulebook_prompt: str = Field(default="", max_length=8000)
    gpu_llm_enabled: bool = False
    gpu_llm_endpoint: str | None = Field(default=None, max_length=255)

    @field_validator("gpu_llm_endpoint")
    @classmethod
    def clean_endpoint(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class WorkspaceSettingsOut(BaseModel):
    """Workspace defaults and rulebook configuration returned to the Owner."""

    model_config = ConfigDict(from_attributes=True)

    allow_auto_review: bool
    default_review_mode: ReviewMode
    default_provider: str | None
    default_model: str | None
    default_thinking_effort: ThinkingEffort
    rulebook_prompt: str
    gpu_llm_enabled: bool
    gpu_llm_endpoint: str | None
    updated_at: datetime


class CustomRuleCreate(BaseModel):
    """Payload to create a company-specific keyword or regex rule."""

    pattern: str = Field(min_length=1, max_length=255)
    entity_type: EntityType = "CUSTOM"
    is_regex: bool = False
    enabled: bool = True

    @field_validator("pattern")
    @classmethod
    def strip_pattern(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Pattern must not be blank")
        return cleaned

    def validate_regex_if_needed(self) -> None:
        if self.is_regex:
            try:
                re.compile(self.pattern)
            except re.error as exc:
                raise ValueError(f"Invalid regular expression: {exc}") from exc


class CustomRuleUpdate(BaseModel):
    """Partial update payload for an existing custom rule."""

    pattern: str | None = Field(default=None, min_length=1, max_length=255)
    entity_type: EntityType | None = None
    is_regex: bool | None = None
    enabled: bool | None = None

    @field_validator("pattern")
    @classmethod
    def strip_pattern(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Pattern must not be blank")
        return cleaned


class CustomRuleOut(BaseModel):
    """Custom detection rule returned to the Owner."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    pattern: str
    entity_type: str
    is_regex: bool
    enabled: bool
    created_at: datetime
