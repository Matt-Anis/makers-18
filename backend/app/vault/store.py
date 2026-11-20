from dataclasses import dataclass, field
from functools import lru_cache
import json
import logging
import re
from typing import Protocol

from cryptography.fernet import Fernet
import redis

from app.config import get_settings

logger = logging.getLogger(__name__)


@dataclass
class VaultData:
    """Per-session bidirectional mapping between real values and placeholders."""

    to_placeholder: dict[str, str] = field(default_factory=dict)
    to_real: dict[str, str] = field(default_factory=dict)
    counters: dict[str, int] = field(default_factory=dict)

    def assign_placeholder(self, entity_type: str, real_text: str) -> str:
        """Return an existing placeholder for real_text or allocate a consistent new one."""
        normalized_type = entity_type.strip().upper()
        lookup_key = " ".join(real_text.strip().split()).lower()
        if lookup_key in self.to_placeholder:
            return self.to_placeholder[lookup_key]

        next_index = self.counters.get(normalized_type, 0) + 1
        self.counters[normalized_type] = next_index
        placeholder = f"[{normalized_type}_{next_index}]"
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
                "counters": self.counters,
            }
        ).encode("utf-8")

    @classmethod
    def from_json_bytes(cls, raw: bytes) -> "VaultData":
        payload = json.loads(raw.decode("utf-8"))
        return cls(
            to_placeholder=dict(payload.get("to_placeholder", {})),
            to_real=dict(payload.get("to_real", {})),
            counters={k: int(v) for k, v in payload.get("counters", {}).items()},
        )


class VaultCipher:
    """Encrypts and decrypts serialized vault payloads with Fernet symmetric encryption."""

    def __init__(self, fernet_key: str, app_env: str) -> None:
        if fernet_key:
            key_bytes = fernet_key.encode("utf-8")
        elif app_env == "production":
            raise RuntimeError("VAULT_ENCRYPTION_KEY must be set in production")
        else:
            logger.warning("VAULT_ENCRYPTION_KEY not set; generating ephemeral key for %s", app_env)
            key_bytes = Fernet.generate_key()
        self._fernet = Fernet(key_bytes)

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


@lru_cache
def get_vault_store() -> VaultStore:
    """Return the configured encrypted Redis vault store."""
    settings = get_settings()
    cipher = VaultCipher(settings.vault_encryption_key, settings.app_env)
    client = redis.Redis.from_url(settings.redis_url, decode_responses=False)
    return RedisVaultStore(client=client, cipher=cipher)
