import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import require_roles
from app.db import get_db
from app.models import AuditLog, CustomRule, User, UserRole
from app.schemas.settings import CustomRuleCreate, CustomRuleOut, CustomRuleUpdate

router = APIRouter(prefix="/rules", tags=["rules"])


def _validate_regex(pattern: str, is_regex: bool) -> None:
    if not is_regex:
        return
    try:
        re.compile(pattern)
    except re.error as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid regular expression: {exc}",
        ) from exc


@router.get("", response_model=list[CustomRuleOut])
def list_rules(
    _owner: User = Depends(require_roles(UserRole.OWNER)),
    db: Session = Depends(get_db),
) -> list[CustomRule]:
    """List company custom detection rules (owner only)."""
    return list(db.scalars(select(CustomRule).order_by(CustomRule.created_at.desc())))


@router.post("", response_model=CustomRuleOut, status_code=status.HTTP_201_CREATED)
def create_rule(
    payload: CustomRuleCreate,
    owner: User = Depends(require_roles(UserRole.OWNER)),
    db: Session = Depends(get_db),
) -> CustomRule:
    """Create a custom detection rule (owner only)."""
    _validate_regex(payload.pattern, payload.is_regex)

    rule = CustomRule(
        pattern=payload.pattern,
        entity_type=payload.entity_type,
        is_regex=payload.is_regex,
        enabled=payload.enabled,
        created_by_user_id=owner.id,
    )
    db.add(rule)
    db.add(AuditLog(user_id=owner.id, action="rules.created"))
    db.commit()
    db.refresh(rule)
    return rule


@router.patch("/{rule_id}", response_model=CustomRuleOut)
def update_rule(
    rule_id: str,
    payload: CustomRuleUpdate,
    owner: User = Depends(require_roles(UserRole.OWNER)),
    db: Session = Depends(get_db),
) -> CustomRule:
    """Update or toggle an existing custom detection rule (owner only)."""
    rule = db.get(CustomRule, rule_id)
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")

    next_pattern = payload.pattern if payload.pattern is not None else rule.pattern
    next_is_regex = payload.is_regex if payload.is_regex is not None else rule.is_regex
    _validate_regex(next_pattern, next_is_regex)

    rule.pattern = next_pattern
    rule.is_regex = next_is_regex
    if payload.entity_type is not None:
        rule.entity_type = payload.entity_type
    if payload.enabled is not None:
        rule.enabled = payload.enabled

    db.add(AuditLog(user_id=owner.id, action="rules.updated"))
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/{rule_id}")
def delete_rule(
    rule_id: str,
    owner: User = Depends(require_roles(UserRole.OWNER)),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Delete a custom detection rule (owner only)."""
    rule = db.get(CustomRule, rule_id)
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")

    db.delete(rule)
    db.add(AuditLog(user_id=owner.id, action="rules.deleted"))
    db.commit()
    return {"status": "deleted"}
