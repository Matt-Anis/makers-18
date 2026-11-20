from datetime import datetime

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
    """Masked chat message returned for session recovery."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    role: str
    masked_content: str
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


class GatewaySessionDetailOut(GatewaySessionOut):
    """Gateway session metadata plus masked message history and vault status."""

    vault_active: bool
    masked_messages: list[MaskedMessageOut]


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
