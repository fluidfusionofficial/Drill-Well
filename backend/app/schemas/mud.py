"""Pydantic schemas for mud records — preserves original units."""

from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict


class MudRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    mud_record_id: int
    well_id: Optional[str] = None
    record_date: Optional[date] = None
    start_md: Optional[float] = None
    end_md: Optional[float] = None
    mud_type: Optional[str] = None
    mud_weight_ppg: Optional[float] = None
    mud_weight_sg: Optional[float] = None
    viscosity_sec: Optional[float] = None
    pv_cp: Optional[float] = None
    yp_lb_100sqft: Optional[float] = None
    gel_10s: Optional[float] = None
    gel_10m: Optional[float] = None
    gel_30m: Optional[float] = None
    ph: Optional[float] = None
    fluid_loss_api_cc: Optional[float] = None
    solids_pct: Optional[float] = None
    original_unit_mw: Optional[str] = None
