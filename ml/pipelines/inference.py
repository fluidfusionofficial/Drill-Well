"""NWIS inference pipeline.

``NWISInferencePipeline`` is the single object used by the FastAPI service
layer to call all ML models. It loads artefacts once at startup and keeps
them in memory for the lifetime of the process.

All outputs are decision-support only. No method issues operational commands
or predictions stated as certainties.
"""

from __future__ import annotations

import logging
import pathlib
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Default artefact paths (resolved relative to this file's location)
_DEFAULT_ARTEFACT_DIR = pathlib.Path(__file__).parent.parent / "artefacts"


@dataclass
class PipelineHealth:
    event_classifier_loaded: bool
    similarity_learner_loaded: bool
    anomaly_detector_loaded: bool
    all_healthy: bool
    messages: list[str] = field(default_factory=list)


class NWISInferencePipeline:
    """Unified inference pipeline for NWIS.

    Load all models once via :meth:`load_models`, then call any of
    the inference methods. Each method is safe to call concurrently
    (models are read-only after loading).

    Usage::

        pipeline = NWISInferencePipeline()
        pipeline.load_models()
        results = pipeline.classify_event(event_df)
    """

    def __init__(self, artefact_dir: str | pathlib.Path | None = None) -> None:
        self._artefact_dir = pathlib.Path(artefact_dir or _DEFAULT_ARTEFACT_DIR)
        self._event_classifier = None
        self._similarity_learner = None
        self._anomaly_detector = None

    # ------------------------------------------------------------------
    # Model loading
    # ------------------------------------------------------------------

    def load_models(
        self,
        event_classifier_path: str | pathlib.Path | None = None,
        similarity_learner_path: str | pathlib.Path | None = None,
        anomaly_detector_path: str | pathlib.Path | None = None,
    ) -> "NWISInferencePipeline":
        """Load all saved model artefacts from disk.

        Paths default to ``<artefact_dir>/<model_name>.joblib``. Missing files
        are logged as warnings but do not raise — :meth:`health_check` reports
        which models are unavailable.

        Args:
            event_classifier_path: Override path for the EventClassifier.
            similarity_learner_path: Override path for the SimilarityLearner.
            anomaly_detector_path: Override path for the ParameterAnomalyDetector.

        Returns:
            ``self`` for method chaining.
        """
        paths = {
            "event_classifier": event_classifier_path or self._artefact_dir / "event_classifier.joblib",
            "similarity_learner": similarity_learner_path or self._artefact_dir / "similarity_learner.joblib",
            "anomaly_detector": anomaly_detector_path or self._artefact_dir / "anomaly_detector.joblib",
        }

        # Load EventClassifier
        p = pathlib.Path(paths["event_classifier"])
        if p.exists():
            try:
                from ml.models.event_classifier import EventClassifier
                self._event_classifier = EventClassifier.load(p)
                logger.info("EventClassifier loaded from %s", p)
            except Exception as exc:
                logger.error("Failed to load EventClassifier: %s", exc)
        else:
            logger.warning("EventClassifier artefact not found at %s", p)

        # Load SimilarityLearner
        p = pathlib.Path(paths["similarity_learner"])
        if p.exists():
            try:
                from ml.models.similarity_model import SimilarityLearner
                self._similarity_learner = SimilarityLearner.load(p)
                logger.info("SimilarityLearner loaded from %s", p)
            except Exception as exc:
                logger.error("Failed to load SimilarityLearner: %s", exc)
        else:
            logger.warning("SimilarityLearner artefact not found at %s", p)

        # Load ParameterAnomalyDetector
        p = pathlib.Path(paths["anomaly_detector"])
        if p.exists():
            try:
                from ml.models.anomaly_detector import ParameterAnomalyDetector
                self._anomaly_detector = ParameterAnomalyDetector.load(p)
                logger.info("ParameterAnomalyDetector loaded from %s", p)
            except Exception as exc:
                logger.error("Failed to load ParameterAnomalyDetector: %s", exc)
        else:
            logger.warning("ParameterAnomalyDetector artefact not found at %s", p)

        return self

    # ------------------------------------------------------------------
    # Inference: event classification
    # ------------------------------------------------------------------

    def classify_event(
        self, event_df: pd.DataFrame
    ) -> list[dict[str, Any]]:
        """Classify drilling events and return advisory context.

        Each result is framed as "recorded precedent" — never a prediction or
        operational instruction.

        Args:
            event_df: DataFrame with event features (from
                :func:`ml.features.feature_store.extract_event_features`).

        Returns:
            List of advisory dicts, one per row in ``event_df``.

        Raises:
            RuntimeError: If EventClassifier is not loaded.
        """
        if self._event_classifier is None:
            raise RuntimeError(
                "EventClassifier is not loaded. "
                "Call load_models() and ensure the artefact exists."
            )
        return self._event_classifier.predict(event_df)

    # ------------------------------------------------------------------
    # Inference: anomaly detection
    # ------------------------------------------------------------------

    def detect_anomalies(
        self, drilling_df: pd.DataFrame
    ) -> list[dict[str, Any]]:
        """Detect anomalous drilling-parameter patterns.

        Args:
            drilling_df: DataFrame with daily drilling records.

        Returns:
            List of anomaly result dicts with ``is_anomaly``, ``anomaly_score``,
            ``contaminated_parameters``, and ``advisory_note`` per row.

        Raises:
            RuntimeError: If ParameterAnomalyDetector is not loaded.
        """
        if self._anomaly_detector is None:
            raise RuntimeError(
                "ParameterAnomalyDetector is not loaded. "
                "Call load_models() and ensure the artefact exists."
            )
        results = self._anomaly_detector.detect_anomalies(drilling_df)
        return [
            {
                "row_index": r.row_index,
                "well_id": r.well_id,
                "report_date": r.report_date,
                "is_anomaly": r.is_anomaly,
                "anomaly_score": r.anomaly_score,
                "contaminated_parameters": r.contaminated_parameters,
                "advisory_note": r.advisory_note,
            }
            for r in results
        ]

    # ------------------------------------------------------------------
    # Inference: similar-well ranking
    # ------------------------------------------------------------------

    def rank_similar_wells(
        self,
        similarity_matrix: np.ndarray,
        well_ids: list[str],
        query_index: int = 0,
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        """Rank wells by similarity to a query well using learned weights.

        Args:
            similarity_matrix: 2-D array of shape ``(n_wells, N_DIMS)`` where
                each row contains per-dimension similarity scores for a well
                relative to the query.
            well_ids: List of well IDs corresponding to rows of
                ``similarity_matrix``.
            query_index: Row index of the query well in ``similarity_matrix``.
                That well is excluded from results.
            top_k: Number of similar wells to return.

        Returns:
            List of dicts sorted by similarity score descending::

                [
                    {
                        "well_id": "WX-07",
                        "similarity_score": 0.83,
                        "dimension_scores": {...},
                        "advisory_note": "...",
                    },
                    ...
                ]

        Raises:
            RuntimeError: If SimilarityLearner is not loaded.
        """
        if self._similarity_learner is None:
            raise RuntimeError(
                "SimilarityLearner is not loaded. "
                "Call load_models() and ensure the artefact exists."
            )

        from ml.models.similarity_model import DIMENSION_NAMES

        weights = np.array([self._similarity_learner.weights[d] for d in DIMENSION_NAMES])
        scores = similarity_matrix @ weights

        # Exclude query well itself
        indexed = [
            (i, well_ids[i], float(scores[i]), similarity_matrix[i].tolist())
            for i in range(len(well_ids))
            if i != query_index
        ]
        ranked = sorted(indexed, key=lambda x: x[1], reverse=True)[:top_k]

        results = []
        for i, well_id, score, dim_scores in ranked:
            results.append(
                {
                    "well_id": well_id,
                    "similarity_score": round(score, 4),
                    "dimension_scores": {
                        d: round(float(v), 4)
                        for d, v in zip(DIMENSION_NAMES, dim_scores)
                    },
                    "advisory_note": (
                        f"Based on recorded historical data, well '{well_id}' "
                        f"shows {score:.0%} similarity to the query well across "
                        "formation, depth, location, mud system, and drilling parameters. "
                        "This is offset-well context for decision support, "
                        "not an operational recommendation."
                    ),
                }
            )
        return results

    # ------------------------------------------------------------------
    # Health check
    # ------------------------------------------------------------------

    def health_check(self) -> PipelineHealth:
        """Return the loaded status of each model in the pipeline.

        Returns:
            :class:`PipelineHealth` with per-model flags and any warnings.
        """
        msgs: list[str] = []
        ec_loaded = self._event_classifier is not None
        sl_loaded = self._similarity_learner is not None
        ad_loaded = self._anomaly_detector is not None

        if not ec_loaded:
            msgs.append(
                "EventClassifier not loaded — classify_event() will raise. "
                "Run ml/training/train_event_classifier.py to produce an artefact."
            )
        if not sl_loaded:
            msgs.append(
                "SimilarityLearner not loaded — rank_similar_wells() will use fallback equal weights."
            )
        if not ad_loaded:
            msgs.append(
                "ParameterAnomalyDetector not loaded — detect_anomalies() will raise. "
                "Run ml/training to produce an artefact."
            )

        all_healthy = ec_loaded and sl_loaded and ad_loaded
        return PipelineHealth(
            event_classifier_loaded=ec_loaded,
            similarity_learner_loaded=sl_loaded,
            anomaly_detector_loaded=ad_loaded,
            all_healthy=all_healthy,
            messages=msgs,
        )
