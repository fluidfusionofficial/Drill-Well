"""Pydantic schemas for drilling events and hazard records."""

from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict


class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    event_id: int
    well_id: str
    event_type: Optional[str] = None
    severity: Optional[str] = None
    start_md: float
    end_md: Optional[float] = None
    start_tvd: Optional[float] = None
    end_tvd: Optional[float] = None
    depth_reference_type: Optional[str] = "MD"
    event_date: Optional[date] = None
    formation_name: Optional[str] = None
    description_raw: str
    normalized_description: Optional[str] = None
    npt_hours: Optional[float] = 0.0
    mud_loss_bbl: Optional[float] = None
    extraction_method: Optional[str] = None
    extraction_confidence: Optional[float] = None
    source_document_id: Optional[str] = None
    source_page_or_sheet: Optional[str] = None


class MudLossDetailResponse(EventResponse):
    loss_bbl: Optional[float] = None
    cumulative_loss_bbl: Optional[float] = None
    lithology: Optional[str] = None
    treatment_description: Optional[str] = None


class WellControlDetailResponse(EventResponse):
    kick_type: Optional[str] = None
    shut_in_pressure_psi: Optional[float] = None
    response_description: Optional[str] = None
