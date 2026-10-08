"""Search API router.

Endpoints
---------
POST /    Full-text / semantic search across document OCR text.

Returns a ranked list of SearchResultResponse records with snippet,
well context, and relevance score.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.search import SearchRequest, SearchResultResponse
from app.services.search import search

router = APIRouter(prefix="/search", tags=["Search"])


# ── 12. Search ─────────────────────────────────────────────────────────────────


@router.post(
    "",
    response_model=list[SearchResultResponse],
    summary="Full-text search across ingested documents",
)
async def search_documents(
    request: SearchRequest,
    db: AsyncSession = Depends(get_db),
) -> list[SearchResultResponse]:
    """Search document OCR text for the query string.

    Optionally restrict to specific well_ids or document_types.
    Results are ordered by relevance score (descending).
    """
    results = await search(
        db,
        request.q,
        well_ids=request.well_ids,
        document_types=request.document_types,
        limit=request.limit,
    )
    return results  # type: ignore[return-value]
