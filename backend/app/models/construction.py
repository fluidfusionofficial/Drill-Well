"""ORM models for well construction: logging, lithology, casing, cementing."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LoggingRun(Base):
    __tablename__ = "logging_run"

    log_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    well_id: Mapped[str] = mapped_column(String(64), ForeignKey("well_master.well_id"), nullable=False, index=True)
    run_date: Mapped[Optional[date]] = mapped_column(Date)
    run_no: Mapped[Optional[str]] = mapped_column(String(16))
    log_name: Mapped[Optional[str]] = mapped_column(String(128))
    start_md: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    end_md: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    hole_size: Mapped[Optional[str]] = mapped_column(String(32))
    remarks: Mapped[Optional[str]] = mapped_column(Text)
    source_document_id: Mapped[Optional[str]] = mapped_column(String(128), ForeignKey("document.document_id"))


class LithologyObservation(Base):
    __tablename__ = "lithology_observation"

    litho_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    well_id: Mapped[str] = mapped_column(String(64), ForeignKey("well_master.well_id"), nullable=False, index=True)
    start_md: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    end_md: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    lithology: Mapped[Optional[str]] = mapped_column(String(128))
    percentage: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    description: Mapped[Optional[str]] = mapped_column(Text)
    hc_show: Mapped[Optional[str]] = mapped_column(String(128))
    source_document_id: Mapped[Optional[str]] = mapped_column(String(128), ForeignKey("document.document_id"))


class CasingRun(Base):
    __tablename__ = "casing_run"

    casing_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    well_id: Mapped[str] = mapped_column(String(64), ForeignKey("well_master.well_id"), nullable=False, index=True)
    hole_size: Mapped[Optional[str]] = mapped_column(String(32))
    depth_md: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    casing_size: Mapped[Optional[str]] = mapped_column(String(32))
    float_collar_md: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    shoe_md: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    material: Mapped[Optional[str]] = mapped_column(String(64))
    source_document_id: Mapped[Optional[str]] = mapped_column(String(128), ForeignKey("document.document_id"))


class CementJob(Base):
    __tablename__ = "cement_job"

    cement_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    well_id: Mapped[str] = mapped_column(String(64), ForeignKey("well_master.well_id"), nullable=False, index=True)
    casing_size: Mapped[Optional[str]] = mapped_column(String(32))
    job_date: Mapped[Optional[date]] = mapped_column(Date)
    spacer: Mapped[Optional[str]] = mapped_column(Text)
    slurry: Mapped[Optional[str]] = mapped_column(Text)
    displacement: Mapped[Optional[str]] = mapped_column(Text)
    bump_pressure: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 1))
    woc_hours: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 1))
    returns: Mapped[Optional[str]] = mapped_column(Text)
    source_document_id: Mapped[Optional[str]] = mapped_column(String(128), ForeignKey("document.document_id"))
