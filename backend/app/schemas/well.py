"""Pydantic response schemas for the Wells API.

All depth values explicitly carry depth_reference_type (MD | TVD | TVDSS).
MD and TVD are never silently interchanged.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class WellResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    well_id: str
    well_name: str
    field: str
    basin: str
    operator: Optional[str] = None
    well_type: Optional[str] = None
    well_profile: Optional[str] = None
    status: Optional[str] = None
    actual_td_md: Optional[float] = None
    actual_td_tvd: Optional[float] = None


class WellDetailResponse(WellResponse):
    model_config = ConfigDict(from_attributes=True)

    spud_date: Optional[date] = None
    td_date: Optional[date] = None
    planned_td_md: Optional[float] = None
    kb_elevation_m: Optional[float] = None
    ground_elevation_m: Optional[float] = None
    created_at: Optional[datetime] = None


class DailyOperationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    operation_id: int
    well_id: str
    report_date: Optional[date] = None
    present_depth_md: Optional[float] = None
    depth_reference_type: str = "MD"
    present_operation: Optional[str] = None
    mud_weight_ppg: Optional[float] = None
    mud_weight_original_value: Optional[str] = None
    mud_weight_original_unit: Optional[str] = None


class FormationIntervalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    interval_id: int
    well_id: str
    formation_name_raw: str
    top_md: float
    top_tvd: Optional[float] = None
    depth_reference_type: str = "MD"
    top_source_type: Optional[str] = None
    confidence: Optional[float] = None
    source_document_id: str


class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    event_id: str
    well_id: str
    event_type: str
    depth_md: Optional[float] = None
    depth_reference_type: str = "MD"
    severity: Optional[str] = None
    volume_bbl: Optional[float] = None
    advisory_text: Optional[str] = None
    source_document_id: str


class DocumentSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    document_id: str
    filename: str
    document_type: Optional[str] = None
    file_uri: str


class OffsetWellResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    well_id: str
    well_name: str
    distance_km: Optional[float] = None
    status: Optional[str] = None


class SimilarWellResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    candidate_well_id: str
    composite_score: float
    depth_score: Optional[float] = None
    formation_score: Optional[float] = None
    spatial_score: Optional[float] = None
    hazard_score: Optional[float] = None
    operator_score: Optional[float] = None
    explanation: Optional[str] = None
    spatial_distance_km: Optional[float] = None


class DepthContextResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    well_id: str
    centre_md: float
    window_m: float
    events: list[EventResponse] = []
    formations: list[FormationIntervalResponse] = []
