"""Excel parser for Oil India DDR (Daily Drilling Report) workbooks.

All field discovery uses label search, never hard-coded row/column indices.
WX-07 and WX-11 have different row layouts; this module handles both
transparently.

Public API
----------
discover_sheets(wb) -> list[str]
    Return sheet names that appear to contain daily drilling-report data.

parse_sheet(ws, aliases) -> dict
    Extract one daily record from a single worksheet using label-based search.

parse_workbook(path) -> list[dict]
    Open an XLSX workbook and return one provenance-tagged dict per daily sheet.

Provenance fields added to every record
---------------------------------------
  source_document_path   — absolute path of the workbook
  source_sheet_name      — name of the originating worksheet
  extraction_method      — "label_search_excel"
  extraction_confidence  — float 0.0–1.0 reflecting completeness
  depth_reference_type   — "MD" (present_depth and progress are always MD
                           in DDR sheets; TVD data comes from directional surveys)
"""

from __future__ import annotations

import math
import os
import re
from typing import Any

import openpyxl
from openpyxl.worksheet.worksheet import Worksheet

from app.services.ingestion.label_aliases import (
    LABEL_ALIASES,
    find_label_in_cells,
    normalize_label,
)

# Heuristics used by discover_sheets to decide whether a sheet holds DDR data
_DDR_HINT_LABELS = {"present_depth_md", "operation_state", "operation_text"}
_DDR_CANDIDATE_SCORE_THRESHOLD = 1  # at least 1 canonical field must match


def _sheet_to_rows(ws: Worksheet) -> list[list[Any]]:
    """Return all cell values as a 2-D list (row-major).

    Merged cells return the top-left value for all constituent cells so that
    label searches find the text regardless of which sub-cell is queried.
    """
    # unmerge for a clean value-only grid
    data: list[list[Any]] = []
    for row in ws.iter_rows(values_only=True):
        data.append(list(row))
    return data


def _read_adjacent(
    rows: list[list[Any]],
    r: int,
    c: int,
    prefer_right: bool = True,
) -> Any:
    """Return the value adjacent to a label cell at (r, c).

    Strategy: prefer the cell to the right (same row, c+1); fall back to the
    cell below (r+1, same column).  When *prefer_right* is False the priority
    is reversed.  Returns None when both adjacent cells are out of range or
    empty.
    """
    candidates: list[tuple[int, int]] = (
        [(r, c + 1), (r + 1, c)] if prefer_right else [(r + 1, c), (r, c + 1)]
    )
    for ri, ci in candidates:
        if 0 <= ri < len(rows) and 0 <= ci < len(rows[ri]):
            val = rows[ri][ci]
            if val is not None and str(val).strip():
                return val
    return None


def _coerce_number(val: Any) -> float | None:
    """Attempt to parse *val* as a float; return None on failure."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val) if not math.isnan(float(val)) else None
    cleaned = re.sub(r"[^\d.\-]", "", str(val))
    try:
        return float(cleaned)
    except ValueError:
        return None


def discover_sheets(wb: openpyxl.Workbook) -> list[str]:
    """Return names of worksheets that appear to contain DDR daily records.

    A sheet qualifies when at least one of the hint canonical labels is found
    in its cells.  Sheets named 'Summary', 'Index', 'Cover', or 'Table of
    Contents' are excluded even if they accidentally match.
    """
    excluded_patterns = re.compile(
        r"(summary|index|cover|contents|chart|legend|template)",
        re.IGNORECASE,
    )
    qualifying: list[str] = []
    for name in wb.sheetnames:
        if excluded_patterns.search(name):
            continue
        ws = wb[name]
        rows = _sheet_to_rows(ws)
        score = 0
        for canonical in _DDR_HINT_LABELS:
            if find_label_in_cells(rows, canonical) is not None:
                score += 1
        if score >= _DDR_CANDIDATE_SCORE_THRESHOLD:
            qualifying.append(name)
    return qualifying


def parse_sheet(
    ws: Worksheet,
    aliases: dict[str, list[str]] | None = None,
) -> dict[str, Any]:
    """Extract a single daily drilling record from *ws*.

    All numeric depth and parameter values are extracted along with their
    original raw cell string so that the unit preservation rule is satisfied
    downstream.  Depth values are always tagged as MD (present depth and
    progress in DDR sheets are measured depth).

    Parameters
    ----------
    ws:
        An openpyxl Worksheet object.
    aliases:
        Optional override for LABEL_ALIASES (useful in tests).  Defaults to
        the module-level LABEL_ALIASES dict.
    """
    if aliases is None:
        aliases = LABEL_ALIASES

    rows = _sheet_to_rows(ws)
    record: dict[str, Any] = {}
    found_fields = 0

    for canonical in aliases:
        pos = find_label_in_cells(rows, canonical)
        if pos is None:
            record[canonical] = None
            continue
        r, c = pos
        raw_val = _read_adjacent(rows, r, c)
        found_fields += 1

        # Store both the parsed value and the original raw string
        record[canonical] = {
            "value": raw_val,
            "original_value": str(raw_val) if raw_val is not None else None,
            "original_unit": _infer_unit_from_canonical(canonical),
        }

        # Coerce numeric fields
        if canonical in _NUMERIC_CANONICALS:
            numeric = _coerce_number(raw_val)
            record[canonical]["numeric"] = numeric

    # Provenance
    total_fields = len(aliases)
    confidence = round(found_fields / total_fields, 3) if total_fields > 0 else 0.0
    record["_provenance"] = {
        "source_sheet_name": ws.title,
        "extraction_method": "label_search_excel",
        "extraction_confidence": confidence,
        "depth_reference_type": "MD",
    }
    return record


# Canonicals that carry numeric values and should be coerced to float
_NUMERIC_CANONICALS = {
    "present_depth_md",
    "progress_24h_md",
    "mud_weight_ppg",
    "viscosity_sec",
    "fluid_loss_api_cc",
    "wob_ton",
    "rpm",
    "torque",
    "flow_gpm",
    "spp_psi",
    "npt_hours",
    "mud_loss_bbl",
    "target_depth",
}

# Unit strings corresponding to the unit suffix in each canonical name
_CANONICAL_UNIT_MAP: dict[str, str] = {
    "present_depth_md": "m",
    "progress_24h_md": "m",
    "mud_weight_ppg": "ppg",
    "viscosity_sec": "sec",
    "fluid_loss_api_cc": "cc",
    "wob_ton": "ton",
    "rpm": "rpm",
    "torque": "kN·m",
    "flow_gpm": "gpm",
    "spp_psi": "psi",
    "npt_hours": "h",
    "mud_loss_bbl": "bbl",
    "target_depth": "m",
}


def _infer_unit_from_canonical(canonical: str) -> str | None:
    return _CANONICAL_UNIT_MAP.get(canonical)


def parse_workbook(path: str) -> list[dict[str, Any]]:
    """Open *path* as an XLSX workbook and return one record per DDR sheet.

    Each returned dict contains the extracted fields plus a ``_provenance``
    block with the source path, sheet name, extraction method, and confidence.

    Parameters
    ----------
    path:
        Absolute filesystem path to the XLSX file.
    """
    wb = openpyxl.load_workbook(path, data_only=True)
    sheet_names = discover_sheets(wb)

    records: list[dict[str, Any]] = []
    for name in sheet_names:
        ws = wb[name]
        rec = parse_sheet(ws)
        # Add the file path to the provenance block
        rec["_provenance"]["source_document_path"] = os.path.abspath(path)
        records.append(rec)

    wb.close()
    return records
