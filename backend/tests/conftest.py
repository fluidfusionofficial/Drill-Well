"""Shared pytest fixtures for the NWIS test suite.

Database strategy
-----------------
Unit tests (normalization, ingestion, similarity, alerts) exercise pure Python
functions — they require no database at all.

API tests use httpx.AsyncClient with FastAPI's dependency-override mechanism to
inject a mock AsyncSession.  This keeps tests fast, avoids PostgreSQL-specific
types (PostGIS Geometry, ARRAY, JSONB), and allows fine-grained control of
query results via unittest.mock.

The async_engine and db_session fixtures are provided as a convenience for
future integration tests that do need lightweight DB access (SQLite / aiosqlite).
PostgreSQL-specific column types are only exercised in full integration tests
that run against a real PostgreSQL+PostGIS instance.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# ── In-memory SQLite engine ───────────────────────────────────────────────────
# Provided for future lightweight ORM tests; no tables are created here because
# the production models contain PostgreSQL-specific types (Geometry, ARRAY, JSONB).
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture(scope="session")
async def async_engine():
    """Session-scoped in-memory SQLite async engine."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(async_engine):
    """Per-test AsyncSession bound to the in-memory SQLite engine.

    No schema is created — use this fixture for tests that interact with the
    session object directly (e.g. testing ORM-layer helpers that don't need
    PostgreSQL-specific column types).
    """
    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as session:
        yield session


# ── Mock DB session for API tests ─────────────────────────────────────────────

@pytest.fixture
def mock_db():
    """An AsyncMock of AsyncSession — configure per-test for endpoint tests."""
    session = AsyncMock(spec=AsyncSession)
    # Default execute result — callers can override for specific queries.
    default_result = MagicMock()
    default_result.scalars.return_value.all.return_value = []
    default_result.scalar_one_or_none.return_value = None
    session.execute = AsyncMock(return_value=default_result)
    session.get = AsyncMock(return_value=None)
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    return session


@pytest_asyncio.fixture
async def api_client(mock_db):
    """httpx AsyncClient wired to the NWIS FastAPI app with a mocked DB session.

    Provides clean dependency injection: every ``Depends(get_db)`` call in the
    request handler receives the mock_db fixture instead of a live database
    session.  The override is cleared after the test to avoid cross-test leakage.
    """
    from app.database import get_db
    from app.main import app

    async def _override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = _override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        yield client
    app.dependency_overrides.clear()
