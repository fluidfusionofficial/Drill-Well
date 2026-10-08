"""Train the NWIS EventClassifier from the database.

Usage::

    python -m ml.training.train_event_classifier

Environment variables:
    DATABASE_URL — PostgreSQL DSN (required).
    ARTEFACT_DIR — Output directory for .joblib files (default: ml/artefacts).
    TARGET_COL   — Column to classify (default: event_type).
    VAL_WELLS    — Comma-separated well IDs for validation split.
    TEST_WELLS   — Comma-separated well IDs for test split.
"""

from __future__ import annotations

import logging
import os
import pathlib
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("nwis.train_event_classifier")


def main() -> None:
    # ── Configuration from environment ────────────────────────────────────
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        logger.error(
            "DATABASE_URL environment variable is not set. "
            "Cannot connect to the database."
        )
        sys.exit(1)

    artefact_dir = pathlib.Path(
        os.environ.get("ARTEFACT_DIR", pathlib.Path(__file__).parent.parent / "artefacts")
    )
    target_col = os.environ.get("TARGET_COL", "event_type")

    val_wells_env = os.environ.get("VAL_WELLS")
    test_wells_env = os.environ.get("TEST_WELLS")
    val_wells = val_wells_env.split(",") if val_wells_env else None
    test_wells = test_wells_env.split(",") if test_wells_env else None

    logger.info("=== NWIS EventClassifier Training ===")
    logger.info("  DATABASE_URL : %s", database_url.split("@")[-1])  # hide credentials
    logger.info("  ARTEFACT_DIR : %s", artefact_dir)
    logger.info("  TARGET_COL   : %s", target_col)
    logger.info("  VAL_WELLS    : %s", val_wells)
    logger.info("  TEST_WELLS   : %s", test_wells)

    # ── Connect to database ────────────────────────────────────────────────
    from ml.features.feature_store import connect_db, build_training_dataset

    engine = connect_db(database_url)

    # ── Build training dataset (split by well, never random) ──────────────
    logger.info("Extracting training dataset from database …")
    splits = build_training_dataset(
        engine,
        target=target_col,
        val_wells=val_wells,
        test_wells=test_wells,
    )
    train_df = splits["train"]
    val_df = splits["val"]
    test_df = splits["test"]

    if train_df.empty:
        logger.error(
            "Training split is empty — ensure the database contains "
            "populated drilling_events rows."
        )
        sys.exit(1)

    # ── Validate target distribution ───────────────────────────────────────
    target_counts = train_df[target_col].value_counts()
    logger.info("Target distribution in training split:\n%s", target_counts.to_string())

    min_class_count = int(target_counts.min())
    if min_class_count < 5:
        logger.warning(
            "Smallest class has only %d samples. "
            "PR-AUC estimates will be unreliable for this class. "
            "Consider collecting more annotated events before deploying.",
            min_class_count,
        )

    # ── Train ──────────────────────────────────────────────────────────────
    from ml.models.event_classifier import EventClassifier

    classifier = EventClassifier()
    logger.info("Starting training …")
    classifier.train(train_df, val_df=val_df, target_col=target_col)

    # ── Evaluate on test split ─────────────────────────────────────────────
    logger.info("Evaluating on test split …")
    metrics = classifier.evaluate(test_df, target_col=target_col)

    logger.info("── Evaluation results ────────────────────────────────────")
    logger.info("  Precision (macro) : %.4f", metrics.precision)
    logger.info("  Recall    (macro) : %.4f", metrics.recall)
    logger.info("  F1        (macro) : %.4f", metrics.f1)
    logger.info("  PR-AUC    (macro) : %.4f  ← primary metric", metrics.pr_auc)
    logger.info("── Per-class PR-AUC ──────────────────────────────────────")
    for cls_name, auc in metrics.per_class_pr_auc.items():
        logger.info("  %-30s %.4f", cls_name, auc)
    logger.info("── Classification report ─────────────────────────────────")
    logger.info("\n%s", metrics.report)

    # ── Domain review gate ─────────────────────────────────────────────────
    if metrics.pr_auc < 0.5:
        logger.warning(
            "PR-AUC %.4f is below the minimum threshold of 0.50. "
            "This model should NOT be deployed without domain review and "
            "additional data collection.",
            metrics.pr_auc,
        )

    # ── Save artefact ──────────────────────────────────────────────────────
    artefact_path = artefact_dir / "event_classifier.joblib"
    classifier.save(artefact_path)
    logger.info("Model saved to %s", artefact_path)
    logger.info(
        "IMPORTANT: This artefact requires petroleum-engineering domain review "
        "before it is loaded by the inference pipeline in any connected environment."
    )

    # ── Feature importance (for domain expert review) ──────────────────────
    logger.info("── Top features by XGBoost gain ──────────────────────────")
    for item in classifier.explain(top_n=15):
        logger.info("  %-40s %.6f", item["feature"], item["importance"])


if __name__ == "__main__":
    main()
