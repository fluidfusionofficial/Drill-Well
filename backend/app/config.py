"""Application configuration via Pydantic BaseSettings.

All settings are read from environment variables (or a .env file).
Defaults are suitable for local development; override in production.
"""

from __future__ import annotations

from typing import List

from pydantic import AnyUrl, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central settings object.  Instantiate once and import the singleton."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application metadata ───────────────────────────────────────────────────
    APP_NAME: str = "NWIS"
    API_PREFIX: str = "/api"
    DEBUG: bool = False

    # ── Database ───────────────────────────────────────────────────────────────
    # Async URL (asyncpg) used at runtime by SQLAlchemy
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://nwis:nwis_dev@localhost:5432/nwis",
        description="SQLAlchemy async database URL (asyncpg driver)",
    )
    # Synchronous URL (psycopg2) used by Alembic migrations
    SYNC_DATABASE_URL: str = Field(
        default="postgresql+psycopg2://nwis:nwis_dev@localhost:5432/nwis",
        description="SQLAlchemy sync database URL (psycopg2 driver, Alembic only)",
    )

    # ── Redis / Celery ─────────────────────────────────────────────────────────
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL",
    )
    CELERY_BROKER_URL: str = Field(
        default="redis://localhost:6379/1",
        description="Celery broker URL",
    )
    CELERY_RESULT_BACKEND: str = Field(
        default="redis://localhost:6379/2",
        description="Celery result backend URL",
    )

    # ── File storage ───────────────────────────────────────────────────────────
    STORAGE_PATH: str = Field(
        default="./storage/uploads",
        description="Local filesystem path for uploaded source documents",
    )

    # ── CORS ───────────────────────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:8080"],
        description="Allowed CORS origins (no trailing slash)",
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _parse_cors_origins(cls, v: object) -> List[str]:
        """Accept either a Python list or a comma-separated string."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return list(v)  # type: ignore[arg-type]

    # ── Auth ───────────────────────────────────────────────────────────────────
    SECRET_KEY: str = Field(
        default="change-me-before-production",
        description="JWT signing secret — must be overridden in production",
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ── Derived helpers ────────────────────────────────────────────────────────

    @property
    def async_db_url(self) -> str:
        """Canonical async DB URL (asyncpg driver)."""
        return self.DATABASE_URL

    @property
    def sync_db_url(self) -> str:
        """Canonical sync DB URL for Alembic (psycopg2 driver)."""
        return self.SYNC_DATABASE_URL


# Module-level singleton — import this everywhere in the application.
settings = Settings()
