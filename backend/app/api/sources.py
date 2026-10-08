"""Sources (document provenance) API router.

Endpoints
---------
GET /{document_id}    Full document record with OCR pages and extracted tables.

Used by the provenance drawer in the NWIS frontend to render the original
source snippet alongside any extracted fact.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.source import SourceDocumentDetailResponse
from app.services.sources import get_source_document

router = APIRouter(prefix="/sources", tags=["Sources"])


# ── 18. Document detail ────────────────────────────────────────────────────────


@router.get(
    "/{document_id}",
    response_model=SourceDocumentDetailResponse,
    summary="Full source document detail with pages and extracted tables",
)
async def get_document_detail(
    document_id: str,
    db: AsyncSession = Depends(get_db),
) -> SourceDocumentDetailResponse:
    """Return a Document record with its OCR pages and extracted tables.

    Used by the provenance drawer to render the source snippet that backs
    any extracted fact.  Returns 404 if document_id is not found.
    """
    doc = await get_source_document(db, document_id)
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Source document '{document_id}' not found",
        )
    return doc  # type: ignore[return-value]
