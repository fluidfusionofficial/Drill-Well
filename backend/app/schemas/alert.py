"""Pydantic v2 schemas for alert and active-context endpoints.

Alert language rule (non-negotiable):
advisory_text MUST use 'recorded precedent' / 'historical context' language.
It MUST NOT contain: 'will happen', 'will', 'predicted', 'must', 'should drill'.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ── Requests ───────────────────────────────────────────────────────────────────


class ActiveContextRequest(BaseModel):
    """Body for POST /active-context.

    bit_md is the current bit position in Measured Depth.
    MD and TVD are never interchanged — callers must supply MD here.
    """

    well_id: str
    bit_md: float = Field(
        ..., ge=0.0, description="Current bit position, Measured Depth (m)"
    )


class AlertDismissRequest(BaseModel):
    """Body for POST /alerts/{alert_id}/dismiss (deactivate alert)."""

    reason: str | None = Field(None, description="Why this alert is being deactivated")
    dismissed_by: str | None = Field(None, description="Identifier of the acting user")


# ── Responses ──────────────────────────────────────────────────────────────────


class AlertResponse(BaseModel):
    """One historical-context alert record.

    advisory_text uses 'recorded precedent' / 'historical context' language —
    never predictive or directive statements.
    """

    model_config = ConfigDict(from_attributes=True)

    alert_id: int
    well_id: str
    level: str = Field(..., description="INFO | WARNING | CRITICAL")
    category: str = Field(
        ...,
        description="MUD_LOSS | STUCK_PIPE | CASING_FAILURE | FORMATION_CHANGE | OTHER",
    )
    trigger_depth_md: float | None = Field(
        None, description="Depth that triggered this alert, Measured Depth (m)"
    )
    advisory_text: str = Field(
        ...,
        description=(
            "Uses 'recorded precedent' / 'historical context' language — "
            "never predictive certainty"
        ),
    )
    risk_score: float | None = Field(None, ge=0.0, le=1.0)
    source_event_id: str | None
    is_active: bool
    created_at: datetime


class ActiveContextResponse(BaseModel):
    """Response for POST /active-context.

    Returns historical-context alerts relevant to the current bit position.
    These are advisory — engineers make all operational decisions.
    """

    well_id: str
    bit_md: float
    depth_reference_type: str = Field(
        "MD",
        description="Always MD — bit_md is Measured Depth",
    )
    alerts: list[AlertResponse] = []
