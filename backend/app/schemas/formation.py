"""Pydantic schemas for formation data."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict


class FormationMasterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    formation_id: int
    canonical_name: str
    basin: Optional[str] = None
    age_era: Optional[str] = None
    lithology_class: Optional[str] = None
    aliases: Optional[list[str]] = None


class FormationIntervalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    interval_id: int
    well_id: str
    formation_name_raw: str
    canonical_name: Optional[str] = None
    top_md: float
    base_md: Optional[float] = None
    top_tvd: Optional[float] = None
    base_tvd: Optional[float] = None
    depth_reference_type: Optional[str] = "MD"
    top_source_type: Optional[str] = None
    confidence: Optional[float] = None
    source_document_id: Optional[str] = None
    source_page_or_sheet: Optional[str] = None


class FormationComparisonResponse(BaseModel):
    formation_name: str
    prognosed_top_md: Optional[float] = None
    sample_top_md: Optional[float] = None
    wireline_top_md: Optional[float] = None
    delta_sample_vs_prognosed: Optional[float] = None
    delta_wireline_vs_prognosed: Optional[float] = None
