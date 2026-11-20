from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    database_url: str = "sqlite:///./data/gateway.db"
    redis_url: str = "redis://localhost:6379/0"

    auth_cookie_name: str = "cpg_session"
    auth_cookie_secure: bool = False
    auth_session_ttl_seconds: int = 8 * 3600

    vault_ttl_seconds: int = 2 * 3600
    vault_encryption_key: str = ""
    ephemeral_vaults_only: bool = False

    history_max_messages: int = 24
    history_max_chars: int = 48_000

    seed_demo_users: bool = False


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()
