import asyncio
from concurrent.futures import ThreadPoolExecutor
import json
import logging
import re

import httpx

from app.detection.pipeline import VALID_ENTITY_TYPES

logger = logging.getLogger(__name__)

DEFAULT_SLM_MODEL = "Qwen/Qwen2.5-7B-Instruct-AWQ"

SLM_SYSTEM_PROMPT = (
    "Extract ONLY missed sensitive entities from the text as JSON. "
    "Ignore tokens already formatted like [PERSON_abc123]. "
    'Return JSON: {"leftovers": [{"text": "<exact verbatim substring>", "type": "PERSON|COMPANY|ID|BANK|CUSTOM"}]}. '
    "Return an empty list if nothing sensitive remains."
)

_PLACEHOLDER_TOKEN_RE = re.compile(r"\[[A-Z]+_[0-9a-fA-F]{4,12}\]")
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+|\n+")


def should_skip_slm(masked_text: str) -> bool:
    """
    Short-circuit trivial prompts after Pass 0 + Layer 1 masking.
    Ignores already-masked [TYPE_<6-hex>] tokens so follow-ups referencing vaulted
    entities skip the GPU SLM in <1ms.
    """
    without_tokens = _PLACEHOLDER_TOKEN_RE.sub(" ", masked_text)
    stripped = " ".join(without_tokens.split()).strip()
    if not stripped:
        return True

    words = stripped.split()
    if len(words) < 15 and not re.search(r"\d", stripped):
        capitalized = [w for w in words[1:] if w[:1].isupper()]
        if not capitalized:
            return True
    return False


def chunk_text_for_slm(
    text: str,
    *,
    max_words: int = 380,
    overlap_words: int = 25,
) -> list[str]:
    """
    Split long pre-masked documents on sentence/paragraph boundaries into ~350-400-word
    overlapping chunks so vLLM can batch up to 8 chunks concurrently without hitting
    max-model-len limits or slicing entity names across boundaries.
    """
    cleaned = text.strip()
    if not cleaned:
        return []
    if len(cleaned.split()) <= max_words:
        return [cleaned]

    units = [part.strip() for part in _SENTENCE_SPLIT_RE.split(cleaned) if part.strip()]
    chunks: list[str] = []
    current_words: list[str] = []

    for unit in units:
        unit_words = unit.split()
        # Handle single run-on paragraphs/sentences longer than max_words.
        if len(unit_words) > max_words:
            if current_words:
                chunks.append(" ".join(current_words))
                current_words = current_words[-overlap_words:] if overlap_words > 0 else []
            step = max(1, max_words - overlap_words)
            for idx in range(0, len(unit_words), step):
                slice_words = unit_words[idx : idx + max_words]
                if slice_words:
                    chunks.append(" ".join(slice_words))
                if idx + max_words >= len(unit_words):
                    break
            current_words = unit_words[-overlap_words:] if overlap_words > 0 else []
            continue

        if current_words and len(current_words) + len(unit_words) > max_words:
            chunks.append(" ".join(current_words))
            tail = current_words[-overlap_words:] if overlap_words > 0 else []
            current_words = tail + unit_words
        else:
            current_words.extend(unit_words)

    if current_words:
        final_chunk = " ".join(current_words)
        if not chunks or chunks[-1] != final_chunk:
            chunks.append(final_chunk)

    return chunks


class OpenAICompatibleSLMDetector:
    """
    Layer 2/3 detector calling Ollama/vLLM OpenAI-compatible HTTP endpoints on pre-masked text.
    Splits long documents into overlapping chunks and dispatches up to `max_concurrency`
    chunks concurrently to leverage vLLM continuous batching + prefix caching.
    """

    is_post_mask = True

    def __init__(
        self,
        endpoint: str,
        *,
        rulebook_prompt: str = "",
        model: str = DEFAULT_SLM_MODEL,
        api_key: str | None = None,
        timeout_seconds: float = 15.0,
        max_concurrency: int = 8,
        max_chunk_words: int = 380,
        overlap_words: int = 25,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._endpoint = endpoint.rstrip("/")
        self._rulebook_prompt = rulebook_prompt.strip()
        self._model = (model or DEFAULT_SLM_MODEL).strip() or DEFAULT_SLM_MODEL
        self._api_key = api_key.strip() if api_key and api_key.strip() else None
        self._timeout = timeout_seconds
        self._max_concurrency = max(1, max_concurrency)
        self._max_chunk_words = max(50, max_chunk_words)
        self._overlap_words = max(0, min(overlap_words, self._max_chunk_words // 4))
        self._transport = transport

    def _target_url(self) -> str:
        if self._endpoint.endswith("/chat/completions"):
            return self._endpoint
        return f"{self._endpoint}/chat/completions"

    def _system_prompt(self) -> str:
        if self._rulebook_prompt:
            return f"{SLM_SYSTEM_PROMPT}\nRulebook: {self._rulebook_prompt[:2500]}"
        return SLM_SYSTEM_PROMPT

    async def _call_chunk(
        self,
        client: httpx.AsyncClient,
        semaphore: asyncio.Semaphore,
        chunk: str,
    ) -> list[tuple[str, str]]:
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"

        payload = {
            "model": self._model,
            "temperature": 0,
            "max_tokens": 256,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": self._system_prompt()},
                {"role": "user", "content": chunk},
            ],
        }
        url = self._target_url()
        async with semaphore:
            try:
                resp = await client.post(url, headers=headers, json=payload)
                resp.raise_for_status()
                content = resp.json()["choices"][0]["message"]["content"]
                parsed = json.loads(content)
            except Exception as exc:  # noqa: BLE001 — graceful fallback when GPU server is unreachable
                logger.warning("GPU SLM chunk skipped (%s): %s", url, exc)
                return []

        leftovers = parsed.get("leftovers", [])
        if not isinstance(leftovers, list):
            return []

        extracted: list[tuple[str, str]] = []
        for item in leftovers:
            if not isinstance(item, dict):
                continue
            needle = str(item.get("text", "")).strip()
            raw_type = str(item.get("type", "CUSTOM")).strip().upper()
            entity_type = raw_type if raw_type in VALID_ENTITY_TYPES else "CUSTOM"
            if not needle or needle.startswith("[") or _PLACEHOLDER_TOKEN_RE.search(needle):
                continue
            extracted.append((needle, entity_type))
        return extracted

    async def _extract_chunks_async(self, chunks: list[str]) -> list[tuple[str, str]]:
        semaphore = asyncio.Semaphore(self._max_concurrency)
        async with httpx.AsyncClient(
            timeout=self._timeout,
            transport=self._transport,
        ) as client:
            results = await asyncio.gather(
                *(self._call_chunk(client, semaphore, chunk) for chunk in chunks)
            )
        merged: list[tuple[str, str]] = []
        seen: set[tuple[str, str]] = set()
        for chunk_items in results:
            for needle, entity_type in chunk_items:
                key = (needle.lower(), entity_type)
                if key not in seen:
                    seen.add(key)
                    merged.append((needle, entity_type))
        return merged

    def _run_async(self, chunks: list[str]) -> list[tuple[str, str]]:
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.run(self._extract_chunks_async(chunks))
        with ThreadPoolExecutor(max_workers=1) as pool:
            return pool.submit(asyncio.run, self._extract_chunks_async(chunks)).result()

    def detect_post_mask(
        self,
        premasked_text: str,
        original_text: str,
    ) -> list[tuple[int, int, str, str, float]]:
        """Run chunked concurrent SLM extraction on pre-masked text and map offsets onto original_text."""
        if not premasked_text.strip() or should_skip_slm(premasked_text):
            return []

        chunks = chunk_text_for_slm(
            premasked_text,
            max_words=self._max_chunk_words,
            overlap_words=self._overlap_words,
        )
        if not chunks:
            return []

        extracted = self._run_async(chunks)
        spans: list[tuple[int, int, str, str, float]] = []
        for needle, entity_type in extracted:
            for match in re.finditer(re.escape(needle), original_text):
                spans.append((match.start(), match.end(), entity_type, "llm", 0.85))
        return spans

    def detect(self, text: str) -> list[tuple[int, int, str, str, float]]:
        """Direct single-text entry point (kept compatible with ExtraDetector)."""
        return self.detect_post_mask(text, text)
