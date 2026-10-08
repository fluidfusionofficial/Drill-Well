"""ORM models for stratigraphy and formation tops.

FormationMaster   — canonical formation catalogue with basin affiliation and aliases.
FormationInterval — per-well stratigraphic interval linking a formation to depth
                    extents in both MD and TVD, with explicit planned-vs-actual
                    distinction (top_source_type) and mandatory provenance.

Design constraints enforced here:
- MD and TVD are stored in separate columns; never silently converted.
- top_source_type distinguishes PROGNOSED from measured data; the two are
  stored as independent records and must never overwrite each other.
- confidence is a 0–1 numeric field; NULL means not assessed, not zero.
"""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    ARRAY,
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
    from app.models.event import Event


class FormationMaster(Base):
    """Canonical formation catalogue for the basin.

    canonical_name is globally unique.  aliases stores alternative spellings
    found across operator documents (e.g. "HEG" vs "Habiganj-Eocene Gas").
    """

    __tablename__ = "formation_master"

    formation_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    canonical_name: Mapped[str] = mapped_column(
        String(128), nullable=False, unique=True
    )
    basin: Mapped[str] = mapped_column(String(64), nullable=False)
    age_era: Mapped[Optional[str]] = mapped_column(String(64))
    lithology_class: Mapped[Optional[str]] = mapped_column(String(64))
    # PostgreSQL TEXT[] array for alias spellings.
    aliases: Mapped[Optional[list[str]]] = mapped_column(ARRAY(Text))

    # ── Relationships ──────────────────────────────────────────────────────────
    intervals: Mapped[list[FormationInterval]] = relationship(
        "FormationInterval", back_populates="formation"
    )
    events: Mapped[list[Event]] = relationship(
        "Event", back_populates="formation"
    )

    def __repr__(self) -> str:
        return (
            f"<FormationMaster formation_id={self.formation_id} "
            f"canonical_name={self.canonical_name!r}>"
        )


class FormationInterval(Base):
    """Formation top/base interval for a specific well.

    Both MD and TVD extents are stored.  top_source_type records whether the
    top was picked from the prognosis (PROGNOSED) or from actual measured data
    (SAMPLE_CUTTINGS, WIRELINE).  Prognosed and actual records are stored as
    separate rows — neither overwrites the other.

    source_document_id is NOT NULL: every formation top must be traceable to
    a source document.
    """

    __tablename__ = "formation_interval"
    __table_args__ = (
        CheckConstraint(
            "depth_reference_type IN ('MD', 'TVD', 'TVDSS')",
            name="ck_formation_interval_depth_reference_type",
        ),
        CheckConstraint(
            "top_source_type IN ('PROGNOSED', 'SAMPLE_CUTTINGS', 'WIRELINE')",
            name="ck_formation_interval_top_source_type",
        ),
        CheckConstraint(
            "confidence BETWEEN 0.0 AND 1.0",
            name="ck_formation_interval_confidence",
        ),
    )

    interval_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    well_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("well_master.well_id", ondelete="CASCADE"),
        nullable=False,
    )
    formation_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("formation_master.formation_id"), nullable=True
    )
    # Raw name as it appeared in the source document.
    formation_name_raw: Mapped[str] = mapped_column(String(128), nullable=False)

    # MD and TVD are separate; never silently interchanged.
    top_md: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    base_md: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    top_tvd: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    base_tvd: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))

    depth_reference_type: Mapped[str] = mapped_column(
        String(16), nullable=False, default="MD"
    )
    # Planned vs actual — stored as separate records, never overwriting.
    top_source_type: Mapped[Optional[str]] = mapped_column(String(32))

    # Extraction provenance fields (mandatory on all extracted-data tables).
    confidence: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2))
    source_document_id: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("document_master.document_id"),
        nullable=False,
    )
    source_page_or_sheet: Mapped[Optional[str]] = mapped_column(String(64))

    # ── Relationships ──────────────────────────────────────────────────────────
    well: Mapped[WellMaster] = relationship(
        "WellMaster", back_populates="formation_intervals"
    )
    formation: Mapped[Optional[FormationMaster]] = relationship(
        "FormationMaster", back_populates="intervals"
    )

    def __repr__(self) -> str:
        return (
            f"<FormationInterval interval_id={self.interval_id} "
            f"well_id={self.well_id!r} formation_name_raw={self.formation_name_raw!r} "
            f"top_md={self.top_md} top_source_type={self.top_source_type!r}>"
        )
