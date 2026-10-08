"""SQLAlchemy 2.0 async database engine, session factory, and declarative base.

Design constraints:
- Async-first: all application code uses AsyncSession.
- get_db() is a FastAPI dependency that yields a session per request and
  guarantees rollback on error.
- Base is imported by every model module and by Alembic's env.py so that
  autogenerate can discover the full schema.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# ── Engine ─────────────────────────────────────────────────────────────────────
# echo=True in DEBUG mode so SQL statements are logged during development.
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# ── Session factory ────────────────────────────────────────────────────────────
# expire_on_commit=False prevents lazy-loading errors after commit when objects
# are still accessed within the same request scope.
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ── Declarative base ───────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    """Shared declarative base for all ORM models.

    Import this class (not DeclarativeBase directly) in every model file so
    Alembic's metadata discovery works correctly.
    """


# ── FastAPI dependency ─────────────────────────────────────────────────────────

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an AsyncSession for the duration of a single request.

    Rolls back the transaction on any unhandled exception and always closes
    the session, returning the connection to the pool.

    Usage::

        @router.get("/example")
        async def example(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
