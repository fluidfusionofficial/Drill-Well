"""Explainable multi-factor similar-well scoring.

Five weighted dimensions produce a composite similarity score in [0, 1]:

  1. depth     (25%) — TD measured-depth proximity
  2. formation (25%) — shared stratigraphic sequence (Jaccard)
  3. spatial   (20%) — surface-location great-circle distance
  4. hazard    (20%) — shared historical hazard event types (Jaccard)
  5. operator  (10%) — same field / operator bonus

All explanations use historical-evidence language only — they never assert
what a future well will encounter.

Public API
----------
spatial_distance_km(lat1, lng1, lat2, lng2)  -- Haversine distance
WellProfile                                   -- input descriptor
score_similarity(active, candidate)           -- returns SimilarityResult
SimilarityResult / SimilarityComponents       -- output types
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional


# ── Weights (must sum to 1.0) ─────────────────────────────────────────────────

_WEIGHTS: dict[str, float] = {
    "depth": 0.25,
    "formation": 0.25,
    "spatial": 0.20,
    "hazard": 0.20,
    "operator": 0.10,
}

_EARTH_RADIUS_KM = 6371.0


# ── Data types ────────────────────────────────────────────────────────────────

@dataclass
class WellProfile:
    """Minimal well descriptor for similarity scoring.

    Attributes
    ----------
    well_id:       Unique identifier (e.g. 'WX-07').
    td_md:         Total depth (measured depth, metres).
    formations:    List of formation names encountered (canonical or raw).
    lat, lng:      WGS-84 surface-location coordinates (decimal degrees).
    hazard_types:  Historical event types (e.g. ['MUD_LOSS', 'HELD_UP']).
    field_name:    Field or asset name for operator-score bonus.
    """

    well_id: str
    td_md: Optional[float] = None
    formations: list[str] = field(default_factory=list)
    lat: Optional[float] = None
    lng: Optional[float] = None
    hazard_types: list[str] = field(default_factory=list)
    field_name: Optional[str] = None


@dataclass
class SimilarityComponents:
    """Individual dimension scores, each in [0, 1]."""

    depth: float = 0.0
    formation: float = 0.0
    spatial: float = 0.0
    hazard: float = 0.0
    operator: float = 0.0


@dataclass
class SimilarityResult:
    """Composite similarity result with component breakdown and explanation."""

    active_well_id: str
    candidate_well_id: str
    composite_score: float          # Weighted sum of component scores, in [0, 1]
    components: SimilarityComponents
    explanation: str                # Historical-evidence narrative
    spatial_distance_km: Optional[float] = None


# ── Spatial distance ──────────────────────────────────────────────────────────

def spatial_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return the great-circle distance in kilometres (Haversine formula).

    Accurate to within ~0.5 % for distances relevant to oil-field proximity
    checks (< 500 km).  Both inputs are WGS-84 decimal degrees.
    """
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return 2.0 * _EARTH_RADIUS_KM * math.asin(math.sqrt(a))


# ── Component scorers ─────────────────────────────────────────────────────────

def _depth_score(td_a: Optional[float], td_b: Optional[float]) -> float:
    """Linear decay: 1.0 when identical, 0.0 when ≥2000 m apart."""
    if td_a is None or td_b is None:
        return 0.0
    diff = abs(td_a - td_b)
    return max(0.0, 1.0 - diff / 2000.0)


def _formation_score(formations_a: list[str], formations_b: list[str]) -> float:
    """Jaccard similarity of the two formation-name sets (case-insensitive)."""
    set_a = {f.lower().strip() for f in formations_a}
    set_b = {f.lower().strip() for f in formations_b}
    if not set_a and not set_b:
        return 0.0
    union = len(set_a | set_b)
    if union == 0:
        return 0.0
    return len(set_a & set_b) / union


def _spatial_score(dist_km: Optional[float]) -> float:
    """Linear decay: 1.0 at 0 km, 0.0 at ≥50 km."""
    if dist_km is None:
        return 0.0
    return max(0.0, 1.0 - dist_km / 50.0)


def _hazard_score(hazards_a: list[str], hazards_b: list[str]) -> float:
    """Jaccard similarity of the two hazard-type sets (upper-cased)."""
    set_a = {h.upper() for h in hazards_a}
    set_b = {h.upper() for h in hazards_b}
    if not set_a and not set_b:
        return 0.0
    union = len(set_a | set_b)
    if union == 0:
        return 0.0
    return len(set_a & set_b) / union


def _operator_score(field_a: Optional[str], field_b: Optional[str]) -> float:
    """1.0 if both wells are in the same named field; 0.0 otherwise."""
    if field_a and field_b and field_a.strip().lower() == field_b.strip().lower():
        return 1.0
    return 0.0


# ── Explanation builder ───────────────────────────────────────────────────────

def _build_explanation(
    active: WellProfile,
    candidate: WellProfile,
    components: SimilarityComponents,
    dist_km: Optional[float],
) -> str:
    """Produce a human-readable historical-evidence explanation.

    Language is restricted to 'recorded precedent' / 'historical context' —
    never predictive or directive.
    """
    parts: list[str] = []

    if dist_km is not None:
        parts.append(
            f"{candidate.well_id} has a recorded surface location "
            f"{dist_km:.1f} km from {active.well_id}"
        )

    if components.formation > 0:
        shared = {f.lower().strip() for f in active.formations} & {
            f.lower().strip() for f in candidate.formations
        }
        parts.append(
            f"historical records show shared formations: {', '.join(sorted(shared))}"
        )

    if components.hazard > 0:
        shared_h = {h.upper() for h in active.hazard_types} & {
            h.upper() for h in candidate.hazard_types
        }
        parts.append(
            f"both wells have recorded precedent for: {', '.join(sorted(shared_h))}"
        )

    if components.depth > 0:
        parts.append(
            f"historical total-depth records: {active.well_id} "
            f"{active.td_md:.0f} m vs {candidate.well_id} "
            f"{candidate.td_md:.0f} m"
        )

    if not parts:
        parts.append("limited shared historical context available")

    return (
        f"Historical context for {candidate.well_id} as an offset reference: "
        + "; ".join(parts)
        + "."
    )


# ── Public API ────────────────────────────────────────────────────────────────

def score_similarity(active: WellProfile, candidate: WellProfile) -> SimilarityResult:
    """Return an explainable similarity score between *active* and *candidate*.

    The composite score is the weighted sum of five normalised component scores.
    The explanation provides historical evidence only — it never asserts what
    the active well will encounter.
    """
    # Spatial distance first — needed by both spatial_score and explanation.
    dist_km: Optional[float] = None
    if (
        active.lat is not None and active.lng is not None
        and candidate.lat is not None and candidate.lng is not None
    ):
        dist_km = spatial_distance_km(active.lat, active.lng, candidate.lat, candidate.lng)

    components = SimilarityComponents(
        depth=_depth_score(active.td_md, candidate.td_md),
        formation=_formation_score(active.formations, candidate.formations),
        spatial=_spatial_score(dist_km),
        hazard=_hazard_score(active.hazard_types, candidate.hazard_types),
        operator=_operator_score(active.field_name, candidate.field_name),
    )

    composite = sum(
        getattr(components, dim) * w for dim, w in _WEIGHTS.items()
    )

    explanation = _build_explanation(active, candidate, components, dist_km)

    return SimilarityResult(
        active_well_id=active.well_id,
        candidate_well_id=candidate.well_id,
        composite_score=round(composite, 4),
        components=components,
        explanation=explanation,
        spatial_distance_km=dist_km,
    )


# ── Database-backed lookup ────────────────────────────────────────────────────


async def find_similar_wells(
    db: "AsyncSession",
    well_id: str,
    limit: int = 5,
) -> list[dict]:
    """Return the top-N similar wells for well_id ranked by composite_score.

    Reads from pre-computed similarity_record rows.  If none exist, returns
    an empty list — callers should trigger a background scoring job.

    Each dict includes all five score dimensions and the explanation text
    so that clients can render the full rationale breakdown.
    """
    from sqlalchemy import select  # local import to avoid circular dep at module level
    from app.models.knowledge import SimilarityRecord
    from app.models.well import WellMaster

    stmt = (
        select(SimilarityRecord, WellMaster)
        .join(
            WellMaster,
            WellMaster.well_id == SimilarityRecord.candidate_well_id,
        )
        .where(SimilarityRecord.active_well_id == well_id)
        .order_by(SimilarityRecord.composite_score.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        {
            "candidate_well_id": rec.candidate_well_id,
            "candidate_well_name": wm.well_name,
            "composite_score": float(rec.composite_score),
            "depth_score": float(rec.depth_score) if rec.depth_score is not None else None,
            "formation_score": (
                float(rec.formation_score) if rec.formation_score is not None else None
            ),
            "spatial_score": (
                float(rec.spatial_score) if rec.spatial_score is not None else None
            ),
            "hazard_score": (
                float(rec.hazard_score) if rec.hazard_score is not None else None
            ),
            "operator_score": (
                float(rec.operator_score) if rec.operator_score is not None else None
            ),
            "explanation": rec.explanation,
        }
        for rec, wm in rows
    ]
