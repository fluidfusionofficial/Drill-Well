"""ORM models for well identity and spatial location.

WellMaster  — canonical per-well metadata record (the primary key for all data).
WellLocation — PostGIS point geometry with provenance and coordinate status.

Design constraints enforced here:
- MD and TVD are stored as separate columns; no silent conversion.
- Coordinates may be null when genuinely unavailable (coordinate_status carries the reason).
- source_document_id on WellLocation is NOT NULL — provenance is always required.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from geoalchemy2 import Geometry
from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.formation import FormationInterval
    from app.models.operation import DailyOperation
    from app.models.event import Event
    from app.models.knowledge import LessonLearned, EngineerObservation, SimilarityRecord
    from app.models.alert import Alert


class WellMaster(Base):
    """Canonical well header record.

    Every other table in NWIS links back to this via well_id.  A view of any
    well must only display data where data.well_id == this well_id — never
    borrow another well's records silently.
    """

    __tablename__ = "well_master"
    __table_args__ = (
        CheckConstraint(
            "well_type IN ('EXPLORATION', 'DEVELOPMENT', 'APPRAISAL')",
            name="ck_well_master_well_type",
        ),
        CheckConstraint(
            "well_profile IN ('VERTICAL', 'DIRECTIONAL_J', 'DIRECTIONAL_S', 'HORIZONTAL')",
            name="ck_well_master_well_profile",
        ),
        CheckConstraint(
            "status IN ('COMPLETED', 'ABANDONED', 'DRILLING', 'SUSPENDED')",
            name="ck_well_master_status",
        ),
    )

    well_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    well_name: Mapped[str] = mapped_column(String(128), nullable=False)
    field: Mapped[str] = mapped_column(String(64), nullable=False)
    basin: Mapped[str] = mapped_column(String(64), nullable=False, default="Upper Assam")
    operator: Mapped[Optional[str]] = mapped_column(
        String(128), default="Oil India Limited"
    )
    well_type: Mapped[Optional[str]] = mapped_column(String(32))
    well_profile: Mapped[Optional[str]] = mapped_column(String(32))
    spud_date: Mapped[Optional[date]] = mapped_column(Date)
    td_date: Mapped[Optional[date]] = mapped_column(Date)

    # MD and TVD are separate; never silently interchanged.
    planned_td_md: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    actual_td_md: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    actual_td_tvd: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))

    kb_elevation_m: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))
    ground_elevation_m: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))
    status: Mapped[Optional[str]] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    locations: Mapped[list[WellLocation]] = relationship(
        "WellLocation", back_populates="well", cascade="all, delete-orphan"
    )
    documents: Mapped[list[Document]] = relationship(
        "Document", back_populates="well"
    )
    formation_intervals: Mapped[list[FormationInterval]] = relationship(
        "FormationInterval", back_populates="well", cascade="all, delete-orphan"
    )
    daily_operations: Mapped[list[DailyOperation]] = relationship(
        "DailyOperation", back_populates="well", cascade="all, delete-orphan"
    )
    events: Mapped[list[Event]] = relationship(
        "Event", back_populates="well", cascade="all, delete-orphan"
    )
    lessons_learned: Mapped[list[LessonLearned]] = relationship(
        "LessonLearned", back_populates="well", cascade="all, delete-orphan"
    )
    engineer_observations: Mapped[list[EngineerObservation]] = relationship(
        "EngineerObservation", back_populates="well", cascade="all, delete-orphan"
    )
    alerts: Mapped[list[Alert]] = relationship(
        "Alert", back_populates="well", cascade="all, delete-orphan"
    )
    # similarity records where this well is the active (query) well
    similarity_as_active: Mapped[list[SimilarityRecord]] = relationship(
        "SimilarityRecord",
        foreign_keys="SimilarityRecord.active_well_id",
        back_populates="active_well",
        cascade="all, delete-orphan",
    )
    # similarity records where this well is the candidate (result) well
    similarity_as_candidate: Mapped[list[SimilarityRecord]] = relationship(
        "SimilarityRecord",
        foreign_keys="SimilarityRecord.candidate_well_id",
        back_populates="candidate_well",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<WellMaster well_id={self.well_id!r} well_name={self.well_name!r}>"


class WellLocation(Base):
    """PostGIS point geometry record for a well's surface location.

    coordinate_status records why coordinates may be imprecise.  When genuine
    survey coordinates are unavailable, latitude/longitude are left NULL rather
    than fabricated.  source_document_id is NOT NULL — every location claim
    must be traceable to a source.
    """

    __tablename__ = "well_location"
    __table_args__ = (
        CheckConstraint(
            "coordinate_status IN ('OFFICIAL_SURVEY', 'SCALED_MAP', 'ESTIMATED')",
            name="ck_well_location_coordinate_status",
        ),
        Index("idx_well_location_geom", "geom", postgresql_using="gist"),
    )

    location_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    well_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("well_master.well_id", ondelete="CASCADE"), nullable=False
    )
    latitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 7))
    longitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 7))
    # GeoAlchemy2 geometry column; GIST index declared above.
    geom: Mapped[Optional[object]] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326), nullable=True
    )
    crs_epsg: Mapped[Optional[int]] = mapped_column(Integer, default=4326)
    surface_reference: Mapped[Optional[str]] = mapped_column(String(32), default="KB")
    coordinate_status: Mapped[Optional[str]] = mapped_column(String(32))
    # Provenance is mandatory on every extracted-data row.
    source_document_id: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("document_master.document_id"),
        nullable=False,
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    well: Mapped[WellMaster] = relationship("WellMaster", back_populates="locations")

    def __repr__(self) -> str:
        return (
            f"<WellLocation location_id={self.location_id} well_id={self.well_id!r} "
            f"lat={self.latitude} lon={self.longitude}>"
        )
