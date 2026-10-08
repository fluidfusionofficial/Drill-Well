"""Pydantic schemas for the Search API."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    q: str = Field(..., description="Full-text search query string")
    well_ids: Optional[list[str]] = Field(None, description="Restrict to specific wells")
    document_types: Optional[list[str]] = Field(None, description="Restrict to document types")
    limit: int = Field(20, ge=1, le=100, description="Max results to return")


class SearchResultResponse(BaseModel):
    document_id: str
    well_id: Optional[str] = None
    document_type: Optional[str] = None
    filename: str
    page_number: Optional[int] = None
    snippet: Optional[str] = None
    relevance_score: float = 0.0
