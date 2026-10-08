"""Alembic async migration environment for NWIS.

Uses asyncpg so that all database I/O matches the application's async engine.
The synchronous fallback path (run_migrations_offline) still uses the psycopg2
SYNC_DATABASE_URL so that alembic CLI tooling works without a live connection.
"""

from __future__ import annotations

import asyncio
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

# ── Application imports ────────────────────────────────────────────────────────
# Import Base so Alembic can discover all mapped tables via metadata.
from app.database import Base  # noqa: F401 — side-effect import

# Import every model module so their classes are registered on Base.metadata
# before autogenerate inspects it.  Add new model modules here as they grow.
import app.models  # noqa: F401

# ── Alembic Config object ──────────────────────────────────────────────────────
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override sqlalchemy.url with the environment variable so that the same
# alembic.ini works across local dev, Docker, and CI without modification.
_sync_url = os.environ.get("SYNC_DATABASE_URL") or os.environ.get(
    "DATABASE_URL", "postgresql+psycopg2://nwis:nwis_dev@localhost:5432/nwis"
).replace("postgresql+asyncpg://", "postgresql+psycopg2://")

config.set_main_option("sqlalchemy.url", _sync_url)

target_metadata = Base.metadata


# ── Offline migrations (no live DB connection required) ───────────────────────

def run_migrations_offline() -> None:
    """Emit SQL to stdout without connecting to the database.

    Useful for reviewing what a migration will do before applying it.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


# ── Online migrations (async, using asyncpg) ──────────────────────────────────

def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create an async engine and run migrations inside a sync-compatible wrapper."""
    # Build the async URL from the environment (asyncpg driver).
    async_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://nwis:nwis_dev@localhost:5432/nwis",
    )

    # Temporarily override the config URL with the async variant.
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = async_url

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
