from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import GatewaySessionStatus


class CreateGatewaySessionRequest(BaseModel):
    """Payload to start a new contract privacy gateway session."""

    provider: str = Field(min_length=1, max_length=64)
    title: str = Field(default="Contract review", min_length=1, max_length=160)

    @field_validator("provider", "title")
    @classmethod
    def strip_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Value must not be blank")
        return cleaned


class MaskedMessageOut(BaseModel):
    """Chat message returned for session recovery (unmasked on the fly when vault exists)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    role: str
    masked_content: str
    unmasked_content: str
    created_at: datetime


class GatewaySessionOut(BaseModel):
    """Gateway session metadata returned to its owner."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_user_id: str
    title: str
    provider: str
    status: GatewaySessionStatus
    created_at: datetime
    updated_at: datetime
    expires_at: datetime
    ended_at: datetime | None = None


class FindingOut(BaseModel):
    """Detected sensitive span shown to the user before send."""

    id: str
    type: str
    text: str
    start: int
    end: int
    source: str
    confidence: float
    placeholder: str


class PendingReviewOut(BaseModel):
    """Active awaiting-approval review returned when reloading a session."""

    review_id: str
    provider: str
    model: str
    thinking_effort: str
    raw_text: str
    findings: list[FindingOut]
    masked_preview: str
    created_at: datetime


class GatewaySessionDetailOut(GatewaySessionOut):
    """Gateway session metadata plus masked message history, vault status, and active review."""

    vault_active: bool
    masked_messages: list[MaskedMessageOut]
    pending_review: PendingReviewOut | None = None


class AuditLogOut(BaseModel):
    """Metadata-only audit entry."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str | None
    gateway_session_id: str | None
    action: str
    provider: str | None
    approved: bool | None
    entity_counts: dict[str, int] | None
    created_at: datetime


class SendMessageRequest(BaseModel):
    """Payload to filter and optionally hold or dispatch a user message."""

    content: str = Field(min_length=1, max_length=50000)
    provider: str | None = Field(default=None, max_length=64)
    model: str | None = Field(default=None, max_length=128)
    thinking_effort: Literal["low", "medium", "high"] | None = None
    mode: Literal["manual", "auto"] | None = None

    @field_validator("content")
    @classmethod
    def validate_non_blank_content(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Message content must not be blank")
        return value


class SendMessageResponse(BaseModel):
    """Response for both held ('needs_review') and dispatched ('sent') turns."""

    status: Literal["needs_review", "sent"]
    review_id: str | None = None
    provider: str
    model: str
    thinking_effort: str
    findings: list[FindingOut] = Field(default_factory=list)
    masked_preview: str | None = None
    user_message: MaskedMessageOut | None = None
    assistant_message: MaskedMessageOut | None = None


class ReviewRejectResponse(BaseModel):
    """Response returned when a pending review is denied by the user."""

    status: Literal["rejected"]
    review_id: str


class VaultIndexEntryOut(BaseModel):
    """Single indexed entry from a user's own per-session redaction vault."""

    index: int
    placeholder: str
    entity_type: str
    original_value: str
    occurrences: int


class SessionInspectorOut(BaseModel):
    """Owner-scoped privacy inspector snapshot: obfuscated messages, token index, and cipher proof."""

    session_id: str
    title: str
    provider: str
    status: GatewaySessionStatus
    vault_active: bool
    redis_cached: bool
    snapshot_persisted: bool
    ephemeral_only: bool
    expires_at: datetime
    cipher_preview: str | None = None
    cipher_bytes: int = 0
    entry_count: int = 0
    entries: list[VaultIndexEntryOut] = Field(default_factory=list)
    messages: list[MaskedMessageOut] = Field(default_factory=list)

