"""Ingestion utility helpers.

sha256 hashing, label normalisation, and document-type detection.
Fields are found by label (not row position) — parsers must never hard-code
row numbers because different workbooks have different layouts.

Public API
----------
compute_sha256(path)          -- hex SHA-256 digest of a file
normalize_label(raw)          -- stable snake_case identifier from any header string
detect_document_type(filename)-- infer DDR / WCR / DDDP / MUD_LOG / LOG_LAS from name
"""

from __future__ import annotations

import hashlib
import re
from pathlib import Path


# ── SHA-256 hashing ───────────────────────────────────────────────────────────

_CHUNK_SIZE = 65_536  # 64 KiB — avoids loading large PDFs / LAS files into memory


def compute_sha256(file_path: str | Path, chunk_size: int = _CHUNK_SIZE) -> str:
    """Return the lowercase hex-encoded SHA-256 digest of *file_path*.

    Streams the file in *chunk_size* byte chunks so that large documents
    (multi-page PDFs, full LAS logs) do not exhaust available memory.

    Raises
    ------
    FileNotFoundError
        If *file_path* does not exist.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(chunk_size), b""):
            h.update(chunk)
    return h.hexdigest()


# ── Label normalisation ───────────────────────────────────────────────────────

_CAMEL_SPLIT = re.compile(r"([a-z])([A-Z])")
_SEPARATORS = re.compile(r"[\s\-_/\\]+")
_NON_ALNUM = re.compile(r"[^a-z0-9_]")
_MULTI_UNDERSCORE = re.compile(r"_+")


def normalize_label(raw: str) -> str:
    """Return a stable, lowercase snake_case identifier derived from *raw*.

    Parenthesised unit hints are incorporated into the label:
    ``'Mud Weight (ppg)'`` → ``'mud_weight_ppg'``.

    This function is deterministic and free of row-position assumptions —
    it processes the header text, not its column index.

    Examples
    --------
    >>> normalize_label("Mud Weight (ppg)")
    'mud_weight_ppg'
    >>> normalize_label("WOB (ton)")
    'wob_ton'
    >>> normalize_label("fluid loss cc/30min")
    'fluid_loss_cc_30min'
    >>> normalize_label("Present_Depth_m")
    'present_depth_m'
    """
    # Split CamelCase before lower-casing.
    text = _CAMEL_SPLIT.sub(r"\1_\2", raw)
    text = text.lower()
    # Expand parenthesised content with an underscore prefix.
    text = re.sub(r"\(([^)]*)\)", lambda m: "_" + m.group(1), text)
    # Replace separators with underscore.
    text = _SEPARATORS.sub("_", text)
    # Drop any remaining characters that are not alphanumeric or underscore.
    text = _NON_ALNUM.sub("", text)
    # Collapse consecutive underscores and strip leading/trailing.
    text = _MULTI_UNDERSCORE.sub("_", text).strip("_")
    return text


# ── Document-type detection ───────────────────────────────────────────────────

_FILENAME_HINTS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bdddp\b", re.I), "DDDP"),
    (re.compile(r"\bddr\b", re.I), "DDR"),
    (re.compile(r"\bwcr\b", re.I), "WCR"),
    (re.compile(r"\bmud.?log\b", re.I), "MUD_LOG"),
    (re.compile(r"\.las$", re.I), "LOG_LAS"),
    (re.compile(r"\.dlis$", re.I), "LOG_LAS"),
]

_EXTENSION_MAP: dict[str, str] = {
    ".pdf": "DDR",
    ".xlsx": "WCR",
    ".xls": "WCR",
    ".docx": "WCR",
    ".doc": "WCR",
    ".las": "LOG_LAS",
    ".dlis": "LOG_LAS",
    ".csv": "DDR",
    ".txt": "DDR",
}

VALID_DOCUMENT_TYPES: frozenset[str] = frozenset(
    {"DDR", "WCR", "DDDP", "MUD_LOG", "LOG_LAS"}
)


def detect_document_type(filename: str) -> str:
    """Infer the document type from *filename*.

    Checks filename-level hints (DDDP, DDR, WCR, MUD_LOG, LAS) before
    falling back to file extension.  Returns ``'DDR'`` as the safe default
    when no match is found.

    The check order is important: DDDP must be checked before DDR because a
    DDDP filename may contain 'DDR' as a substring.
    """
    for pattern, doc_type in _FILENAME_HINTS:
        if pattern.search(filename):
            return doc_type
    ext = Path(filename).suffix.lower()
    return _EXTENSION_MAP.get(ext, "DDR")
