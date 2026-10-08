"""ORM model for discrete drilling events (mud losses, stuck pipe, etc.).

Event — a notable hazard occurrence recorded in a DDR or WCR.

Design constraints:
- depth_md is always measured depth; it is never silently converted to TVD.
- source_document_id is NOT NULL (provenance mandatory).
- advisory_text must use 'recorded precedent' / 'historical context' language;
  it must never contain predictive or directive statements.
"""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    CheckConstraint,
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
    from app.models.formation import FormationMaster


class Event(Base):
    """A discrete hazard or notable occurrence during drilling."""

    __tablename__ = "event"
    __table_args__ = (
        CheckConstraint(
            "event_type IN ('MUD_LOSS', 'HELD_UP', 'TIGHT_PULL', 'CASING_FAILURE', "
            "'KICK', 'BLOWOUT', 'LOST_CIRCULATION', 'BIT_FAILURE', 'OTHER')",
            name="ck_event_event_type",
        ),
        CheckConstraint(
            "severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')",
            name="ck_event_severity",
        ),
        CheckConstraint(
            "depth_reference_type IN ('MD', 'TVD', 'TVDSS')",
            name="ck_event_depth_reference_type",
        ),
        CheckConstraint(
            "extraction_confidence BETWEEN 0.0 AND 1.0",
            name="ck_event_confidence",
        ),
    )

    event_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    well_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("well_master.well_id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)

    # Depth is always MD — never silently converted.
    depth_md: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    depth_reference_type: Mapped[str] = mapped_column(
        String(8), nullable=False, default="MD"
    )
    severity: Mapped[Optional[str]] = mapped_column(String(16))
    volume_bbl: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))

    formation_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("formation_master.formation_id"), nullable=True
    )
    description: Mapped[Optional[str]] = mapped_column(Text)
    # Advisory text must use 'recorded precedent' / 'historical context' — never predictive.
    advisory_text: Mapped[Optional[str]] = mapped_column(Text)

    # Provenance (mandatory).
    source_document_id: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("document_master.document_id"),
        nullable=False,
    )
    extraction_method: Mapped[Optional[str]] = mapped_column(String(64), default="STRUCTURED_PARSE")
    extraction_confidence: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2), default=0.90)

    # ── Relationships ──────────────────────────────────────────────────────────
    well: Mapped[WellMaster] = relationship("WellMaster", back_populates="events")
    formation: Mapped[Optional[FormationMaster]] = relationship(
        "FormationMaster", back_populates="events"
    )

    def __repr__(self) -> str:
        return (
            f"<Event event_id={self.event_id!r} event_type={self.event_type!r} "
            f"well_id={self.well_id!r} depth_md={self.depth_md}>"
        )
