from collections.abc import Generator
from pathlib import Path

from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

import app.main as main_module
from app.db import Base, build_engine, get_db
from app.main import app
from app.models import ProviderConfig, User, UserRole
import app.providers.discovery as discovery_module
from app.security import hash_password


@pytest.fixture()
def api_env(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> Generator[tuple[TestClient, sessionmaker[Session]], None, None]:
    monkeypatch.setenv("VAULT_ENCRYPTION_KEY", Fernet.generate_key().decode("utf-8"))
    from app.config import get_settings
    from app.security import get_secret_fernet

    get_settings.cache_clear()
    get_secret_fernet.cache_clear()

    db_file = tmp_path / "test_settings.db"
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
            yield test_client, TestingSessionLocal
    finally:
        app.dependency_overrides.clear()
        test_engine.dispose()
        get_settings.cache_clear()
        get_secret_fernet.cache_clear()


def _login(client: TestClient, email: str, password: str) -> None:
    resp = client.post("/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200


def test_regular_user_blocked_from_owner_settings_and_rules(api_env) -> None:
    client, _sf = api_env
    _login(client, "user@acme.local", "user-secret-123")

    assert client.get("/settings/providers").status_code == 403
    assert client.put("/settings/providers/openai", json={"enabled": True}).status_code == 403
    assert client.get("/settings/workspace").status_code == 403
    assert client.get("/rules").status_code == 403
    assert client.post("/rules", json={"pattern": "X"}).status_code == 403

    # Regular users CAN access model discovery for enabled models.
    models_resp = client.get("/providers/models")
    assert models_resp.status_code == 200
    body = models_resp.json()
    assert any(m["model_id"] == "nyxora-mock-v1" for m in body["models"])
    assert "rulebook_prompt" not in body


def test_owner_provider_key_encryption_and_live_discovery(
    api_env,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, session_factory = api_env
    _login(client, "owner@acme.local", "owner-secret-123")

    save_resp = client.put(
        "/settings/providers/openai",
        json={
            "api_key": "sk-proj-supersecret7890",
            "enabled": True,
            "enabled_models": ["gpt-4o", "o3-mini"],
        },
    )
    assert save_resp.status_code == 200
    saved = save_resp.json()
    assert saved["is_configured"] is True
    assert saved["key_hint"] == "••••7890"
    assert "sk-proj-supersecret7890" not in save_resp.text

    with session_factory() as db:
        row = db.scalar(select(ProviderConfig).where(ProviderConfig.provider == "openai"))
        assert row is not None
        assert row.encrypted_api_key is not None
        assert "sk-proj-supersecret7890" not in row.encrypted_api_key

    # Mock live HTTP response from OpenAI /models
    class _FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {"data": [{"id": "gpt-4o"}, {"id": "o3-mini"}, {"id": "text-embedding-3-small"}]}

    monkeypatch.setattr(discovery_module.httpx, "get", lambda *_args, **_kwargs: _FakeResponse())
    discover_resp = client.post("/settings/providers/openai/discover")
    assert discover_resp.status_code == 200
    disc_data = discover_resp.json()
    assert disc_data["source"] == "live"
    discovered_ids = {m["model_id"] for m in disc_data["models"]}
    assert discovered_ids == {"gpt-4o", "o3-mini"}

    # Fallback gracefully when httpx raises
    def _raise(*_args, **_kwargs):
        raise httpx.ConnectError("offline")

    monkeypatch.setattr(discovery_module.httpx, "get", _raise)
    fallback_resp = client.post("/settings/providers/openai/discover")
    assert fallback_resp.status_code == 200
    assert fallback_resp.json()["source"] == "fallback"

    # Regular user sees ONLY Owner-enabled models + thinking efforts
    _login(client, "user@acme.local", "user-secret-123")
    user_models = client.get("/providers/models").json()["models"]
    o3 = next(m for m in user_models if m["model_id"] == "o3-mini")
    assert o3["supports_thinking"] is True
    assert o3["thinking_efforts"] == ["low", "medium", "high"]


def test_owner_workspace_settings_and_rules_crud(api_env) -> None:
    client, _sf = api_env
    _login(client, "owner@acme.local", "owner-secret-123")

    invalid_ws = client.put(
        "/settings/workspace",
        json={"allow_auto_review": False, "default_review_mode": "auto"},
    )
    assert invalid_ws.status_code == 422

    updated_ws = client.put(
        "/settings/workspace",
        json={
            "allow_auto_review": True,
            "default_review_mode": "auto",
            "default_provider": "mock",
            "default_model": "nyxora-mock-v1",
            "default_thinking_effort": "high",
            "rulebook_prompt": "Always mask bank IBANs.",
            "gpu_llm_enabled": True,
            "gpu_llm_endpoint": "https://pod123-8000.proxy.runpod.net/v1",
            "gpu_llm_model": "Qwen/Qwen2.5-3B-Instruct-AWQ",
            "gpu_llm_api_key": "rp-secret-key-9988",
        },
    )
    assert updated_ws.status_code == 200
    ws_body = updated_ws.json()
    assert ws_body["default_thinking_effort"] == "high"
    assert ws_body["gpu_llm_model"] == "Qwen/Qwen2.5-3B-Instruct-AWQ"
    assert ws_body["gpu_llm_key_configured"] is True
    assert ws_body["gpu_llm_key_hint"].endswith("9988")
    assert "rp-secret-key-9988" not in updated_ws.text

    cleared_ws = client.put(
        "/settings/workspace",
        json={
            "allow_auto_review": True,
            "default_review_mode": "auto",
            "default_provider": "mock",
            "default_model": "nyxora-mock-v1",
            "default_thinking_effort": "high",
            "rulebook_prompt": "Always mask bank IBANs.",
            "gpu_llm_enabled": False,
            "clear_gpu_llm_api_key": True,
        },
    )
    assert cleared_ws.status_code == 200
    assert cleared_ws.json()["gpu_llm_key_configured"] is False
    assert cleared_ws.json()["gpu_llm_key_hint"] is None

    bad_regex = client.post(
        "/rules",
        json={"pattern": "[unclosed(", "entity_type": "CUSTOM", "is_regex": True},
    )
    assert bad_regex.status_code == 422

    created = client.post(
        "/rules",
        json={"pattern": "PROJECT-ZEUS", "entity_type": "CUSTOM", "is_regex": False},
    )
    assert created.status_code == 201
    rule_id = created.json()["id"]

    toggled = client.patch(f"/rules/{rule_id}", json={"enabled": False})
    assert toggled.status_code == 200
    assert toggled.json()["enabled"] is False

    deleted = client.delete(f"/rules/{rule_id}")
    assert deleted.status_code == 200

    # Import a single Markdown policy file containing both SLM instructions and Layer 1 custom rules.
    md_doc = (
        "# Acme Privacy Policy\n\n"
        "## Privacy Rulebook\n"
        "- Flag all M&A target codenames and internal valuations.\n\n"
        "## Custom Rules\n"
        "- PROJECT-TITAN | CUSTOM\n"
        "- `\\bDZ-\\d{4}\\b` | ID | regex\n"
    ).encode("utf-8")

    imported = client.post(
        "/rules/import-markdown",
        files={"file": ("policy.md", md_doc, "text/markdown")},
    )
    assert imported.status_code == 200
    imp_body = imported.json()
    assert len(imp_body["created_rules"]) == 2
    assert imp_body["skipped_existing_count"] == 0
    assert imp_body["rulebook_updated"] is True
    assert "M&A target codenames" in imp_body["rulebook_prompt"]
    assert "PROJECT-TITAN" not in imp_body["rulebook_prompt"]
    patterns = {(r["pattern"], r["entity_type"], r["is_regex"]) for r in imp_body["created_rules"]}
    assert patterns == {("PROJECT-TITAN", "CUSTOM", False), (r"\bDZ-\d{4}\b", "ID", True)}

    # Re-importing the exact same Markdown file deduplicates cleanly.
    reimported = client.post(
        "/rules/import-markdown",
        files={"file": ("policy.md", md_doc, "text/markdown")},
    )
    assert reimported.status_code == 200
    assert len(reimported.json()["created_rules"]) == 0
    assert reimported.json()["skipped_existing_count"] == 2

    # Invalid regex inside Markdown fails with 422.
    bad_md = b"## Custom Rules\n- `[unclosed(` | CUSTOM | regex\n"
    bad_res = client.post(
        "/rules/import-markdown",
        files={"file": ("broken.md", bad_md, "text/markdown")},
    )
    assert bad_res.status_code == 422

    # Regular users cannot import Markdown rules.
    _login(client, "user@acme.local", "user-secret-123")
    denied = client.post(
        "/rules/import-markdown",
        files={"file": ("policy.md", md_doc, "text/markdown")},
    )
    assert denied.status_code == 403
