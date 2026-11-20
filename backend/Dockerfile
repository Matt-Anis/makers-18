FROM python:3.12-slim

ARG SPACY_MODEL=en_core_web_lg

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Cache heavy NLP engine + spaCy model in its own layer so app dependency edits stay fast.
RUN uv pip install --system --no-cache "spacy>=3.7,<4.0" "presidio-analyzer>=2.2.354,<3.0" \
    && python -m spacy download "${SPACY_MODEL}"

COPY requirements.txt ./
RUN uv pip install --system --no-cache -r requirements.txt

COPY app ./app

RUN mkdir -p /data && chown 10001:10001 /data

USER 10001:10001
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
