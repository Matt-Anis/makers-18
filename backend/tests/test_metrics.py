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
from app.security import hash_password


@pytest.fixture()
def metrics_env(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> Generator[TestClient, None, None]:
    monkeypatch.setenv("VAULT_ENCRYPTION_KEY", Fernet.generate_key().decode("utf-8"))
    from app.config import get_settings
    from app.security import get_secret_fernet

    get_settings.cache_clear()
    get_secret_fernet.cache_clear()

    db_file = tmp_path / "test_metrics.db"
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
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()
        test_engine.dispose()
        get_settings.cache_clear()
        get_secret_fernet.cache_clear()


def _login(client: TestClient, email: str, password: str) -> None:
    resp = client.post("/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200


def test_metrics_owner_only_and_end_to_end_evaluation(metrics_env: TestClient) -> None:
    client = metrics_env

    # Regular users cannot view or trigger evaluation benchmarks.
    _login(client, "user@acme.local", "user-secret-123")
    assert client.get("/metrics/latest").status_code == 403
    assert client.post("/metrics/run", json={"include_gpu_slm": False}).status_code == 403

    # Owner starts with no persisted evaluation run.
    _login(client, "owner@acme.local", "owner-secret-123")
    initial = client.get("/metrics/latest")
    assert initial.status_code == 200
    assert initial.json()["has_run"] is False

    # Triggering an evaluation run executes both synthetic (60) and realistic (14) benchmarks.
    run_resp = client.post("/metrics/run", json={"include_gpu_slm": False})
    assert run_resp.status_code == 200
    body = run_resp.json()
    assert body["has_run"] is True
    assert body["run_id"]
    assert body["duration_ms"] >= 1

    syn = body["synthetic"]
    real = body["realistic"]
    assert syn["document_count"] == 60
    assert real["document_count"] == 14
    assert syn["unmask_round_trip"] == 100.0
    assert real["unmask_round_trip"] == 100.0
    assert syn["overall_recall"] > 70.0
    assert real["overall_recall"] > 60.0
    assert len(syn["per_entity"]) == 8
    assert len(real["ablation"]) == 4

    # Subsequent GET /metrics/latest returns the persisted snapshot.
    latest = client.get("/metrics/latest")
    assert latest.status_code == 200
    assert latest.json()["run_id"] == body["run_id"]
    assert latest.json()["realistic"]["overall_recall"] == real["overall_recall"]
