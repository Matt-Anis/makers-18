from pathlib import Path
import re

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import require_roles
from app.db import get_db
from app.detection.pipeline import VALID_ENTITY_TYPES
from app.models import AuditLog, CustomRule, User, UserRole, WorkspaceSettings, utcnow
from app.schemas.settings import (
    CustomRuleCreate,
    CustomRuleOut,
    CustomRuleUpdate,
    MarkdownRulesImportOut,
)

router = APIRouter(prefix="/rules", tags=["rules"])

MAX_RULES_MD_BYTES = 1 * 1024 * 1024  # 1 MB
_CUSTOM_RULES_HEADING_RE = re.compile(r"^#{1,3}\s*custom\s+rules\b", flags=re.IGNORECASE)
_ANY_HEADING_RE = re.compile(r"^#{1,6}\s+")
_RULE_BULLET_RE = re.compile(r"^\s*[-*]\s+(.+?)\s*\|\s*([A-Za-z]+)(?:\s*\|\s*(regex|literal))?\s*$", flags=re.IGNORECASE)


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


def parse_rules_markdown(content: str) -> tuple[list[tuple[str, str, bool]], str]:
    """
    Parse a Markdown privacy policy file into:
      1) Structured Layer 1 custom rules: `- pattern | ENTITY_TYPE` or ``- `regex` | ENTITY_TYPE | regex``
      2) Plain-English SLM rulebook instructions from all remaining lines.
    """
    parsed_rules: list[tuple[str, str, bool]] = []
    rulebook_lines: list[str] = []
    in_custom_rules_section = False

    for raw_line in content.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        stripped = raw_line.strip()
        if _CUSTOM_RULES_HEADING_RE.match(stripped):
            in_custom_rules_section = True
            continue
        if _ANY_HEADING_RE.match(stripped):
            in_custom_rules_section = False
            rulebook_lines.append(raw_line)
            continue

        bullet_match = _RULE_BULLET_RE.match(raw_line)
        if bullet_match:
            raw_pattern = bullet_match.group(1).strip()
            raw_type = bullet_match.group(2).strip().upper()
            raw_mode = (bullet_match.group(3) or "").strip().lower()
            if raw_type in VALID_ENTITY_TYPES:
                if len(raw_pattern) >= 2 and raw_pattern.startswith("`") and raw_pattern.endswith("`"):
                    raw_pattern = raw_pattern[1:-1].strip()
                if not raw_pattern:
                    continue
                is_regex = raw_mode == "regex"
                _validate_regex(raw_pattern, is_regex)
                parsed_rules.append((raw_pattern[:255], raw_type, is_regex))
                continue

        if not in_custom_rules_section:
            rulebook_lines.append(raw_line)

    rulebook_text = re.sub(r"\n{3,}", "\n\n", "\n".join(rulebook_lines)).strip()[:8000]
    return parsed_rules, rulebook_text


@router.post("/import-markdown", response_model=MarkdownRulesImportOut)
async def import_rules_markdown(
    file: UploadFile = File(...),
    owner: User = Depends(require_roles(UserRole.OWNER)),
    db: Session = Depends(get_db),
) -> MarkdownRulesImportOut:
    """Import Layer 1 custom rules and/or Layer 2/3 SLM rulebook from a Markdown (.md) file."""
    safe_name = Path(file.filename or "rules.md").name
    ext = Path(safe_name).suffix.lower()
    if ext not in {".md", ".markdown", ".txt"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Upload a .md, .markdown, or .txt rules file.",
        )

    data = await file.read(MAX_RULES_MD_BYTES + 1)
    await file.close()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded Markdown file is empty.",
        )
    if len(data) > MAX_RULES_MD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Markdown rules file exceeds the 1 MB size limit.",
        )

    try:
        content = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        content = data.decode("latin-1", errors="replace")

    parsed_rules, rulebook_text = parse_rules_markdown(content)
    if not parsed_rules and not rulebook_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No custom rules or rulebook instructions found in Markdown file.",
        )

    existing_keys = {
        (row.pattern.lower(), row.entity_type, row.is_regex)
        for row in db.scalars(select(CustomRule))
    }

    created_rows: list[CustomRule] = []
    skipped_existing = 0
    for pattern, entity_type, is_regex in parsed_rules:
        key = (pattern.lower(), entity_type, is_regex)
        if key in existing_keys:
            skipped_existing += 1
            continue
        existing_keys.add(key)
        row = CustomRule(
            pattern=pattern,
            entity_type=entity_type,
            is_regex=is_regex,
            enabled=True,
            created_by_user_id=owner.id,
        )
        db.add(row)
        created_rows.append(row)

    rulebook_updated = False
    settings_row = db.get(WorkspaceSettings, "default")
    if settings_row is None:
        settings_row = WorkspaceSettings(id="default")
        db.add(settings_row)
    if rulebook_text:
        settings_row.rulebook_prompt = rulebook_text
        settings_row.updated_at = utcnow()
        rulebook_updated = True

    db.add(
        AuditLog(
            user_id=owner.id,
            action="rules.imported_markdown",
            entity_counts={
                "created": len(created_rows),
                "skipped_existing": skipped_existing,
                "rulebook_updated": 1 if rulebook_updated else 0,
            },
        )
    )
    db.commit()
    for row in created_rows:
        db.refresh(row)

    return MarkdownRulesImportOut(
        filename=safe_name,
        created_rules=[CustomRuleOut.model_validate(row) for row in created_rows],
        skipped_existing_count=skipped_existing,
        rulebook_updated=rulebook_updated,
        rulebook_prompt=settings_row.rulebook_prompt,
    )
