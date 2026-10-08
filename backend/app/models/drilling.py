"""ORM models for bit runs and drilling parameter intervals."""

from __future__ import annotations

from decimal import Decimal
from typing import Optional

from sqlalchemy import ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class BitRun(Base):
    __tablename__ = "bit_run"

    bit_run_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    well_id: Mapped[str] = mapped_column(String(64), ForeignKey("well_master.well_id"), nullable=False, index=True)
    daily_op_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("daily_operation.daily_op_id"), nullable=True)
    bit_no: Mapped[Optional[str]] = mapped_column(String(16))
    hole_size_in: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 2))
    make: Mapped[Optional[str]] = mapped_column(String(64))
    serial_no: Mapped[Optional[str]] = mapped_column(String(64))
    iadc_code: Mapped[Optional[str]] = mapped_column(String(16))
    type_model: Mapped[Optional[str]] = mapped_column(String(64))
    jets: Mapped[Optional[str]] = mapped_column(String(64))
    in_md: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    out_md: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    meterage: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    bit_hours: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 1))
    rop_m_hr: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    wob_ton: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 1))
    rpm: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 1))
    remarks: Mapped[Optional[str]] = mapped_column(Text)
    dull_grading: Mapped[Optional[str]] = mapped_column(String(32))
    source_document_id: Mapped[Optional[str]] = mapped_column(String(128), ForeignKey("document.document_id"))


class DrillingParameterInterval(Base):
    __tablename__ = "drilling_parameter_interval"

    param_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    well_id: Mapped[str] = mapped_column(String(64), ForeignKey("well_master.well_id"), nullable=False, index=True)
    start_md: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    end_md: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    rop_m_hr: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    wob_ton: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 1))
    rpm: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 1))
    torque: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))
    total_spm: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 1))
    flow_gpm: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 1))
    spp_psi: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 1))
    source_document_id: Mapped[Optional[str]] = mapped_column(String(128), ForeignKey("document.document_id"))
