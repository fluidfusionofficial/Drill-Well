"""Pydantic v2 schemas for engineer observations and lessons learned.

Schemas match the LessonLearned and EngineerObservation ORM models exactly.
Advisory-language rules apply to all body/text fields.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ── Observations ───────────────────────────────────────────────────────────────


class ObservationCreate(BaseModel):
    """Request body for POST /knowledge/observations."""

    well_id: str
    observation_type: Literal["HAZARD", "RECOMMENDATION", "NOTE", "QUERY"] = Field(
        "NOTE", description="Classification of the observation"
    )
    text: str = Field(..., min_length=5, description="Free-text observation content")
    depth_md: float | None = Field(
        None, description="Depth of the observation, Measured Depth (m)"
    )
    engineer_name: str | None = None


class ObservationResponse(BaseModel):
    """Response for a created or fetched engineer observation."""

    model_config = ConfigDict(from_attributes=True)

    observation_id: int
    well_id: str
    observation_type: str
    text: str
    depth_md: float | None
    engineer_name: str | None
    created_at: datetime


# ── Lessons learned ────────────────────────────────────────────────────────────


class LessonLearnedCreate(BaseModel):
    """Request body for POST /knowledge/lessons."""

    well_id: str
    title: str = Field(..., min_length=5, description="Short lesson title")
    body: str | None = Field(None, description="Full lesson body text")
    category: str | None = Field(
        None, description="Topic category e.g. STUCK_PIPE, MUD_LOSS, KICK"
    )
    source_document_id: str | None = Field(
        None, description="Source document the lesson is grounded in, if any"
    )


class LessonLearnedResponse(BaseModel):
    """Response for a created or fetched lesson learned."""

    model_config = ConfigDict(from_attributes=True)

    lesson_id: int
    well_id: str
    title: str
    body: str | None
    category: str | None
    source_document_id: str | None
    extraction_confidence: float | None
    created_at: datetime
