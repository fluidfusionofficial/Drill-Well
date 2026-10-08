"""Tests for the ingestion utility helpers.

Covers:
  - compute_sha256: known content, empty file, missing file
  - normalize_label: spaces, CamelCase, parenthesised units, separators
  - detect_document_type: DDR, WCR, DDDP, LAS, unknown defaults
"""

from __future__ import annotations

import hashlib
import os
from pathlib import Path

import pytest

from app.services.ingestion.utils import (
    compute_sha256,
    detect_document_type,
    normalize_label,
)


# ── compute_sha256 ────────────────────────────────────────────────────────────

class TestComputeSha256:
    def test_known_content(self, tmp_path: Path):
        target = tmp_path / "payload.bin"
        target.write_bytes(b"hello nwis seeder")
        expected = hashlib.sha256(b"hello nwis seeder").hexdigest()
        assert compute_sha256(target) == expected

    def test_empty_file(self, tmp_path: Path):
        target = tmp_path / "empty.bin"
        target.write_bytes(b"")
        assert compute_sha256(target) == hashlib.sha256(b"").hexdigest()

    def test_large_file_streamed(self, tmp_path: Path):
        # 300 KiB > default chunk size of 64 KiB → exercises the chunked read path.
        data = b"x" * (300 * 1024)
        target = tmp_path / "large.bin"
        target.write_bytes(data)
        expected = hashlib.sha256(data).hexdigest()
        assert compute_sha256(target) == expected

    def test_missing_file_raises(self):
        with pytest.raises(FileNotFoundError):
            compute_sha256("/tmp/nwis_test_does_not_exist_xyz.bin")

    def test_path_as_string(self, tmp_path: Path):
        target = tmp_path / "str_path.bin"
        target.write_bytes(b"abc")
        result = compute_sha256(str(target))
        assert result == hashlib.sha256(b"abc").hexdigest()

    def test_returns_lowercase_hex(self, tmp_path: Path):
        target = tmp_path / "hex.bin"
        target.write_bytes(b"test")
        digest = compute_sha256(target)
        assert digest == digest.lower()
        assert len(digest) == 64


# ── normalize_label ───────────────────────────────────────────────────────────

class TestNormalizeLabel:
    def test_spaces_to_underscores(self):
        assert normalize_label("Mud Weight") == "mud_weight"

    def test_parenthesised_unit(self):
        assert normalize_label("Mud Weight (ppg)") == "mud_weight_ppg"

    def test_slash_unit(self):
        assert normalize_label("fluid loss cc/30min") == "fluid_loss_cc_30min"

    def test_camel_case_split(self):
        result = normalize_label("PresentDepth")
        assert "present" in result
        assert "depth" in result

    def test_uppercase_acronym(self):
        result = normalize_label("WOB")
        assert result == "wob"

    def test_no_double_underscores(self):
        label = normalize_label("  Multiple   Spaces  ")
        assert "__" not in label

    def test_no_leading_trailing_underscores(self):
        label = normalize_label("  Depth(m)  ")
        assert not label.startswith("_")
        assert not label.endswith("_")

    def test_existing_underscore_preserved(self):
        result = normalize_label("present_depth_m")
        assert result == "present_depth_m"

    def test_special_chars_removed(self):
        result = normalize_label("Depth @500m!")
        assert "@" not in result
        assert "!" not in result

    def test_idempotent(self):
        first = normalize_label("Mud Weight (ppg)")
        second = normalize_label(first)
        assert first == second


# ── detect_document_type ──────────────────────────────────────────────────────

class TestDetectDocumentType:
    def test_ddr_in_name(self):
        assert detect_document_type("WX07_DDR_Jul2025.pdf") == "DDR"

    def test_dddp_takes_priority_over_ddr(self):
        # 'DDDP' contains 'DDR' as substring — DDDP hint must win.
        assert detect_document_type("DDDP_WX07_Final.pdf") == "DDDP"

    def test_wcr_in_name(self):
        assert detect_document_type("WCR_WX11_2025.xlsx") == "WCR"

    def test_wcr_excel_extension(self):
        # Extension-based fallback when no keyword hint is present.
        assert detect_document_type("well_completion_report.xlsx") == "WCR"

    def test_las_filename(self):
        assert detect_document_type("formation_eval.las") == "LOG_LAS"

    def test_las_by_hint(self):
        # Hint pattern checks .las extension before extension map.
        assert detect_document_type("WX07_LOG.las") == "LOG_LAS"

    def test_mud_log(self):
        assert detect_document_type("mud_log_WX07.pdf") == "MUD_LOG"

    def test_unknown_extension_defaults_to_ddr(self):
        assert detect_document_type("report.unknown_ext") == "DDR"

    def test_pdf_extension_defaults_to_ddr(self):
        # A PDF without any keyword hint defaults to DDR.
        assert detect_document_type("generic_report.pdf") == "DDR"

    def test_case_insensitive_hint(self):
        # 'ddr' lower-case should match.
        assert detect_document_type("wx07_ddr_report.pdf") == "DDR"
