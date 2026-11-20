from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import get_settings
from app.db import Base, SessionLocal, engine, ensure_schema_migrations
from app.routers.audit import router as audit_router
from app.routers.auth import router as auth_router
from app.routers.providers import router as providers_router
from app.routers.rules import router as rules_router
from app.routers.sessions import router as sessions_router
from app.routers.settings import router as settings_router
from app.seed import (
    ensure_default_workspace_settings,
    normalize_legacy_roles,
    seed_demo_users,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Initialize relational tables and optionally seed demo accounts on startup."""
    Base.metadata.create_all(bind=engine)
    ensure_schema_migrations(engine)
    settings = get_settings()
    with SessionLocal() as db:
        normalize_legacy_roles(db)
        ensure_default_workspace_settings(db)
        if settings.seed_demo_users:
            seed_demo_users(db)
    yield


app = FastAPI(title="Contract Privacy Gateway", lifespan=lifespan)
app.include_router(auth_router)
app.include_router(sessions_router)
app.include_router(audit_router)
app.include_router(settings_router)
app.include_router(providers_router)
app.include_router(rules_router)


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness check endpoint."""
    return {"status": "ok"}
