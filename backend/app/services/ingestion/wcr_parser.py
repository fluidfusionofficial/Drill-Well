"""DOCX parser for Oil India Well Completion Reports (WCR).

parse_wcr(path) -> dict
    Open a WCR DOCX file and return a structured dict with nine top-level
    sections.  All depth values are tagged with depth_reference_type.  Every
    sub-record includes original_value and original_unit to satisfy the unit
    preservation rule.

Returned structure
------------------
{
  "general_well_data":    dict,
  "formation_tops":       list[dict],
  "bit_records":          list[dict],
  "drilling_parameters":  list[dict],
  "mud_parameters":       list[dict],
  "events":               list[dict],
  "lithology":            list[dict],
  "casing_runs":          list[dict],
  "cement_jobs":          list[dict],
  "_provenance": {
      "source_document_path": str,
      "extraction_method": "docx_table_and_paragraph",
      "extraction_confidence": float,
  }
}

Design constraints enforced
---------------------------
- All depth fields carry depth_reference_type ("MD" unless the source says TVD).
- planned vs actual formation tops are stored as separate records with
  top_source_type set to "PROGNOSED" or "SAMPLE_CUTTINGS" / "WIRELINE".
- No hard-coded row numbers.  Tables are searched by header text using
  normalize_label() from label_aliases.
- original_value + original_unit are always preserved alongside numeric values.
"""

from __future__ import annotations

import os
import re
from typing import Any

from docx import Document as DocxDocument
from docx.table import Table
from docx.text.paragraph import Paragraph

from app.services.ingestion.label_aliases import normalize_label


# ── Paragraph helpers ─────────────────────────────────────────────────────────

def _para_text(para: Paragraph) -> str:
    return para.text.strip()


def _clean(s: Any) -> str:
    return str(s).strip() if s is not None else ""


def _coerce_float(s: str) -> float | None:
    cleaned = re.sub(r"[^\d.\-]", "", s)
    try:
        return float(cleaned) if cleaned else None
    except ValueError:
        return None


# ── Table helpers ─────────────────────────────────────────────────────────────

def _table_rows(table: Table) -> list[list[str]]:
    """Return table as a 2-D list of stripped strings."""
    result = []
    for row in table.rows:
        result.append([_clean(cell.text) for cell in row.cells])
    return result


def _header_row_index(rows: list[list[str]]) -> int | None:
    """Return the index of the row that contains column headers (first non-empty row)."""
    for i, row in enumerate(rows):
        if any(c for c in row):
            return i
    return None


def _find_col(headers: list[str], *aliases: str) -> int | None:
    """Return column index whose header matches any of *aliases* (case-insensitive sub-string)."""
    lowered = [h.lower() for h in headers]
    for alias in aliases:
        a = alias.lower()
        for i, h in enumerate(lowered):
            if a in h:
                return i
    return None


# ── General well data (paragraph key-value scan) ─────────────────────────────

_GENERAL_PATTERNS: dict[str, list[str]] = {
    "well_name": ["well name", "well no", "well:"],
    "location": ["location", "loc:"],
    "rig": ["rig name", "rig no", "rig:"],
    "spud_date": ["spud date", "date of spud"],
    "completion_date": ["completion date", "td date", "date of td"],
    "target_depth_md": ["target depth", "planned td", "total depth"],
    "actual_td_md": ["actual td", "final depth", "drilled to"],
    "well_type": ["well type", "well classification"],
    "operator": ["operator", "oil company"],
    "field": ["field", "area"],
    "basin": ["basin"],
    "kb_elevation": ["kb elevation", "kelly bushing", "rotary table elevation"],
    "ground_elevation": ["ground elevation", "gl elevation"],
}


def _extract_general(doc: DocxDocument) -> dict[str, Any]:
    result: dict[str, Any] = {k: None for k in _GENERAL_PATTERNS}
    for para in doc.paragraphs:
        text = _para_text(para)
        if ":" not in text:
            continue
        parts = text.split(":", 1)
        label_raw, value_raw = parts[0].strip().lower(), parts[1].strip()
        if not value_raw:
            continue
        for canonical, aliases in _GENERAL_PATTERNS.items():
            if result[canonical] is not None:
                continue
            for alias in aliases:
                if alias in label_raw:
                    result[canonical] = {
                        "value": value_raw,
                        "original_value": value_raw,
                        "original_unit": _unit_for_general(canonical),
                    }
                    break
    return result


def _unit_for_general(canonical: str) -> str | None:
    if "depth" in canonical or "_td" in canonical or "elevation" in canonical:
        return "m"
    return None


# ── Formation tops ────────────────────────────────────────────────────────────

def _extract_formation_tops(tables: list[Table]) -> list[dict[str, Any]]:
    """Find formation-top tables and parse prognosed + actual tops.

    Both planned (PROGNOSED) and actual (SAMPLE_CUTTINGS) are stored as
    separate records — they must never overwrite each other.
    """
    tops: list[dict[str, Any]] = []
    for table in tables:
        rows = _table_rows(table)
        if not rows:
            continue
        hi = _header_row_index(rows)
        if hi is None:
            continue
        headers = rows[hi]
        # Identify formation-top tables by header content
        joined = " ".join(h.lower() for h in headers)
        if "formation" not in joined and "fm" not in joined:
            continue

        form_col = _find_col(headers, "formation", "fm", "group", "stratigraphy")
        top_prog_col = _find_col(headers, "prognosed", "planned", "expected")
        top_act_col = _find_col(headers, "actual", "drilled", "encountered")
        top_col = _find_col(headers, "top (m)", "top m", "depth (m)", "depth m", "top")
        base_col = _find_col(headers, "base (m)", "base m", "base")
        source_col = _find_col(headers, "source", "method", "log")

        if form_col is None:
            continue

        for row in rows[hi + 1 :]:
            if not any(row):
                continue
            formation_name = _clean(row[form_col]) if len(row) > form_col else ""
            if not formation_name or formation_name.lower() in ("formation", ""):
                continue

            # Prognosed record
            if top_prog_col is not None and len(row) > top_prog_col:
                prog_val = _clean(row[top_prog_col])
                if prog_val:
                    tops.append({
                        "formation_name_raw": formation_name,
                        "top_md": {
                            "value": _coerce_float(prog_val),
                            "original_value": prog_val,
                            "original_unit": "m",
                        },
                        "top_source_type": "PROGNOSED",
                        "depth_reference_type": "MD",
                    })

            # Actual record
            if top_act_col is not None and len(row) > top_act_col:
                act_val = _clean(row[top_act_col])
                if act_val:
                    source_type = "SAMPLE_CUTTINGS"
                    if source_col is not None and len(row) > source_col:
                        src_text = _clean(row[source_col]).lower()
                        if "wireline" in src_text or "log" in src_text:
                            source_type = "WIRELINE"
                    tops.append({
                        "formation_name_raw": formation_name,
                        "top_md": {
                            "value": _coerce_float(act_val),
                            "original_value": act_val,
                            "original_unit": "m",
                        },
                        "top_source_type": source_type,
                        "depth_reference_type": "MD",
                    })

            # Single "top" column (unspecified source → SAMPLE_CUTTINGS)
            if top_prog_col is None and top_act_col is None and top_col is not None:
                if len(row) > top_col:
                    top_val = _clean(row[top_col])
                    base_val = (
                        _clean(row[base_col])
                        if base_col is not None and len(row) > base_col
                        else None
                    )
                    if top_val:
                        tops.append({
                            "formation_name_raw": formation_name,
                            "top_md": {
                                "value": _coerce_float(top_val),
                                "original_value": top_val,
                                "original_unit": "m",
                            },
                            "base_md": {
                                "value": _coerce_float(base_val) if base_val else None,
                                "original_value": base_val,
                                "original_unit": "m",
                            } if base_val else None,
                            "top_source_type": "SAMPLE_CUTTINGS",
                            "depth_reference_type": "MD",
                        })
    return tops


# ── Bit records ───────────────────────────────────────────────────────────────

def _extract_bit_records(tables: list[Table]) -> list[dict[str, Any]]:
    bits: list[dict[str, Any]] = []
    for table in tables:
        rows = _table_rows(table)
        if not rows:
            continue
        hi = _header_row_index(rows)
        if hi is None:
            continue
        headers = rows[hi]
        joined = " ".join(h.lower() for h in headers)
        if "bit" not in joined:
            continue

        serial_col = _find_col(headers, "serial", "s/n", "bit no", "number")
        size_col = _find_col(headers, "size", "diameter", "hole size")
        type_col = _find_col(headers, "type", "iadc", "bit type")
        depth_in_col = _find_col(headers, "depth in", "from", "run in", "spud depth")
        depth_out_col = _find_col(headers, "depth out", "to", "pull out", "final depth")
        hrs_col = _find_col(headers, "hrs", "hours", "bit hours", "bit hrs")
        dull_col = _find_col(headers, "dull", "grading", "bit condition")

        for row in rows[hi + 1 :]:
            if not any(row):
                continue
            rec: dict[str, Any] = {
                "bit_serial": _get_col(row, serial_col),
                "hole_size": {
                    "value": _coerce_float(_get_col(row, size_col) or ""),
                    "original_value": _get_col(row, size_col),
                    "original_unit": "in",
                } if size_col is not None else None,
                "bit_type": _get_col(row, type_col),
                "depth_in_md": {
                    "value": _coerce_float(_get_col(row, depth_in_col) or ""),
                    "original_value": _get_col(row, depth_in_col),
                    "original_unit": "m",
                    "depth_reference_type": "MD",
                } if depth_in_col is not None else None,
                "depth_out_md": {
                    "value": _coerce_float(_get_col(row, depth_out_col) or ""),
                    "original_value": _get_col(row, depth_out_col),
                    "original_unit": "m",
                    "depth_reference_type": "MD",
                } if depth_out_col is not None else None,
                "bit_hours": {
                    "value": _coerce_float(_get_col(row, hrs_col) or ""),
                    "original_value": _get_col(row, hrs_col),
                    "original_unit": "h",
                } if hrs_col is not None else None,
                "dull_grading": _get_col(row, dull_col),
            }
            if any(v for v in rec.values() if v is not None):
                bits.append(rec)
    return bits


def _get_col(row: list[str], col: int | None) -> str | None:
    if col is None or col >= len(row):
        return None
    val = row[col]
    return val if val else None


# ── Drilling parameters ───────────────────────────────────────────────────────

def _extract_drilling_params(tables: list[Table]) -> list[dict[str, Any]]:
    params: list[dict[str, Any]] = []
    for table in tables:
        rows = _table_rows(table)
        if not rows:
            continue
        hi = _header_row_index(rows)
        if hi is None:
            continue
        headers = rows[hi]
        joined = " ".join(h.lower() for h in headers)
        if not any(kw in joined for kw in ("wob", "rpm", "rop", "torque", "drilling param")):
            continue

        depth_col = _find_col(headers, "depth", "interval", "from", "section")
        wob_col = _find_col(headers, "wob", "weight on bit")
        rpm_col = _find_col(headers, "rpm", "rotation")
        torque_col = _find_col(headers, "torque")
        flow_col = _find_col(headers, "flow", "gpm", "pump rate")
        spp_col = _find_col(headers, "spp", "standpipe", "pump pressure")
        rop_col = _find_col(headers, "rop", "rate of penetration")

        for row in rows[hi + 1 :]:
            if not any(row):
                continue
            rec: dict[str, Any] = {}
            if depth_col is not None:
                rec["depth_interval_md"] = {
                    "value": _get_col(row, depth_col),
                    "original_value": _get_col(row, depth_col),
                    "original_unit": "m",
                    "depth_reference_type": "MD",
                }
            for canonical, col in [
                ("wob_ton", wob_col),
                ("rpm", rpm_col),
                ("torque", torque_col),
                ("flow_gpm", flow_col),
                ("spp_psi", spp_col),
                ("rop", rop_col),
            ]:
                if col is not None:
                    raw = _get_col(row, col)
                    rec[canonical] = {
                        "value": _coerce_float(raw or ""),
                        "original_value": raw,
                        "original_unit": _drilling_param_unit(canonical),
                    }
            if any(v for v in rec.values() if v is not None):
                params.append(rec)
    return params


def _drilling_param_unit(canonical: str) -> str | None:
    return {
        "wob_ton": "ton",
        "rpm": "rpm",
        "torque": "kN·m",
        "flow_gpm": "gpm",
        "spp_psi": "psi",
        "rop": "m/h",
    }.get(canonical)


# ── Mud parameters ────────────────────────────────────────────────────────────

def _extract_mud_params(tables: list[Table]) -> list[dict[str, Any]]:
    params: list[dict[str, Any]] = []
    for table in tables:
        rows = _table_rows(table)
        if not rows:
            continue
        hi = _header_row_index(rows)
        if hi is None:
            continue
        headers = rows[hi]
        joined = " ".join(h.lower() for h in headers)
        if not any(kw in joined for kw in ("mud weight", "viscosity", "fluid loss", "mw", "ppg", "mud param")):
            continue

        date_col = _find_col(headers, "date")
        depth_col = _find_col(headers, "depth")
        mw_col = _find_col(headers, "mw", "mud weight", "density")
        visc_col = _find_col(headers, "visc", "viscosity", "fann")
        fl_col = _find_col(headers, "fluid loss", "filtrate", "fl")
        ph_col = _find_col(headers, "ph")
        pv_col = _find_col(headers, "pv", "plastic viscosity")
        yp_col = _find_col(headers, "yp", "yield point")

        for row in rows[hi + 1 :]:
            if not any(row):
                continue
            rec: dict[str, Any] = {}
            if date_col is not None:
                rec["date"] = _get_col(row, date_col)
            if depth_col is not None:
                rec["depth_md"] = {
                    "value": _coerce_float(_get_col(row, depth_col) or ""),
                    "original_value": _get_col(row, depth_col),
                    "original_unit": "m",
                    "depth_reference_type": "MD",
                }
            for canonical, col, unit in [
                ("mud_weight_ppg", mw_col, "ppg"),
                ("viscosity_sec", visc_col, "sec"),
                ("fluid_loss_api_cc", fl_col, "cc"),
                ("ph", ph_col, None),
                ("pv", pv_col, "cP"),
                ("yp", yp_col, "lb/100ft²"),
            ]:
                if col is not None:
                    raw = _get_col(row, col)
                    rec[canonical] = {
                        "value": _coerce_float(raw or "") if raw else None,
                        "original_value": raw,
                        "original_unit": unit,
                    }
            if any(v for v in rec.values() if v is not None):
                params.append(rec)
    return params


# ── Events (lost circulation, stuck pipe, kicks, etc.) ───────────────────────

_EVENT_KEYWORDS = [
    "lost circulation", "mud loss", "stuck pipe", "kick", "blowout",
    "tight hole", "washout", "twist off", "fishing", "sidetrack",
    "well control", "mud pump failure", "npt",
]


def _extract_events(doc: DocxDocument) -> list[dict[str, Any]]:
    """Scan paragraphs and event tables for significant drilling events.

    Returns records tagged with recorded_context = True so the alert engine
    can label them as 'recorded precedent' (never 'predicted event').
    """
    events: list[dict[str, Any]] = []
    for para in doc.paragraphs:
        text = _para_text(para)
        if not text:
            continue
        text_lower = text.lower()
        for keyword in _EVENT_KEYWORDS:
            if keyword in text_lower:
                events.append({
                    "event_type": keyword.replace(" ", "_").upper(),
                    "description": text,
                    "recorded_context": True,
                    "source": "paragraph",
                })
                break

    # Also scan tables for event logs
    for table in doc.tables:
        rows = _table_rows(table)
        if not rows:
            continue
        hi = _header_row_index(rows)
        if hi is None:
            continue
        headers = rows[hi]
        joined = " ".join(h.lower() for h in headers)
        if not any(kw in joined for kw in ("event", "incident", "problem", "npt", "loss")):
            continue

        date_col = _find_col(headers, "date")
        depth_col = _find_col(headers, "depth")
        desc_col = _find_col(headers, "description", "event", "details", "remarks")

        for row in rows[hi + 1 :]:
            if not any(row):
                continue
            rec: dict[str, Any] = {
                "recorded_context": True,
                "source": "table",
            }
            if date_col is not None:
                rec["date"] = _get_col(row, date_col)
            if depth_col is not None:
                rec["depth_md"] = {
                    "value": _coerce_float(_get_col(row, depth_col) or ""),
                    "original_value": _get_col(row, depth_col),
                    "original_unit": "m",
                    "depth_reference_type": "MD",
                }
            if desc_col is not None:
                rec["description"] = _get_col(row, desc_col)
            desc_text = (rec.get("description") or "").lower()
            for keyword in _EVENT_KEYWORDS:
                if keyword in desc_text:
                    rec["event_type"] = keyword.replace(" ", "_").upper()
                    break
            if any(v for v in rec.values() if v not in (None, True, "table")):
                events.append(rec)
    return events


# ── Lithology ─────────────────────────────────────────────────────────────────

def _extract_lithology(tables: list[Table]) -> list[dict[str, Any]]:
    litho: list[dict[str, Any]] = []
    for table in tables:
        rows = _table_rows(table)
        if not rows:
            continue
        hi = _header_row_index(rows)
        if hi is None:
            continue
        headers = rows[hi]
        joined = " ".join(h.lower() for h in headers)
        if not any(kw in joined for kw in ("lithology", "litho", "rock type", "description")):
            continue

        depth_top_col = _find_col(headers, "from", "top", "depth top")
        depth_base_col = _find_col(headers, "to", "base", "depth base", "bottom")
        desc_col = _find_col(headers, "description", "lithology", "rock", "litho")

        for row in rows[hi + 1 :]:
            if not any(row):
                continue
            rec: dict[str, Any] = {}
            if depth_top_col is not None:
                rec["top_md"] = {
                    "value": _coerce_float(_get_col(row, depth_top_col) or ""),
                    "original_value": _get_col(row, depth_top_col),
                    "original_unit": "m",
                    "depth_reference_type": "MD",
                }
            if depth_base_col is not None:
                rec["base_md"] = {
                    "value": _coerce_float(_get_col(row, depth_base_col) or ""),
                    "original_value": _get_col(row, depth_base_col),
                    "original_unit": "m",
                    "depth_reference_type": "MD",
                }
            if desc_col is not None:
                rec["description"] = _get_col(row, desc_col)
            if any(v for v in rec.values() if v is not None):
                litho.append(rec)
    return litho


# ── Casing runs ───────────────────────────────────────────────────────────────

def _extract_casing_runs(tables: list[Table]) -> list[dict[str, Any]]:
    runs: list[dict[str, Any]] = []
    for table in tables:
        rows = _table_rows(table)
        if not rows:
            continue
        hi = _header_row_index(rows)
        if hi is None:
            continue
        headers = rows[hi]
        joined = " ".join(h.lower() for h in headers)
        if "casing" not in joined and "liner" not in joined:
            continue

        size_col = _find_col(headers, "size", "od", "diameter")
        weight_col = _find_col(headers, "weight", "lb/ft", "kg/m")
        grade_col = _find_col(headers, "grade", "steel grade")
        depth_col = _find_col(headers, "depth", "set depth", "shoe depth")
        type_col = _find_col(headers, "type", "casing type", "section")

        for row in rows[hi + 1 :]:
            if not any(row):
                continue
            rec: dict[str, Any] = {
                "casing_type": _get_col(row, type_col),
                "size_in": {
                    "value": _coerce_float(_get_col(row, size_col) or ""),
                    "original_value": _get_col(row, size_col),
                    "original_unit": "in",
                } if size_col is not None else None,
                "weight": {
                    "value": _coerce_float(_get_col(row, weight_col) or ""),
                    "original_value": _get_col(row, weight_col),
                    "original_unit": "lb/ft",
                } if weight_col is not None else None,
                "grade": _get_col(row, grade_col),
                "shoe_depth_md": {
                    "value": _coerce_float(_get_col(row, depth_col) or ""),
                    "original_value": _get_col(row, depth_col),
                    "original_unit": "m",
                    "depth_reference_type": "MD",
                } if depth_col is not None else None,
            }
            if any(v for v in rec.values() if v is not None):
                runs.append(rec)
    return runs


# ── Cement jobs ───────────────────────────────────────────────────────────────

def _extract_cement_jobs(tables: list[Table]) -> list[dict[str, Any]]:
    jobs: list[dict[str, Any]] = []
    for table in tables:
        rows = _table_rows(table)
        if not rows:
            continue
        hi = _header_row_index(rows)
        if hi is None:
            continue
        headers = rows[hi]
        joined = " ".join(h.lower() for h in headers)
        if "cement" not in joined:
            continue

        casing_col = _find_col(headers, "casing", "string", "section")
        vol_col = _find_col(headers, "volume", "vol", "sacks", "bbls")
        top_col = _find_col(headers, "top of cement", "toc", "cement top")
        class_col = _find_col(headers, "class", "type", "slurry")

        for row in rows[hi + 1 :]:
            if not any(row):
                continue
            rec: dict[str, Any] = {
                "casing_string": _get_col(row, casing_col),
                "cement_class": _get_col(row, class_col),
                "volume": {
                    "value": _coerce_float(_get_col(row, vol_col) or ""),
                    "original_value": _get_col(row, vol_col),
                    "original_unit": "bbl",
                } if vol_col is not None else None,
                "toc_md": {
                    "value": _coerce_float(_get_col(row, top_col) or ""),
                    "original_value": _get_col(row, top_col),
                    "original_unit": "m",
                    "depth_reference_type": "MD",
                } if top_col is not None else None,
            }
            if any(v for v in rec.values() if v is not None):
                jobs.append(rec)
    return jobs


# ── Public entry point ────────────────────────────────────────────────────────

def parse_wcr(path: str) -> dict[str, Any]:
    """Parse a WCR DOCX file and return a structured extraction result.

    Parameters
    ----------
    path:
        Absolute filesystem path to a WCR .docx file.

    Returns
    -------
    dict with keys: general_well_data, formation_tops, bit_records,
    drilling_parameters, mud_parameters, events, lithology, casing_runs,
    cement_jobs, _provenance.
    """
    doc = DocxDocument(path)
    tables = doc.tables

    general = _extract_general(doc)
    formation_tops = _extract_formation_tops(tables)
    bit_records = _extract_bit_records(tables)
    drilling_parameters = _extract_drilling_params(tables)
    mud_parameters = _extract_mud_params(tables)
    events = _extract_events(doc)
    lithology = _extract_lithology(tables)
    casing_runs = _extract_casing_runs(tables)
    cement_jobs = _extract_cement_jobs(tables)

    # Confidence: proportion of general fields that were populated
    populated = sum(1 for v in general.values() if v is not None)
    total = len(general)
    confidence = round(populated / total, 3) if total > 0 else 0.0

    return {
        "general_well_data": general,
        "formation_tops": formation_tops,
        "bit_records": bit_records,
        "drilling_parameters": drilling_parameters,
        "mud_parameters": mud_parameters,
        "events": events,
        "lithology": lithology,
        "casing_runs": casing_runs,
        "cement_jobs": cement_jobs,
        "_provenance": {
            "source_document_path": os.path.abspath(path),
            "extraction_method": "docx_table_and_paragraph",
            "extraction_confidence": confidence,
        },
    }
