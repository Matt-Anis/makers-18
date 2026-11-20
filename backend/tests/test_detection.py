from dataclasses import dataclass
import json
import re

import httpx

from app.detection.pipeline import (
    apply_mask,
    commit_findings_to_vault,
    detect_sensitive_entities,
)
from app.detection.presidio_detector import PresidioDetector, get_presidio_detector
from app.detection.slm_client import (
    OpenAICompatibleSLMDetector,
    chunk_text_for_slm,
    should_skip_slm,
)
from app.models import CustomRule
from app.vault.store import VaultData


def test_detection_pipeline_vault_consistency_and_custom_rules() -> None:
    vault = VaultData()
    rules = [
        CustomRule(pattern="APOLLO-X", entity_type="CUSTOM", is_regex=False, enabled=True),
        CustomRule(pattern=r"\bDZ-\d{4}\b", entity_type="ID", is_regex=True, enabled=True),
    ]

    msg1 = (
        "SERVICE AGREEMENT between Atlas Tech SARL (ID: DZ-4021) and Karim Benali. "
        "Email karim.benali@atlastech.dz, phone +213 550 12 34 56, project APOLLO-X."
    )
    findings1 = detect_sensitive_entities(msg1, vault=vault, custom_rules=rules)
    types1 = {f.type for f in findings1}
    assert {"COMPANY", "ID", "PERSON", "EMAIL", "PHONE", "CUSTOM"}.issubset(types1)

    masked1 = apply_mask(msg1, findings1)
    assert "Karim Benali" not in masked1
    assert "karim.benali@atlastech.dz" not in masked1
    assert "APOLLO-X" not in masked1
    assert "DZ-4021" not in masked1

    # Commit approved findings to the persistent vault.
    commit_findings_to_vault(vault, findings1)
    karim_token = next(f.placeholder for f in findings1 if f.text == "Karim Benali")
    assert re.fullmatch(r"\[PERSON_[0-9a-f]{6}\]", karim_token)

    # Follow-up message reuses the exact same token via Pass 0 Vault Lookup.
    msg2 = "What are Karim Benali's payment obligations?"
    findings2 = detect_sensitive_entities(msg2, vault=vault, custom_rules=rules)
    assert any(f.source == "vault" and f.placeholder == karim_token for f in findings2)
    masked2 = apply_mask(msg2, findings2)
    assert karim_token in masked2
    assert vault.unmask_text(masked2) == msg2


def test_slm_short_circuit_premask_chunking_and_auth() -> None:
    assert should_skip_slm("Summarize the termination obligations please.") is True
    assert should_skip_slm("What did [PERSON_7f3a9b] agree to?") is True
    assert should_skip_slm("Summarize clause 4 please.") is False
    assert should_skip_slm("What did Karim Benali agree to?") is False

    seen_requests: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content.decode("utf-8"))
        seen_requests.append(
            {
                "url": str(request.url),
                "auth": request.headers.get("authorization"),
                "model": body["model"],
                "content": body["messages"][1]["content"],
            }
        )
        leftovers = []
        if "sonatrach" in body["messages"][1]["content"]:
            leftovers.append({"text": "sonatrach", "type": "COMPANY"})
        if "zenith-9" in body["messages"][1]["content"]:
            leftovers.append({"text": "zenith-9", "type": "CUSTOM"})
        leftovers.append({"text": "HALLUCINATED", "type": "CUSTOM"})
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": json.dumps({"leftovers": leftovers})}}]},
        )

    transport = httpx.MockTransport(handler)
    detector = OpenAICompatibleSLMDetector(
        "http://gpu-server:8001/v1",
        model="Qwen/Qwen2.5-3B-Instruct-AWQ",
        api_key="rp-secret-token-42",
        max_concurrency=8,
        max_chunk_words=55,
        overlap_words=10,
        transport=transport,
    )

    # 1) Pre-masked pipeline check: Layer 1 masks email/person before SLM ever sees the text.
    contract = (
        "Confidential memorandum from Karim Benali (karim.benali@atlastech.dz) detailing licensing "
        "obligations for sonatrach and external counsel regarding regional distribution rights "
        "across multiple jurisdictions for codename zenith-9."
    )
    findings = detect_sensitive_entities(
        contract,
        vault=VaultData(),
        custom_rules=[],
        extra_detectors=[detector],
    )
    assert len(seen_requests) == 1
    assert seen_requests[0]["auth"] == "Bearer rp-secret-token-42"
    assert seen_requests[0]["model"] == "Qwen/Qwen2.5-3B-Instruct-AWQ"
    assert "Karim Benali" not in seen_requests[0]["content"]
    assert "karim.benali@atlastech.dz" not in seen_requests[0]["content"]
    assert re.search(r"\[EMAIL_[0-9a-f]{6}\]", seen_requests[0]["content"])
    assert re.search(r"\[PERSON_[0-9a-f]{6}\]", seen_requests[0]["content"])

    by_text = {f.text: f for f in findings}
    assert by_text["karim.benali@atlastech.dz"].type == "EMAIL"
    assert by_text["sonatrach"].type == "COMPANY"
    assert by_text["sonatrach"].source == "llm"
    assert by_text["zenith-9"].type == "CUSTOM"
    assert by_text["zenith-9"].source == "llm"
    assert "HALLUCINATED" not in by_text

    # 2) Long text splits into multiple overlapping chunks dispatched concurrently and deduplicated.
    seen_requests.clear()
    filler = " ".join(["obligations", "clause", "schedule", "indemnity", "payment"] * 18)
    long_doc = (
        f"Part one discusses sonatrach terms. {filler}. "
        f"Part two introduces zenith-9 deliverables. {filler}."
    )
    chunks = chunk_text_for_slm(long_doc, max_words=55, overlap_words=10)
    assert len(chunks) >= 3

    long_spans = detector.detect_post_mask(long_doc, long_doc)
    assert len(seen_requests) == len(chunks)
    extracted_texts = {long_doc[s:e] for s, e, _t, _src, _c in long_spans}
    assert extracted_texts == {"sonatrach", "zenith-9"}


def test_presidio_detector_mapping_filtering_and_fallback(monkeypatch) -> None:
    @dataclass
    class _FakeResult:
        entity_type: str
        start: int
        end: int
        score: float

    text = "Contract with Sonatrach signed by Nadia Mansouri in Algiers regarding [PERSON_1a2b3c]."

    class _FakeAnalyzer:
        def analyze(self, text: str, entities: list[str], language: str, score_threshold: float):
            assert language == "en"
            assert "ORGANIZATION" in entities
            return [
                _FakeResult("ORGANIZATION", text.index("Sonatrach"), text.index("Sonatrach") + 9, 0.85),
                _FakeResult("PERSON", text.index("Nadia Mansouri"), text.index("Nadia Mansouri") + 14, 0.91),
                _FakeResult("LOCATION", text.index("Algiers"), text.index("Algiers") + 7, 0.72),
                # Low-score guess below min_score must be ignored.
                _FakeResult("PERSON", 0, 8, 0.2),
                # Existing bracket placeholder must never be re-flagged.
                _FakeResult("ORGANIZATION", text.index("[PERSON_1a2b3c]"), text.index("[PERSON_1a2b3c]") + 15, 0.95),
            ]

    detector = PresidioDetector(_FakeAnalyzer(), min_score=0.45)
    vault = VaultData()
    findings = detect_sensitive_entities(
        text,
        vault=vault,
        custom_rules=[],
        extra_detectors=[detector],
    )
    by_text = {f.text: f for f in findings}
    assert by_text["Sonatrach"].type == "COMPANY"
    assert by_text["Sonatrach"].source == "ner"
    assert by_text["Nadia Mansouri"].type == "PERSON"
    assert by_text["Algiers"].type == "ADDRESS"
    assert "[PERSON_1a2b3c]" not in by_text
    assert "Contract" not in by_text

    # Graceful fallback returns None if Presidio cannot initialize.
    import app.detection.presidio_detector as presidio_mod

    presidio_mod.get_presidio_detector.cache_clear()
    monkeypatch.setattr(presidio_mod, "_build_presidio_analyzer", lambda _model: None)
    assert get_presidio_detector("missing_model") is None
    presidio_mod.get_presidio_detector.cache_clear()

