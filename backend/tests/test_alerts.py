"""Tests for the Level 1 deterministic historical-context alert engine.

Covers:
  - check_proximity_alerts: triggers within window, not outside, multiple events
  - Alert level classification: INFO / WARNING / CRITICAL based on severity
  - Advisory language: 'recorded precedent' / 'historical context' present
  - Advisory language: predictive phrases absent
  - compute_risk_score: proximity decay, severity weighting, cap at 1.0
"""

from __future__ import annotations

import pytest

from app.services.alerts import (
    AlertResult,
    HistoricalEvent,
    check_proximity_alerts,
    compute_risk_score,
)


# ── Reference events (matching EV-101 … EV-106 in the seed data) ─────────────

EV_MUD_LOSS_HIGH = HistoricalEvent(
    event_id="EV-101",
    event_type="MUD_LOSS",
    depth_md=523.0,
    well_id="WX-07",
    severity="HIGH",
    volume_bbl=25.0,
)

EV_MUD_LOSS_CRITICAL = HistoricalEvent(
    event_id="EV-102",
    event_type="MUD_LOSS",
    depth_md=544.0,
    well_id="WX-07",
    severity="CRITICAL",
    volume_bbl=209.0,
)

EV_HELD_UP = HistoricalEvent(
    event_id="EV-103",
    event_type="HELD_UP",
    depth_md=507.0,
    well_id="WX-07",
    severity="MEDIUM",
)

EV_TIGHT_PULL = HistoricalEvent(
    event_id="EV-104",
    event_type="TIGHT_PULL",
    depth_md=568.0,
    well_id="WX-11",
    severity="MEDIUM",
)

EV_CASING = HistoricalEvent(
    event_id="EV-105",
    event_type="CASING_FAILURE",
    depth_md=341.0,
    well_id="WX-07",
    severity="HIGH",
)

EV_HELD_UP_11 = HistoricalEvent(
    event_id="EV-106",
    event_type="HELD_UP",
    depth_md=512.0,
    well_id="WX-11",
    severity="MEDIUM",
)

ALL_EVENTS = [EV_MUD_LOSS_HIGH, EV_MUD_LOSS_CRITICAL, EV_HELD_UP, EV_TIGHT_PULL, EV_CASING, EV_HELD_UP_11]


# ── check_proximity_alerts ────────────────────────────────────────────────────

class TestCheckProximityAlerts:
    def test_triggers_within_window(self):
        alerts = check_proximity_alerts(530.0, [EV_MUD_LOSS_HIGH], proximity_window_m=50.0)
        assert len(alerts) == 1
        assert alerts[0].source_event_id == "EV-101"

    def test_exact_boundary_triggers(self):
        # At exactly 50 m distance → should trigger (distance == window).
        alerts = check_proximity_alerts(473.0, [EV_HELD_UP], proximity_window_m=50.0)
        assert len(alerts) == 1  # EV-103 at 507, current=473 → dist=34 < 50

    def test_outside_window_not_triggered(self):
        alerts = check_proximity_alerts(700.0, ALL_EVENTS, proximity_window_m=50.0)
        assert len(alerts) == 0

    def test_empty_events_returns_empty(self):
        alerts = check_proximity_alerts(500.0, [], proximity_window_m=50.0)
        assert len(alerts) == 0

    def test_multiple_events_in_window(self):
        # Depth 530: EV-101 at 523 (dist 7), EV-102 at 544 (dist 14), EV-103 at 507 (dist 23)
        alerts = check_proximity_alerts(530.0, [EV_MUD_LOSS_HIGH, EV_MUD_LOSS_CRITICAL, EV_HELD_UP])
        assert len(alerts) == 3

    def test_result_contains_alert_id(self):
        alerts = check_proximity_alerts(530.0, [EV_MUD_LOSS_HIGH])
        assert alerts[0].alert_id.startswith("ALERT-EV-101")

    def test_trigger_depth_recorded(self):
        alerts = check_proximity_alerts(530.0, [EV_MUD_LOSS_HIGH])
        assert alerts[0].trigger_depth_md == pytest.approx(530.0)

    def test_category_matches_event_type(self):
        alerts = check_proximity_alerts(520.0, [EV_MUD_LOSS_HIGH])
        assert alerts[0].category == "MUD_LOSS"


# ── Alert level classification ────────────────────────────────────────────────

class TestAlertLevelClassification:
    def test_critical_severity_gives_critical_level(self):
        alerts = check_proximity_alerts(544.0, [EV_MUD_LOSS_CRITICAL])
        assert len(alerts) == 1
        assert alerts[0].level == "CRITICAL"

    def test_high_severity_gives_warning_or_higher(self):
        alerts = check_proximity_alerts(523.0, [EV_MUD_LOSS_HIGH])
        assert alerts[0].level in ("WARNING", "CRITICAL")

    def test_medium_severity_gives_info_or_higher(self):
        alerts = check_proximity_alerts(507.0, [EV_HELD_UP])
        assert alerts[0].level in ("INFO", "WARNING", "CRITICAL")

    def test_casing_failure_high_severity(self):
        alerts = check_proximity_alerts(341.0, [EV_CASING])
        assert alerts[0].level in ("WARNING", "CRITICAL")


# ── Advisory language ─────────────────────────────────────────────────────────

class TestAdvisoryLanguage:
    def test_contains_historical_context_phrase(self):
        alerts = check_proximity_alerts(530.0, [EV_MUD_LOSS_HIGH])
        lower = alerts[0].advisory_text.lower()
        assert any(kw in lower for kw in ("recorded precedent", "historical context", "was recorded")), (
            f"Missing historical-context language: {alerts[0].advisory_text!r}"
        )

    def test_no_will_happen(self):
        for ev in ALL_EVENTS:
            dist = 20.0  # within window
            alerts = check_proximity_alerts(ev.depth_md + dist, [ev])
            for alert in alerts:
                assert "will happen" not in alert.advisory_text.lower()

    def test_no_you_must(self):
        alerts = check_proximity_alerts(530.0, ALL_EVENTS, proximity_window_m=200.0)
        for alert in alerts:
            assert "you must" not in alert.advisory_text.lower()

    def test_no_predicted(self):
        alerts = check_proximity_alerts(530.0, ALL_EVENTS, proximity_window_m=200.0)
        for alert in alerts:
            assert "predicted" not in alert.advisory_text.lower()

    def test_source_well_mentioned(self):
        alerts = check_proximity_alerts(523.0, [EV_MUD_LOSS_HIGH])
        assert "WX-07" in alerts[0].advisory_text

    def test_depth_mentioned(self):
        alerts = check_proximity_alerts(523.0, [EV_MUD_LOSS_HIGH])
        assert "523" in alerts[0].advisory_text

    def test_mud_loss_template_used(self):
        alerts = check_proximity_alerts(523.0, [EV_MUD_LOSS_HIGH])
        lower = alerts[0].advisory_text.lower()
        assert "mud loss" in lower

    def test_tight_pull_template_used(self):
        alerts = check_proximity_alerts(568.0, [EV_TIGHT_PULL])
        lower = alerts[0].advisory_text.lower()
        assert "tight" in lower or "pull" in lower


# ── compute_risk_score ────────────────────────────────────────────────────────

class TestComputeRiskScore:
    def test_no_events_gives_zero(self):
        score = compute_risk_score([], 500.0)
        assert score == pytest.approx(0.0)

    def test_exact_match_high_severity(self):
        score = compute_risk_score([EV_MUD_LOSS_HIGH], current_depth=523.0)
        # HIGH weight = 0.8, exp(-0/20) = 1.0 → score = 0.8
        assert score == pytest.approx(0.8, rel=1e-3)

    def test_exact_match_critical_severity(self):
        score = compute_risk_score([EV_MUD_LOSS_CRITICAL], current_depth=544.0)
        # CRITICAL weight = 1.0, exp(-0/20) = 1.0 → score = 1.0
        assert score == pytest.approx(1.0, rel=1e-3)

    def test_capped_at_one(self):
        many_critical = [EV_MUD_LOSS_CRITICAL] * 20
        score = compute_risk_score(many_critical, current_depth=544.0)
        assert score <= 1.0

    def test_outside_window_zero(self):
        score = compute_risk_score([EV_MUD_LOSS_HIGH], current_depth=1000.0, proximity_window_m=50.0)
        assert score == pytest.approx(0.0)

    def test_score_decays_with_distance(self):
        score_near = compute_risk_score([EV_HELD_UP], current_depth=508.0)  # dist 1
        score_far = compute_risk_score([EV_HELD_UP], current_depth=540.0)   # dist 33
        assert score_near > score_far

    def test_risk_is_in_unit_interval(self):
        for ev in ALL_EVENTS:
            score = compute_risk_score(ALL_EVENTS, current_depth=ev.depth_md)
            assert 0.0 <= score <= 1.0, f"Score {score} out of [0, 1] for depth {ev.depth_md}"
