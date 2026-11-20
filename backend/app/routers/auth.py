from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import extract_session_token, get_current_user, require_roles
from app.config import Settings, get_settings
from app.db import get_db
from app.models import AuditLog, AuthSession, User, UserRole, utcnow
from app.schemas.auth import CreateUserRequest, LoginRequest, UserOut
from app.security import (
    generate_session_token,
    hash_password,
    hash_session_token,
    verify_dummy_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=UserOut)
def login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    """Authenticate a user and set an HttpOnly session cookie."""
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None:
        verify_dummy_password(payload.password)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    raw_token = generate_session_token()
    now = utcnow()
    auth_session = AuthSession(
        token_hash=hash_session_token(raw_token),
        user_id=user.id,
        created_at=now,
        expires_at=now + timedelta(seconds=settings.auth_session_ttl_seconds),
    )
    db.add(auth_session)
    db.add(AuditLog(user_id=user.id, action="auth.login"))
    db.commit()

    response.set_cookie(
        key=settings.auth_cookie_name,
        value=raw_token,
        max_age=settings.auth_session_ttl_seconds,
        httponly=True,
        samesite="lax",
        secure=settings.auth_cookie_secure,
        path="/",
    )
    return user


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict[str, str]:
    """Revoke the current auth session (if present) and clear the session cookie."""
    raw_token = extract_session_token(request, settings)
    if raw_token:
        token_hash = hash_session_token(raw_token)
        auth_session = db.scalar(select(AuthSession).where(AuthSession.token_hash == token_hash))
        if auth_session is not None and auth_session.revoked_at is None:
            auth_session.revoked_at = utcnow()
            db.add(AuditLog(user_id=auth_session.user_id, action="auth.logout"))
            db.commit()

    response.delete_cookie(
        key=settings.auth_cookie_name,
        path="/",
        httponly=True,
        samesite="lax",
        secure=settings.auth_cookie_secure,
    )
    return {"status": "ok"}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> User:
    """Return the authenticated user's profile."""
    return current_user


@router.get("/users", response_model=list[UserOut])
def list_users(
    _owner: User = Depends(require_roles(UserRole.OWNER)),
    db: Session = Depends(get_db),
) -> list[User]:
    """List provisioned accounts (owner only)."""
    return list(db.scalars(select(User).order_by(User.created_at.asc())))


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: CreateUserRequest,
    _owner: User = Depends(require_roles(UserRole.OWNER)),
    db: Session = Depends(get_db),
) -> User:
    """Provision a new workspace account (owner only; no public self-registration)."""
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        role=payload.role.value,
        password_hash=hash_password(payload.password),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
