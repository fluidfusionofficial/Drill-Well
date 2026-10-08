"""Well knowledge aggregation — the core "intelligence page" data provider.

Every query scopes to a single well_id. No silent cross-well data borrowing.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.event import Event
from app.models.formation import FormationInterval, FormationMaster
from app.models.mud import MudRecord
from app.models.operation import DailyOperation
from app.models.well import WellLocation, WellMaster


async def get_well_profile(session: AsyncSession, well_id: str) -> Optional[dict]:
    """Full well master profile with location."""
    well = (
        await session.execute(
            select(WellMaster).where(WellMaster.well_id == well_id)
        )
    ).scalar_one_or_none()
    if not well:
        return None

    location = (
        await session.execute(
            select(WellLocation).where(WellLocation.well_id == well_id)
        )
    ).scalar_one_or_none()

    event_count = (
        await session.execute(
            select(Event.event_id).where(Event.well_id == well_id)
        )
    ).all()

    return {
        "well": well,
        "location": location,
        "event_count": len(event_count),
    }


async def get_well_timeline(session: AsyncSession, well_id: str) -> list:
    """Daily operations for the well, ordered by date."""
    stmt = (
        select(DailyOperation)
        .where(DailyOperation.well_id == well_id)
        .order_by(DailyOperation.operation_date)
    )
    return list((await session.execute(stmt)).scalars().all())


async def get_well_formations(session: AsyncSession, well_id: str) -> list[dict]:
    """Formation intervals with source type breakdown."""
    stmt = (
        select(FormationInterval, FormationMaster)
        .outerjoin(
            FormationMaster,
            FormationInterval.formation_id == FormationMaster.formation_id,
        )
        .where(FormationInterval.well_id == well_id)
        .order_by(FormationInterval.top_md)
    )
    rows = (await session.execute(stmt)).all()
    return [
        {
            "interval": interval,
            "canonical_name": master.canonical_name if master else None,
        }
        for interval, master in rows
    ]


async def get_well_events(
    session: AsyncSession,
    well_id: str,
    event_type: Optional[str] = None,
    min_severity: Optional[str] = None,
) -> list:
    """Historical events with optional filters."""
    severity_order = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}
    stmt = select(Event).where(Event.well_id == well_id)
    if event_type:
        stmt = stmt.where(Event.event_type == event_type)
    stmt = stmt.order_by(Event.start_md)
    events = list((await session.execute(stmt)).scalars().all())

    if min_severity and min_severity in severity_order:
        threshold = severity_order[min_severity]
        events = [
            e
            for e in events
            if severity_order.get(e.severity, 0) >= threshold
        ]
    return events


async def get_well_documents(session: AsyncSession, well_id: str) -> list:
    """Source documents linked to this well."""
    stmt = (
        select(Document)
        .where(Document.well_id == well_id)
        .order_by(Document.ingestion_timestamp)
    )
    return list((await session.execute(stmt)).scalars().all())


async def get_depth_context(
    session: AsyncSession,
    well_id: str,
    md: float,
    window_m: float = 50.0,
) -> dict:
    """Events, formations, and mud records within a depth window around *md*.

    This is the "what happened here?" query — the heart of NWIS decision support.
    """
    top = md - window_m
    bottom = md + window_m

    events_stmt = (
        select(Event)
        .where(Event.well_id == well_id)
        .where(Event.start_md >= top)
        .where(Event.start_md <= bottom)
        .order_by(Event.start_md)
    )
    events = list((await session.execute(events_stmt)).scalars().all())

    formations_stmt = (
        select(FormationInterval)
        .where(FormationInterval.well_id == well_id)
        .where(FormationInterval.top_md <= bottom)
        .where(
            (FormationInterval.base_md >= top) | (FormationInterval.base_md.is_(None))
        )
        .order_by(FormationInterval.top_md)
    )
    formations = list((await session.execute(formations_stmt)).scalars().all())

    mud_stmt = (
        select(MudRecord)
        .where(MudRecord.well_id == well_id)
        .where(MudRecord.start_md <= bottom)
        .where((MudRecord.end_md >= top) | (MudRecord.end_md.is_(None)))
        .order_by(MudRecord.start_md)
    )
    mud_records = list((await session.execute(mud_stmt)).scalars().all())

    return {
        "well_id": well_id,
        "center_md": md,
        "window_m": window_m,
        "events": events,
        "formations": formations,
        "mud_records": mud_records,
    }
