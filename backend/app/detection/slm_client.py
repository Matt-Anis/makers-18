import json
import logging
import re

import httpx

from app.detection.pipeline import VALID_ENTITY_TYPES

logger = logging.getLogger(__name__)

SLM_SYSTEM_PROMPT = (
    "Extract ONLY missed sensitive entities from the text as JSON. "
    "Ignore tokens already formatted like [PERSON_abc123]. "
    'Return JSON: {"leftovers": [{"text": "<exact verbatim substring>", "type": "PERSON|COMPANY|ID|BANK|CUSTOM"}]}. '
    "Return an empty list if nothing sensitive remains."
)


def should_skip_slm(masked_text: str) -> bool:
    """Short-circuit trivial follow-up messages that contain no proper nouns or numbers."""
    stripped = masked_text.strip()
    words = stripped.split()
    if len(words) < 15 and not re.search(r"\d", stripped):
        # Skip if at most the first word is capitalized (sentence start).
        capitalized = [w for w in words[1:] if w[:1].isupper()]
        if not capitalized:
            return True
    return False


class OpenAICompatibleSLMDetector:
    """Optional Layer 2/3 detector calling Ollama/vLLM OpenAI-compatible HTTP endpoints."""

    def __init__(
        self,
        endpoint: str,
        *,
        rulebook_prompt: str = "",
        model: str = "Qwen/Qwen2.5-7B-Instruct-AWQ",
        timeout_seconds: float = 10.0,
    ) -> None:
        self._endpoint = endpoint.rstrip("/")
        self._rulebook_prompt = rulebook_prompt.strip()
        self._model = model
        self._timeout = timeout_seconds

    def detect(self, text: str) -> list[tuple[int, int, str, str, float]]:
        if not text.strip() or should_skip_slm(text):
            return []

        system_content = SLM_SYSTEM_PROMPT
        if self._rulebook_prompt:
            system_content = f"{SLM_SYSTEM_PROMPT}\nRulebook: {self._rulebook_prompt[:600]}"

        payload = {
            "model": self._model,
            "temperature": 0,
            "max_tokens": 256,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_content},
                {"role": "user", "content": text},
            ],
        }
        url = (
            self._endpoint
            if self._endpoint.endswith("/chat/completions")
            else f"{self._endpoint}/chat/completions"
        )

        try:
            resp = httpx.post(url, json=payload, timeout=self._timeout)
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            parsed = json.loads(content)
        except Exception as exc:  # noqa: BLE001 — graceful fallback when GPU server is unreachable
            logger.warning("GPU SLM detector skipped (%s): %s", url, exc)
            return []

        leftovers = parsed.get("leftovers", [])
        if not isinstance(leftovers, list):
            return []

        spans: list[tuple[int, int, str, str, float]] = []
        for item in leftovers:
            if not isinstance(item, dict):
                continue
            needle = str(item.get("text", "")).strip()
            raw_type = str(item.get("type", "CUSTOM")).strip().upper()
            entity_type = raw_type if raw_type in VALID_ENTITY_TYPES else "CUSTOM"
            if not needle or needle.startswith("["):
                continue
            for match in re.finditer(re.escape(needle), text):
                spans.append((match.start(), match.end(), entity_type, "llm", 0.85))
        return spans
