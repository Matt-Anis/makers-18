from collections.abc import Generator
import json
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
from app.models import (
    AuditLog,
    MaskedMessage,
    PendingReview,
    ProviderConfig,
    User,
    UserRole,
    WorkspaceSettings,
)
from app.security import encrypt_secret, get_secret_fernet, hash_password
from app.vault.store import InMemoryVaultStore, VaultCipher, get_vault_store


@pytest.fixture()
def gate_env(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> Generator[tuple[TestClient, sessionmaker[Session]], None, None]:
    db_file = tmp_path / "test_gate.db"
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
        db.add(WorkspaceSettings(id="default", allow_auto_review=False, default_review_mode="manual"))
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
            yield test_client, TestingSessionLocal
    finally:
        app.dependency_overrides.clear()
        test_engine.dispose()


def _login(client: TestClient, email: str, password: str) -> None:
    resp = client.post("/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200


def test_manual_mode_reject_never_calls_provider_and_wipes_payload(gate_env, monkeypatch) -> None:
    client, session_factory = gate_env
    _login(client, "anis@acme.local", "anis-secret-123")

    created = client.post("/sessions", json={"provider": "mock", "title": "NDA Review"})
    assert created.status_code == 201
    session_id = created.json()["id"]

    provider_calls: list[dict] = []
    import app.routers.sessions as sessions_router

    orig_send = sessions_router.send_masked_chat

    def spy_send(*args, **kwargs):
        provider_calls.append({"args": args, "kwargs": kwargs})
        return orig_send(*args, **kwargs)

    monkeypatch.setattr(sessions_router, "send_masked_chat", spy_send)

    prompt = "Please review obligations for Karim Benali (karim.benali@atlastech.dz)."
    res = client.post(f"/sessions/{session_id}/messages", json={"content": prompt, "mode": "manual"})
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "needs_review"
    assert body["review_id"]
    assert provider_calls == []
    assert "Karim Benali" not in body["masked_preview"]
    assert len(body["findings"]) >= 2

    # Ensure raw PII is NOT stored unencrypted in PendingReview and no MaskedMessage exists yet.
    with session_factory() as db:
        review = db.get(PendingReview, body["review_id"])
        assert review is not None
        assert review.status == "pending"
        assert "Karim Benali" not in review.encrypted_payload
        assert "karim.benali@atlastech.dz" not in review.encrypted_payload
        assert (
            list(db.scalars(select(MaskedMessage).where(MaskedMessage.gateway_session_id == session_id)))
            == []
        )

    # Rejecting must wipe payload, log approved=False, and still never call any provider.
    rejected = client.post(f"/sessions/{session_id}/reviews/{body['review_id']}/reject")
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"
    assert provider_calls == []

    with session_factory() as db:
        review = db.get(PendingReview, body["review_id"])
        assert review is not None
        assert review.status == "rejected"
        assert review.encrypted_payload == ""
        audit = db.scalar(
            select(AuditLog).where(
                AuditLog.gateway_session_id == session_id,
                AuditLog.action == "message.rejected",
            )
        )
        assert audit is not None
        assert audit.approved is False
        assert audit.entity_counts is not None

    # Re-approving or re-rejecting an already resolved review is blocked cleanly.
    assert client.post(f"/sessions/{session_id}/reviews/{body['review_id']}/approve").status_code == 409


def test_manual_mode_approve_sends_masked_only_and_unmasks_multiturn_tokens(
    gate_env, monkeypatch
) -> None:
    client, session_factory = gate_env
    with session_factory() as db:
        db.add(
            ProviderConfig(
                provider="openai",
                encrypted_api_key=encrypt_secret("sk-test-openai-9999", get_secret_fernet()),
                key_hint="****9999",
                enabled=True,
                enabled_models=["gpt-4o"],
            )
        )
        db.commit()

    captured_requests: list[dict] = []

    class _FakeOpenAIResponse:
        def __init__(self, masked_user: str) -> None:
            self._masked_user = masked_user

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            person_match = re.search(r"\[PERSON_[0-9a-f]{6}\]", self._masked_user)
            company_match = re.search(r"\[COMPANY_[0-9a-f]{6}\]", self._masked_user)
            p_tok = person_match.group(0) if person_match else "[PERSON_missing]"
            c_tok = company_match.group(0) if company_match else "[COMPANY_missing]"
            return {
                "choices": [
                    {
                        "message": {
                            "content": f"{p_tok} represents {c_tok} under Clause 2."
                        }
                    }
                ]
            }

    import app.providers.client as client_mod

    def fake_httpx_post(url, headers=None, json=None, **_kwargs):
        captured_requests.append({"url": url, "headers": headers, "json": json})
        last_user = json["messages"][-1]["content"]
        return _FakeOpenAIResponse(last_user)

    monkeypatch.setattr(client_mod.httpx, "post", fake_httpx_post)

    _login(client, "anis@acme.local", "anis-secret-123")
    session_id = client.post("/sessions", json={"provider": "openai", "title": "MSA"}).json()["id"]

    # Turn 1: paused at review gate, no external HTTP request fired yet.
    turn1 = client.post(
        f"/sessions/{session_id}/messages",
        json={
            "provider": "openai",
            "model": "gpt-4o",
            "content": "Check Atlas Tech SARL liabilities for Karim Benali (karim.benali@atlastech.dz).",
            "mode": "manual",
        },
    )
    assert turn1.status_code == 200
    assert turn1.json()["status"] == "needs_review"
    assert captured_requests == []
    review_id = turn1.json()["review_id"]

    karim_token = next(
        item["placeholder"] for item in turn1.json()["findings"] if item["text"] == "Karim Benali"
    )
    assert re.fullmatch(r"\[PERSON_[0-9a-f]{6}\]", karim_token)

    # Approve Turn 1 -> masked text sent to OpenAI, response unmasked verbatim.
    approved = client.post(f"/sessions/{session_id}/reviews/{review_id}/approve")
    assert approved.status_code == 200
    body1 = approved.json()
    assert body1["status"] == "sent"
    assert len(captured_requests) == 1
    sent_payload = json.dumps(captured_requests[0]["json"])
    assert "Karim Benali" not in sent_payload
    assert "Atlas Tech SARL" not in sent_payload
    assert "karim.benali@atlastech.dz" not in sent_payload
    assert karim_token in sent_payload

    assert body1["assistant_message"]["masked_content"].startswith(karim_token)
    assert "Karim Benali represents Atlas Tech SARL under Clause 2." == body1["assistant_message"]["unmasked_content"]

    with session_factory() as db:
        review = db.get(PendingReview, review_id)
        assert review is not None
        assert review.status == "approved"
        assert review.encrypted_payload == ""

    # Turn 2: mention Karim Benali again -> must reuse identical token from persistent Vault.
    turn2 = client.post(
        f"/sessions/{session_id}/messages",
        json={
            "provider": "openai",
            "model": "gpt-4o",
            "content": "What if Karim Benali terminates early?",
            "mode": "manual",
        },
    )
    assert turn2.status_code == 200
    assert turn2.json()["status"] == "needs_review"
    turn2_token = next(
        item["placeholder"] for item in turn2.json()["findings"] if item["text"] == "Karim Benali"
    )
    assert turn2_token == karim_token

    approved2 = client.post(f"/sessions/{session_id}/reviews/{turn2.json()['review_id']}/approve")
    assert approved2.status_code == 200
    assert len(captured_requests) == 2
    assert len(captured_requests[1]["json"]["messages"]) == 4  # system + user1 + assistant1 + user2

    # Full history recovers unmasked messages cleanly.
    detail = client.get(f"/sessions/{session_id}")
    assert detail.status_code == 200
    assert len(detail.json()["masked_messages"]) == 4
    assert "Karim Benali" in detail.json()["masked_messages"][1]["unmasked_content"]


def test_clean_message_auto_policy_and_cross_user_isolation(gate_env) -> None:
    client, _session_factory = gate_env
    _login(client, "anis@acme.local", "anis-secret-123")
    session_id = client.post("/sessions", json={"provider": "mock", "title": "Policy"}).json()["id"]

    # Clean message (no sensitive entities) sends immediately even in manual mode.
    clean = client.post(
        f"/sessions/{session_id}/messages",
        json={"content": "summarize the termination obligations in three bullet points."},
    )
    assert clean.status_code == 200
    assert clean.json()["status"] == "sent"
    assert clean.json()["findings"] == []

    # Auto mode is blocked while workspace allow_auto_review is False.
    blocked_auto = client.post(
        f"/sessions/{session_id}/messages",
        json={"content": "Review Karim Benali contract.", "mode": "auto"},
    )
    assert blocked_auto.status_code == 403

    # Hold one review for cross-user isolation check.
    held = client.post(
        f"/sessions/{session_id}/messages",
        json={"content": "Email karim.benali@atlastech.dz now.", "mode": "manual"},
    )
    assert held.status_code == 200
    review_id = held.json()["review_id"]

    # Samira cannot post to Anis's session or approve/reject Anis's review.
    _login(client, "samira@acme.local", "samira-secret-123")
    assert client.post(f"/sessions/{session_id}/messages", json={"content": "hi"}).status_code == 404
    assert client.post(f"/sessions/{session_id}/reviews/{review_id}/approve").status_code == 404
    assert client.post(f"/sessions/{session_id}/reviews/{review_id}/reject").status_code == 404

    # Owner enables auto-review -> Anis can now send directly in auto mode.
    _login(client, "owner@acme.local", "owner-secret-123")
    upd = client.put(
        "/settings/workspace",
        json={
            "allow_auto_review": True,
            "default_review_mode": "manual",
            "default_provider": "mock",
            "default_model": "nyxora-mock-v1",
            "default_thinking_effort": "medium",
            "rulebook_prompt": "",
            "gpu_llm_enabled": False,
            "gpu_llm_endpoint": None,
        },
    )
    assert upd.status_code == 200

    _login(client, "anis@acme.local", "anis-secret-123")
    auto_sent = client.post(
        f"/sessions/{session_id}/messages",
        json={"content": "Email karim.benali@atlastech.dz with updates.", "mode": "auto"},
    )
    assert auto_sent.status_code == 200
    assert auto_sent.json()["status"] == "sent"
    assert "karim.benali@atlastech.dz" not in auto_sent.json()["user_message"]["masked_content"]
    assert "karim.benali@atlastech.dz" in auto_sent.json()["user_message"]["unmasked_content"]


def test_message_ordering_history_windowing_and_pending_review_reload(gate_env) -> None:
    from app.routers.sessions import window_masked_history

    # Unit check: window_masked_history preserves opening contract turn + latest turns + role alternation.
    long_history = [
        ("user", "Contract 1 between [COMPANY_111111] and [PERSON_222222]."),
        ("assistant", "Reviewed opening contract."),
        ("user", "Turn 2 question"),
        ("assistant", "Turn 2 answer"),
        ("user", "Turn 3 question"),
        ("assistant", "Turn 3 answer"),
        ("user", "Turn 4 question"),
        ("assistant", "Turn 4 answer"),
    ]
    windowed = window_masked_history(
        long_history,
        "Turn 5 newest question",
        max_messages=5,
        max_chars=500,
    )
    assert [role for role, _ in windowed] == ["user", "assistant", "user", "assistant", "user"]
    assert windowed[0][1].startswith("Contract 1")
    assert windowed[2][1] == "Turn 4 question"
    assert windowed[-1][1] == "Turn 5 newest question"

    # Character cap drops older turns gracefully and still starts with user.
    tight = window_masked_history(
        long_history,
        "Short newest",
        max_messages=10,
        max_chars=60,
    )
    assert tight[0][0] == "user"
    assert tight[-1] == ("user", "Short newest")
    assert sum(len(text) for _, text in tight) <= 60

    # API check: strict user -> assistant timestamp ordering and pending_review restoration on GET /sessions/{id}.
    client, session_factory = gate_env
    _login(client, "anis@acme.local", "anis-secret-123")
    session_id = client.post("/sessions", json={"provider": "mock", "title": "Reload"}).json()["id"]

    sent = client.post(
        f"/sessions/{session_id}/messages",
        json={"content": "summarize obligations in plain text."},
    )
    assert sent.status_code == 200
    body = sent.json()
    assert body["user_message"]["created_at"] < body["assistant_message"]["created_at"]

    # Hold a manual review, then create a second one -> older review is superseded and GET returns only the latest.
    first = client.post(
        f"/sessions/{session_id}/messages",
        json={"content": "Check Karim Benali clause 1.", "mode": "manual"},
    )
    assert first.status_code == 200
    first_id = first.json()["review_id"]

    second = client.post(
        f"/sessions/{session_id}/messages",
        json={"content": "Check Karim Benali clause 2.", "mode": "manual"},
    )
    assert second.status_code == 200
    second_id = second.json()["review_id"]

    detail = client.get(f"/sessions/{session_id}")
    assert detail.status_code == 200
    detail_body = detail.json()
    assert [m["role"] for m in detail_body["masked_messages"]] == ["user", "assistant"]
    assert detail_body["pending_review"] is not None
    assert detail_body["pending_review"]["review_id"] == second_id
    assert detail_body["pending_review"]["raw_text"] == "Check Karim Benali clause 2."
    assert "Karim Benali" not in detail_body["pending_review"]["masked_preview"]

    with session_factory() as db:
        superseded = db.get(PendingReview, first_id)
        assert superseded is not None
        assert superseded.status == "superseded"
        assert superseded.encrypted_payload == ""

    # After approving, pending_review becomes None on reload.
    approved = client.post(f"/sessions/{session_id}/reviews/{second_id}/approve")
    assert approved.status_code == 200
    after = client.get(f"/sessions/{session_id}").json()
    assert after["pending_review"] is None
    assert [m["role"] for m in after["masked_messages"]] == ["user", "assistant", "user", "assistant"]

