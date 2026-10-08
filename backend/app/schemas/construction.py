"""Pydantic schemas for well construction: logging, lithology, casing, cementing."""

from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict


class LoggingRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    log_id: int
    well_id: Optional[str] = None
    run_date: Optional[date] = None
    run_no: Optional[str] = None
    log_name: Optional[str] = None
    start_md: Optional[float] = None
    end_md: Optional[float] = None
    hole_size: Optional[str] = None
    remarks: Optional[str] = None


class LithologyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    litho_id: int
    well_id: Optional[str] = None
    start_md: Optional[float] = None
    end_md: Optional[float] = None
    lithology: Optional[str] = None
    percentage: Optional[float] = None
    description: Optional[str] = None
    hc_show: Optional[str] = None


class CasingRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    casing_id: int
    well_id: Optional[str] = None
    hole_size: Optional[str] = None
    depth_md: Optional[float] = None
    casing_size: Optional[str] = None
    float_collar_md: Optional[float] = None
    shoe_md: Optional[float] = None
    material: Optional[str] = None


class CementJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cement_id: int
    well_id: Optional[str] = None
    casing_size: Optional[str] = None
    job_date: Optional[date] = None
    spacer: Optional[str] = None
    slurry: Optional[str] = None
    displacement: Optional[str] = None
    bump_pressure: Optional[float] = None
    woc_hours: Optional[float] = None
    returns: Optional[str] = None
