from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for relational models."""


def _ensure_sqlite_dir(database_url: str) -> None:
    if not database_url.startswith("sqlite:///"):
        return
    raw_path = database_url.removeprefix("sqlite:///")
    if raw_path == ":memory:" or not raw_path:
        return
    Path(raw_path).parent.mkdir(parents=True, exist_ok=True)


def build_engine(database_url: str) -> Engine:
    """Create a SQLAlchemy engine with SQLite safety pragmas when applicable."""
    _ensure_sqlite_dir(database_url)
    is_sqlite = database_url.startswith("sqlite")
    connect_args = {"check_same_thread": False} if is_sqlite else {}
    engine = create_engine(database_url, connect_args=connect_args, pool_pre_ping=True)

    if is_sqlite:
        @event.listens_for(engine, "connect")
        def _set_sqlite_pragmas(dbapi_connection, _connection_record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON;")
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.close()

    return engine


settings = get_settings()
engine = build_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """Yield a request-scoped database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_schema_migrations(target_engine: Engine) -> None:
    """Apply lightweight idempotent column migrations for existing SQLite volumes."""
    inspector = inspect(target_engine)
    if not inspector.has_table("workspace_settings"):
        return

    existing_columns = {col["name"] for col in inspector.get_columns("workspace_settings")}
    additions = [
        ("gpu_llm_model", "VARCHAR(128) DEFAULT 'Qwen/Qwen2.5-7B-Instruct-AWQ'"),
        ("encrypted_gpu_llm_api_key", "TEXT"),
        ("gpu_llm_key_hint", "VARCHAR(32)"),
    ]
    missing = [(name, ddl) for name, ddl in additions if name not in existing_columns]
    if not missing:
        return

    with target_engine.begin() as conn:
        for name, ddl in missing:
            conn.execute(text(f"ALTER TABLE workspace_settings ADD COLUMN {name} {ddl}"))
