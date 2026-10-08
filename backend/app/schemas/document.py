"""Pydantic schemas for source documents and provenance."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    document_id: str
    well_id: Optional[str] = None
    filename: Optional[str] = None
    file_hash_sha256: Optional[str] = None
    document_type: Optional[str] = None
    file_uri: Optional[str] = None
    ocr_engine: Optional[str] = None
    ingestion_timestamp: Optional[datetime] = None


class DocumentPageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    page_id: int
    page_number: Optional[int] = None
    ocr_text: Optional[str] = None
    ocr_quality: Optional[float] = None


class DocumentDetailResponse(DocumentResponse):
    pages: list[DocumentPageResponse] = []
    tables: list[dict] = []
