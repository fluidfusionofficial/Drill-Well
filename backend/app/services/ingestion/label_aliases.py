"""Canonical label registry and cell-search utilities for Excel parsers.

LABEL_ALIASES maps each canonical field name to a list of raw strings that may
appear in a cell to mean the same thing.  Matching is case-insensitive and
ignores leading/trailing whitespace.  Sub-string matching is used so that
cells like "Present Depth (MD)" match the canonical "present_depth_md".

Canonical names follow the NWIS data model conventions:
- _md  suffix  → measured depth
- _tvd suffix  → true vertical depth
- _ppg, _sec, _cc, _ton, _gpm, _psi, _bbl, _m → unit hints preserved in name

CRITICAL: WX-07 and WX-11 Excel workbooks have different row layouts.
Every function here searches by label text — never by row/column index.
"""

from __future__ import annotations

from typing import Any

# ── Canonical field → list of aliases found in raw cell text ──────────────────
# Each alias is a lower-cased substring that, when found in the normalised cell
# text, identifies the canonical field.  Order within each list does not matter.
LABEL_ALIASES: dict[str, list[str]] = {
    "present_depth_md": [
        "present depth",
        "current depth",
        "depth at end",
        "depth (md)",
        "present d.o.h",
        "doh",
        "depth of hole",
        "depth at end of report",
    ],
    "progress_24h_md": [
        "progress in 24",
        "progress (24",
        "footage drilled",
        "drilling progress",
        "24 hrs drilling",
        "meters drilled",
        "depth progress",
        "drilled 24hr",
        "drilled (24",
    ],
    "operation_state": [
        "present operation",
        "current operation",
        "operation code",
        "activity code",
        "rig activity",
    ],
    "mud_weight_ppg": [
        "mud weight",
        "mw (ppg)",
        "mw ppg",
        "mud wt",
        "density ppg",
        "density (ppg)",
        "wt ppg",
    ],
    "viscosity_sec": [
        "viscosity",
        "funnel vis",
        "fann vis",
        "visc (sec)",
        "visc sec",
        "marsh vis",
        "marshy vis",
    ],
    "fluid_loss_api_cc": [
        "fluid loss",
        "api filtrate",
        "filtration",
        "water loss",
        "fl api",
        "fl (cc)",
        "fluid loss api",
    ],
    "wob_ton": [
        "weight on bit",
        "wob",
        "w.o.b",
        "bit weight",
        "applied wob",
    ],
    "rpm": [
        "rotary speed",
        "rpm",
        "r.p.m",
        "rotation speed",
        "surface rpm",
        "rot speed",
    ],
    "torque": [
        "torque",
        "rotary torque",
        "surface torque",
        "torq",
    ],
    "flow_gpm": [
        "flow rate",
        "pump rate",
        "circulation rate",
        "gpm",
        "flow (gpm)",
        "pump output",
        "stroke rate",
    ],
    "spp_psi": [
        "standpipe pressure",
        "pump pressure",
        "spp",
        "s.p.p",
        "circulating pressure",
        "dp pressure",
        "drill pipe pressure",
    ],
    "npt_hours": [
        "npt",
        "non-productive",
        "non productive",
        "unproductive",
        "downtime",
        "lost time",
    ],
    "mud_loss_bbl": [
        "mud loss",
        "lost circulation",
        "loss of mud",
        "lost mud",
        "total mud loss",
        "mud lost",
        "cumulative loss",
    ],
    "formation": [
        "formation",
        "stratigraphy",
        "litho",
        "geological formation",
        "fm top",
        "formation top",
    ],
    "operation_text": [
        "operation details",
        "daily operation",
        "activity description",
        "work description",
        "operation summary",
        "description of work",
        "work done",
        "operations for the day",
    ],
    "bit_serial": [
        "bit serial",
        "serial no",
        "serial number",
        "bit s/n",
        "bit id",
    ],
    "mud_type": [
        "mud type",
        "mud system",
        "fluid type",
        "fluid system",
        "type of mud",
    ],
    "hole_size": [
        "hole size",
        "bit size",
        "hole diameter",
        "drill bit size",
        "bit dia",
        "hole dia",
    ],
    "well_name": [
        "well name",
        "well no",
        "well number",
        "well id",
        "well designation",
        "well:",
    ],
    "location": [
        "location",
        "loc",
        "well location",
        "surface location",
        "pad",
    ],
    "rig": [
        "rig name",
        "rig no",
        "rig number",
        "drilling rig",
        "rig id",
        "rig:",
    ],
    "target_depth": [
        "target depth",
        "planned td",
        "total depth",
        "objective depth",
        "td (planned)",
        "planned total depth",
        "designed td",
    ],
}


def normalize_label(raw: str) -> str | None:
    """Return the canonical field name for *raw* cell text, or None.

    Matching is case-insensitive sub-string search against LABEL_ALIASES.
    The first matching canonical key is returned; if no alias matches, returns
    None.

    Parameters
    ----------
    raw:
        The raw string value from a spreadsheet or document cell, e.g.
        "Present Depth (MD) m".
    """
    clean = raw.strip().lower()
    if not clean:
        return None
    for canonical, aliases in LABEL_ALIASES.items():
        for alias in aliases:
            if alias in clean:
                return canonical
    return None


def find_label_in_cells(
    rows: list[list[Any]],
    canonical: str,
) -> tuple[int, int] | None:
    """Search *rows* for the first cell matching the canonical label.

    Returns ``(row_index, col_index)`` (both 0-based) of the label cell, or
    None when no match is found.  The caller uses the adjacent cell (same row,
    next column; or same column, next row) to read the corresponding value.

    Parameters
    ----------
    rows:
        A 2D list of cell values as returned by openpyxl's iter_rows().  Each
        inner list is a row; cells are the raw values (strings, numbers, None).
    canonical:
        A canonical field name from LABEL_ALIASES.
    """
    aliases = LABEL_ALIASES.get(canonical, [])
    if not aliases:
        return None

    for r_idx, row in enumerate(rows):
        for c_idx, cell in enumerate(row):
            if cell is None:
                continue
            cell_str = str(cell).strip().lower()
            for alias in aliases:
                if alias in cell_str:
                    return (r_idx, c_idx)
    return None
