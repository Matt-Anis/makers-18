from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models import CustomRule, ProviderConfig, User, UserRole, WorkspaceSettings
from app.security import hash_password

DEMO_USERS = (
    ("owner@acme.local", "Workspace Owner", UserRole.OWNER, "demo-owner-pass"),
    ("user@acme.local", "Anis User", UserRole.USER, "demo-user-pass"),
)

LEGACY_ROLE_MAP = {
    "admin": UserRole.OWNER.value,
    "reviewer": UserRole.USER.value,
    "requester": UserRole.USER.value,
}


def normalize_legacy_roles(db: Session) -> None:
    """Migrate legacy 3-role values (admin/reviewer/requester) to owner/user."""
    changed = False
    for old_role, new_role in LEGACY_ROLE_MAP.items():
        result = db.execute(
            update(User).where(User.role == old_role).values(role=new_role)
        )
        if result.rowcount:
            changed = True
    if changed:
        db.commit()


def ensure_default_workspace_settings(db: Session) -> None:
    """Create the singleton workspace_settings and local_mock provider defaults if missing."""
    settings_row = db.get(WorkspaceSettings, "default")
    if settings_row is None:
        db.add(
            WorkspaceSettings(
                id="default",
                allow_auto_review=True,
                default_review_mode="manual",
                default_provider="mock",
                default_model="nyxora-mock-v1",
                default_thinking_effort="medium",
                rulebook_prompt=(
                    "Flag any remaining personal names, company identifiers, national/tax IDs, "
                    "bank accounts, phone numbers, email addresses, or confidential project codenames."
                ),
                gpu_llm_enabled=False,
            )
        )

    mock_provider = db.scalar(select(ProviderConfig).where(ProviderConfig.provider == "mock"))
    if mock_provider is None:
        db.add(
            ProviderConfig(
                provider="mock",
                enabled=True,
                enabled_models=["nyxora-mock-v1"],
            )
        )

    if (db.scalar(select(func.count(CustomRule.id))) or 0) == 0:
        db.add_all(
            [
                CustomRule(pattern="APOLLO-X", entity_type="CUSTOM", is_regex=False, enabled=True),
                CustomRule(pattern=r"\b\d{15}\b", entity_type="ID", is_regex=True, enabled=True),
            ]
        )

    db.commit()


def seed_demo_users(db: Session) -> None:
    """Populate deterministic demo accounts only when the users table is empty."""
    existing_count = db.scalar(select(func.count(User.id))) or 0
    if existing_count > 0:
        return

    for email, full_name, role, password in DEMO_USERS:
        db.add(
            User(
                email=email,
                full_name=full_name,
                role=role.value,
                password_hash=hash_password(password),
                is_active=True,
            )
        )
    db.commit()
