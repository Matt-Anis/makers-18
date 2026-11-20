from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import require_roles
from app.db import get_db
from app.models import AuditLog, User, UserRole
from app.schemas.sessions import AuditLogOut

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=list[AuditLogOut])
def list_audit_logs(
    limit: int = Query(default=50, ge=1, le=200),
    _owner: User = Depends(require_roles(UserRole.OWNER)),
    db: Session = Depends(get_db),
) -> list[AuditLog]:
    """Return recent metadata-only audit log entries (owner only)."""
    return list(
        db.scalars(
            select(AuditLog)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
        )
    )
