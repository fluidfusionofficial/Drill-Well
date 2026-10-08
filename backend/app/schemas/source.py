"""Pydantic v2 schemas for source document detail endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class DocumentPageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    page_id: int
    page_number: int
    image_uri: str | None
    ocr_quality: float | None


class DocumentTableResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    table_id: int
    page_number: int
    table_type: str | None
    extraction_quality: float | None
    extracted_json: Any | None


class SourceDocumentDetailResponse(BaseModel):
    """Full source document record with OCR pages and extracted tables.

    Returned by GET /sources/{document_id} so the provenance drawer can
    render the original source snippet alongside any extracted fact.
    """

    model_config = ConfigDict(from_attributes=True)

    document_id: str
    well_id: str | None
    filename: str
    document_type: str | None
    ocr_engine: str | None
    ingestion_timestamp: datetime
    pages: list[DocumentPageResponse] = []
    tables: list[DocumentTableResponse] = []
