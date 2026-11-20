from functools import lru_cache
import hashlib
import logging
import secrets

from cryptography.fernet import Fernet
from pwdlib import PasswordHash

from app.config import get_settings

logger = logging.getLogger(__name__)

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


def build_fernet(fernet_key: str, app_env: str) -> Fernet:
    """Construct a Fernet cipher, requiring an explicit key in production."""
    if fernet_key:
        key_bytes = fernet_key.encode("utf-8")
    elif app_env == "production":
        raise RuntimeError("VAULT_ENCRYPTION_KEY must be set in production")
    else:
        logger.warning("VAULT_ENCRYPTION_KEY not set; generating ephemeral key for %s", app_env)
        key_bytes = Fernet.generate_key()
    return Fernet(key_bytes)


@lru_cache
def get_secret_fernet() -> Fernet:
    """Return the cached Fernet cipher for secrets at rest."""
    settings = get_settings()
    return build_fernet(settings.vault_encryption_key, settings.app_env)


def encrypt_secret(plaintext: str, fernet: Fernet) -> str:
    """Encrypt a sensitive string (such as a provider API key) for DB storage."""
    return fernet.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_secret(ciphertext: str, fernet: Fernet) -> str:
    """Decrypt a Fernet-encrypted secret string."""
    return fernet.decrypt(ciphertext.encode("utf-8")).decode("utf-8")


def mask_api_key(raw_key: str) -> str:
    """Return a non-sensitive suffix hint for an API key without exposing the secret."""
    cleaned = raw_key.strip()
    if len(cleaned) <= 4:
        return "••••"
    return f"••••{cleaned[-4:]}"
