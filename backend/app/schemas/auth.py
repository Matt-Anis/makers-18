from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import UserRole


def _normalize_email(value: str) -> str:
    normalized = value.strip().lower()
    if "@" not in normalized or len(normalized) < 3:
        raise ValueError("Invalid email address")
    return normalized


class LoginRequest(BaseModel):
    """Credentials submitted to establish a user auth session."""

    email: str
    password: str = Field(min_length=1, max_length=256)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _normalize_email(value)


class CreateUserRequest(BaseModel):
    """Admin-only payload to provision a workspace account."""

    email: str
    full_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=256)
    role: UserRole = UserRole.REQUESTER

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _normalize_email(value)

    @field_validator("full_name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Full name must not be blank")
        return cleaned


class UserOut(BaseModel):
    """Public user profile returned to authenticated clients."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: str
    role: UserRole
    is_active: bool
