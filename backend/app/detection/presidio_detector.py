from functools import lru_cache
import logging
import re
from typing import Any

from app.detection.pipeline import PERSON_STOPWORDS

logger = logging.getLogger(__name__)

# Map Presidio analyzer entity labels to NYXORA's unified placeholder categories.
PRESIDIO_ENTITY_MAP: dict[str, str] = {
    "PERSON": "PERSON",
    "ORGANIZATION": "COMPANY",
    "ORG": "COMPANY",
    "EMAIL_ADDRESS": "EMAIL",
    "PHONE_NUMBER": "PHONE",
    "LOCATION": "ADDRESS",
    "IBAN_CODE": "BANK",
    "CREDIT_CARD": "BANK",
    "US_BANK_NUMBER": "BANK",
    "US_SSN": "ID",
    "US_PASSPORT": "ID",
    "US_DRIVER_LICENSE": "ID",
    "US_ITIN": "ID",
    "UK_NHS": "ID",
    "MEDICAL_LICENSE": "ID",
}

PRESIDIO_SUPPORTED_ENTITIES: tuple[str, ...] = tuple(PRESIDIO_ENTITY_MAP.keys())

_PLACEHOLDER_TOKEN_RE = re.compile(r"^\[[A-Z]+_[0-9a-fA-F]{4,12}\]$")


class PresidioDetector:
    """Layer 1b NER detector backed by Microsoft Presidio + spaCy (no Presidio anonymizer)."""

    is_ml_ner = True

    def __init__(
        self,
        analyzer: Any,
        *,
        min_score: float = 0.45,
        language: str = "en",
    ) -> None:
        self._analyzer = analyzer
        self._min_score = min_score
        self._language = language

    def detect(self, text: str) -> list[tuple[int, int, str, str, float]]:
        if not text or not text.strip():
            return []

        try:
            results = self._analyzer.analyze(
                text=text,
                entities=list(PRESIDIO_SUPPORTED_ENTITIES),
                language=self._language,
                score_threshold=self._min_score,
            )
        except Exception as exc:  # noqa: BLE001 — never crash send gate if NLP engine fails
            logger.warning("Presidio analysis failed; falling back to rules: %s", exc)
            return []

        spans: list[tuple[int, int, str, str, float]] = []
        for res in results:
            score = float(getattr(res, "score", 0.0))
            if score < self._min_score:
                continue
            start = int(getattr(res, "start", -1))
            end = int(getattr(res, "end", -1))
            if not (0 <= start < end <= len(text)):
                continue

            matched = text[start:end].strip()
            if not matched or _PLACEHOLDER_TOKEN_RE.match(matched):
                continue

            raw_label = str(getattr(res, "entity_type", "")).upper()
            entity_type = PRESIDIO_ENTITY_MAP.get(raw_label)
            if entity_type is None:
                continue
            if entity_type == "PERSON" and matched.lower() in PERSON_STOPWORDS:
                continue

            spans.append((start, end, entity_type, "ner", round(score, 3)))
        return spans


def _build_presidio_analyzer(model_name: str) -> Any | None:
    """Initialize Presidio AnalyzerEngine with spaCy ORG support, or return None if unavailable."""
    try:
        from presidio_analyzer import AnalyzerEngine
        from presidio_analyzer.nlp_engine import NlpEngineProvider
        from presidio_analyzer.predefined_recognizers import SpacyRecognizer
    except ImportError:
        logger.warning(
            "presidio-analyzer is not installed in this environment; Layer 1 NER falls back to rules."
        )
        return None

    nlp_configuration = {
        "nlp_engine_name": "spacy",
        "models": [{"lang_code": "en", "model_name": model_name}],
        "ner_model_configuration": {
            "model_to_presidio_entity_mapping": {
                "PER": "PERSON",
                "PERSON": "PERSON",
                "ORG": "ORGANIZATION",
                "LOC": "LOCATION",
                "GPE": "LOCATION",
                "FAC": "LOCATION",
            },
            "low_confidence_score_multiplier": 0.4,
            "low_score_entity_names": [],
            "labels_to_ignore": [
                "CARDINAL",
                "ORDINAL",
                "QUANTITY",
                "PERCENT",
                "MONEY",
                "TIME",
                "DATE",
                "LANGUAGE",
                "LAW",
                "EVENT",
                "WORK_OF_ART",
                "PRODUCT",
                "NORP",
            ],
        },
    }

    try:
        nlp_engine = NlpEngineProvider(nlp_configuration=nlp_configuration).create_engine()
        analyzer = AnalyzerEngine(nlp_engine=nlp_engine, supported_languages=["en"])
        # Ensure spaCy ORG spans map into ORGANIZATION even on Presidio versions that omit ORG by default.
        analyzer.registry.add_recognizer(
            SpacyRecognizer(
                supported_language="en",
                supported_entities=["PERSON", "ORGANIZATION", "LOCATION"],
            )
        )
        return analyzer
    except Exception as exc:  # noqa: BLE001 — graceful fallback when spaCy model is missing
        logger.warning(
            "Could not initialize Presidio with spaCy model '%s' (%s); falling back to rules.",
            model_name,
            exc,
        )
        return None


@lru_cache(maxsize=4)
def get_presidio_detector(
    model_name: str = "en_core_web_lg",
    min_score: float = 0.45,
) -> PresidioDetector | None:
    """Return a cached PresidioDetector instance, or None if Presidio/spaCy is unavailable."""
    analyzer = _build_presidio_analyzer(model_name)
    if analyzer is None:
        return None
    return PresidioDetector(analyzer, min_score=min_score)
