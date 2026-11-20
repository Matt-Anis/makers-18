from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import User, UserRole
from app.security import hash_password

DEMO_USERS = (
    ("admin@acme.local", "Admin User", UserRole.ADMIN, "demo-admin-pass"),
    ("reviewer@acme.local", "Samira Reviewer", UserRole.REVIEWER, "demo-reviewer-pass"),
    ("requester@acme.local", "Anis Requester", UserRole.REQUESTER, "demo-requester-pass"),
)


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
