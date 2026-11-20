from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import get_settings
from app.db import Base, SessionLocal, engine
from app.routers.auth import router as auth_router
from app.seed import seed_demo_users


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Initialize relational tables and optionally seed demo accounts on startup."""
    Base.metadata.create_all(bind=engine)
    settings = get_settings()
    if settings.seed_demo_users:
        with SessionLocal() as db:
            seed_demo_users(db)
    yield


app = FastAPI(title="Contract Privacy Gateway", lifespan=lifespan)
app.include_router(auth_router)


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness check endpoint."""
    return {"status": "ok"}
