"""Pydantic schemas for daily operations and timeline."""

from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict


class DailyOperationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    daily_op_id: int
    well_id: str
    operation_date: Optional[date] = None
    present_depth_md: Optional[float] = None
    progress_24h: Optional[float] = None
    operation_state: Optional[str] = None
    hole_size: Optional[str] = None
    operation_text: Optional[str] = None
    npt_hours: Optional[float] = 0.0


class OperationTimeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    time_id: int
    daily_op_id: int
    operating_hours: Optional[float] = None
    standby_hours: Optional[float] = None
    repairing_hours: Optional[float] = None
    force_majeure_hours: Optional[float] = None
    non_operating_hours: Optional[float] = None
    ilm_hours: Optional[float] = None


class TimelineResponse(BaseModel):
    well_id: str
    entries: list[DailyOperationResponse]
    total_days: int
