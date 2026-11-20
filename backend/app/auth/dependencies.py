from collections.abc import Callable
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.config import Settings, get_settings
from app.db import get_db
from app.models import AuthSession, User, UserRole, utcnow
from app.security import hash_session_token


def ensure_utc(dt: datetime) -> datetime:
    """Attach UTC tzinfo when SQLite returns naive datetimes."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def extract_session_token(request: Request, settings: Settings) -> str | None:
    """Read an auth token from the HttpOnly cookie or Authorization Bearer header."""
    cookie_token = request.cookies.get(settings.auth_cookie_name)
    if cookie_token:
        return cookie_token

    auth_header = request.headers.get("Authorization", "")
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
        if token:
            return token
    return None


def get_current_auth_session(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthSession:
    """Resolve and validate the active server-side AuthSession for the request."""
    raw_token = extract_session_token(request, settings)
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    token_hash = hash_session_token(raw_token)
    auth_session = db.scalar(
        select(AuthSession)
        .options(joinedload(AuthSession.user))
        .where(AuthSession.token_hash == token_hash)
    )
    if auth_session is None or auth_session.revoked_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked session",
        )

    if ensure_utc(auth_session.expires_at) <= utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired",
        )

    if not auth_session.user or not auth_session.user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account inactive",
        )

    return auth_session


def get_current_user(
    auth_session: AuthSession = Depends(get_current_auth_session),
) -> User:
    """Return the authenticated User for the current request."""
    return auth_session.user


def require_roles(*allowed_roles: UserRole) -> Callable[[User], User]:
    """Build a dependency restricting access to users holding one of allowed_roles."""
    allowed = {role.value for role in allowed_roles}

    def _check_role(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return _check_role
