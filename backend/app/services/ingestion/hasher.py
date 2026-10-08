"""SHA-256 hashing and duplicate detection for ingested documents.

compute_sha256   — synchronous; returns the lowercase hex digest.
check_duplicate  — async; returns an existing document_id when the same file
                   content has already been ingested, or None when it is new.

Design note: deduplication is by content hash, not by filename.  The same
physical file uploaded twice under different names is caught; two files with
the same name but different content are treated as distinct.
"""

from __future__ import annotations

import hashlib

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession


def compute_sha256(content: bytes) -> str:
    """Return the lowercase hexadecimal SHA-256 digest of *content*."""
    return hashlib.sha256(content).hexdigest()


async def check_duplicate(
    session: AsyncSession,
    file_hash: str,
) -> str | None:
    """Return an existing document_id whose SHA-256 matches *file_hash*.

    Returns None when no matching document is found, allowing the caller to
    proceed with ingestion.  The query uses the document_master table defined
    in app.models.document.

    Parameters
    ----------
    session:
        An active AsyncSession obtained from app.database.get_db.
    file_hash:
        Lowercase hexadecimal SHA-256 string (64 characters), as produced by
        compute_sha256().
    """
    stmt = text(
        "SELECT document_id FROM document_master "
        "WHERE file_hash_sha256 = :hash LIMIT 1"
    )
    result = await session.execute(stmt, {"hash": file_hash})
    row = result.fetchone()
    return row[0] if row else None
