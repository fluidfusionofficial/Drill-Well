"""Similarity weight learner for NWIS offset-well ranking.

The backend's ``app/services/similarity.py`` uses five weighted dimensions to
score well similarity. This module learns those weights from labelled pairs
(or optimises them against a retrieval quality metric) using
``scipy.optimize.minimize``, and validates them with ablation tests.

Every output is framed as "recorded historical similarity", never as a
prediction or guarantee.
"""

from __future__ import annotations

import logging
import pathlib
from dataclasses import dataclass, field
from typing import Callable

import joblib
import numpy as np
from scipy.optimize import minimize

logger = logging.getLogger(__name__)

# ── Dimension names (must match backend similarity service) ────────────────
DIMENSION_NAMES = [
    "formation_overlap",
    "depth_range_similarity",
    "geographic_proximity",
    "mud_system_match",
    "drilling_parameter_similarity",
]
N_DIMS = len(DIMENSION_NAMES)

# ── Default seed weights (equal, sums to 1.0) ─────────────────────────────
_DEFAULT_WEIGHTS = np.ones(N_DIMS, dtype=np.float64) / N_DIMS


@dataclass
class WeightValidationResult:
    weights: dict[str, float]
    ndcg_score: float
    ablation_results: dict[str, float] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)


class SimilarityLearner:
    """Learn similarity dimension weights from labelled well-pair data.

    The similarity score between two wells is:

        score = w1 * formation_overlap
              + w2 * depth_range_similarity
              + w3 * geographic_proximity
              + w4 * mud_system_match
              + w5 * drilling_parameter_similarity

    where all ``wN >= 0`` and ``sum(wN) == 1``.

    ``learn_weights`` optimises the weights to maximise NDCG@K on labelled
    ranked lists. ``ablation_test`` measures each dimension's individual
    contribution by zeroing it out and observing the NDCG drop.
    """

    def __init__(self, seed_weights: np.ndarray | None = None) -> None:
        self._weights: np.ndarray = (
            seed_weights.copy() if seed_weights is not None else _DEFAULT_WEIGHTS.copy()
        )
        self._is_fitted = False

    # ------------------------------------------------------------------
    # Weight learning
    # ------------------------------------------------------------------

    def learn_weights(
        self,
        similarity_matrices: np.ndarray,
        relevance_labels: np.ndarray,
        k: int = 5,
        n_restarts: int = 5,
    ) -> np.ndarray:
        """Learn dimension weights that maximise NDCG@K.

        Args:
            similarity_matrices: Array of shape ``(N, N_DIMS)`` where each row
                is a vector of per-dimension similarity scores for a well pair.
                Scores must be in ``[0, 1]``.
            relevance_labels: Array of shape ``(N,)`` with relevance judgements
                (e.g. 3=highly similar, 2=similar, 1=somewhat, 0=unrelated).
                Must be non-negative integers.
            k: Cutoff for NDCG@K.
            n_restarts: Number of random restarts to escape local minima.

        Returns:
            1-D numpy array of ``N_DIMS`` weights summing to 1.0.
        """
        if similarity_matrices.shape[1] != N_DIMS:
            raise ValueError(
                f"Expected {N_DIMS} dimensions per pair, "
                f"got {similarity_matrices.shape[1]}."
            )
        if len(similarity_matrices) != len(relevance_labels):
            raise ValueError(
                "similarity_matrices and relevance_labels must have the same length."
            )

        def neg_ndcg(w: np.ndarray) -> float:
            w = np.abs(w)
            w = w / (w.sum() + 1e-9)
            scores = similarity_matrices @ w
            return -_ndcg_at_k(scores, relevance_labels, k)

        # Constraint: weights sum to 1
        constraints = {"type": "eq", "fun": lambda w: np.sum(np.abs(w)) - 1.0}
        bounds = [(0.0, 1.0)] * N_DIMS

        best_result = None
        rng = np.random.default_rng(42)

        for i in range(n_restarts):
            w0 = rng.dirichlet(np.ones(N_DIMS))
            result = minimize(
                neg_ndcg,
                w0,
                method="SLSQP",
                bounds=bounds,
                constraints=constraints,
                options={"maxiter": 500, "ftol": 1e-8},
            )
            if best_result is None or result.fun < best_result.fun:
                best_result = result
            logger.debug("Restart %d/%d — NDCG@%d=%.4f", i + 1, n_restarts, k, -result.fun)

        raw = np.abs(best_result.x)
        self._weights = raw / raw.sum()
        self._is_fitted = True

        logger.info(
            "Learned similarity weights: %s (NDCG@%d=%.4f)",
            dict(zip(DIMENSION_NAMES, [round(w, 4) for w in self._weights])),
            k,
            -best_result.fun,
        )
        return self._weights.copy()

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    def validate_weights(
        self,
        similarity_matrices: np.ndarray,
        relevance_labels: np.ndarray,
        k: int = 5,
    ) -> WeightValidationResult:
        """Validate current weights and run ablation tests.

        Args:
            similarity_matrices: Held-out pairs, same format as
                :meth:`learn_weights`.
            relevance_labels: Corresponding relevance judgements.
            k: NDCG cutoff.

        Returns:
            :class:`WeightValidationResult` with NDCG score and ablation table.
        """
        self._assert_fitted()
        scores = similarity_matrices @ self._weights
        ndcg = _ndcg_at_k(scores, relevance_labels, k)

        ablation = self.ablation_test(similarity_matrices, relevance_labels, k)

        notes = []
        for dim, drop in ablation.items():
            if drop > 0.05:
                notes.append(
                    f"Dimension '{dim}' contributes >5% NDCG; "
                    "removing it significantly degrades ranking quality."
                )
            elif drop < 0.0:
                notes.append(
                    f"Dimension '{dim}' has negative contribution — "
                    "consider reducing its weight or reviewing data quality."
                )

        return WeightValidationResult(
            weights={name: round(float(w), 4) for name, w in zip(DIMENSION_NAMES, self._weights)},
            ndcg_score=round(float(ndcg), 4),
            ablation_results={k_: round(float(v), 4) for k_, v in ablation.items()},
            notes=notes,
        )

    # ------------------------------------------------------------------
    # Ablation testing
    # ------------------------------------------------------------------

    def ablation_test(
        self,
        similarity_matrices: np.ndarray,
        relevance_labels: np.ndarray,
        k: int = 5,
    ) -> dict[str, float]:
        """Measure each dimension's contribution via leave-one-out ablation.

        For each dimension, zeros out that weight, renormalises the remaining
        weights, recomputes scores, and reports the NDCG@K drop.

        Args:
            similarity_matrices: Well-pair feature matrix.
            relevance_labels: Relevance labels.
            k: NDCG cutoff.

        Returns:
            Dict mapping dimension name to NDCG drop (positive = dimension
            helps; negative = dimension hurts).
        """
        self._assert_fitted()
        baseline_scores = similarity_matrices @ self._weights
        baseline_ndcg = _ndcg_at_k(baseline_scores, relevance_labels, k)

        drops: dict[str, float] = {}
        for i, dim_name in enumerate(DIMENSION_NAMES):
            ablated = self._weights.copy()
            ablated[i] = 0.0
            total = ablated.sum()
            if total > 1e-9:
                ablated = ablated / total
            else:
                ablated = np.ones(N_DIMS) / N_DIMS
            ablated_scores = similarity_matrices @ ablated
            ablated_ndcg = _ndcg_at_k(ablated_scores, relevance_labels, k)
            drops[dim_name] = float(baseline_ndcg - ablated_ndcg)

        logger.info("Ablation results (NDCG@%d drops): %s", k, drops)
        return drops

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def weights(self) -> dict[str, float]:
        """Current dimension weights as a dict (for serialisation)."""
        return {name: float(w) for name, w in zip(DIMENSION_NAMES, self._weights)}

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def save(self, path: str | pathlib.Path) -> None:
        path = pathlib.Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({"weights": self._weights, "dimension_names": DIMENSION_NAMES}, path, compress=3)
        logger.info("SimilarityLearner saved to %s", path)

    @classmethod
    def load(cls, path: str | pathlib.Path) -> "SimilarityLearner":
        payload = joblib.load(path)
        obj = cls.__new__(cls)
        obj._weights = payload["weights"]
        obj._is_fitted = True
        logger.info("SimilarityLearner loaded from %s", path)
        return obj

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _assert_fitted(self) -> None:
        if not self._is_fitted:
            raise RuntimeError(
                "SimilarityLearner has no weights yet. Call learn_weights() first."
            )


# ── NDCG implementation ────────────────────────────────────────────────────

def _dcg_at_k(scores: np.ndarray, relevance: np.ndarray, k: int) -> float:
    """Compute Discounted Cumulative Gain at K."""
    order = np.argsort(scores)[::-1][:k]
    gains = relevance[order]
    discounts = np.log2(np.arange(2, len(gains) + 2))
    return float(np.sum(gains / discounts))


def _ndcg_at_k(scores: np.ndarray, relevance: np.ndarray, k: int) -> float:
    """Normalised DCG@K (0..1)."""
    dcg = _dcg_at_k(scores, relevance, k)
    ideal = _dcg_at_k(relevance, relevance, k)
    return dcg / ideal if ideal > 0.0 else 0.0
