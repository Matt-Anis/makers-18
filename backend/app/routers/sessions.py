from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import ensure_utc, get_current_user
from app.config import Settings, get_settings
from app.db import get_db
from app.models import AuditLog, GatewaySession, GatewaySessionStatus, User, utcnow
from app.schemas.sessions import (
    CreateGatewaySessionRequest,
    GatewaySessionDetailOut,
    GatewaySessionOut,
)
from app.vault.store import VaultData, VaultStore, get_vault_store

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
    """Create a user-owned gateway session and initialize its encrypted ephemeral vault."""
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

    vault_store.save(gateway_session.id, VaultData(), ttl_seconds=settings.vault_ttl_seconds)

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
    return [item for item in sessions if ensure_utc(item.expires_at) > now]


@router.get("/{session_id}", response_model=GatewaySessionDetailOut)
def get_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    vault_store: VaultStore = Depends(get_vault_store),
) -> GatewaySessionDetailOut:
    """Fetch a single gateway session owned by the current user along with masked history."""
    gateway_session = _get_owned_session(
        db,
        session_id,
        current_user.id,
        with_messages=True,
    )
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
        vault_active=vault_store.exists(gateway_session.id),
        masked_messages=gateway_session.masked_messages,
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
    vault_store.delete(gateway_session.id)

    now = utcnow()
    gateway_session.status = GatewaySessionStatus.ENDED.value
    gateway_session.ended_at = now
    gateway_session.updated_at = now
    gateway_session.masked_messages.clear()

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
