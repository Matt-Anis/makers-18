from dataclasses import dataclass, field
from functools import lru_cache
import json
import re
import secrets
from typing import Protocol

import redis
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import SessionVaultSnapshot, utcnow
from app.security import build_fernet


@dataclass
class VaultData:
    """Per-session bidirectional mapping between real values and [TYPE_<6-hex>] tokens."""

    to_placeholder: dict[str, str] = field(default_factory=dict)
    to_real: dict[str, str] = field(default_factory=dict)

    def assign_placeholder(self, entity_type: str, real_text: str) -> str:
        """Return an existing placeholder for real_text or allocate a random 6-hex token."""
        normalized_type = entity_type.strip().upper()
        lookup_key = " ".join(real_text.strip().split()).lower()
        if lookup_key in self.to_placeholder:
            return self.to_placeholder[lookup_key]

        while True:
            placeholder = f"[{normalized_type}_{secrets.token_hex(3)}]"
            if placeholder not in self.to_real:
                break

        self.to_placeholder[lookup_key] = placeholder
        self.to_real[placeholder] = real_text.strip()
        return placeholder

    def unmask_text(self, masked_text: str) -> str:
        """Restore placeholders in masked_text using longest-match, case-insensitive lookup."""
        if not self.to_real or not masked_text:
            return masked_text

        ordered_placeholders = sorted(self.to_real.keys(), key=len, reverse=True)
        pattern = re.compile(
            "|".join(re.escape(placeholder) for placeholder in ordered_placeholders),
            flags=re.IGNORECASE,
        )
        lower_to_real = {k.lower(): v for k, v in self.to_real.items()}
        return pattern.sub(lambda match: lower_to_real[match.group(0).lower()], masked_text)

    def to_json_bytes(self) -> bytes:
        return json.dumps(
            {
                "to_placeholder": self.to_placeholder,
                "to_real": self.to_real,
            }
        ).encode("utf-8")

    @classmethod
    def from_json_bytes(cls, raw: bytes) -> "VaultData":
        payload = json.loads(raw.decode("utf-8"))
        return cls(
            to_placeholder=dict(payload.get("to_placeholder", {})),
            to_real=dict(payload.get("to_real", {})),
        )


class VaultCipher:
    """Encrypts and decrypts serialized vault payloads with Fernet symmetric encryption."""

    def __init__(self, fernet_key: str, app_env: str) -> None:
        self._fernet = build_fernet(fernet_key, app_env)

    def encrypt(self, vault: VaultData) -> bytes:
        return self._fernet.encrypt(vault.to_json_bytes())

    def decrypt(self, ciphertext: bytes) -> VaultData:
        return VaultData.from_json_bytes(self._fernet.decrypt(ciphertext))


class VaultStore(Protocol):
    """Storage interface for per-session encrypted redaction vaults."""

    def save(self, session_id: str, vault: VaultData, ttl_seconds: int) -> None: ...

    def load(self, session_id: str) -> VaultData | None: ...

    def delete(self, session_id: str) -> None: ...

    def exists(self, session_id: str) -> bool: ...

    def encrypt_bytes(self, vault: VaultData) -> str: ...

    def decrypt_bytes(self, ciphertext: str) -> VaultData: ...


class RedisVaultStore:
    """Stores Fernet-encrypted vaults in persistence-disabled Redis with TTL expiry."""

    def __init__(self, client: redis.Redis, cipher: VaultCipher) -> None:
        self._client = client
        self._cipher = cipher

    @staticmethod
    def _key(session_id: str) -> str:
        return f"vault:{session_id}"

    def save(self, session_id: str, vault: VaultData, ttl_seconds: int) -> None:
        ciphertext = self._cipher.encrypt(vault)
        self._client.set(self._key(session_id), ciphertext, ex=ttl_seconds)

    def load(self, session_id: str) -> VaultData | None:
        raw = self._client.get(self._key(session_id))
        if raw is None:
            return None
        return self._cipher.decrypt(raw)

    def delete(self, session_id: str) -> None:
        self._client.delete(self._key(session_id))

    def exists(self, session_id: str) -> bool:
        return bool(self._client.exists(self._key(session_id)))

    def encrypt_bytes(self, vault: VaultData) -> str:
        return self._cipher.encrypt(vault).decode("utf-8")

    def decrypt_bytes(self, ciphertext: str) -> VaultData:
        return self._cipher.decrypt(ciphertext.encode("utf-8"))


class InMemoryVaultStore:
    """In-memory encrypted vault store for unit tests without Redis."""

    def __init__(self, cipher: VaultCipher) -> None:
        self._cipher = cipher
        self.raw_entries: dict[str, bytes] = {}

    def save(self, session_id: str, vault: VaultData, ttl_seconds: int) -> None:
        self.raw_entries[session_id] = self._cipher.encrypt(vault)

    def load(self, session_id: str) -> VaultData | None:
        raw = self.raw_entries.get(session_id)
        if raw is None:
            return None
        return self._cipher.decrypt(raw)

    def delete(self, session_id: str) -> None:
        self.raw_entries.pop(session_id, None)

    def exists(self, session_id: str) -> bool:
        return session_id in self.raw_entries

    def encrypt_bytes(self, vault: VaultData) -> str:
        return self._cipher.encrypt(vault).decode("utf-8")

    def decrypt_bytes(self, ciphertext: str) -> VaultData:
        return self._cipher.decrypt(ciphertext.encode("utf-8"))


def save_session_vault(
    db: Session,
    vault_store: VaultStore,
    session_id: str,
    vault: VaultData,
    *,
    ttl_seconds: int,
    ephemeral_only: bool,
) -> None:
    """Save vault to Redis cache and optionally persist encrypted snapshot in SQLite."""
    vault_store.save(session_id, vault, ttl_seconds=ttl_seconds)
    if ephemeral_only:
        return

    encrypted_blob = vault_store.encrypt_bytes(vault)
    snapshot = db.get(SessionVaultSnapshot, session_id)
    now = utcnow()
    if snapshot is None:
        db.add(
            SessionVaultSnapshot(
                gateway_session_id=session_id,
                encrypted_blob=encrypted_blob,
                updated_at=now,
            )
        )
    else:
        snapshot.encrypted_blob = encrypted_blob
        snapshot.updated_at = now


def load_session_vault(
    db: Session,
    vault_store: VaultStore,
    session_id: str,
    *,
    ttl_seconds: int,
    ephemeral_only: bool,
) -> VaultData | None:
    """Load vault from Redis hot cache, falling back to persisted encrypted snapshot."""
    vault = vault_store.load(session_id)
    if vault is not None or ephemeral_only:
        return vault

    snapshot = db.get(SessionVaultSnapshot, session_id)
    if snapshot is None:
        return None
    restored = vault_store.decrypt_bytes(snapshot.encrypted_blob)
    vault_store.save(session_id, restored, ttl_seconds=ttl_seconds)
    return restored


def delete_session_vault(db: Session, vault_store: VaultStore, session_id: str) -> None:
    """Wipe vault from both Redis cache and SQLite snapshot."""
    vault_store.delete(session_id)
    snapshot = db.get(SessionVaultSnapshot, session_id)
    if snapshot is not None:
        db.delete(snapshot)


@lru_cache
def get_vault_store() -> VaultStore:
    """Return the configured encrypted Redis vault store."""
    settings = get_settings()
    cipher = VaultCipher(settings.vault_encryption_key, settings.app_env)
    client = redis.Redis.from_url(settings.redis_url, decode_responses=False)
    return RedisVaultStore(client=client, cipher=cipher)
