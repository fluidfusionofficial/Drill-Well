"""ORM models for captured knowledge artefacts.

LessonLearned        — structured post-well learning captured from WCRs/DDDPs.
EngineerObservation  — real-time observations created by drilling engineers.
SimilarityRecord     — cached similar-well score between two wells.

Advisory-language rule applies to LessonLearned.body and advisory fields.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.well import WellMaster


class LessonLearned(Base):
    """A captured post-well or mid-well learning from a source document."""

    __tablename__ = "lesson_learned"
    __table_args__ = (
        CheckConstraint(
            "extraction_confidence BETWEEN 0.0 AND 1.0",
            name="ck_lesson_confidence",
        ),
    )

    lesson_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    well_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("well_master.well_id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    body: Mapped[Optional[str]] = mapped_column(Text)
    category: Mapped[Optional[str]] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    source_document_id: Mapped[Optional[str]] = mapped_column(
        String(128), ForeignKey("document_master.document_id"), nullable=True
    )
    extraction_confidence: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2))

    # ── Relationships ──────────────────────────────────────────────────────────
    well: Mapped[WellMaster] = relationship("WellMaster", back_populates="lessons_learned")

    def __repr__(self) -> str:
        return (
            f"<LessonLearned lesson_id={self.lesson_id} "
            f"well_id={self.well_id!r} title={self.title!r}>"
        )


class EngineerObservation(Base):
    """A real-time observation submitted by a drilling engineer."""

    __tablename__ = "engineer_observation"
    __table_args__ = (
        CheckConstraint(
            "observation_type IN ('HAZARD', 'RECOMMENDATION', 'NOTE', 'QUERY')",
            name="ck_eng_obs_type",
        ),
    )

    observation_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    well_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("well_master.well_id", ondelete="CASCADE"), nullable=False
    )
    observation_type: Mapped[str] = mapped_column(
        String(32), nullable=False, default="NOTE"
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    depth_md: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    engineer_name: Mapped[Optional[str]] = mapped_column(String(128))

    # ── Relationships ──────────────────────────────────────────────────────────
    well: Mapped[WellMaster] = relationship(
        "WellMaster", back_populates="engineer_observations"
    )

    def __repr__(self) -> str:
        return (
            f"<EngineerObservation observation_id={self.observation_id} "
            f"well_id={self.well_id!r} type={self.observation_type!r}>"
        )


class SimilarityRecord(Base):
    """Cached composite similarity score between two wells (active vs candidate)."""

    __tablename__ = "similarity_record"
    __table_args__ = (
        CheckConstraint(
            "composite_score BETWEEN 0.0 AND 1.0",
            name="ck_similarity_composite",
        ),
    )

    record_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # active_well_id — the well currently being drilled (the query).
    active_well_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("well_master.well_id", ondelete="CASCADE"),
        nullable=False,
    )
    # candidate_well_id — the offset / reference well.
    candidate_well_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("well_master.well_id", ondelete="CASCADE"),
        nullable=False,
    )
    composite_score: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    depth_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 4))
    formation_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 4))
    spatial_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 4))
    hazard_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 4))
    operator_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 4))
    # Explanation — must use historical-evidence language only.
    explanation: Mapped[Optional[str]] = mapped_column(Text)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    active_well: Mapped[WellMaster] = relationship(
        "WellMaster",
        foreign_keys=[active_well_id],
        back_populates="similarity_as_active",
    )
    candidate_well: Mapped[WellMaster] = relationship(
        "WellMaster",
        foreign_keys=[candidate_well_id],
        back_populates="similarity_as_candidate",
    )

    def __repr__(self) -> str:
        return (
            f"<SimilarityRecord active={self.active_well_id!r} "
            f"candidate={self.candidate_well_id!r} score={self.composite_score}>"
        )
