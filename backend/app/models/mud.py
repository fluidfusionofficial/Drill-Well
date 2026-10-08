"""ORM model for daily mud program records (mud check rows from WCR / DDR).

MudRecord — per-day, per-depth-interval mud properties.

Design constraints:
- depth_start_md / depth_end_md are measured-depth only (never converted to TVD).
- mud_weight_original_value / mud_weight_original_unit preserve the raw field reading
  so the normalised ppg value can always be verified against its source.
- source_document_id is NOT NULL (provenance mandatory).
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
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.well import WellMaster


class MudRecord(Base):
    """One mud-check row keyed to a well, date, and depth interval."""

    __tablename__ = "mud_record"
    __table_args__ = (
        CheckConstraint(
            "depth_reference_type IN ('MD', 'TVD', 'TVDSS')",
            name="ck_mud_record_depth_reference_type",
        ),
        CheckConstraint(
            "extraction_confidence BETWEEN 0.0 AND 1.0",
            name="ck_mud_record_confidence",
        ),
    )

    record_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    well_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("well_master.well_id", ondelete="CASCADE"), nullable=False
    )
    record_date: Mapped[Optional[date]] = mapped_column(Date)

    # MD interval — TVD values are not available in the source WCR tables.
    depth_start_md: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    depth_end_md: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    depth_reference_type: Mapped[str] = mapped_column(
        String(8), nullable=False, default="MD"
    )

    # Mud weight — normalised to ppg; original preserved.
    mud_weight_ppg: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    mud_weight_original_value: Mapped[Optional[str]] = mapped_column(String(32))
    mud_weight_original_unit: Mapped[Optional[str]] = mapped_column(String(16), default="ppg")

    viscosity_sec: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))
    plastic_viscosity_cp: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))
    yield_point_lbs100ft2: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))
    gel_strength_10sec: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))
    gel_strength_10min: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))
    ph: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 2))
    fluid_loss_api_cc: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))
    solids_percent: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))

    # Provenance (mandatory).
    source_document_id: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("document_master.document_id"),
        nullable=False,
    )
    extraction_method: Mapped[Optional[str]] = mapped_column(
        String(64), default="STRUCTURED_PARSE"
    )
    extraction_confidence: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(3, 2), default=0.90
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    well: Mapped[WellMaster] = relationship("WellMaster")

    def __repr__(self) -> str:
        return (
            f"<MudRecord record_id={self.record_id} well_id={self.well_id!r} "
            f"date={self.record_date} "
            f"depth={self.depth_start_md}-{self.depth_end_md} "
            f"mw_ppg={self.mud_weight_ppg}>"
        )
