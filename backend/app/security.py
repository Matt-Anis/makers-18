import hashlib
import secrets

from pwdlib import PasswordHash

_password_hash = PasswordHash.recommended()
# Precomputed dummy hash used to avoid timing differences when an account is missing.
_DUMMY_HASH = _password_hash.hash("dummy-timing-guard-password")


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id."""
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a plaintext password against an Argon2id hash."""
    return _password_hash.verify(password, password_hash)


def verify_dummy_password(password: str) -> None:
    """Perform a dummy verification to equalize timing on unknown emails."""
    _password_hash.verify(password, _DUMMY_HASH)


def generate_session_token() -> str:
    """Generate a high-entropy opaque session token."""
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    """Return the SHA-256 hex digest of a raw session token."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
