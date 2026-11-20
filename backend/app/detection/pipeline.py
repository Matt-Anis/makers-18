from dataclasses import dataclass
import re
import secrets
from typing import Protocol

from app.models import CustomRule
from app.vault.store import VaultData

VALID_ENTITY_TYPES = frozenset(
    {"PERSON", "COMPANY", "EMAIL", "PHONE", "ADDRESS", "ID", "BANK", "CUSTOM"}
)

# Common capitalized legal/contract phrases that must not be mistaken for person names.
PERSON_STOPWORDS = frozenset(
    {
        "service agreement",
        "non disclosure",
        "confidential information",
        "effective date",
        "governing law",
        "intellectual property",
        "termination notice",
        "project codename",
        "force majeure",
        "party a",
        "party b",
        "privacy gateway",
        "united states",
        "algiers algeria",
    }
)

BUILTIN_RULES: tuple[tuple[str, re.Pattern[str], str, float], ...] = (
    (
        "EMAIL",
        re.compile(r"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b"),
        "rule",
        0.99,
    ),
    (
        "BANK",
        re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b"),
        "rule",
        0.97,
    ),
    (
        "BANK",
        re.compile(r"\b(?:\d[ -]*?){13,19}\b"),
        "rule",
        0.9,
    ),
    (
        "PHONE",
        re.compile(r"(?<!\w)(?:\+?\d[\d\s\-().]{7,16}\d)(?!\w)"),
        "rule",
        0.95,
    ),
    (
        "ID",
        re.compile(r"\b\d{15}\b|\b\d{3}-\d{2}-\d{4}\b"),
        "rule",
        0.95,
    ),
    (
        "COMPANY",
        re.compile(
            r"\b(?!(?:Agreement|Between|Check|Compare|Draft|Email|For|From|Notice|Regarding|Review|Verify|With)\b)"
            r"[A-Z0-9][A-Za-z0-9&.,'-]{0,25}"
            r"(?:\s+(?:of|the|and|for|de|du|des|et|[A-Z0-9][A-Za-z0-9&.,'-]{0,25})){0,4}"
            r"\s+(?:SARL|SPA|EURL|SNC|LLC|Inc\.?|Corp\.?|Ltd\.?|SAS|GmbH)\b"
        ),
        "ner",
        0.93,
    ),
    (
        "ADDRESS",
        re.compile(
            r"\b\d{1,5}\s+(?:Rue|Avenue|Ave\.?|Boulevard|Blvd\.?|Street|St\.?|Road|Rd\.?|Cite|Cité)\s+[A-Za-z0-9\s,'-]{3,50}"
        ),
        "rule",
        0.9,
    ),
    (
        "PERSON",
        re.compile(r"\b[A-Z][a-z]{1,24}\s+[A-Z][a-z]{1,24}\b"),
        "ner",
        0.86,
    ),
)

SOURCE_PRIORITY = {
    "vault": 5,
    "custom": 4,
    "rule": 3,
    "ner": 2,
    "pii-model": 2,
    "llm": 1,
}


@dataclass
class DetectedFinding:
    """Single detected sensitive span aligned to offsets in the original user message."""

    id: str
    type: str
    text: str
    start: int
    end: int
    source: str
    confidence: float
    placeholder: str


class ExtraDetector(Protocol):
    """Plug-in interface for external detectors (e.g., Presidio or GPU SLM)."""

    def detect(self, text: str) -> list[tuple[int, int, str, str, float]]:
        """Return list of (start, end, entity_type, source, confidence) spans."""
        ...


def _detect_from_vault(text: str, vault: VaultData) -> list[tuple[int, int, str, str, float, str]]:
    """Pass 0: deterministically match entities already mapped in this session's vault."""
    if not vault.to_real:
        return []

    spans: list[tuple[int, int, str, str, float, str]] = []
    # Match longest original values first to prevent partial prefix matches.
    items = sorted(vault.to_real.items(), key=lambda pair: len(pair[1]), reverse=True)
    for placeholder, original in items:
        if not original.strip():
            continue
        escaped = re.escape(original.strip())
        if original[0].isalnum() and original[-1].isalnum():
            pattern = re.compile(rf"(?<!\w){escaped}(?!\w)", flags=re.IGNORECASE)
        else:
            pattern = re.compile(escaped, flags=re.IGNORECASE)
        entity_type = placeholder.strip("[]").split("_", 1)[0]
        if entity_type not in VALID_ENTITY_TYPES:
            entity_type = "CUSTOM"
        for match in pattern.finditer(text):
            spans.append((match.start(), match.end(), entity_type, "vault", 1.0, placeholder))
    return spans


def _detect_custom_rules(
    text: str,
    rules: list[CustomRule],
) -> list[tuple[int, int, str, str, float, str | None]]:
    spans: list[tuple[int, int, str, str, float, str | None]] = []
    for rule in rules:
        if not rule.enabled or not rule.pattern.strip():
            continue
        entity_type = rule.entity_type if rule.entity_type in VALID_ENTITY_TYPES else "CUSTOM"
        try:
            if rule.is_regex:
                compiled = re.compile(rule.pattern)
            else:
                escaped = re.escape(rule.pattern.strip())
                if rule.pattern[0].isalnum() and rule.pattern[-1].isalnum():
                    compiled = re.compile(rf"(?<!\w){escaped}(?!\w)", flags=re.IGNORECASE)
                else:
                    compiled = re.compile(escaped, flags=re.IGNORECASE)
        except re.error:
            continue

        for match in compiled.finditer(text):
            if match.end() > match.start():
                spans.append((match.start(), match.end(), entity_type, "custom", 0.99, None))
    return spans


def _detect_builtin(text: str) -> list[tuple[int, int, str, str, float, str | None]]:
    spans: list[tuple[int, int, str, str, float, str | None]] = []
    for entity_type, compiled, source, confidence in BUILTIN_RULES:
        for match in compiled.finditer(text):
            matched_text = match.group(0).strip(" ,.;:")
            if not matched_text:
                continue
            start = match.start()
            end = start + len(matched_text)
            if entity_type == "PERSON" and matched_text.lower() in PERSON_STOPWORDS:
                continue
            if entity_type == "PHONE":
                digits = sum(ch.isdigit() for ch in matched_text)
                if digits < 8:
                    continue
            spans.append((start, end, entity_type, source, confidence, None))
    return spans


def _merge_spans(
    raw_spans: list[tuple[int, int, str, str, float, str | None]],
) -> list[tuple[int, int, str, str, float, str | None]]:
    """Resolve overlapping spans by source priority, then longer length, then earlier start."""
    ordered = sorted(
        raw_spans,
        key=lambda item: (
            -SOURCE_PRIORITY.get(item[3], 0),
            -(item[1] - item[0]),
            item[0],
        ),
    )
    accepted: list[tuple[int, int, str, str, float, str | None]] = []
    for candidate in ordered:
        c_start, c_end = candidate[0], candidate[1]
        if any(c_start < a_end and c_end > a_start for a_start, a_end, *_ in accepted):
            continue
        accepted.append(candidate)

    accepted.sort(key=lambda item: item[0])
    return accepted


def detect_sensitive_entities(
    text: str,
    *,
    vault: VaultData,
    custom_rules: list[CustomRule],
    extra_detectors: list[ExtraDetector] | None = None,
) -> list[DetectedFinding]:
    """
    Run Pass 0 (Vault Lookup) + Layer 1 (Custom Rules + Regex/NER) + pluggable extra detectors,
    returning non-overlapping offset-aligned findings with consistent [TYPE_<6-hex>] tokens.
    """
    if not text:
        return []

    raw_spans: list[tuple[int, int, str, str, float, str | None]] = []
    raw_spans.extend(_detect_from_vault(text, vault))
    raw_spans.extend(_detect_custom_rules(text, custom_rules))
    raw_spans.extend(_detect_builtin(text))

    if extra_detectors:
        for detector in extra_detectors:
            for start, end, entity_type, source, confidence in detector.detect(text):
                if 0 <= start < end <= len(text):
                    norm_type = entity_type.upper()
                    if norm_type not in VALID_ENTITY_TYPES:
                        norm_type = "CUSTOM"
                    raw_spans.append((start, end, norm_type, source, confidence, None))

    merged = _merge_spans(raw_spans)

    # Allocate placeholders against a working copy so caller controls when Vault mutates.
    working_to_placeholder = dict(vault.to_placeholder)
    working_to_real = dict(vault.to_real)

    findings: list[DetectedFinding] = []
    for start, end, entity_type, source, confidence, fixed_placeholder in merged:
        substring = text[start:end]
        if fixed_placeholder:
            placeholder = fixed_placeholder
        else:
            lookup_key = " ".join(substring.strip().split()).lower()
            if lookup_key in working_to_placeholder:
                placeholder = working_to_placeholder[lookup_key]
            else:
                while True:
                    placeholder = f"[{entity_type}_{secrets.token_hex(3)}]"
                    if placeholder not in working_to_real:
                        break
                working_to_placeholder[lookup_key] = placeholder
                working_to_real[placeholder] = substring.strip()

        findings.append(
            DetectedFinding(
                id=f"f_{start}_{end}",
                type=entity_type,
                text=substring,
                start=start,
                end=end,
                source=source,
                confidence=confidence,
                placeholder=placeholder,
            )
        )

    return findings


def apply_mask(text: str, findings: list[DetectedFinding]) -> str:
    """Replace detected spans with their placeholders (sorted right-to-left)."""
    if not findings:
        return text
    result = text
    for finding in sorted(findings, key=lambda item: item.start, reverse=True):
        result = result[: finding.start] + finding.placeholder + result[finding.end :]
    return result


def commit_findings_to_vault(vault: VaultData, findings: list[DetectedFinding]) -> None:
    """Persist approved findings into VaultData while preserving exact preview placeholders."""
    for finding in findings:
        lookup_key = " ".join(finding.text.strip().split()).lower()
        if lookup_key not in vault.to_placeholder:
            vault.to_placeholder[lookup_key] = finding.placeholder
            vault.to_real[finding.placeholder] = finding.text.strip()
