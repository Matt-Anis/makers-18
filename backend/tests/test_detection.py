import re

from app.detection.pipeline import (
    apply_mask,
    commit_findings_to_vault,
    detect_sensitive_entities,
)
from app.detection.slm_client import OpenAICompatibleSLMDetector, should_skip_slm
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


def test_slm_short_circuit_and_verbatim_matching(monkeypatch) -> None:
    assert should_skip_slm("Summarize the termination obligations please.") is True
    assert should_skip_slm("Summarize clause 4 please.") is False
    assert should_skip_slm("What did Karim Benali agree to?") is False

    class _FakeResp:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {
                "choices": [
                    {
                        "message": {
                            "content": '{"leftovers": [{"text": "Orion Labs", "type": "COMPANY"}, {"text": "HALLUCINATED", "type": "CUSTOM"}]}'
                        }
                    }
                ]
            }

    import app.detection.slm_client as slm_mod

    monkeypatch.setattr(slm_mod.httpx, "post", lambda *_a, **_kw: _FakeResp())
    detector = OpenAICompatibleSLMDetector("http://gpu-server:8001/v1")
    text = (
        "This confidential memorandum summarizes ongoing negotiations between Orion Labs "
        "and external counsel regarding quarterly licensing terms across multiple regions."
    )
    spans = detector.detect(text)
    assert len(spans) == 1
    start, end, entity_type, source, _conf = spans[0]
    assert text[start:end] == "Orion Labs"
    assert entity_type == "COMPANY"
    assert source == "llm"
