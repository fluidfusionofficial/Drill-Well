"""PostGIS spatial query service for offset well discovery.

Uses ST_DWithin on geography for geodetically accurate distance queries.
Falls back to Haversine when PostGIS is unavailable.
"""

from __future__ import annotations

import math
from typing import Optional

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.well import WellLocation, WellMaster


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance between two lat/lon points in kilometres."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def find_offset_wells(
    session: AsyncSession,
    well_id: str,
    radius_km: float = 5.0,
) -> list[dict]:
    """Find wells within *radius_km* of the given well using PostGIS.

    Returns list of dicts: {well: WellMaster, distance_km: float} sorted
    by distance ascending.  Falls back to Haversine scan if PostGIS is
    not available or the active well has no geometry.
    """
    active_loc = (
        await session.execute(
            select(WellLocation).where(WellLocation.well_id == well_id)
        )
    ).scalar_one_or_none()

    if active_loc is None:
        return []

    radius_m = radius_km * 1000

    try:
        stmt = (
            select(
                WellMaster,
                func.ST_Distance(
                    func.ST_GeogFromWKB(WellLocation.geom),
                    func.ST_GeogFromWKB(active_loc.geom),
                ).label("distance_m"),
            )
            .join(WellLocation, WellLocation.well_id == WellMaster.well_id)
            .where(WellMaster.well_id != well_id)
            .where(
                func.ST_DWithin(
                    func.ST_GeogFromWKB(WellLocation.geom),
                    func.ST_GeogFromWKB(active_loc.geom),
                    radius_m,
                )
            )
            .order_by("distance_m")
        )
        rows = (await session.execute(stmt)).all()
        return [
            {"well": row[0], "distance_km": round(row[1] / 1000, 3)}
            for row in rows
        ]
    except Exception:
        return await _haversine_fallback(session, well_id, active_loc, radius_km)


async def _haversine_fallback(
    session: AsyncSession,
    well_id: str,
    active_loc: WellLocation,
    radius_km: float,
) -> list[dict]:
    """Fallback: load all well locations and compute Haversine distances."""
    stmt = (
        select(WellMaster, WellLocation)
        .join(WellLocation, WellLocation.well_id == WellMaster.well_id)
        .where(WellMaster.well_id != well_id)
    )
    rows = (await session.execute(stmt)).all()
    results = []
    for well, loc in rows:
        if loc.latitude is None or loc.longitude is None:
            continue
        d = haversine_distance(
            float(active_loc.latitude),
            float(active_loc.longitude),
            float(loc.latitude),
            float(loc.longitude),
        )
        if d <= radius_km:
            results.append({"well": well, "distance_km": round(d, 3)})
    results.sort(key=lambda r: r["distance_km"])
    return results


async def find_wells_in_bbox(
    session: AsyncSession,
    min_lat: float,
    min_lng: float,
    max_lat: float,
    max_lng: float,
) -> list[WellMaster]:
    """Return wells whose location falls within a bounding box."""
    stmt = (
        select(WellMaster)
        .join(WellLocation, WellLocation.well_id == WellMaster.well_id)
        .where(WellLocation.latitude >= min_lat)
        .where(WellLocation.latitude <= max_lat)
        .where(WellLocation.longitude >= min_lng)
        .where(WellLocation.longitude <= max_lng)
    )
    return list((await session.execute(stmt)).scalars().all())
