"""Pydantic schemas for the explainable similar-well engine."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict


class SimilarityComponentResponse(BaseModel):
    key: str
    label: str
    score: float
    weight: float
    weighted_score: float
    evidence: str


class SimilarWellResponse(BaseModel):
    well_id: str
    score: int
    distance_km: float
    matching_formations: list[str]
    components: list[SimilarityComponentResponse]
    explanation: str
    caveats: list[str]
