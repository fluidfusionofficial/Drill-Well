"""Service function for source document provenance queries."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.document import Document


async def get_source_document(
    db: AsyncSession,
    document_id: str,
) -> Document | None:
    """Return a Document with pages and tables eagerly loaded, or None."""
    stmt = (
        select(Document)
        .options(
            selectinload(Document.pages),
            selectinload(Document.tables),
        )
        .where(Document.document_id == document_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
