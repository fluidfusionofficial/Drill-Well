"""Well data-access service layer.

All functions accept an AsyncSession and return ORM model instances or
plain dicts suitable for serialisation by the Wells API router.

MD and TVD are stored separately in DailyOperation.present_depth_md and
FormationInterval.top_md / top_tvd — never silently interchanged.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.event import Event
from app.models.formation import FormationInterval
from app.models.operation import DailyOperation
from app.models.well import WellMaster


async def get_wells(
    db: AsyncSession,
    *,
    basin: Optional[str] = None,
    field: Optional[str] = None,
    operator: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> list[WellMaster]:
    """Return a filtered list of WellMaster records."""
    stmt = select(WellMaster)
    if basin:
        stmt = stmt.where(WellMaster.basin.ilike(f"%{basin}%"))
    if field:
        stmt = stmt.where(WellMaster.field.ilike(f"%{field}%"))
    if operator:
        stmt = stmt.where(WellMaster.operator.ilike(f"%{operator}%"))
    if status:
        stmt = stmt.where(WellMaster.status == status.upper())
    stmt = stmt.order_by(WellMaster.well_id).limit(limit).offset(offset)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_well(db: AsyncSession, well_id: str) -> Optional[WellMaster]:
    """Return the WellMaster for *well_id*, or None if not found."""
    result = await db.execute(
        select(WellMaster).where(WellMaster.well_id == well_id)
    )
    return result.scalar_one_or_none()


async def get_well_timeline(db: AsyncSession, well_id: str) -> list[DailyOperation]:
    """Return daily operations for *well_id* ordered by report_date ascending."""
    result = await db.execute(
        select(DailyOperation)
        .where(DailyOperation.well_id == well_id)
        .order_by(DailyOperation.report_date.asc())
    )
    return list(result.scalars().all())


async def get_well_formations(db: AsyncSession, well_id: str) -> list[FormationInterval]:
    """Return all formation intervals for *well_id* ordered by top_md."""
    result = await db.execute(
        select(FormationInterval)
        .where(FormationInterval.well_id == well_id)
        .order_by(FormationInterval.top_md.asc())
    )
    return list(result.scalars().all())


async def get_well_events(
    db: AsyncSession,
    well_id: str,
    *,
    event_type: Optional[str] = None,
    min_severity: Optional[str] = None,
) -> list[Event]:
    """Return events for *well_id*, optionally filtered by type and severity."""
    _severity_order = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}
    stmt = select(Event).where(Event.well_id == well_id)
    if event_type:
        stmt = stmt.where(Event.event_type.ilike(f"%{event_type}%"))
    result = await db.execute(stmt.order_by(Event.depth_md.asc()))
    events = list(result.scalars().all())
    if min_severity:
        min_rank = _severity_order.get(min_severity.upper(), 0)
        events = [e for e in events if _severity_order.get(e.severity or "LOW", 0) >= min_rank]
    return events


async def get_well_documents(db: AsyncSession, well_id: str) -> list[Document]:
    """Return all source documents associated with *well_id*."""
    result = await db.execute(
        select(Document).where(Document.well_id == well_id)
    )
    return list(result.scalars().all())


async def get_offset_wells(
    db: AsyncSession,
    well_id: str,
    *,
    radius_km: float = 5.0,
) -> list[dict]:
    """Return wells within *radius_km* of *well_id* (PostGIS stub).

    This stub returns an empty list until PostGIS queries are implemented.
    """
    return []


async def get_depth_context(
    db: AsyncSession,
    well_id: str,
    *,
    centre_md: float,
    window_m: float = 50.0,
) -> dict:
    """Return events and formations within *window_m* of *centre_md* for *well_id*."""
    events_result = await db.execute(
        select(Event)
        .where(Event.well_id == well_id)
        .where(Event.depth_md >= centre_md - window_m)
        .where(Event.depth_md <= centre_md + window_m)
    )
    formations_result = await db.execute(
        select(FormationInterval)
        .where(FormationInterval.well_id == well_id)
        .where(FormationInterval.top_md >= centre_md - window_m)
        .where(FormationInterval.top_md <= centre_md + window_m)
    )
    return {
        "well_id": well_id,
        "centre_md": centre_md,
        "window_m": window_m,
        "events": list(events_result.scalars().all()),
        "formations": list(formations_result.scalars().all()),
    }
