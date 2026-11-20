from datetime import datetime, timezone
from enum import StrEnum
import uuid

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utcnow() -> datetime:
    """Return the current timezone-aware UTC timestamp."""
    return datetime.now(timezone.utc)


def new_uuid() -> str:
    """Return a string UUID4 identifier."""
    return str(uuid.uuid4())


class UserRole(StrEnum):
    """Role assigned to an authenticated workspace user."""

    OWNER = "owner"
    USER = "user"


class GatewaySessionStatus(StrEnum):
    """Lifecycle status of a contract privacy gateway session."""

    ACTIVE = "active"
    ENDED = "ended"


class User(Base):
    """Registered company user allowed to access the gateway."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default=UserRole.USER.value)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    auth_sessions: Mapped[list["AuthSession"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    gateway_sessions: Mapped[list["GatewaySession"]] = relationship(
        back_populates="owner",
        cascade="all, delete-orphan",
    )


class AuthSession(Base):
    """Server-side login session storing only a SHA-256 hash of the cookie token."""

    __tablename__ = "auth_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[User] = relationship(back_populates="auth_sessions")


class GatewaySession(Base):
    """Contract review workspace owned by a user; never stores raw PII or vault mappings."""

    __tablename__ = "gateway_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    owner_user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False, default="Contract review")
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=GatewaySessionStatus.ACTIVE.value,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    owner: Mapped[User] = relationship(back_populates="gateway_sessions")
    masked_messages: Mapped[list["MaskedMessage"]] = relationship(
        back_populates="gateway_session",
        cascade="all, delete-orphan",
        order_by="MaskedMessage.created_at.asc()",
    )


class MaskedMessage(Base):
    """Persisted masked conversation turn for crash recovery (never raw unmasked text)."""

    __tablename__ = "masked_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    gateway_session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("gateway_sessions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    masked_content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    gateway_session: Mapped[GatewaySession] = relationship(back_populates="masked_messages")


class SessionVaultSnapshot(Base):
    """Encrypted vault backup in SQLite so multi-week sessions survive Redis TTL."""

    __tablename__ = "session_vault_snapshots"

    gateway_session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("gateway_sessions.id", ondelete="CASCADE"),
        primary_key=True,
    )
    encrypted_blob: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class PendingReview(Base):
    """Awaiting Accept/Reject human review; payload is Fernet-encrypted at rest."""

    __tablename__ = "pending_reviews"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    gateway_session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("gateway_sessions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    owner_user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    model: Mapped[str] = mapped_column(String(128), nullable=False)
    thinking_effort: Mapped[str] = mapped_column(String(16), nullable=False, default="medium")
    encrypted_payload: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AuditLog(Base):
    """Metadata-only audit record; never stores raw text, prompts, or vault mappings."""

    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    gateway_session_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)
    action: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    approved: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    entity_counts: Mapped[dict[str, int] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False, default=utcnow)


class ProviderConfig(Base):
    """Owner-configured external AI provider settings with Fernet-encrypted API key."""

    __tablename__ = "provider_configs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    provider: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    encrypted_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    key_hint: Mapped[str | None] = mapped_column(String(32), nullable=True)
    base_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    enabled_models: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class WorkspaceSettings(Base):
    """Singleton workspace settings managed by the Owner (modes, defaults, rulebook)."""

    __tablename__ = "workspace_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default="default")
    allow_auto_review: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    default_review_mode: Mapped[str] = mapped_column(String(16), nullable=False, default="manual")
    default_provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    default_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    default_thinking_effort: Mapped[str] = mapped_column(String(16), nullable=False, default="medium")
    rulebook_prompt: Mapped[str] = mapped_column(Text, nullable=False, default="")
    gpu_llm_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    gpu_llm_endpoint: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class CustomRule(Base):
    """Company-specific keyword or regex rule managed by the Owner."""

    __tablename__ = "custom_rules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    pattern: Mapped[str] = mapped_column(String(255), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False, default="CUSTOM")
    is_regex: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by_user_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
