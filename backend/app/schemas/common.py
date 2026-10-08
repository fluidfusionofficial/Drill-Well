"""Shared response and parameter schemas used across the NWIS API.

Every response schema uses ConfigDict(from_attributes=True) so that SQLAlchemy
ORM instances can be passed directly to FastAPI response serialisation.
"""

from __future__ import annotations

from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


# ── Enumerations ───────────────────────────────────────────────────────────────


class ExtractionMethod(str, Enum):
    """How a fact was extracted from a source document."""

    MANUAL = "MANUAL"
    REGEX = "REGEX"
    LLM = "LLM"
    STRUCTURED_PARSE = "STRUCTURED_PARSE"
    OCR = "OCR"


class DepthReferenceType(str, Enum):
    """Depth datum / reference type — never silently convert between these."""

    MD = "MD"       # Measured Depth
    TVD = "TVD"     # True Vertical Depth
    TVDSS = "TVDSS" # TVD Sub-Sea
    MSL = "MSL"     # Mean Sea Level


class SourceType(str, Enum):
    """Whether a data point comes from a plan or an actual measurement."""

    PROGNOSED = "PROGNOSED"
    SAMPLE = "SAMPLE"
    WIRELINE = "WIRELINE"
    REPORTED = "REPORTED"


# ── Provenance ─────────────────────────────────────────────────────────────────


class ProvenanceResponse(BaseModel):
    """Full source-traceability block for any extracted fact.

    Every response that wraps a fact extracted from a document should embed
    this model so consumers can verify and cite the original source.
    """

    model_config = ConfigDict(from_attributes=True)

    source_document_id: int = Field(
        ...,
        description="FK to the SourceDocument that contains this fact.",
    )
    source_document_name: str = Field(
        ...,
        description="Human-readable file name or title of the source document.",
    )
    source_page_or_sheet: str | None = Field(
        None,
        description="Page number (PDFs) or sheet name (Excel) where the fact appears.",
    )
    extraction_method: ExtractionMethod = Field(
        ...,
        description="Technique used to extract the value.",
    )
    extraction_confidence: Annotated[float, Field(ge=0.0, le=1.0)] = Field(
        ...,
        description="Confidence score in [0, 1] assigned at extraction time.",
    )
    citation: str | None = Field(
        None,
        description="Free-text citation or reference string for display.",
    )


# ── Depth range ────────────────────────────────────────────────────────────────


class DepthRangeResponse(BaseModel):
    """An interval described by a start and end depth with an explicit datum.

    MD and TVD are never silently interchanged — callers must always know which
    reference type they are working with.
    """

    model_config = ConfigDict(from_attributes=True)

    start_md: float | None = Field(
        None,
        description="Top of the interval in metres (same datum as depth_reference_type).",
    )
    end_md: float | None = Field(
        None,
        description="Base of the interval in metres (same datum as depth_reference_type).",
    )
    depth_reference_type: DepthReferenceType = Field(
        ...,
        description="Depth datum used for start_md and end_md.",
    )


# ── Pagination ─────────────────────────────────────────────────────────────────


class PaginationParams(BaseModel):
    """Query-parameter bundle injected by FastAPI Depends() for list endpoints."""

    offset: Annotated[int, Field(ge=0)] = Field(
        0,
        description="Number of records to skip (zero-based).",
    )
    limit: Annotated[int, Field(ge=1, le=200)] = Field(
        50,
        description="Maximum number of records to return.",
    )
