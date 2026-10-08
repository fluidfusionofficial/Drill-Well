"""ORM model for daily drilling operations reports (DDR rows).

DailyOperation — one record per 24-hour drilling report entry.

Design constraints:
- present_depth_md stores measured depth only; TVD is not recorded in DDRs.
- source_document_id is NOT NULL (provenance mandatory).
- mud_weight_original_value / mud_weight_original_unit preserve the raw reading.
- Planned vs actual days are stored in separate columns; they never overwrite.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.well import WellMaster


class DailyOperation(Base):
    """One 24-hour drilling report row for a single well."""

    __tablename__ = "daily_operation"
    __table_args__ = (
        CheckConstraint(
            "depth_reference_type IN ('MD', 'TVD', 'TVDSS')",
            name="ck_daily_op_depth_reference_type",
        ),
        CheckConstraint(
            "extraction_confidence BETWEEN 0.0 AND 1.0",
            name="ck_daily_op_confidence",
        ),
    )

    operation_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    well_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("well_master.well_id", ondelete="CASCADE"), nullable=False
    )
    report_date: Mapped[Optional[date]] = mapped_column(Date)
    # MD-only depth; never silently converted to TVD.
    present_depth_md: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    depth_reference_type: Mapped[str] = mapped_column(
        String(8), nullable=False, default="MD"
    )
    progress_24hr_m: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))
    present_operation: Mapped[Optional[str]] = mapped_column(String(128))
    hole_size: Mapped[Optional[str]] = mapped_column(String(32))
    operation_details: Mapped[Optional[str]] = mapped_column(Text)

    # Planned vs actual — stored separately; neither overwrites the other.
    planned_days: Mapped[Optional[int]] = mapped_column(Integer)
    actual_days: Mapped[Optional[int]] = mapped_column(Integer)

    # Mud properties — normalized to canonical unit; original values preserved.
    mud_weight_ppg: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    mud_weight_original_value: Mapped[Optional[str]] = mapped_column(String(32))
    mud_weight_original_unit: Mapped[Optional[str]] = mapped_column(String(16), default="ppg")
    viscosity_sec: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))
    fluid_loss_cc: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))
    ph: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 2))

    drilling_mtrs_24hr: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))
    bit_hrs_24hr: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    wob: Mapped[Optional[str]] = mapped_column(String(32))
    rpm: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))
    operating_time: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    standby_time: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    npt_info: Mapped[Optional[str]] = mapped_column(Text)

    # Provenance (mandatory on every extracted-data row).
    source_document_id: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("document_master.document_id"),
        nullable=False,
    )
    extraction_method: Mapped[Optional[str]] = mapped_column(String(64), default="STRUCTURED_PARSE")
    extraction_confidence: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2), default=0.85)

    # ── Relationships ──────────────────────────────────────────────────────────
    well: Mapped[WellMaster] = relationship("WellMaster", back_populates="daily_operations")

    def __repr__(self) -> str:
        return (
            f"<DailyOperation operation_id={self.operation_id} "
            f"well_id={self.well_id!r} date={self.report_date} "
            f"depth_md={self.present_depth_md}>"
        )
