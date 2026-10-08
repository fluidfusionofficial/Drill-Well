"""Service functions for engineer knowledge artefacts.

create_observation — persist a new EngineerObservation row.
create_lesson      — persist a new LessonLearned row.

These functions accept the schema create-models and return the ORM
instances so that router response_model serialisation works correctly.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge import EngineerObservation, LessonLearned
from app.schemas.knowledge import LessonLearnedCreate, ObservationCreate


async def create_observation(
    db: AsyncSession,
    data: ObservationCreate,
) -> EngineerObservation:
    """Persist a new engineer observation and return the saved ORM instance."""
    obs = EngineerObservation(
        well_id=data.well_id,
        observation_type=data.observation_type,
        text=data.text,
        depth_md=data.depth_md,
        engineer_name=data.engineer_name,
    )
    db.add(obs)
    await db.flush()  # Populate observation_id without committing.
    await db.refresh(obs)
    return obs


async def create_lesson(
    db: AsyncSession,
    data: LessonLearnedCreate,
) -> LessonLearned:
    """Persist a new lesson learned and return the saved ORM instance."""
    lesson = LessonLearned(
        well_id=data.well_id,
        title=data.title,
        body=data.body,
        category=data.category,
        source_document_id=data.source_document_id,
    )
    db.add(lesson)
    await db.flush()
    await db.refresh(lesson)
    return lesson
