"""Drilling-parameter anomaly detector for NWIS.

Uses Isolation Forest to flag multivariate outliers across the key drilling
parameters: ROP, WOB, RPM, Torque, SPP, Flow rate, and Mud weight.

Output is always framed as "anomalous pattern relative to historical baseline",
never as a fault condition or an operational instruction.
"""

from __future__ import annotations

import logging
import pathlib
from dataclasses import dataclass

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

# Drilling parameter columns modelled by this detector.
# MD and TVD are NOT included — this model is parameter-domain only.
PARAMETER_COLUMNS = [
    "rop_m_per_hr",          # Rate of penetration
    "wob_tonnes",             # Weight on bit
    "rpm",                    # Rotary speed
    "torque_kn_m",            # Surface torque
    "standpipe_pressure_bar", # Standpipe pressure
    "flow_rate_lpm",          # Pump flow rate
    "mud_weight_kg_m3",       # Mud weight (ECD proxy)
]


@dataclass
class AnomalyResult:
    """Result for a single observation."""
    row_index: int | str
    well_id: str | None
    report_date: str | None
    is_anomaly: bool
    anomaly_score: float  # Raw IsolationForest decision score (more negative = more anomalous)
    contaminated_parameters: list[str]  # Parameters furthest from their training distribution
    advisory_note: str


class ParameterAnomalyDetector:
    """Multivariate anomaly detector for drilling parameters.

    Fits one :class:`sklearn.ensemble.IsolationForest` model per well or
    on a pooled dataset (controlled by ``per_well``). Anomaly scores are
    standardised so callers can threshold them consistently.

    Per-well fitting is recommended when wells have very different baseline
    parameter envelopes (e.g. different formations, mud systems).
    """

    def __init__(
        self,
        contamination: float = 0.05,
        n_estimators: int = 200,
        per_well: bool = False,
        random_state: int = 42,
    ) -> None:
        """
        Args:
            contamination: Expected fraction of anomalous records in training
                data. Set conservatively (5%) — false positives are less costly
                than false negatives for decision support.
            n_estimators: Number of trees in the Isolation Forest.
            per_well: If ``True``, fit a separate model per well_id.
                If ``False``, fit one pooled model on all provided data.
            random_state: Reproducibility seed.
        """
        self._contamination = contamination
        self._n_estimators = n_estimators
        self._per_well = per_well
        self._random_state = random_state

        # After fitting: either one model (pooled) or dict[well_id -> model]
        self._models: dict[str, IsolationForest] = {}
        self._scalers: dict[str, StandardScaler] = {}
        self._is_fitted = False

    # ------------------------------------------------------------------
    # Fitting
    # ------------------------------------------------------------------

    def fit(self, df: pd.DataFrame) -> "ParameterAnomalyDetector":
        """Fit the Isolation Forest on historical drilling records.

        Rows with all NaN in parameter columns are silently dropped (cannot
        fit on missing data — we do not impute with fabricated values here).
        Partial NaN rows are median-imputed per column from training data.

        Args:
            df: DataFrame with ``PARAMETER_COLUMNS`` columns. May also contain
                ``well_id`` (used when ``per_well=True``).

        Returns:
            ``self``.
        """
        available_cols = [c for c in PARAMETER_COLUMNS if c in df.columns]
        if not available_cols:
            raise ValueError(
                f"DataFrame must contain at least one of {PARAMETER_COLUMNS}."
            )

        if self._per_well:
            if "well_id" not in df.columns:
                raise ValueError("per_well=True requires a 'well_id' column.")
            for well_id, group in df.groupby("well_id"):
                model, scaler = self._fit_one(group[available_cols], str(well_id))
                self._models[str(well_id)] = model
                self._scalers[str(well_id)] = scaler
                logger.info("Fitted anomaly detector for well %s (%d rows)", well_id, len(group))
        else:
            model, scaler = self._fit_one(df[available_cols], "_pooled")
            self._models["_pooled"] = model
            self._scalers["_pooled"] = scaler
            logger.info("Fitted pooled anomaly detector (%d rows)", len(df))

        self._is_fitted = True
        self._fitted_columns = available_cols
        return self

    def _fit_one(
        self, param_df: pd.DataFrame, label: str
    ) -> tuple[IsolationForest, StandardScaler]:
        """Fit and return a single IsolationForest + scaler pair."""
        clean = param_df.dropna(how="all")
        if clean.empty:
            raise ValueError(f"No valid (non-NaN) rows for {label}.")

        # Median impute remaining NaNs in the training set
        medians = clean.median()
        clean = clean.fillna(medians)

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(clean.values)

        model = IsolationForest(
            n_estimators=self._n_estimators,
            contamination=self._contamination,
            random_state=self._random_state,
            n_jobs=-1,
        )
        model.fit(X_scaled)
        return model, scaler

    # ------------------------------------------------------------------
    # Detection
    # ------------------------------------------------------------------

    def detect_anomalies(self, df: pd.DataFrame) -> list[AnomalyResult]:
        """Score each row in ``df`` for anomalousness.

        Args:
            df: DataFrame with drilling parameter columns. Rows from wells not
                seen during fitting (when ``per_well=True``) fall back to the
                pooled model if one exists; otherwise they are skipped with a
                logged warning.

        Returns:
            List of :class:`AnomalyResult` objects, one per row.
        """
        self._assert_fitted()
        available_cols = [c for c in self._fitted_columns if c in df.columns]

        results: list[AnomalyResult] = []
        for idx, row in df.iterrows():
            well_id = str(row.get("well_id", "")) if "well_id" in df.columns else None
            report_date = str(row.get("report_date", "")) if "report_date" in df.columns else None

            model, scaler = self._resolve_model(well_id)
            if model is None:
                logger.warning(
                    "No model for well '%s' and no pooled model; skipping row %s.",
                    well_id,
                    idx,
                )
                continue

            param_vec = row[available_cols].fillna(
                pd.Series(scaler.mean_, index=available_cols)
            ).values.reshape(1, -1).astype(np.float64)

            param_scaled = scaler.transform(param_vec)
            raw_score = float(model.decision_function(param_scaled)[0])
            is_anomaly = bool(model.predict(param_scaled)[0] == -1)

            contaminated = self._identify_contaminated_params(
                param_scaled[0], available_cols
            )

            results.append(
                AnomalyResult(
                    row_index=idx,
                    well_id=well_id,
                    report_date=report_date,
                    is_anomaly=is_anomaly,
                    anomaly_score=round(raw_score, 4),
                    contaminated_parameters=contaminated,
                    advisory_note=(
                        "Historical context: this parameter combination lies outside "
                        "the normal operating envelope observed in prior records "
                        f"({'anomalous' if is_anomaly else 'within range'}). "
                        "This is a decision-support indicator, not a fault diagnosis."
                    ),
                )
            )
        return results

    def _resolve_model(
        self, well_id: str | None
    ) -> tuple[IsolationForest | None, StandardScaler | None]:
        """Return the appropriate (model, scaler) pair for a given well."""
        if self._per_well and well_id and well_id in self._models:
            return self._models[well_id], self._scalers[well_id]
        if "_pooled" in self._models:
            return self._models["_pooled"], self._scalers["_pooled"]
        return None, None

    def _identify_contaminated_params(
        self, scaled_row: np.ndarray, col_names: list[str]
    ) -> list[str]:
        """Identify parameters with absolute z-score above 2.5."""
        contaminated = []
        for val, name in zip(scaled_row, col_names):
            if abs(val) > 2.5:
                contaminated.append(name)
        return contaminated

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def save(self, path: str | pathlib.Path) -> None:
        path = pathlib.Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "models": self._models,
            "scalers": self._scalers,
            "per_well": self._per_well,
            "contamination": self._contamination,
            "fitted_columns": self._fitted_columns,
        }
        joblib.dump(payload, path, compress=3)
        logger.info("ParameterAnomalyDetector saved to %s", path)

    @classmethod
    def load(cls, path: str | pathlib.Path) -> "ParameterAnomalyDetector":
        payload = joblib.load(path)
        obj = cls.__new__(cls)
        obj._models = payload["models"]
        obj._scalers = payload["scalers"]
        obj._per_well = payload["per_well"]
        obj._contamination = payload["contamination"]
        obj._fitted_columns = payload["fitted_columns"]
        obj._is_fitted = True
        logger.info("ParameterAnomalyDetector loaded from %s", path)
        return obj

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _assert_fitted(self) -> None:
        if not self._is_fitted:
            raise RuntimeError(
                "ParameterAnomalyDetector has not been fitted. Call fit() first."
            )
