"""Tests for the normalization service layer.

Covers:
  - parse_with_unit: plain numeric, ranges, unit-labelled strings
  - normalize_mud_weight: ppg, kg/m3, g/cc, sg; originals preserved
  - parse_ddmmyyyy: valid dates, bad formats rejected
  - DepthValue + convert_depth: type validation, refuses MD↔TVD without survey
  - normalize_formation_name: alias table look-ups, unknown names passed through
"""

from __future__ import annotations

import datetime

import pytest

from app.services.normalization.depth import (
    DepthConversionError,
    DepthValue,
    convert_depth,
)
from app.services.normalization.units import (
    MudWeight,
    ParsedValue,
    UnitParseError,
    normalize_formation_name,
    normalize_mud_weight,
    parse_ddmmyyyy,
    parse_with_unit,
)


# ── parse_with_unit ───────────────────────────────────────────────────────────

class TestParseWithUnit:
    def test_plain_float(self):
        p = parse_with_unit("9.1")
        assert p.value == pytest.approx(9.1)
        assert p.unit == ""
        assert p.value_min is None
        assert p.value_max is None

    def test_with_unit(self):
        p = parse_with_unit("8.7 ppg")
        assert p.value == pytest.approx(8.7)
        assert p.unit == "ppg"

    def test_range_midpoint(self):
        p = parse_with_unit("3-6")
        assert p.value_min == pytest.approx(3.0)
        assert p.value_max == pytest.approx(6.0)
        assert p.value == pytest.approx(4.5)

    def test_range_with_unit(self):
        p = parse_with_unit("39-45 sec")
        assert p.value == pytest.approx(42.0)
        assert p.unit == "sec"

    def test_integer_input(self):
        p = parse_with_unit("42")
        assert p.value == pytest.approx(42.0)

    def test_comma_decimal(self):
        p = parse_with_unit("9,1")
        assert p.value == pytest.approx(9.1)

    def test_empty_raises(self):
        with pytest.raises(UnitParseError):
            parse_with_unit("")

    def test_whitespace_only_raises(self):
        with pytest.raises(UnitParseError):
            parse_with_unit("   ")

    def test_raw_text_preserved(self):
        p = parse_with_unit("8.7 ppg")
        assert p.raw == "8.7 ppg"


# ── normalize_mud_weight ──────────────────────────────────────────────────────

class TestNormalizeMudWeight:
    def test_ppg_identity(self):
        mw = normalize_mud_weight("8.7", "ppg")
        assert mw.value_ppg == pytest.approx(8.7)

    def test_ppg_preserves_original_value(self):
        mw = normalize_mud_weight("8.7", "ppg")
        assert mw.original_value == "8.7"
        assert mw.original_unit == "ppg"

    def test_kgm3_conversion(self):
        # 1000 kg/m3 / 119.8264 ≈ 8.345 ppg
        mw = normalize_mud_weight("1000", "kg/m3")
        assert mw.value_ppg == pytest.approx(1000 / 119.8264, rel=1e-3)

    def test_kgm3_preserves_original(self):
        mw = normalize_mud_weight("1050", "kg/m3")
        assert mw.original_value == "1050"
        assert mw.original_unit == "kg/m3"

    def test_gcc_conversion(self):
        # 1.0 g/cc = 8.3454 ppg
        mw = normalize_mud_weight("1.0", "g/cc")
        assert mw.value_ppg == pytest.approx(8.34540445, rel=1e-3)

    def test_sg_conversion(self):
        mw_sg = normalize_mud_weight("1.09", "sg")
        mw_gcc = normalize_mud_weight("1.09", "g/cc")
        assert mw_sg.value_ppg == pytest.approx(mw_gcc.value_ppg, rel=1e-6)

    def test_preserves_original_sg(self):
        mw = normalize_mud_weight("1.09", "sg")
        assert mw.original_value == "1.09"
        assert mw.original_unit == "sg"

    def test_kg_m3_is_always_computed(self):
        mw = normalize_mud_weight("8.7", "ppg")
        assert mw.value_kg_m3 == pytest.approx(8.7 * 119.8264, rel=1e-3)

    def test_unknown_unit_raises(self):
        with pytest.raises(UnitParseError):
            normalize_mud_weight("8.7", "bar")


# ── parse_ddmmyyyy ────────────────────────────────────────────────────────────

class TestParseDdmmyyyy:
    def test_standard_format(self):
        d = parse_ddmmyyyy("09.07.2025")
        assert d == datetime.date(2025, 7, 9)

    def test_slash_separator(self):
        d = parse_ddmmyyyy("09/07/2025")
        assert d == datetime.date(2025, 7, 9)

    def test_hyphen_separator(self):
        d = parse_ddmmyyyy("09-07-2025")
        assert d == datetime.date(2025, 7, 9)

    def test_strips_whitespace(self):
        d = parse_ddmmyyyy("  09.07.2025  ")
        assert d == datetime.date(2025, 7, 9)

    def test_iso_format_rejected(self):
        # YYYY-MM-DD is ISO 8601, not Oil India DDR format.
        with pytest.raises(ValueError):
            parse_ddmmyyyy("2025-07-09")

    def test_invalid_date_rejected(self):
        with pytest.raises(ValueError):
            parse_ddmmyyyy("32.13.2025")


# ── DepthValue and convert_depth ──────────────────────────────────────────────

class TestDepthValue:
    def test_valid_md(self):
        d = DepthValue(500.0, "MD")
        assert d.value == 500.0
        assert d.reference_type == "MD"

    def test_valid_tvd(self):
        d = DepthValue(480.0, "TVD")
        assert d.reference_type == "TVD"

    def test_invalid_reference_type(self):
        with pytest.raises(ValueError):
            DepthValue(500.0, "FEET")

    def test_frozen(self):
        d = DepthValue(500.0, "MD")
        with pytest.raises(Exception):  # frozen dataclass
            d.value = 600.0  # type: ignore[misc]


class TestConvertDepth:
    def test_same_type_noop(self):
        depth = DepthValue(500.0, "MD")
        result = convert_depth(depth, "MD")
        assert result is depth  # identical object returned

    def test_tvdss_same_type_noop(self):
        depth = DepthValue(450.0, "TVDSS")
        result = convert_depth(depth, "TVDSS")
        assert result.value == 450.0

    def test_refuses_md_to_tvd_without_survey(self):
        depth = DepthValue(500.0, "MD")
        with pytest.raises(DepthConversionError):
            convert_depth(depth, "TVD")

    def test_refuses_tvd_to_md_without_survey(self):
        depth = DepthValue(480.0, "TVD")
        with pytest.raises(DepthConversionError):
            convert_depth(depth, "MD")

    def test_error_message_mentions_survey(self):
        depth = DepthValue(500.0, "MD")
        with pytest.raises(DepthConversionError) as exc_info:
            convert_depth(depth, "TVD")
        assert "survey" in str(exc_info.value).lower()

    def test_converts_with_survey_fn(self):
        def identity_survey(v: float, from_type: str, to_type: str) -> float:
            return v * 0.98  # trivial survey: TVD = 98% of MD

        depth = DepthValue(1000.0, "MD")
        result = convert_depth(depth, "TVD", survey_fn=identity_survey)
        assert result.value == pytest.approx(980.0)
        assert result.reference_type == "TVD"

    def test_invalid_target_type_raises(self):
        depth = DepthValue(500.0, "MD")
        with pytest.raises(ValueError):
            convert_depth(depth, "INVALID")


# ── normalize_formation_name ──────────────────────────────────────────────────

class TestNormalizeFormationName:
    def test_heg_uppercase(self):
        assert normalize_formation_name("HEG") == "HEG"

    def test_heg_alias(self):
        assert normalize_formation_name("Habiganj-Eocene Gas") == "HEG"

    def test_malani_short(self):
        assert normalize_formation_name("Malani") == "Malani Igneous Suite"

    def test_full_plus_notation(self):
        assert normalize_formation_name("All+Shumar") == "All + Shumar"

    def test_jaisalmer_alias(self):
        assert normalize_formation_name("Jaisalmer+Lathi") == "Jaisalmer + Lathi"

    def test_unknown_passthrough(self):
        result = normalize_formation_name("Completely Unknown Formation XYZ")
        assert result == "Completely Unknown Formation XYZ"

    def test_strips_whitespace(self):
        result = normalize_formation_name("  Nagaur  ")
        # "nagaur" is in the alias table → canonical
        assert result == "Nagaur"

    def test_case_insensitive(self):
        assert normalize_formation_name("bilara") == "Bilara"
        assert normalize_formation_name("BILARA") == "Bilara"
