"""Pydantic schemas for bit runs and drilling parameters."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict


class BitRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    bit_run_id: int
    well_id: Optional[str] = None
    bit_no: Optional[str] = None
    hole_size_in: Optional[float] = None
    make: Optional[str] = None
    serial_no: Optional[str] = None
    iadc_code: Optional[str] = None
    type_model: Optional[str] = None
    jets: Optional[str] = None
    in_md: Optional[float] = None
    out_md: Optional[float] = None
    meterage: Optional[float] = None
    bit_hours: Optional[float] = None
    rop_m_hr: Optional[float] = None
    wob_ton: Optional[float] = None
    rpm: Optional[float] = None
    dull_grading: Optional[str] = None


class DrillingParameterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    param_id: int
    well_id: Optional[str] = None
    start_md: Optional[float] = None
    end_md: Optional[float] = None
    rop_m_hr: Optional[float] = None
    wob_ton: Optional[float] = None
    rpm: Optional[float] = None
    torque: Optional[float] = None
    total_spm: Optional[float] = None
    flow_gpm: Optional[float] = None
    spp_psi: Optional[float] = None
