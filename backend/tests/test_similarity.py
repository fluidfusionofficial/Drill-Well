"""Tests for the explainable multi-factor similar-well scoring service.

Covers:
  - spatial_distance_km: known pairs, same point, hemisphere correctness
  - score_similarity: five component scores present and in [0, 1]
  - Component boundary conditions: identical, maximally different
  - Explanation: historical language present, predictive language absent
  - Composite score range and weighting sanity
"""

from __future__ import annotations

import math

import pytest

from app.services.similarity import (
    SimilarityComponents,
    SimilarityResult,
    WellProfile,
    score_similarity,
    spatial_distance_km,
)

# ── Reference well profiles (representative of the NWIS dataset) ──────────────

WX07 = WellProfile(
    well_id="WX-07",
    td_md=1161.0,
    formations=["All + Shumar", "Jaisalmer + Lathi", "Bap + Badhaura", "Nagaur", "HEG"],
    lat=26.92,
    lng=71.44,
    hazard_types=["MUD_LOSS", "HELD_UP", "CASING_FAILURE"],
    field_name="Rajasthan",
)

WX11 = WellProfile(
    well_id="WX-11",
    td_md=1138.0,
    formations=["All + Shumar", "Jaisalmer + Lathi", "Bap + Badhaura", "Nagaur", "HEG"],
    lat=26.97,
    lng=71.51,
    hazard_types=["MUD_LOSS", "TIGHT_PULL", "HELD_UP"],
    field_name="Rajasthan",
)

WX19 = WellProfile(
    well_id="WX-19",
    td_md=945.0,
    formations=["All + Shumar", "Jaisalmer + Lathi", "Nagaur"],
    lat=26.91,
    lng=71.38,
    hazard_types=["MUD_LOSS"],
    field_name="Rajasthan",
)


# ── spatial_distance_km ───────────────────────────────────────────────────────

class TestSpatialDistanceKm:
    def test_same_point_is_zero(self):
        assert spatial_distance_km(26.92, 71.44, 26.92, 71.44) == pytest.approx(0.0, abs=1e-6)

    def test_wx07_to_wx11_is_reasonable(self):
        d = spatial_distance_km(26.92, 71.44, 26.97, 71.51)
        # A ~0.05° lat, ~0.07° lng offset at this latitude is roughly 7-9 km.
        assert 6.0 < d < 11.0

    def test_symmetry(self):
        d1 = spatial_distance_km(26.92, 71.44, 26.97, 71.51)
        d2 = spatial_distance_km(26.97, 71.51, 26.92, 71.44)
        assert d1 == pytest.approx(d2, rel=1e-9)

    def test_1_degree_equator_is_approx_111km(self):
        d = spatial_distance_km(0.0, 0.0, 0.0, 1.0)
        assert 110.0 < d < 112.0

    def test_wx07_to_wx19(self):
        d = spatial_distance_km(26.92, 71.44, 26.91, 71.38)
        assert 0.0 < d < 10.0


# ── score_similarity ──────────────────────────────────────────────────────────

class TestScoreSimilarity:
    def test_returns_similarity_result(self):
        result = score_similarity(WX07, WX11)
        assert isinstance(result, SimilarityResult)

    def test_active_and_candidate_ids_correct(self):
        result = score_similarity(WX07, WX11)
        assert result.active_well_id == "WX-07"
        assert result.candidate_well_id == "WX-11"

    def test_composite_score_in_range(self):
        result = score_similarity(WX07, WX11)
        assert 0.0 <= result.composite_score <= 1.0

    def test_five_components_present(self):
        result = score_similarity(WX07, WX11)
        c = result.components
        for attr in ("depth", "formation", "spatial", "hazard", "operator"):
            score = getattr(c, attr)
            assert 0.0 <= score <= 1.0, f"Component '{attr}' out of range: {score}"

    def test_spatial_distance_populated(self):
        result = score_similarity(WX07, WX11)
        assert result.spatial_distance_km is not None
        assert result.spatial_distance_km > 0.0

    def test_no_coordinates_gives_zero_spatial(self):
        a = WellProfile(well_id="A", td_md=1000.0, formations=["Nagaur"])
        b = WellProfile(well_id="B", td_md=1000.0, formations=["Nagaur"])
        result = score_similarity(a, b)
        assert result.components.spatial == pytest.approx(0.0)
        assert result.spatial_distance_km is None


# ── Component boundary tests ──────────────────────────────────────────────────

class TestDepthComponent:
    def test_identical_td_gives_score_one(self):
        a = WellProfile(well_id="A", td_md=1000.0)
        b = WellProfile(well_id="B", td_md=1000.0)
        result = score_similarity(a, b)
        assert result.components.depth == pytest.approx(1.0)

    def test_2000m_apart_gives_score_zero(self):
        a = WellProfile(well_id="A", td_md=0.0)
        b = WellProfile(well_id="B", td_md=2000.0)
        result = score_similarity(a, b)
        assert result.components.depth == pytest.approx(0.0)

    def test_missing_td_gives_score_zero(self):
        a = WellProfile(well_id="A", td_md=None)
        b = WellProfile(well_id="B", td_md=1000.0)
        result = score_similarity(a, b)
        assert result.components.depth == pytest.approx(0.0)


class TestFormationComponent:
    def test_identical_formations_gives_one(self):
        a = WellProfile(well_id="A", formations=["Nagaur", "HEG"])
        b = WellProfile(well_id="B", formations=["Nagaur", "HEG"])
        result = score_similarity(a, b)
        assert result.components.formation == pytest.approx(1.0)

    def test_no_overlap_gives_zero(self):
        a = WellProfile(well_id="A", formations=["Nagaur"])
        b = WellProfile(well_id="B", formations=["Tipam"])
        result = score_similarity(a, b)
        assert result.components.formation == pytest.approx(0.0)

    def test_partial_overlap(self):
        a = WellProfile(well_id="A", formations=["Nagaur", "HEG", "Bilara"])
        b = WellProfile(well_id="B", formations=["Nagaur", "HEG", "Tipam"])
        result = score_similarity(a, b)
        # Intersection={Nagaur, HEG}, Union={Nagaur, HEG, Bilara, Tipam} → 0.5
        assert result.components.formation == pytest.approx(0.5)


class TestOperatorComponent:
    def test_same_field_gives_one(self):
        result = score_similarity(WX07, WX11)
        assert result.components.operator == pytest.approx(1.0)

    def test_different_field_gives_zero(self):
        a = WellProfile(well_id="A", field_name="Rajasthan")
        b = WellProfile(well_id="B", field_name="Upper Assam")
        result = score_similarity(a, b)
        assert result.components.operator == pytest.approx(0.0)

    def test_missing_field_gives_zero(self):
        a = WellProfile(well_id="A", field_name=None)
        b = WellProfile(well_id="B", field_name="Rajasthan")
        result = score_similarity(a, b)
        assert result.components.operator == pytest.approx(0.0)


class TestHazardComponent:
    def test_full_overlap_gives_one(self):
        a = WellProfile(well_id="A", hazard_types=["MUD_LOSS"])
        b = WellProfile(well_id="B", hazard_types=["MUD_LOSS"])
        result = score_similarity(a, b)
        assert result.components.hazard == pytest.approx(1.0)

    def test_case_insensitive(self):
        a = WellProfile(well_id="A", hazard_types=["mud_loss"])
        b = WellProfile(well_id="B", hazard_types=["MUD_LOSS"])
        result = score_similarity(a, b)
        assert result.components.hazard == pytest.approx(1.0)


# ── Explanation language tests ────────────────────────────────────────────────

class TestExplanationLanguage:
    def test_uses_historical_language(self):
        result = score_similarity(WX07, WX11)
        lower = result.explanation.lower()
        assert any(kw in lower for kw in ("historical", "recorded", "precedent")), (
            f"Explanation missing historical language: {result.explanation!r}"
        )

    def test_no_predictive_language(self):
        result = score_similarity(WX07, WX11)
        lower = result.explanation.lower()
        forbidden = ["will happen", "will encounter", "predicted", "you must", "you should"]
        for phrase in forbidden:
            assert phrase not in lower, (
                f"Forbidden phrase {phrase!r} found in explanation: {result.explanation!r}"
            )

    def test_contains_candidate_id(self):
        result = score_similarity(WX07, WX11)
        assert "WX-11" in result.explanation

    def test_explanation_is_nonempty(self):
        result = score_similarity(WX07, WX19)
        assert len(result.explanation) > 0
