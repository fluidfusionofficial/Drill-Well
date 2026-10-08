"""Pydantic v2 schemas for document ingestion endpoints."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class IngestionJobResponse(BaseModel):
    """Response returned when a file upload is accepted or queried."""

    model_config = ConfigDict(from_attributes=True)

    job_id: str
    well_id: str | None
    filename: str
    document_type: str
    status: str = Field(
        ...,
        description="PENDING | PROCESSING | COMPLETED | FAILED",
    )
    created_at: datetime
    completed_at: datetime | None = None
    error_message: str | None = None
