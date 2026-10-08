"""Full-text search service (stub — full implementation pending pgvector integration)."""

from __future__ import annotations

from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession


async def search(
    db: AsyncSession,
    query: str,
    *,
    well_ids: Optional[list[str]] = None,
    document_types: Optional[list[str]] = None,
    limit: int = 20,
) -> list[dict]:
    """Return ranked search results for *query* across ingested documents.

    This stub always returns an empty list.  The full implementation will
    use PostgreSQL full-text search (tsvector/tsquery) with pgvector for
    semantic re-ranking.
    """
    return []
