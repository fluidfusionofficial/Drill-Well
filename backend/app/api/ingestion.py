"""Ingestion API router.

Endpoints
---------
POST /files          Upload a source document; returns 201 + IngestionJobResponse.
GET  /jobs/{job_id}  Query job status.

File uploads are stored under STORAGE_PATH and a job record is created.
The actual parsing pipeline runs asynchronously (Celery or background task).
"""

from __future__ import annotations

import hashlib
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.document import Document
from app.schemas.ingestion import IngestionJobResponse

router = APIRouter(prefix="/ingestion", tags=["Ingestion"])

# In-memory job store — replace with a proper jobs table in production.
_JOBS: dict[str, dict] = {}

_VALID_DOCUMENT_TYPES = {"DDR", "WCR", "DDDP", "MUD_LOG", "LOG_LAS"}


# ── 10. Upload file ────────────────────────────────────────────────────────────


@router.post(
    "/files",
    response_model=IngestionJobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a source document for ingestion",
)
async def upload_file(
    file: UploadFile,
    document_type: str = "DDR",
    well_id: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> IngestionJobResponse:
    """Accept a file upload, store it, create a Document record, and enqueue parsing.

    Returns HTTP 201 with a job_id that callers can poll via GET /jobs/{job_id}.
    document_type must be one of: DDR, WCR, DDDP, MUD_LOG, LOG_LAS.
    """
    doc_type_upper = document_type.upper()
    if doc_type_upper not in _VALID_DOCUMENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"document_type must be one of {sorted(_VALID_DOCUMENT_TYPES)}",
        )

    # Read file bytes and compute hash.
    content = await file.read()
    file_hash = hashlib.sha256(content).hexdigest()
    original_filename = file.filename or "upload"

    # Build storage path.
    storage_dir = Path(settings.STORAGE_PATH)
    storage_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{file_hash[:16]}_{original_filename}"
    file_path = storage_dir / stored_name
    file_path.write_bytes(content)

    document_id = f"DOC-{file_hash[:24]}"
    now = datetime.now(tz=timezone.utc)

    # Persist Document record.
    doc = Document(
        document_id=document_id,
        well_id=well_id,
        filename=original_filename,
        file_hash_sha256=file_hash,
        document_type=doc_type_upper,
        file_uri=str(file_path),
        ingestion_timestamp=now,
    )
    db.add(doc)
    await db.flush()

    # Create a job record.
    job_id = str(uuid.uuid4())
    job = {
        "job_id": job_id,
        "well_id": well_id,
        "filename": original_filename,
        "document_type": doc_type_upper,
        "status": "PENDING",
        "created_at": now,
        "completed_at": None,
        "error_message": None,
    }
    _JOBS[job_id] = job

    return IngestionJobResponse(**job)


# ── 11. Job status ─────────────────────────────────────────────────────────────


@router.get(
    "/jobs/{job_id}",
    response_model=IngestionJobResponse,
    summary="Query ingestion job status",
)
async def get_job_status(
    job_id: str,
    db: AsyncSession = Depends(get_db),
) -> IngestionJobResponse:
    """Return the current status of an ingestion job.

    Returns 404 if no job with the given job_id is known.
    """
    job = _JOBS.get(job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ingestion job '{job_id}' not found",
        )
    return IngestionJobResponse(**job)
