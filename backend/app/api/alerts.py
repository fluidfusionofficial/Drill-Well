"""Alerts API router.

This router has prefix="" — main.py mounts it at /api/alerts.

Endpoints (relative to /api/alerts mount)
------------------------------------------
POST /active-context          Evaluate historical-context alerts at bit_md.
GET  /                        List stored alerts; query: active_well_id, status.
POST /{alert_id}/dismiss      Deactivate an alert.

Advisory-language rule: all advisory_text in alert records uses
'recorded precedent' / 'historical context' language only.
NWIS is decision-support only — never autonomous operational commands.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.alert import (
    ActiveContextRequest,
    ActiveContextResponse,
    AlertDismissRequest,
    AlertResponse,
)
from app.services.alerts import (
    dismiss_alert_in_db,
    get_active_context_alerts,
    get_alerts_from_db,
)

router = APIRouter(prefix="", tags=["Alerts"])


# ── 13. Active context ─────────────────────────────────────────────────────────


@router.post(
    "/active-context",
    response_model=ActiveContextResponse,
    summary="Evaluate historical-context alerts for current bit position",
)
async def post_active_context(
    body: ActiveContextRequest,
    db: AsyncSession = Depends(get_db),
) -> ActiveContextResponse:
    """Return historical-context alerts relevant to the current bit position.

    Looks up offset well events near body.bit_md and applies the Level 1
    deterministic alert engine.  Alerts use 'recorded precedent' /
    'historical context' language — never predictions or commands.
    """
    alerts = await get_active_context_alerts(db, body.well_id, body.bit_md)
    return ActiveContextResponse(
        well_id=body.well_id,
        bit_md=body.bit_md,
        depth_reference_type="MD",
        alerts=alerts,  # type: ignore[arg-type]
    )


# ── 14. List alerts ────────────────────────────────────────────────────────────


@router.get(
    "",
    response_model=list[AlertResponse],
    summary="List stored alerts",
)
async def list_alerts(
    active_well_id: str | None = Query(
        None, description="Filter alerts to this well ID"
    ),
    is_active: bool | None = Query(
        None, description="True = active only, False = inactive only, omit = all"
    ),
    db: AsyncSession = Depends(get_db),
) -> list[AlertResponse]:
    """Return stored Alert rows optionally filtered by well and active status."""
    alerts = await get_alerts_from_db(db, active_well_id=active_well_id, is_active=is_active)
    return alerts  # type: ignore[return-value]


# ── 15. Dismiss alert ──────────────────────────────────────────────────────────


@router.post(
    "/{alert_id}/dismiss",
    response_model=AlertResponse,
    summary="Deactivate an alert",
)
async def dismiss_alert(
    alert_id: int,
    body: AlertDismissRequest,
    db: AsyncSession = Depends(get_db),
) -> AlertResponse:
    """Set is_active=False on the given alert and record the dismissal reason."""
    alert = await dismiss_alert_in_db(
        db,
        alert_id,
        reason=body.reason,
        dismissed_by=body.dismissed_by,
    )
    if alert is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert {alert_id} not found",
        )
    return alert  # type: ignore[return-value]
