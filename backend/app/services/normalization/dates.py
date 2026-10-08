"""Date parsing for heterogeneous Oil India drilling report formats.

Handles DD.MM.YYYY (Indian/Excel sheet names), ISO 8601, and English formats.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Optional

_MONTH_NAMES = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6,
    "jul": 7, "july": 7, "aug": 8, "august": 8, "sep": 9, "september": 9,
    "oct": 10, "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
}

_RE_ISO = re.compile(r"^(\d{4})-(\d{1,2})-(\d{1,2})$")
_RE_DMY_DOT = re.compile(r"^(\d{1,2})\.(\d{1,2})\.(\d{4})$")
_RE_DMY_SLASH = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{4})$")
_RE_NAMED = re.compile(r"^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$")
_RE_NAMED_LONG = re.compile(r"^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$")


def _safe_date(year: int, month: int, day: int) -> Optional[date]:
    try:
        return date(year, month, day)
    except ValueError:
        return None


def parse_date(raw: str) -> Optional[date]:
    """Parse a date string from drilling reports into a Python date.

    Supported formats:
    - 2025-07-08 (ISO 8601)
    - 08.07.2025 (DD.MM.YYYY — Indian / OIL standard)
    - 08/07/2025 (DD/MM/YYYY)
    - 8 Jul 2025, 8 July 2025
    - July 8, 2025
    """
    if not raw:
        return None
    s = raw.strip()

    if m := _RE_ISO.match(s):
        return _safe_date(int(m.group(1)), int(m.group(2)), int(m.group(3)))

    if m := _RE_DMY_DOT.match(s):
        return _safe_date(int(m.group(3)), int(m.group(2)), int(m.group(1)))

    if m := _RE_DMY_SLASH.match(s):
        return _safe_date(int(m.group(3)), int(m.group(2)), int(m.group(1)))

    if m := _RE_NAMED.match(s):
        month = _MONTH_NAMES.get(m.group(2).lower())
        if month:
            return _safe_date(int(m.group(3)), month, int(m.group(1)))

    if m := _RE_NAMED_LONG.match(s):
        month = _MONTH_NAMES.get(m.group(1).lower())
        if month:
            return _safe_date(int(m.group(3)), month, int(m.group(2)))

    return None


def parse_sheet_date(sheet_name: str) -> Optional[date]:
    """Parse an Excel sheet name like '08.07.2025' into a date."""
    return parse_date(sheet_name)


def to_iso(d: date) -> str:
    """Format a date as YYYY-MM-DD."""
    return d.isoformat()
