"""Unit-aware normalisation helpers for drilling parameters.

Every normalised value MUST preserve original_value and original_unit
alongside the canonical form — this is a non-negotiable design rule.

Public API
----------
parse_with_unit(raw)          -- parse "8.7 ppg" or "3-6" into a ParsedValue
normalize_mud_weight(raw, unit) -- convert to ppg, preserve original
parse_ddmmyyyy(raw)           -- parse DD.MM.YYYY dates as used in Oil India DDRs
normalize_formation_name(raw) -- canonical formation name via alias table
"""

from __future__ import annotations

import datetime as _dt
import re
from dataclasses import dataclass
from typing import Optional


# ── Value + unit parsing ───────────────────────────────────────────────────────

# Matches: optional sign, integer or decimal (with comma or period), optional unit
_UNIT_PATTERN = re.compile(
    r"^\s*([+-]?\d+(?:[.,]\d+)?(?:\s*[-–]\s*[+-]?\d+(?:[.,]\d+)?)?)\s*([a-zA-Z/%°\"'³·/]*)\s*$"
)
_RANGE_SEP = re.compile(r"\s*[-–]\s*")


class UnitParseError(ValueError):
    """Raised when a raw string cannot be decomposed into a numeric value and unit."""


@dataclass
class ParsedValue:
    """A raw string decomposed into a numeric value (midpoint if range) and unit."""

    raw: str
    value: float               # mid-point for ranges; single value otherwise
    value_min: Optional[float]
    value_max: Optional[float]
    unit: str


def parse_with_unit(raw: str) -> ParsedValue:
    """Parse a string such as '8.7 ppg', '39-45 sec', or '9.1' into a ParsedValue.

    Range strings like '3-6' yield value=(3+6)/2, value_min=3, value_max=6.
    Unit-less strings yield unit=''.

    Raises UnitParseError if *raw* cannot be parsed.
    """
    raw = raw.strip()
    if not raw:
        raise UnitParseError(f"Empty input: {raw!r}")

    m = _UNIT_PATTERN.match(raw)
    if not m:
        raise UnitParseError(f"Cannot parse value+unit from: {raw!r}")

    num_part = m.group(1).replace(",", ".")
    unit_part = m.group(2).strip()

    parts = _RANGE_SEP.split(num_part)
    if len(parts) == 2:
        v_min = float(parts[0])
        v_max = float(parts[1])
        value = (v_min + v_max) / 2.0
    else:
        value = float(num_part)
        v_min = v_max = None

    return ParsedValue(raw=raw, value=value, value_min=v_min, value_max=v_max, unit=unit_part)


# ── Mud-weight conversions ─────────────────────────────────────────────────────

_PPG_TO_KG_M3 = 119.8264  # 1 ppg ≈ 119.8264 kg/m³
_GCC_TO_PPG = 8.34540445   # 1 g/cc = 8.3454 ppg  (also used for S.G.)


@dataclass
class MudWeight:
    """Normalised mud weight — canonical ppg plus preserved original."""

    value_ppg: float
    value_kg_m3: float
    original_value: str
    original_unit: str


def normalize_mud_weight(raw_value: str, unit: str = "ppg") -> MudWeight:
    """Convert a raw mud-weight reading to ppg, preserving the original value and unit.

    Supported input units: ppg, kg/m3, kg/m³, g/cc, g/cm3, sg, s.g.

    Raises UnitParseError for unrecognised units.
    """
    parsed = parse_with_unit(f"{raw_value}")

    # Normalise the unit key to strip symbols that vary by document.
    unit_key = unit.lower().replace("³", "3").replace(" ", "").replace(".", "")

    if unit_key == "ppg":
        ppg = parsed.value
    elif unit_key in ("kgm3", "kg/m3", "kgm³"):
        ppg = parsed.value / _PPG_TO_KG_M3
    elif unit_key in ("gcc", "g/cc", "gcm3", "g/cm3"):
        ppg = parsed.value * _GCC_TO_PPG
    elif unit_key in ("sg", "sg.", "s.g.", "specificgravity"):
        ppg = parsed.value * _GCC_TO_PPG
    else:
        raise UnitParseError(f"Unknown mud-weight unit: {unit!r}")

    return MudWeight(
        value_ppg=round(ppg, 4),
        value_kg_m3=round(ppg * _PPG_TO_KG_M3, 4),
        original_value=raw_value,
        original_unit=unit,
    )


# ── Date parsing ───────────────────────────────────────────────────────────────

_DATE_FORMATS = ("%d.%m.%Y", "%d/%m/%Y", "%d-%m-%Y")


def parse_ddmmyyyy(raw: str) -> _dt.date:
    """Parse a date string in DD.MM.YYYY (or DD/MM/YYYY, DD-MM-YYYY) format.

    Oil India DDRs exclusively use the DD.MM.YYYY layout.  Other separators
    are accepted for robustness; ISO 8601 (YYYY-MM-DD) is intentionally
    rejected to surface extraction bugs early.

    Raises ValueError if the string cannot be parsed in any accepted format.
    """
    raw = raw.strip()
    for fmt in _DATE_FORMATS:
        try:
            return _dt.datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    raise ValueError(
        f"Cannot parse date from {raw!r}. "
        f"Expected DD.MM.YYYY format (Oil India DDR standard)."
    )


# ── Formation name normalisation ───────────────────────────────────────────────

# Maps lower-cased raw spellings found in documents → canonical names.
_FORMATION_ALIASES: dict[str, str] = {
    # Rajasthan sequence (WX-07, WX-11)
    "all+shumar": "All + Shumar",
    "all shumar": "All + Shumar",
    "all+ shumar": "All + Shumar",
    "jaisalmer+lathi": "Jaisalmer + Lathi",
    "jaisalmer lathi": "Jaisalmer + Lathi",
    "jaisalmer+ lathi": "Jaisalmer + Lathi",
    "bap+badhaura": "Bap + Badhaura",
    "bap badhaura": "Bap + Badhaura",
    "bap+ badhaura": "Bap + Badhaura",
    "upper carbonate": "Upper Carbonate",
    "nagaur": "Nagaur",
    "heg": "HEG",
    "habiganj-eocene gas": "HEG",
    "habiganj eocene gas": "HEG",
    "bilara": "Bilara",
    "lower bilara": "Lower Bilara",
    "jodhpur": "Jodhpur",
    "malani igneous suite": "Malani Igneous Suite",
    "malani": "Malani Igneous Suite",
    # Assam sequence
    "tipam": "Tipam",
    "barail": "Barail",
    "kopili": "Kopili",
    "sylhet": "Sylhet",
}


def normalize_formation_name(raw: str) -> str:
    """Return the canonical formation name for a raw spelling.

    Case-insensitive lookup in the alias table; falls back to the original
    stripped string (title-cased) if no alias matches — never fabricates a name.
    """
    key = raw.strip().lower()
    return _FORMATION_ALIASES.get(key, raw.strip())
