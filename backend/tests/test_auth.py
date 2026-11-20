from collections.abc import Generator
from pathlib import Path

from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
import pytest
from sqlalchemy.orm import Session, sessionmaker

import app.main as main_module
from app.db import Base, build_engine, get_db
from app.main import app
from app.models import User, UserRole
from app.security import decrypt_secret, encrypt_secret, hash_password, mask_api_key
from app.seed import normalize_legacy_roles


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient, None, None]:
    db_file = tmp_path / "test_gateway.db"
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
                    email="user@acme.local",
                    full_name="Anis User",
                    role=UserRole.USER.value,
                    password_hash=hash_password("user-secret-123"),
                    is_active=True,
                ),
            ]
        )
        db.commit()

    def override_get_db() -> Generator[Session, None, None]:
        with TestingSessionLocal() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        test_engine.dispose()


def test_login_sets_httponly_cookie_and_resolves_me(client: TestClient) -> None:
    response = client.post(
        "/auth/login",
        json={"email": "USER@acme.local", "password": "user-secret-123"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "user@acme.local"
    assert body["role"] == "user"
    assert "password_hash" not in body
    assert "cpg_session" in response.cookies

    me_response = client.get("/auth/me")
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "user@acme.local"


def test_login_rejects_invalid_credentials(client: TestClient) -> None:
    wrong_pw = client.post(
        "/auth/login",
        json={"email": "user@acme.local", "password": "wrong"},
    )
    assert wrong_pw.status_code == 401

    unknown_user = client.post(
        "/auth/login",
        json={"email": "nobody@acme.local", "password": "wrong"},
    )
    assert unknown_user.status_code == 401


def test_logout_revokes_session(client: TestClient) -> None:
    login_resp = client.post(
        "/auth/login",
        json={"email": "user@acme.local", "password": "user-secret-123"},
    )
    token = login_resp.cookies["cpg_session"]

    logout_resp = client.post("/auth/logout")
    assert logout_resp.status_code == 200

    assert client.get("/auth/me").status_code == 401
    assert (
        client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code
        == 401
    )


def test_owner_only_user_provisioning_and_no_public_registration(client: TestClient) -> None:
    assert client.post("/auth/register", json={}).status_code == 404

    client.post(
        "/auth/login",
        json={"email": "user@acme.local", "password": "user-secret-123"},
    )
    forbidden = client.post(
        "/auth/users",
        json={
            "email": "new@acme.local",
            "full_name": "New User",
            "password": "password-123",
            "role": "user",
        },
    )
    assert forbidden.status_code == 403

    client.post(
        "/auth/login",
        json={"email": "owner@acme.local", "password": "owner-secret-123"},
    )
    created = client.post(
        "/auth/users",
        json={
            "email": "new@acme.local",
            "full_name": "New User",
            "password": "password-123",
            "role": "user",
        },
    )
    assert created.status_code == 201
    assert created.json()["role"] == "user"


def test_legacy_roles_normalize_and_secret_encryption_masks_key(tmp_path: Path) -> None:
    test_engine = build_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    SessionFactory = sessionmaker(bind=test_engine, expire_on_commit=False)
    Base.metadata.create_all(bind=test_engine)

    with SessionFactory() as db:
        db.add_all(
            [
                User(
                    email="a@acme.local",
                    full_name="A",
                    role="admin",
                    password_hash="x",
                ),
                User(
                    email="r@acme.local",
                    full_name="R",
                    role="reviewer",
                    password_hash="x",
                ),
                User(
                    email="q@acme.local",
                    full_name="Q",
                    role="requester",
                    password_hash="x",
                ),
            ]
        )
        db.commit()
        normalize_legacy_roles(db)
        roles = {u.email: u.role for u in db.query(User).all()}
        assert roles == {
            "a@acme.local": "owner",
            "r@acme.local": "user",
            "q@acme.local": "user",
        }
    test_engine.dispose()

    fernet = Fernet(Fernet.generate_key())
    raw_key = "sk-test-secret-9876"
    encrypted = encrypt_secret(raw_key, fernet)
    assert raw_key not in encrypted
    assert decrypt_secret(encrypted, fernet) == raw_key
    assert mask_api_key(raw_key) == "••••9876"
