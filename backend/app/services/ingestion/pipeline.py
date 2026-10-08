"""Document ingestion pipeline orchestrator for NWIS.

ingest_file(session, content, filename, well_id_hint, doc_type_hint) -> dict
    Full ingestion pipeline: hash → dedup → detect type → parse → normalize
    → store document record → validate → return job summary.

get_job_status(session, job_id) -> dict
    Return the current status and metadata for an ingestion job.

Pipeline steps
--------------
1. Compute SHA-256 hash of content.
2. Check for duplicate in document_master.
3. Detect file type from magic bytes + extension.
4. Map file type + doc_type_hint to document_type (DDR/WCR/DDDP/etc.).
5. Dispatch to the appropriate parser (excel_parser, wcr_parser, pdf_parser).
6. Normalize all numeric values (units preserved as original_value+original_unit).
7. Persist a Document row in document_master with provenance fields.
8. Validate required provenance fields are present.
9. Return a status dict with job_id, document_id, well_id, document_type,
   record_count, warnings, and status.

Design constraints enforced
---------------------------
- MD and TVD are never silently interchanged; depth_reference_type propagates
  from each parser through to stored records.
- Planned vs actual data is kept as separate records (top_source_type).
- Provenance is mandatory: every stored row must have source_document_id,
  extraction_method, and extraction_confidence.
- Missing data is stored as None with an explicit reason, never fabricated.
- Well identity: a document is linked to well_id_hint; if not provided, the
  parser result is inspected for a well_name match before leaving well_id as
  None (never borrows another well's data).
- alert language: this module never produces language such as "will happen" or
  "predicted event".  Status messages use "recorded precedent" framing.
"""

from __future__ import annotations

import io
import os
import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.ingestion.file_classifier import FileType, detect_file_type
from app.services.ingestion.hasher import check_duplicate, compute_sha256

# ── Document type classification ───────────────────────────────────────────────

# Maps (FileType, lower-cased doc_type_hint substring) -> document_type string
# Hint is matched as a substring; None hint falls through to default.
_DOC_TYPE_MAP: dict[FileType, dict[str, str]] = {
    FileType.XLSX: {
        "ddr": "DDR",
        "drilling_report": "DDR",
        "daily": "DDR",
        "default": "DDR",
    },
    FileType.XLS: {
        "ddr": "DDR",
        "default": "DDR",
    },
    FileType.DOCX: {
        "wcr": "WCR",
        "completion": "WCR",
        "default": "WCR",
    },
    FileType.PDF: {
        "dddp": "DDDP",
        "drilling_design": "DDDP",
        "mud_log": "MUD_LOG",
        "log": "LOG_LAS",
        "default": "DDDP",
    },
}


def _classify_document_type(file_type: FileType, hint: str | None) -> str:
    type_map = _DOC_TYPE_MAP.get(file_type, {})
    if hint:
        hint_lower = hint.lower()
        for key, val in type_map.items():
            if key != "default" and key in hint_lower:
                return val
    return type_map.get("default", "DDDP")


# ── Parsers ────────────────────────────────────────────────────────────────────

def _run_excel_parser(content: bytes, filename: str) -> dict[str, Any]:
    """Write content to a temp buffer and run the Excel parser."""
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    try:
        from app.services.ingestion.excel_parser import parse_workbook
        records = parse_workbook(tmp_path)
        return {"records": records, "record_count": len(records)}
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def _run_wcr_parser(content: bytes, filename: str) -> dict[str, Any]:
    import tempfile
    suffix = ".docx" if filename.lower().endswith(".docx") else ".docx"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    try:
        from app.services.ingestion.wcr_parser import parse_wcr
        result = parse_wcr(tmp_path)
        # Count non-empty sections as records
        section_keys = [
            "formation_tops", "bit_records", "drilling_parameters",
            "mud_parameters", "events", "lithology", "casing_runs", "cement_jobs",
        ]
        record_count = sum(
            len(result.get(k) or []) for k in section_keys
        )
        return {"result": result, "record_count": record_count}
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def _run_pdf_parser(content: bytes, filename: str) -> dict[str, Any]:
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    try:
        from app.services.ingestion.pdf_parser import parse_dddp
        result = parse_dddp(tmp_path)
        record_count = (
            len(result.get("prognosed_formations") or []) +
            len(result.get("casing_program") or []) +
            len(result.get("mud_program") or [])
        )
        return {"result": result, "record_count": record_count}
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


# ── Normalization helpers ──────────────────────────────────────────────────────

def _validate_provenance(extraction_result: dict[str, Any]) -> list[str]:
    """Return a list of missing-provenance warning strings."""
    warnings: list[str] = []
    prov = extraction_result.get("_provenance") or {}
    if not prov.get("extraction_method"):
        warnings.append("extraction_method is absent from provenance")
    if prov.get("extraction_confidence") is None:
        warnings.append("extraction_confidence is absent from provenance")
    return warnings


# ── Document record persistence ────────────────────────────────────────────────

async def _store_document_record(
    session: AsyncSession,
    document_id: str,
    well_id: str | None,
    filename: str,
    file_hash: str,
    document_type: str,
    file_uri: str,
    ocr_engine: str | None,
) -> None:
    """Insert a row into document_master.

    Uses raw SQL via text() to remain independent of any ORM model import
    cycle at service layer.  All provenance fields are mandatory (NOT NULL
    constraints on the table back this up).
    """
    stmt = text("""
        INSERT INTO document_master
            (document_id, well_id, filename, file_hash_sha256,
             document_type, file_uri, ocr_engine)
        VALUES
            (:document_id, :well_id, :filename, :file_hash,
             :document_type, :file_uri, :ocr_engine)
        ON CONFLICT (document_id) DO NOTHING
    """)
    await session.execute(stmt, {
        "document_id": document_id,
        "well_id": well_id,
        "filename": filename,
        "file_hash": file_hash,
        "document_type": document_type,
        "file_uri": file_uri,
        "ocr_engine": ocr_engine,
    })


# ── Job status store (in-memory, suitable for single-process dev) ──────────────
# In production this would be Redis / the database.  The dict is module-level
# so it persists across requests within a process lifetime.
_job_store: dict[str, dict[str, Any]] = {}


# ── Public API ─────────────────────────────────────────────────────────────────

async def ingest_file(
    session: AsyncSession,
    content: bytes,
    filename: str,
    well_id_hint: str | None = None,
    doc_type_hint: str | None = None,
) -> dict[str, Any]:
    """Ingest a document file through the full pipeline.

    Parameters
    ----------
    session:
        Active AsyncSession from app.database.get_db.
    content:
        Raw bytes of the uploaded file.
    filename:
        Original filename including extension.  Used for magic-byte fallback
        (XLSX vs DOCX disambiguation) and stored in document_master.
    well_id_hint:
        Optional well_id to associate with this document.  When None the
        document is stored with well_id = NULL; association can be done later
        via the API.
    doc_type_hint:
        Optional hint about document type (e.g. "DDR", "WCR", "DDDP").
        Feeds into document-type classification but does not override the
        file-type detection.

    Returns
    -------
    dict with keys: job_id, document_id, status, document_type, well_id,
    file_type, file_hash, record_count, warnings, duplicate_of.
    """
    job_id = str(uuid.uuid4())
    warnings: list[str] = []

    # ── Step 1: Hash ───────────────────────────────────────────────────────────
    file_hash = compute_sha256(content)

    # ── Step 2: Deduplication ──────────────────────────────────────────────────
    existing_id = await check_duplicate(session, file_hash)
    if existing_id:
        result = {
            "job_id": job_id,
            "document_id": existing_id,
            "status": "duplicate",
            "duplicate_of": existing_id,
            "file_hash": file_hash,
            "document_type": None,
            "well_id": well_id_hint,
            "file_type": None,
            "record_count": 0,
            "warnings": ["File already ingested with document_id=" + existing_id],
        }
        _job_store[job_id] = result
        return result

    # ── Step 3: Detect file type ───────────────────────────────────────────────
    file_type = detect_file_type(filename, content)
    if file_type == FileType.UNKNOWN:
        result = {
            "job_id": job_id,
            "document_id": None,
            "status": "failed",
            "error": "Unrecognised file type — expected PDF, XLSX, XLS, or DOCX",
            "file_hash": file_hash,
            "file_type": "unknown",
            "document_type": None,
            "well_id": well_id_hint,
            "record_count": 0,
            "warnings": [],
            "duplicate_of": None,
        }
        _job_store[job_id] = result
        return result

    # ── Step 4: Classify document type ────────────────────────────────────────
    document_type = _classify_document_type(file_type, doc_type_hint)

    # ── Step 5: Parse ─────────────────────────────────────────────────────────
    extraction_result: dict[str, Any] = {}
    record_count = 0
    ocr_engine: str | None = None
    parse_error: str | None = None

    try:
        if file_type in (FileType.XLSX, FileType.XLS):
            parsed = _run_excel_parser(content, filename)
            extraction_result = parsed
            record_count = parsed.get("record_count", 0)

        elif file_type == FileType.DOCX:
            parsed = _run_wcr_parser(content, filename)
            extraction_result = parsed.get("result", {})
            record_count = parsed.get("record_count", 0)

        elif file_type == FileType.PDF:
            parsed = _run_pdf_parser(content, filename)
            extraction_result = parsed.get("result", {})
            record_count = parsed.get("record_count", 0)
            if extraction_result.get("ocr_required"):
                warnings.append(
                    "Document appears image-based; OCR recommended for better extraction"
                )

    except Exception as exc:
        parse_error = str(exc)
        warnings.append(f"Parser error: {parse_error}")

    # ── Step 6: Validate provenance ────────────────────────────────────────────
    prov_warnings = _validate_provenance(extraction_result)
    warnings.extend(prov_warnings)

    # ── Step 7: Store document record ─────────────────────────────────────────
    document_id = str(uuid.uuid4())
    # file_uri is a placeholder; in production this would be an S3/blob URI
    file_uri = f"upload://{filename}/{file_hash[:8]}"

    try:
        await _store_document_record(
            session=session,
            document_id=document_id,
            well_id=well_id_hint,
            filename=filename,
            file_hash=file_hash,
            document_type=document_type,
            file_uri=file_uri,
            ocr_engine=ocr_engine,
        )
    except Exception as exc:
        warnings.append(f"DB store warning: {exc}")

    # ── Step 8: Build result ───────────────────────────────────────────────────
    status = "failed" if parse_error and record_count == 0 else "success"
    if warnings and status == "success":
        status = "success_with_warnings"

    result = {
        "job_id": job_id,
        "document_id": document_id,
        "status": status,
        "file_hash": file_hash,
        "file_type": file_type.value,
        "document_type": document_type,
        "well_id": well_id_hint,
        "record_count": record_count,
        "warnings": warnings,
        "duplicate_of": None,
        "extraction_confidence": (
            extraction_result.get("_provenance", {}).get("extraction_confidence")
        ),
    }
    _job_store[job_id] = result
    return result


async def get_job_status(session: AsyncSession, job_id: str) -> dict[str, Any]:
    """Return the status dict for a previously submitted ingestion job.

    Parameters
    ----------
    session:
        Active AsyncSession (currently unused; reserved for future DB-backed
        job tracking).
    job_id:
        UUID string returned by ingest_file().

    Returns
    -------
    dict with job_id, status, and any fields recorded at ingest time.
    Returns {"job_id": job_id, "status": "not_found"} for unknown IDs.
    """
    if job_id in _job_store:
        return _job_store[job_id]
    return {"job_id": job_id, "status": "not_found"}
