from datetime import datetime

from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import require_roles
from app.config import Settings, get_settings
from app.db import get_db
from app.detection.presidio_detector import get_presidio_detector
from app.detection.slm_client import OpenAICompatibleSLMDetector
from app.evaluation.runner import run_evaluation_suite
from app.models import AuditLog, CustomRule, EvaluationRun, User, UserRole, WorkspaceSettings
from app.security import decrypt_secret, get_secret_fernet

router = APIRouter(prefix="/metrics", tags=["metrics"])


class EntityMetricOut(BaseModel):
    type: str
    recall: float | None = None
    precision: float | None = None
    tp: int
    fp: int
    fn: int
    support: int


class AblationLayerOut(BaseModel):
    key: str
    label: str
    recall: float | None = None
    precision: float | None = None
    leak_free_rate: float | None = None
    active: bool
    note: str | None = None


class DatasetMetricsOut(BaseModel):
    document_count: int
    overall_recall: float
    overall_precision: float
    leak_free_rate: float
    unmask_round_trip: float
    tp: int
    fp: int
    fn: int
    per_entity: list[EntityMetricOut]
    ablation: list[AblationLayerOut]


class EvaluationRunRequest(BaseModel):
    include_gpu_slm: bool = False


class MetricsReportOut(BaseModel):
    has_run: bool
    run_id: str | None = None
    created_at: datetime | None = None
    duration_ms: int | None = None
    presidio_active: bool = False
    gpu_slm_configured: bool = False
    gpu_slm_active: bool = False
    synthetic: DatasetMetricsOut | None = None
    realistic: DatasetMetricsOut | None = None


def _is_gpu_slm_configured(ws: WorkspaceSettings | None) -> bool:
    return bool(ws and ws.gpu_llm_enabled and ws.gpu_llm_endpoint)


def _serialize_run(run: EvaluationRun | None, *, gpu_slm_configured: bool) -> MetricsReportOut:
    if run is None:
        return MetricsReportOut(has_run=False, gpu_slm_configured=gpu_slm_configured)

    synthetic_raw = run.payload.get("synthetic")
    realistic_raw = run.payload.get("realistic")
    return MetricsReportOut(
        has_run=True,
        run_id=run.id,
        created_at=run.created_at,
        duration_ms=run.duration_ms,
        presidio_active=run.presidio_active,
        gpu_slm_configured=gpu_slm_configured,
        gpu_slm_active=run.gpu_slm_active,
        synthetic=DatasetMetricsOut.model_validate(synthetic_raw) if synthetic_raw else None,
        realistic=DatasetMetricsOut.model_validate(realistic_raw) if realistic_raw else None,
    )


@router.get("/latest", response_model=MetricsReportOut)
def get_latest_metrics(
    _owner: User = Depends(require_roles(UserRole.OWNER)),
    db: Session = Depends(get_db),
) -> MetricsReportOut:
    """Return the most recent evaluation & layer-ablation run (owner only)."""
    ws = db.get(WorkspaceSettings, "default")
    latest = db.scalar(
        select(EvaluationRun).order_by(EvaluationRun.created_at.desc()).limit(1)
    )
    return _serialize_run(latest, gpu_slm_configured=_is_gpu_slm_configured(ws))


@router.post("/run", response_model=MetricsReportOut)
def trigger_evaluation_run(
    payload: EvaluationRunRequest | None = Body(default=None),
    owner: User = Depends(require_roles(UserRole.OWNER)),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> MetricsReportOut:
    """Run the contract detection & ablation benchmark against active layers and persist results."""
    include_gpu = bool(payload.include_gpu_slm) if payload else False
    ws = db.get(WorkspaceSettings, "default")
    gpu_configured = _is_gpu_slm_configured(ws)

    custom_rules = list(
        db.scalars(
            select(CustomRule)
            .where(CustomRule.enabled.is_(True))
            .order_by(CustomRule.created_at.asc())
        )
    )

    presidio = None
    if settings.presidio_enabled:
        presidio = get_presidio_detector(
            model_name=settings.presidio_model,
            min_score=settings.presidio_min_score,
        )

    slm_detector = None
    if include_gpu and ws is not None and ws.gpu_llm_enabled and ws.gpu_llm_endpoint:
        slm_api_key: str | None = None
        if ws.encrypted_gpu_llm_api_key:
            slm_api_key = decrypt_secret(ws.encrypted_gpu_llm_api_key, get_secret_fernet())
        slm_detector = OpenAICompatibleSLMDetector(
            ws.gpu_llm_endpoint,
            rulebook_prompt=ws.rulebook_prompt,
            model=ws.gpu_llm_model or "Qwen/Qwen2.5-7B-Instruct-AWQ",
            api_key=slm_api_key,
            timeout_seconds=12.0,
        )

    report_payload, duration_ms = run_evaluation_suite(
        custom_rules=custom_rules,
        presidio_detector=presidio,
        slm_detector=slm_detector,
    )

    run = EvaluationRun(
        triggered_by_user_id=owner.id,
        include_gpu_slm=include_gpu,
        presidio_active=presidio is not None,
        gpu_slm_active=slm_detector is not None,
        duration_ms=duration_ms,
        payload=report_payload,
    )
    db.add(run)
    db.add(AuditLog(user_id=owner.id, action="metrics.evaluated"))
    db.commit()
    db.refresh(run)
    return _serialize_run(run, gpu_slm_configured=gpu_configured)
