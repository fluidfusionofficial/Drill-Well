"""Wells API router.

Endpoints
---------
GET  /                   list / filter wells
GET  /{well_id}          full well profile (404 if not found)
GET  /{well_id}/timeline daily operations ordered by report_date
GET  /{well_id}/formations formation intervals (PROGNOSED + measured)
GET  /{well_id}/events   events with evidence; query: event_type, min_severity
GET  /{well_id}/documents source documents for this well
GET  /{well_id}/offsets  PostGIS offset wells within radius_km (default 5.0)
GET  /{well_id}/similar  similar-well ranking; query: limit (default 5)
GET  /{well_id}/depth-context events+formations within MD window; query: md, window_m

All routes use Depends(get_db) and delegate to app.services.wells /
app.services.similarity.  A 404 is raised when a well_id is not found.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.well import (
    DepthContextResponse,
    DocumentSummaryResponse,
    DailyOperationResponse,
    EventResponse,
    FormationIntervalResponse,
    OffsetWellResponse,
    SimilarWellResponse,
    WellDetailResponse,
    WellResponse,
)
from app.services.similarity import find_similar_wells
from app.services.wells import (
    get_depth_context,
    get_offset_wells,
    get_well,
    get_well_documents,
    get_well_events,
    get_well_formations,
    get_well_timeline,
    get_wells,
)

router = APIRouter(prefix="/wells", tags=["Wells"])


# ── 1. List wells ──────────────────────────────────────────────────────────────


@router.get(
    "",
    response_model=list[WellResponse],
    summary="List / filter wells",
)
async def list_wells(
    basin: str | None = Query(None, description="Filter by basin name (partial match)"),
    field: str | None = Query(None, description="Filter by field name (partial match)"),
    operator: str | None = Query(None, description="Filter by operator name (partial match)"),
    status: str | None = Query(None, description="Filter by status: COMPLETED | DRILLING | etc."),
    limit: int = Query(50, ge=1, le=200, description="Max records to return"),
    offset: int = Query(0, ge=0, description="Records to skip"),
    db: AsyncSession = Depends(get_db),
) -> list[WellResponse]:
    wells = await get_wells(
        db, basin=basin, field=field, operator=operator,
        status=status, limit=limit, offset=offset,
    )
    return wells  # type: ignore[return-value]


# ── 2. Well profile ────────────────────────────────────────────────────────────


@router.get(
    "/{well_id}",
    response_model=WellDetailResponse,
    summary="Full well profile",
)
async def get_well_profile(
    well_id: str,
    db: AsyncSession = Depends(get_db),
) -> WellDetailResponse:
    well = await get_well(db, well_id)
    if well is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Well '{well_id}' not found")
    return well  # type: ignore[return-value]


# ── 3. Timeline ────────────────────────────────────────────────────────────────


@router.get(
    "/{well_id}/timeline",
    response_model=list[DailyOperationResponse],
    summary="Daily drilling operations timeline",
)
async def get_timeline(
    well_id: str,
    db: AsyncSession = Depends(get_db),
) -> list[DailyOperationResponse]:
    well = await get_well(db, well_id)
    if well is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Well '{well_id}' not found")
    return await get_well_timeline(db, well_id)  # type: ignore[return-value]


# ── 4. Formations ──────────────────────────────────────────────────────────────


@router.get(
    "/{well_id}/formations",
    response_model=list[FormationIntervalResponse],
    summary="Formation intervals (PROGNOSED + measured)",
)
async def get_formations(
    well_id: str,
    db: AsyncSession = Depends(get_db),
) -> list[FormationIntervalResponse]:
    well = await get_well(db, well_id)
    if well is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Well '{well_id}' not found")
    return await get_well_formations(db, well_id)  # type: ignore[return-value]


# ── 5. Events ──────────────────────────────────────────────────────────────────


@router.get(
    "/{well_id}/events",
    response_model=list[EventResponse],
    summary="Drilling events with evidence",
)
async def get_events(
    well_id: str,
    event_type: str | None = Query(None, description="Filter by event type (partial match)"),
    min_severity: str | None = Query(None, description="Minimum severity: LOW | MEDIUM | HIGH | CRITICAL"),
    db: AsyncSession = Depends(get_db),
) -> list[EventResponse]:
    well = await get_well(db, well_id)
    if well is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Well '{well_id}' not found")
    return await get_well_events(db, well_id, event_type=event_type, min_severity=min_severity)  # type: ignore[return-value]


# ── 6. Documents ───────────────────────────────────────────────────────────────


@router.get(
    "/{well_id}/documents",
    response_model=list[DocumentSummaryResponse],
    summary="Source documents for a well",
)
async def get_documents(
    well_id: str,
    db: AsyncSession = Depends(get_db),
) -> list[DocumentSummaryResponse]:
    well = await get_well(db, well_id)
    if well is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Well '{well_id}' not found")
    return await get_well_documents(db, well_id)  # type: ignore[return-value]


# ── 7. Offset wells ────────────────────────────────────────────────────────────


@router.get(
    "/{well_id}/offsets",
    response_model=list[OffsetWellResponse],
    summary="Offset wells within a radius (PostGIS)",
)
async def get_offsets(
    well_id: str,
    radius_km: float = Query(5.0, gt=0.0, le=500.0, description="Search radius in kilometres"),
    db: AsyncSession = Depends(get_db),
) -> list[OffsetWellResponse]:
    well = await get_well(db, well_id)
    if well is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Well '{well_id}' not found")
    rows = await get_offset_wells(db, well_id, radius_km=radius_km)
    return rows  # type: ignore[return-value]


# ── 8. Similar wells ───────────────────────────────────────────────────────────


@router.get(
    "/{well_id}/similar",
    response_model=list[SimilarWellResponse],
    summary="Similar-well ranking (5-dimension explainable scoring)",
)
async def get_similar(
    well_id: str,
    limit: int = Query(5, ge=1, le=20, description="Max similar wells to return"),
    db: AsyncSession = Depends(get_db),
) -> list[SimilarWellResponse]:
    well = await get_well(db, well_id)
    if well is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Well '{well_id}' not found")
    results = await find_similar_wells(db, well_id, limit=limit)
    return results  # type: ignore[return-value]


# ── 9. Depth context ───────────────────────────────────────────────────────────


@router.get(
    "/{well_id}/depth-context",
    response_model=DepthContextResponse,
    summary="Events and formations within a depth window around a given MD",
)
async def get_depth_context_endpoint(
    well_id: str,
    md: float = Query(..., description="Centre depth, Measured Depth (m)"),
    window_m: float = Query(50.0, gt=0.0, description="Half-window size in metres (default 50)"),
    db: AsyncSession = Depends(get_db),
) -> DepthContextResponse:
    well = await get_well(db, well_id)
    if well is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Well '{well_id}' not found")
    ctx = await get_depth_context(db, well_id, md=md, window_m=window_m)
    return ctx  # type: ignore[return-value]
