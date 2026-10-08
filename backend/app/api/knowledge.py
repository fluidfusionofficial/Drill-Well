"""Knowledge API router.

This router has prefix="" — main.py mounts it at /api/knowledge.

Endpoints (relative to /api/knowledge mount)
---------------------------------------------
POST /observations    Create an engineer observation (returns 201).
POST /lessons         Create a lesson learned (returns 201).

All text content must use historical-evidence language — never predictive
or directive statements.  NWIS is decision-support only.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.knowledge import (
    LessonLearnedCreate,
    LessonLearnedResponse,
    ObservationCreate,
    ObservationResponse,
)
from app.services.knowledge import create_lesson, create_observation

router = APIRouter(prefix="", tags=["Knowledge"])


# ── 16. Create observation ─────────────────────────────────────────────────────


@router.post(
    "/observations",
    response_model=ObservationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record an engineer observation",
)
async def post_observation(
    body: ObservationCreate,
    db: AsyncSession = Depends(get_db),
) -> ObservationResponse:
    """Persist a new engineer observation.

    observation_type must be one of: HAZARD, RECOMMENDATION, NOTE, QUERY.
    depth_md (Measured Depth, metres) is optional.
    """
    obs = await create_observation(db, body)
    return obs  # type: ignore[return-value]


# ── 17. Create lesson learned ──────────────────────────────────────────────────


@router.post(
    "/lessons",
    response_model=LessonLearnedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a lesson learned",
)
async def post_lesson(
    body: LessonLearnedCreate,
    db: AsyncSession = Depends(get_db),
) -> LessonLearnedResponse:
    """Persist a new lesson learned.

    title is required; body, category, and source_document_id are optional.
    """
    lesson = await create_lesson(db, body)
    return lesson  # type: ignore[return-value]
