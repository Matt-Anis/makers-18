from collections.abc import Generator
from pathlib import Path
import re

from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

import app.main as main_module
from app.db import Base, build_engine, get_db
from app.main import app
from app.models import AuditLog, User, UserRole
from app.security import hash_password
from app.vault.store import InMemoryVaultStore, VaultCipher, VaultData, get_vault_store


@pytest.fixture()
def session_env(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> Generator[tuple[TestClient, InMemoryVaultStore, sessionmaker[Session]], None, None]:
    db_file = tmp_path / "test_sessions.db"
    test_engine = build_engine(f"sqlite:///{db_file}")
    TestingSessionLocal = sessionmaker(
        bind=test_engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )
    monkeypatch.setattr(main_module, "engine", test_engine)
    monkeypatch.setattr(main_module, "SessionLocal", TestingSessionLocal)
    Base.metadata.create_all(bind=test_engine)

    with TestingSessionLocal() as db:
        db.add_all(
            [
                User(
                    email="owner@acme.local",
                    full_name="Workspace Owner",
                    role=UserRole.OWNER.value,
                    password_hash=hash_password("owner-secret-123"),
                    is_active=True,
                ),
                User(
                    email="anis@acme.local",
                    full_name="Anis User",
                    role=UserRole.USER.value,
                    password_hash=hash_password("anis-secret-123"),
                    is_active=True,
                ),
                User(
                    email="samira@acme.local",
                    full_name="Samira User",
                    role=UserRole.USER.value,
                    password_hash=hash_password("samira-secret-123"),
                    is_active=True,
                ),
            ]
        )
        db.commit()

    vault_store = InMemoryVaultStore(
        cipher=VaultCipher(Fernet.generate_key().decode("utf-8"), app_env="test")
    )

    def override_get_db() -> Generator[Session, None, None]:
        with TestingSessionLocal() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_vault_store] = lambda: vault_store
    try:
        with TestClient(app) as test_client:
            yield test_client, vault_store, TestingSessionLocal
    finally:
        app.dependency_overrides.clear()
        test_engine.dispose()


def _login(client: TestClient, email: str, password: str) -> None:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200


def test_gateway_session_requires_auth(session_env) -> None:
    client, _vault_store, _session_factory = session_env
    assert client.get("/sessions").status_code == 401
    assert client.post("/sessions", json={"provider": "mock"}).status_code == 401


def test_gateway_session_ownership_isolation_and_wipe(session_env) -> None:
    client, vault_store, session_factory = session_env

    _login(client, "anis@acme.local", "anis-secret-123")
    created = client.post(
        "/sessions",
        json={"provider": "anthropic", "title": "Supplier NDA"},
    )
    assert created.status_code == 201
    session_id = created.json()["id"]
    assert vault_store.exists(session_id)

    # Another user (even a reviewer) cannot view or delete Anis's session.
    _login(client, "samira@acme.local", "samira-secret-123")
    assert client.get("/sessions").json() == []
    assert client.get(f"/sessions/{session_id}").status_code == 404
    assert client.delete(f"/sessions/{session_id}").status_code == 404
    assert vault_store.exists(session_id)

    # Owner sees the session, can inspect it, and can end it to wipe the vault.
    _login(client, "anis@acme.local", "anis-secret-123")
    owned = client.get("/sessions").json()
    assert len(owned) == 1
    assert owned[0]["id"] == session_id

    detail = client.get(f"/sessions/{session_id}")
    assert detail.status_code == 200
    assert detail.json()["vault_active"] is True

    ended = client.delete(f"/sessions/{session_id}")
    assert ended.status_code == 200
    assert not vault_store.exists(session_id)
    assert client.get("/sessions").json() == []

    # Audit log is owner-only and records metadata events.
    assert client.get("/audit").status_code == 403
    _login(client, "owner@acme.local", "owner-secret-123")
    audit_resp = client.get("/audit")
    assert audit_resp.status_code == 200
    actions = [item["action"] for item in audit_resp.json()]
    assert "session.created" in actions
    assert "session.ended" in actions

    with session_factory() as db:
        logs = list(db.scalars(select(AuditLog)))
        assert any(log.gateway_session_id == session_id for log in logs)


def test_vault_encryption_and_unmask_round_trip() -> None:
    cipher = VaultCipher(Fernet.generate_key().decode("utf-8"), app_env="test")
    vault = VaultData()
    p1 = vault.assign_placeholder("PERSON", "Anis")
    p2 = vault.assign_placeholder("PERSON", "Anis Benali")
    assert re.fullmatch(r"\[PERSON_[0-9a-f]{6}\]", p1)
    assert re.fullmatch(r"\[PERSON_[0-9a-f]{6}\]", p2)
    assert p1 != p2
    # Consistent placeholder across case/whitespace variants.
    assert vault.assign_placeholder("PERSON", "  anis ") == p1

    ciphertext = cipher.encrypt(vault)
    assert b"Anis" not in ciphertext
    restored = cipher.decrypt(ciphertext)

    masked = f"Please confirm whether {p2} and {p1.lower()} signed."
    assert restored.unmask_text(masked) == "Please confirm whether Anis Benali and Anis signed."


def test_persistent_vault_recovers_after_redis_cache_eviction(session_env) -> None:
    client, vault_store, session_factory = session_env
    _login(client, "anis@acme.local", "anis-secret-123")
    session_id = client.post("/sessions", json={"provider": "mock", "title": "Long chat"}).json()["id"]

    # Simulate populating the vault + saving persistent snapshot, then evicting Redis RAM cache.
    from app.models import MaskedMessage
    from app.vault.store import save_session_vault

    vault = vault_store.load(session_id)
    assert vault is not None
    token = vault.assign_placeholder("PERSON", "Karim")
    with session_factory() as db:
        save_session_vault(db, vault_store, session_id, vault, ttl_seconds=60, ephemeral_only=False)
        db.add(
            MaskedMessage(
                gateway_session_id=session_id,
                role="user",
                masked_content=f"Please review {token}'s NDA.",
            )
        )
        db.commit()

    vault_store.delete(session_id)
    assert not vault_store.exists(session_id)

    detail = client.get(f"/sessions/{session_id}")
    assert detail.status_code == 200
    body = detail.json()
    assert body["vault_active"] is True
    assert body["masked_messages"][0]["unmasked_content"] == "Please review Karim's NDA."
