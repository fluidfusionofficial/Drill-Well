"""File-type detection using magic bytes, with a filename extension fallback.

FileType         — enum covering every document format the ingestion pipeline
                   accepts (XLSX, XLS, DOCX, PDF) plus UNKNOWN.
detect_file_type — inspects the leading content bytes first; falls back to the
                   filename extension only when the magic byte check is
                   ambiguous (i.e. ZIP-container formats XLSX vs DOCX are
                   distinguished by extension because both share the PK header).

Magic byte reference
--------------------
PDF  : %PDF  — 0x25 50 44 46
XLSX : PK\x03\x04 (ZIP) + extension ".xlsx"  (OOXML spreadsheet)
DOCX : PK\x03\x04 (ZIP) + extension ".docx"  (OOXML word-processing)
XLS  : \xd0\xcf\x11\xe0 (Compound Document File, legacy OLE2)
"""

from __future__ import annotations

from enum import Enum


class FileType(Enum):
    PDF = "pdf"
    XLSX = "xlsx"
    XLS = "xls"
    DOCX = "docx"
    UNKNOWN = "unknown"


# Magic-byte signatures: (byte_offset, bytes_to_match)
_PDF_MAGIC = (0, b"%PDF")
_ZIP_MAGIC = (0, b"PK\x03\x04")
_XLS_MAGIC = (0, b"\xd0\xcf\x11\xe0")

# Minimum content length required before we test magic bytes
_MIN_SNIFF = 8


def _starts_with(content: bytes, offset: int, marker: bytes) -> bool:
    end = offset + len(marker)
    return len(content) >= end and content[offset:end] == marker


def detect_file_type(filename: str, content: bytes) -> FileType:
    """Return the FileType for *content* using magic bytes.

    The filename is used only to disambiguate ZIP-container formats (XLSX vs
    DOCX) because both share the same ``PK\x03\x04`` header.  All other
    detections are purely content-based.

    Parameters
    ----------
    filename:
        Original filename, including extension (case-insensitive).
    content:
        Raw bytes of the file.  At least the first 8 bytes are required;
        shorter content always returns FileType.UNKNOWN.
    """
    if len(content) < _MIN_SNIFF:
        return FileType.UNKNOWN

    if _starts_with(content, *_PDF_MAGIC):
        return FileType.PDF

    if _starts_with(content, *_XLS_MAGIC):
        return FileType.XLS

    if _starts_with(content, *_ZIP_MAGIC):
        # ZIP-based OOXML — differentiate by extension
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext == "xlsx":
            return FileType.XLSX
        if ext == "docx":
            return FileType.DOCX
        # Unknown ZIP content — leave as UNKNOWN; caller decides
        return FileType.UNKNOWN

    return FileType.UNKNOWN
