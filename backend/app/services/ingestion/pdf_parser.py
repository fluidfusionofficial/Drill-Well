"""PDF parser for DDDP (Detailed Drilling Design Program) documents.

Three public functions cover the extraction pipeline:

extract_text_digital(path) -> list[dict]
    Extract text from a digitally-created PDF page-by-page using PyMuPDF.
    Returns one dict per page with page_number, text, and character count.

extract_tables(path) -> list[dict]
    Extract structured tables from the PDF using pdfplumber.  Returns one
    dict per table with page_number, table_index, headers, and rows.

needs_ocr(pages) -> bool
    Heuristic: returns True when the average character-per-page count is below
    a threshold, indicating the PDF is image-based and requires OCR to extract
    useful text.

parse_dddp(path) -> dict
    Top-level parser that combines text and table extraction into a structured
    DDDP result with provenance.  Calls needs_ocr() and flags the result when
    OCR would improve quality (but does not run OCR — the pipeline.py caller
    is responsible for dispatching OCR work).

Design constraints
------------------
- All depth values carry depth_reference_type.
- original_value + original_unit preserved alongside numeric values.
- No data is fabricated; missing sections are represented as empty lists or
  None with an explicit reason string.
- Uses PyMuPDF (fitz) for text extraction and pdfplumber for table extraction.
  Both are listed in requirements.txt.
"""

from __future__ import annotations

import os
import re
from typing import Any

import fitz  # PyMuPDF
import pdfplumber

from app.services.ingestion.label_aliases import normalize_label


# ── Thresholds ─────────────────────────────────────────────────────────────────
# Pages averaging fewer than this many characters are considered image-heavy
# and likely to benefit from OCR.
_MIN_CHARS_PER_PAGE = 100


# ── Text extraction ────────────────────────────────────────────────────────────

def extract_text_digital(path: str) -> list[dict[str, Any]]:
    """Extract text from each page of a digitally-created PDF.

    Parameters
    ----------
    path:
        Absolute path to the PDF file.

    Returns
    -------
    list of dicts, one per page::

        {
            "page_number": int,         # 1-based
            "text": str,                # extracted text, stripped
            "char_count": int,
            "extraction_method": "pymupdf_digital",
        }
    """
    pages: list[dict[str, Any]] = []
    with fitz.open(path) as doc:
        for page_num, page in enumerate(doc, start=1):
            text = page.get_text("text")
            stripped = text.strip()
            pages.append({
                "page_number": page_num,
                "text": stripped,
                "char_count": len(stripped),
                "extraction_method": "pymupdf_digital",
            })
    return pages


# ── Table extraction ───────────────────────────────────────────────────────────

def extract_tables(path: str) -> list[dict[str, Any]]:
    """Extract structured tables from a PDF using pdfplumber.

    Parameters
    ----------
    path:
        Absolute path to the PDF file.

    Returns
    -------
    list of dicts, one per table::

        {
            "page_number": int,          # 1-based
            "table_index": int,          # 0-based index on that page
            "headers": list[str],        # first non-empty row
            "rows": list[list[str]],     # remaining rows
            "row_count": int,
            "col_count": int,
        }
    """
    tables: list[dict[str, Any]] = []
    with pdfplumber.open(path) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            raw_tables = page.extract_tables()
            if not raw_tables:
                continue
            for t_idx, raw in enumerate(raw_tables):
                if not raw:
                    continue
                # Coerce None cells to empty string
                cleaned = [
                    [cell.strip() if cell else "" for cell in row]
                    for row in raw
                ]
                # First non-empty row becomes headers
                header_row: list[str] = []
                data_rows: list[list[str]] = []
                found_header = False
                for row in cleaned:
                    if not found_header and any(row):
                        header_row = row
                        found_header = True
                    elif found_header:
                        if any(row):
                            data_rows.append(row)

                tables.append({
                    "page_number": page_num,
                    "table_index": t_idx,
                    "headers": header_row,
                    "rows": data_rows,
                    "row_count": len(data_rows),
                    "col_count": len(header_row),
                })
    return tables


# ── OCR heuristic ──────────────────────────────────────────────────────────────

def needs_ocr(pages: list[dict[str, Any]]) -> bool:
    """Return True when *pages* appear to be image-based and need OCR.

    A document needs OCR when its average character count per page falls
    below _MIN_CHARS_PER_PAGE.  Empty documents (zero pages) are flagged as
    needing OCR by default.

    Parameters
    ----------
    pages:
        The list returned by extract_text_digital().
    """
    if not pages:
        return True
    total_chars = sum(p.get("char_count", 0) for p in pages)
    avg = total_chars / len(pages)
    return avg < _MIN_CHARS_PER_PAGE


# ── Section parsers ────────────────────────────────────────────────────────────

def _coerce_float(s: str) -> float | None:
    cleaned = re.sub(r"[^\d.\-]", "", s)
    try:
        return float(cleaned) if cleaned else None
    except ValueError:
        return None


def _find_col(headers: list[str], *aliases: str) -> int | None:
    lowered = [h.lower() for h in headers]
    for alias in aliases:
        a = alias.lower()
        for i, h in enumerate(lowered):
            if a in h:
                return i
    return None


def _parse_well_header(pages: list[dict]) -> dict[str, Any]:
    """Extract well header information from the first few pages of a DDDP."""
    header: dict[str, Any] = {
        "well_name": None,
        "location": None,
        "rig": None,
        "well_type": None,
        "target_depth_md": None,
        "spud_date": None,
        "field": None,
        "basin": None,
        "operator": None,
    }
    # Key-value patterns: label: value
    kv_pattern = re.compile(r"^(.{3,40}?)\s*[:\-]\s*(.+)$", re.MULTILINE)

    label_map = {
        "well_name": ["well name", "well no", "well designation"],
        "location": ["location", "loc:", "surface location"],
        "rig": ["rig name", "rig no", "rig:"],
        "well_type": ["well type", "well classification"],
        "target_depth_md": ["target depth", "planned td", "total depth", "designed depth"],
        "spud_date": ["spud date", "planned spud"],
        "field": ["field", "block"],
        "basin": ["basin", "area"],
        "operator": ["operator", "oil company", "company"],
    }

    # Only scan the first 3 pages for header info
    for page in pages[:3]:
        text = page.get("text", "")
        for match in kv_pattern.finditer(text):
            label_raw = match.group(1).strip().lower()
            value_raw = match.group(2).strip()
            if not value_raw:
                continue
            for canonical, aliases in label_map.items():
                if header[canonical] is not None:
                    continue
                for alias in aliases:
                    if alias in label_raw:
                        if canonical == "target_depth_md":
                            header[canonical] = {
                                "value": _coerce_float(value_raw),
                                "original_value": value_raw,
                                "original_unit": "m",
                                "depth_reference_type": "MD",
                            }
                        else:
                            header[canonical] = value_raw
                        break
    return header


def _parse_prognosed_formations(tables: list[dict]) -> list[dict[str, Any]]:
    """Extract prognosed formation tops from DDDP tables.

    All formations extracted from a DDDP are PROGNOSED — they represent the
    planned stratigraphy, not actual encountered formations.
    """
    tops: list[dict[str, Any]] = []
    for table in tables:
        headers = table.get("headers", [])
        joined = " ".join(h.lower() for h in headers)
        if "formation" not in joined and "fm" not in joined:
            continue

        form_col = _find_col(headers, "formation", "fm", "group", "stratigraphy")
        top_col = _find_col(headers, "top (m)", "top m", "depth m", "from m", "top")
        base_col = _find_col(headers, "base (m)", "base m", "to m", "base")

        if form_col is None:
            continue

        for row in table.get("rows", []):
            if not any(row):
                continue
            formation_name = row[form_col].strip() if len(row) > form_col else ""
            if not formation_name or formation_name.lower() in ("formation", "fm", ""):
                continue
            top_val = row[top_col].strip() if top_col is not None and len(row) > top_col else None
            base_val = row[base_col].strip() if base_col is not None and len(row) > base_col else None
            tops.append({
                "formation_name_raw": formation_name,
                "top_md": {
                    "value": _coerce_float(top_val) if top_val else None,
                    "original_value": top_val,
                    "original_unit": "m",
                },
                "base_md": {
                    "value": _coerce_float(base_val) if base_val else None,
                    "original_value": base_val,
                    "original_unit": "m",
                } if base_val else None,
                "top_source_type": "PROGNOSED",
                "depth_reference_type": "MD",
            })
    return tops


def _parse_casing_program(tables: list[dict]) -> list[dict[str, Any]]:
    """Extract planned casing program from DDDP tables."""
    casings: list[dict[str, Any]] = []
    for table in tables:
        headers = table.get("headers", [])
        joined = " ".join(h.lower() for h in headers)
        if "casing" not in joined and "liner" not in joined:
            continue

        size_col = _find_col(headers, "size", "od", "diameter")
        depth_col = _find_col(headers, "depth", "set depth", "shoe")
        type_col = _find_col(headers, "type", "string", "section")
        weight_col = _find_col(headers, "weight", "lb/ft")
        grade_col = _find_col(headers, "grade", "steel")

        for row in table.get("rows", []):
            if not any(row):
                continue
            rec: dict[str, Any] = {
                "casing_type": row[type_col].strip() if type_col is not None and len(row) > type_col else None,
                "size_in": {
                    "value": _coerce_float(row[size_col]) if size_col is not None and len(row) > size_col else None,
                    "original_value": row[size_col] if size_col is not None and len(row) > size_col else None,
                    "original_unit": "in",
                },
                "shoe_depth_md": {
                    "value": _coerce_float(row[depth_col]) if depth_col is not None and len(row) > depth_col else None,
                    "original_value": row[depth_col] if depth_col is not None and len(row) > depth_col else None,
                    "original_unit": "m",
                    "depth_reference_type": "MD",
                },
                "weight": {
                    "value": _coerce_float(row[weight_col]) if weight_col is not None and len(row) > weight_col else None,
                    "original_value": row[weight_col] if weight_col is not None and len(row) > weight_col else None,
                    "original_unit": "lb/ft",
                },
                "grade": row[grade_col].strip() if grade_col is not None and len(row) > grade_col else None,
                "source_type": "PROGNOSED",
            }
            if any(v for v in rec.values() if v is not None):
                casings.append(rec)
    return casings


def _parse_mud_program(tables: list[dict]) -> list[dict[str, Any]]:
    """Extract planned mud program from DDDP tables."""
    programs: list[dict[str, Any]] = []
    for table in tables:
        headers = table.get("headers", [])
        joined = " ".join(h.lower() for h in headers)
        if not any(kw in joined for kw in ("mud", "fluid", "drilling fluid")):
            continue

        section_col = _find_col(headers, "section", "interval", "hole size")
        mud_type_col = _find_col(headers, "mud type", "fluid type", "system")
        mw_col = _find_col(headers, "mud weight", "mw", "density")
        from_col = _find_col(headers, "from", "top", "depth from")
        to_col = _find_col(headers, "to", "base", "depth to")

        for row in table.get("rows", []):
            if not any(row):
                continue
            rec: dict[str, Any] = {
                "section": row[section_col].strip() if section_col is not None and len(row) > section_col else None,
                "mud_type": row[mud_type_col].strip() if mud_type_col is not None and len(row) > mud_type_col else None,
                "mud_weight_ppg": {
                    "value": _coerce_float(row[mw_col]) if mw_col is not None and len(row) > mw_col else None,
                    "original_value": row[mw_col] if mw_col is not None and len(row) > mw_col else None,
                    "original_unit": "ppg",
                },
                "depth_from_md": {
                    "value": _coerce_float(row[from_col]) if from_col is not None and len(row) > from_col else None,
                    "original_value": row[from_col] if from_col is not None and len(row) > from_col else None,
                    "original_unit": "m",
                    "depth_reference_type": "MD",
                },
                "depth_to_md": {
                    "value": _coerce_float(row[to_col]) if to_col is not None and len(row) > to_col else None,
                    "original_value": row[to_col] if to_col is not None and len(row) > to_col else None,
                    "original_unit": "m",
                    "depth_reference_type": "MD",
                },
                "source_type": "PROGNOSED",
            }
            if any(v for v in rec.values() if v is not None):
                programs.append(rec)
    return programs


# ── Top-level DDDP parser ──────────────────────────────────────────────────────

def parse_dddp(path: str) -> dict[str, Any]:
    """Parse a DDDP PDF and return a structured extraction result.

    Parameters
    ----------
    path:
        Absolute filesystem path to a DDDP .pdf file.

    Returns
    -------
    dict with keys: well_header, prognosed_formations, casing_program,
    mud_program, raw_pages, tables_extracted, ocr_required, _provenance.
    """
    pages = extract_text_digital(path)
    tables = extract_tables(path)
    ocr_required = needs_ocr(pages)

    well_header = _parse_well_header(pages)
    prognosed_formations = _parse_prognosed_formations(tables)
    casing_program = _parse_casing_program(tables)
    mud_program = _parse_mud_program(tables)

    # Confidence heuristic based on header completeness + section presence
    header_score = sum(1 for v in well_header.values() if v is not None) / max(len(well_header), 1)
    section_score = sum([
        1 if prognosed_formations else 0,
        1 if casing_program else 0,
        1 if mud_program else 0,
    ]) / 3
    confidence = round((header_score + section_score) / 2, 3)

    return {
        "well_header": well_header,
        "prognosed_formations": prognosed_formations,
        "casing_program": casing_program,
        "mud_program": mud_program,
        "raw_pages": pages,
        "tables_extracted": tables,
        "ocr_required": ocr_required,
        "_provenance": {
            "source_document_path": os.path.abspath(path),
            "page_count": len(pages),
            "table_count": len(tables),
            "extraction_method": "pymupdf_digital_pdfplumber",
            "extraction_confidence": confidence,
            "ocr_required": ocr_required,
            "ocr_engine": None,  # populated by pipeline if OCR is run
        },
    }
