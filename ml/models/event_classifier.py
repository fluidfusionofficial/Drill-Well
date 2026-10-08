"""Drilling-event classifier for the NWIS ML pipeline.

Optimises PR-AUC, not accuracy, because drilling-event classes are
heavily imbalanced (e.g. stuck pipe events are rare).

Output is always framed as "recorded precedent" or "historical context",
never as a prediction stated as a certainty.
"""

from __future__ import annotations

import logging
import pathlib
from dataclasses import dataclass, field
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import (
    average_precision_score,
    classification_report,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier

logger = logging.getLogger(__name__)

# Numeric columns from the feature store that carry drilling-parameter context.
_NUMERIC_FEATURES = [
    "depth_md_m",
    "duration_hours",
    "rop_at_event",
    "wob_at_event",
    "rpm_at_event",
    "torque_at_event",
    "spp_at_event",
    "flow_at_event",
    "mud_weight_at_event",
    "extraction_confidence",
]

_TEXT_FEATURE = "description_text"


@dataclass
class ClassifierMetrics:
    precision: float
    recall: float
    f1: float
    pr_auc: float  # primary optimisation target
    report: str
    per_class_pr_auc: dict[str, float] = field(default_factory=dict)


class EventClassifier:
    """TF-IDF + XGBoost classifier for drilling event types.

    Architecture
    ------------
    1. ``preprocess_text`` — cleans description text and fits/applies TF-IDF.
    2. Numeric features are median-imputed (missing = NaN, never fabricated).
    3. Text and numeric arrays are horizontally stacked before XGBoost.
    4. ``explain`` returns the top-N feature names and their SHAP-like
       importances from the XGBoost gain metric, so domain experts can audit.

    Optimisation target
    -------------------
    PR-AUC (area under precision-recall curve) is the primary metric because
    rare-event classes (e.g. stuck pipe, kick) must be detected even at the
    cost of some false positives.
    """

    def __init__(
        self,
        max_tfidf_features: int = 500,
        xgb_params: dict[str, Any] | None = None,
    ) -> None:
        self._tfidf = TfidfVectorizer(
            max_features=max_tfidf_features,
            ngram_range=(1, 2),
            sublinear_tf=True,
            strip_accents="unicode",
            min_df=2,
        )
        self._label_enc = LabelEncoder()
        self._numeric_medians: pd.Series | None = None

        default_xgb = {
            "n_estimators": 300,
            "max_depth": 6,
            "learning_rate": 0.05,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "use_label_encoder": False,
            "eval_metric": "aucpr",  # PR-AUC as XGBoost internal metric
            "tree_method": "hist",
            "random_state": 42,
        }
        if xgb_params:
            default_xgb.update(xgb_params)
        self._model = XGBClassifier(**default_xgb)
        self._feature_names: list[str] = []
        self._is_fitted = False

    # ------------------------------------------------------------------
    # Preprocessing
    # ------------------------------------------------------------------

    def preprocess_text(self, texts: pd.Series, fit: bool = False) -> np.ndarray:
        """Clean and vectorise description text via TF-IDF.

        Args:
            texts: Raw text series (may contain NaN — treated as empty string).
            fit: If ``True``, fits the vectoriser; otherwise transforms only.

        Returns:
            Dense 2-D numpy array of shape ``(n_samples, max_tfidf_features)``.
        """
        filled = texts.fillna("").str.lower().str.strip()
        if fit:
            matrix = self._tfidf.fit_transform(filled)
        else:
            matrix = self._tfidf.transform(filled)
        return matrix.toarray()

    def _prepare_features(
        self, df: pd.DataFrame, fit_tfidf: bool = False
    ) -> np.ndarray:
        """Combine text and numeric features into a single matrix."""
        text_arr = self.preprocess_text(df[_TEXT_FEATURE], fit=fit_tfidf)

        num_df = df[[c for c in _NUMERIC_FEATURES if c in df.columns]].copy()
        if fit_tfidf:
            # Compute and store medians from training data only.
            self._numeric_medians = num_df.median()
        if self._numeric_medians is not None:
            num_df = num_df.fillna(self._numeric_medians)
        else:
            num_df = num_df.fillna(0.0)

        num_arr = num_df.values.astype(np.float32)

        combined = np.hstack([text_arr, num_arr])

        if fit_tfidf:
            tfidf_names = self._tfidf.get_feature_names_out().tolist()
            num_names = num_df.columns.tolist()
            self._feature_names = tfidf_names + num_names

        return combined

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def train(
        self,
        train_df: pd.DataFrame,
        val_df: pd.DataFrame | None = None,
        target_col: str = "event_type",
    ) -> "EventClassifier":
        """Fit TF-IDF and XGBoost on training data.

        Validation data, if supplied, is passed to XGBoost's ``eval_set`` for
        early stopping (100 rounds, optimising ``aucpr``).

        Args:
            train_df: Training rows from :func:`build_training_dataset`.
            val_df: Validation rows (same well-split). Optional.
            target_col: Column name of the classification target.

        Returns:
            ``self`` for method chaining.
        """
        if target_col not in train_df.columns:
            raise ValueError(
                f"Target column '{target_col}' not in training data."
            )

        y_train = self._label_enc.fit_transform(train_df[target_col].astype(str))
        X_train = self._prepare_features(train_df, fit_tfidf=True)

        fit_kwargs: dict[str, Any] = {}
        if val_df is not None and not val_df.empty:
            y_val = self._label_enc.transform(val_df[target_col].astype(str))
            X_val = self._prepare_features(val_df, fit_tfidf=False)
            fit_kwargs["eval_set"] = [(X_val, y_val)]
            fit_kwargs["verbose"] = 50

        logger.info(
            "Training EventClassifier on %d samples, %d features, %d classes",
            X_train.shape[0],
            X_train.shape[1],
            len(self._label_enc.classes_),
        )
        self._model.fit(X_train, y_train, **fit_kwargs)
        self._is_fitted = True
        return self

    # ------------------------------------------------------------------
    # Prediction
    # ------------------------------------------------------------------

    def predict(self, df: pd.DataFrame) -> list[dict[str, Any]]:
        """Classify events and return advisory context objects.

        Each result item is framed as historical context, not a certainty.

        Returns:
            List of dicts, one per row::

                {
                    "event_id": int | None,
                    "predicted_label": str,
                    "confidence": float,  # max class probability
                    "advisory_note": str, # framed as recorded precedent
                    "all_probabilities": dict[str, float],
                }
        """
        self._assert_fitted()
        X = self._prepare_features(df, fit_tfidf=False)
        probas = self._model.predict_proba(X)
        classes = self._label_enc.classes_

        results = []
        for i, row_probas in enumerate(probas):
            top_idx = int(np.argmax(row_probas))
            label = classes[top_idx]
            confidence = float(row_probas[top_idx])
            event_id = df.iloc[i].get("event_id") if "event_id" in df.columns else None
            results.append(
                {
                    "event_id": event_id,
                    "predicted_label": label,
                    "confidence": round(confidence, 4),
                    "advisory_note": (
                        f"Based on recorded precedent in the historical dataset, "
                        f"this pattern is most consistent with '{label}' "
                        f"(confidence {confidence:.0%}). "
                        "This is historical context, not a prediction or instruction."
                    ),
                    "all_probabilities": {
                        c: round(float(p), 4) for c, p in zip(classes, row_probas)
                    },
                }
            )
        return results

    # ------------------------------------------------------------------
    # Explainability
    # ------------------------------------------------------------------

    def explain(self, top_n: int = 20) -> list[dict[str, float]]:
        """Return the top-N features by XGBoost gain importance.

        This allows petroleum engineers to audit which terms or parameters
        drove the classification.

        Args:
            top_n: Number of features to return.

        Returns:
            List of ``{"feature": str, "importance": float}`` sorted
            descending by importance.
        """
        self._assert_fitted()
        importances = self._model.feature_importances_
        if not self._feature_names or len(self._feature_names) != len(importances):
            feature_names = [f"f{i}" for i in range(len(importances))]
        else:
            feature_names = self._feature_names

        pairs = sorted(
            zip(feature_names, importances.tolist()),
            key=lambda x: x[1],
            reverse=True,
        )
        return [{"feature": name, "importance": round(imp, 6)} for name, imp in pairs[:top_n]]

    # ------------------------------------------------------------------
    # Evaluation
    # ------------------------------------------------------------------

    def evaluate(self, test_df: pd.DataFrame, target_col: str = "event_type") -> ClassifierMetrics:
        """Compute precision, recall, F1, and PR-AUC on held-out test data.

        PR-AUC is the primary metric. Accuracy is intentionally omitted to
        avoid misleading results on imbalanced classes.

        Args:
            test_df: Test split from :func:`build_training_dataset`.
            target_col: Classification target column name.

        Returns:
            :class:`ClassifierMetrics` with macro-averaged scores.
        """
        self._assert_fitted()
        y_true_labels = test_df[target_col].astype(str)
        y_true = self._label_enc.transform(y_true_labels)
        X = self._prepare_features(test_df, fit_tfidf=False)
        probas = self._model.predict_proba(X)
        y_pred = np.argmax(probas, axis=1)

        # Per-class PR-AUC (one-vs-rest)
        n_classes = len(self._label_enc.classes_)
        per_class_pr_auc: dict[str, float] = {}
        overall_pr_auc_scores = []
        for i, cls_name in enumerate(self._label_enc.classes_):
            y_bin = (y_true == i).astype(int)
            if y_bin.sum() == 0:
                logger.warning("Class '%s' has no positive samples in test set.", cls_name)
                continue
            ap = average_precision_score(y_bin, probas[:, i])
            per_class_pr_auc[str(cls_name)] = round(float(ap), 4)
            overall_pr_auc_scores.append(ap)

        macro_pr_auc = float(np.mean(overall_pr_auc_scores)) if overall_pr_auc_scores else 0.0

        labels_range = list(range(n_classes))
        metrics = ClassifierMetrics(
            precision=round(float(precision_score(y_true, y_pred, average="macro", labels=labels_range, zero_division=0)), 4),
            recall=round(float(recall_score(y_true, y_pred, average="macro", labels=labels_range, zero_division=0)), 4),
            f1=round(float(f1_score(y_true, y_pred, average="macro", labels=labels_range, zero_division=0)), 4),
            pr_auc=round(macro_pr_auc, 4),
            report=classification_report(
                y_true,
                y_pred,
                target_names=[str(c) for c in self._label_enc.classes_],
                zero_division=0,
            ),
            per_class_pr_auc=per_class_pr_auc,
        )
        logger.info(
            "EventClassifier evaluation — precision=%.3f recall=%.3f f1=%.3f pr_auc=%.3f",
            metrics.precision,
            metrics.recall,
            metrics.f1,
            metrics.pr_auc,
        )
        return metrics

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def save(self, path: str | pathlib.Path) -> None:
        """Serialise the fitted model to a joblib file.

        Args:
            path: Destination ``.joblib`` file path.
        """
        self._assert_fitted()
        path = pathlib.Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "tfidf": self._tfidf,
            "label_enc": self._label_enc,
            "numeric_medians": self._numeric_medians,
            "model": self._model,
            "feature_names": self._feature_names,
        }
        joblib.dump(payload, path, compress=3)
        logger.info("EventClassifier saved to %s", path)

    @classmethod
    def load(cls, path: str | pathlib.Path) -> "EventClassifier":
        """Load a previously saved classifier.

        Args:
            path: Path to a ``.joblib`` file written by :meth:`save`.

        Returns:
            A fully initialised, fitted :class:`EventClassifier`.
        """
        payload = joblib.load(path)
        obj = cls.__new__(cls)
        obj._tfidf = payload["tfidf"]
        obj._label_enc = payload["label_enc"]
        obj._numeric_medians = payload["numeric_medians"]
        obj._model = payload["model"]
        obj._feature_names = payload.get("feature_names", [])
        obj._is_fitted = True
        logger.info("EventClassifier loaded from %s", path)
        return obj

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _assert_fitted(self) -> None:
        if not self._is_fitted:
            raise RuntimeError(
                "EventClassifier has not been fitted yet. Call train() first."
            )
