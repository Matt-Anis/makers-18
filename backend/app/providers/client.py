import logging

import httpx

logger = logging.getLogger(__name__)

MASKED_SYSTEM_PROMPT = (
    "You are a legal and contract analysis assistant operating behind a zero-trust privacy gateway. "
    "All sensitive entities in user messages have been replaced with opaque bracketed tokens such as "
    "[PERSON_a1b2c3] or [COMPANY_4d5e6f]. Preserve every bracketed token verbatim in your response and "
    "never attempt to guess or reconstruct the underlying values."
)

ANTHROPIC_THINKING_BUDGETS = {
    "low": 1024,
    "medium": 2048,
    "high": 4096,
}


class ProviderCallError(Exception):
    """Raised when an upstream LLM provider call fails or is misconfigured."""

    def __init__(self, detail: str, *, status_code: int = 502) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def _build_mock_reply(model: str, masked_messages: list[tuple[str, str]], thinking_effort: str) -> str:
    last_user = next(
        (content for role, content in reversed(masked_messages) if role == "user"),
        "",
    )
    return (
        f"[NYXORA Mock ({model}, thinking={thinking_effort})] "
        f"Reviewed sanitized input ({len(masked_messages)} turn(s)): {last_user}"
    )


def send_masked_chat(
    provider: str,
    model: str,
    masked_messages: list[tuple[str, str]],
    *,
    api_key: str | None = None,
    base_url: str | None = None,
    thinking_effort: str = "medium",
    timeout_seconds: float = 45.0,
) -> str:
    """
    Dispatch only masked conversation history to the configured AI provider and return the
    complete non-streaming response text.
    """
    if provider == "mock":
        return _build_mock_reply(model, masked_messages, thinking_effort)

    try:
        if provider in ("openai", "openai_compatible"):
            resolved_base = (base_url or "https://api.openai.com/v1").rstrip("/")
            headers = {"Content-Type": "application/json"}
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"

            payload: dict[str, object] = {
                "model": model,
                "messages": [{"role": "system", "content": MASKED_SYSTEM_PROMPT}]
                + [{"role": role, "content": text} for role, text in masked_messages],
            }
            if provider == "openai" and model.lower().startswith(("o1", "o3", "o4", "gpt-5")):
                payload["reasoning_effort"] = thinking_effort

            resp = httpx.post(
                f"{resolved_base}/chat/completions",
                headers=headers,
                json=payload,
                timeout=timeout_seconds,
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            if not isinstance(content, str):
                raise ProviderCallError("Upstream OpenAI-compatible provider returned empty content")
            return content

        if provider == "anthropic":
            resolved_base = (base_url or "https://api.anthropic.com").rstrip("/")
            if not api_key:
                raise ProviderCallError("Anthropic API key is missing", status_code=400)
            payload = {
                "model": model,
                "max_tokens": 2048,
                "system": MASKED_SYSTEM_PROMPT,
                "messages": [{"role": role, "content": text} for role, text in masked_messages],
            }
            lowered = model.lower()
            if "3-7" in lowered or "sonnet-4" in lowered or "opus-4" in lowered:
                budget = ANTHROPIC_THINKING_BUDGETS.get(thinking_effort, 2048)
                payload["max_tokens"] = budget + 1024
                payload["thinking"] = {"type": "enabled", "budget_tokens": budget}

            resp = httpx.post(
                f"{resolved_base}/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json=payload,
                timeout=timeout_seconds,
            )
            resp.raise_for_status()
            data = resp.json()
            parts = [
                block.get("text", "")
                for block in data.get("content", [])
                if isinstance(block, dict) and block.get("type") == "text"
            ]
            combined = "\n".join(part for part in parts if part).strip()
            if not combined:
                raise ProviderCallError("Anthropic returned an empty response")
            return combined

        if provider == "gemini":
            resolved_base = (
                base_url or "https://generativelanguage.googleapis.com/v1beta"
            ).rstrip("/")
            if not api_key:
                raise ProviderCallError("Gemini API key is missing", status_code=400)
            payload = {
                "systemInstruction": {"parts": [{"text": MASKED_SYSTEM_PROMPT}]},
                "contents": [
                    {
                        "role": "model" if role == "assistant" else "user",
                        "parts": [{"text": text}],
                    }
                    for role, text in masked_messages
                ],
            }
            resp = httpx.post(
                f"{resolved_base}/models/{model}:generateContent",
                params={"key": api_key},
                json=payload,
                timeout=timeout_seconds,
            )
            resp.raise_for_status()
            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                raise ProviderCallError("Gemini returned no candidates")
            parts = [
                part.get("text", "")
                for part in candidates[0].get("content", {}).get("parts", [])
                if isinstance(part, dict)
            ]
            combined = "\n".join(part for part in parts if part).strip()
            if not combined:
                raise ProviderCallError("Gemini returned an empty response")
            return combined

        raise ProviderCallError(f"Unsupported provider '{provider}'", status_code=400)
    except ProviderCallError:
        raise
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "Provider %s returned HTTP %s: %s",
            provider,
            exc.response.status_code,
            exc.response.text[:300],
        )
        raise ProviderCallError(
            f"Upstream provider '{provider}' returned HTTP {exc.response.status_code}",
            status_code=502,
        ) from exc
    except Exception as exc:
        logger.warning("Provider %s request failed: %s", provider, exc)
        raise ProviderCallError(
            f"Upstream provider '{provider}' request failed",
            status_code=502,
        ) from exc
