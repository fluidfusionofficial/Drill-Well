"""Evaluation utilities for the NWIS ML pipeline.

Provides:
- ``evaluate_classifier`` — loads a saved model and evaluates it.
- ``plot_confusion_matrix`` — saves a PNG confusion matrix.
- ``plot_pr_curves`` — saves per-class precision-recall curve plots.
- ``detect_leakage`` — checks for well-level data leakage in a split dataset.
"""

from __future__ import annotations

import argparse
import logging
import os
import pathlib
import sys
from typing import TYPE_CHECKING

import numpy as np
import pandas as pd

if TYPE_CHECKING:
    from ml.models.event_classifier import EventClassifier, ClassifierMetrics

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Evaluate a saved classifier
# ---------------------------------------------------------------------------

def evaluate_classifier(
    model_path: str | pathlib.Path,
    test_df: pd.DataFrame,
    target_col: str = "event_type",
    output_dir: str | pathlib.Path | None = None,
) -> "ClassifierMetrics":
    """Load a saved EventClassifier and evaluate it on ``test_df``.

    Saves confusion matrix and PR curves to ``output_dir`` if provided.

    Args:
        model_path: Path to a ``.joblib`` file written by
            :meth:`EventClassifier.save`.
        test_df: Held-out test DataFrame (must contain ``target_col``).
        target_col: Classification target column.
        output_dir: Directory for plot files. If ``None``, plots are not saved.

    Returns:
        :class:`ClassifierMetrics` with full evaluation results.
    """
    from ml.models.event_classifier import EventClassifier

    classifier = EventClassifier.load(model_path)
    metrics = classifier.evaluate(test_df, target_col=target_col)

    logger.info("Precision : %.4f", metrics.precision)
    logger.info("Recall    : %.4f", metrics.recall)
    logger.info("F1        : %.4f", metrics.f1)
    logger.info("PR-AUC    : %.4f", metrics.pr_auc)
    logger.info("\n%s", metrics.report)

    if output_dir is not None:
        out = pathlib.Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)

        X = classifier._prepare_features(test_df, fit_tfidf=False)
        y_true = classifier._label_enc.transform(test_df[target_col].astype(str))
        probas = classifier._model.predict_proba(X)
        y_pred = np.argmax(probas, axis=1)
        class_names = [str(c) for c in classifier._label_enc.classes_]

        plot_confusion_matrix(y_true, y_pred, class_names, out / "confusion_matrix.png")
        plot_pr_curves(y_true, probas, class_names, out / "pr_curves.png")

    return metrics


# ---------------------------------------------------------------------------
# Confusion matrix
# ---------------------------------------------------------------------------

def plot_confusion_matrix(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    class_names: list[str],
    save_path: str | pathlib.Path,
) -> None:
    """Plot and save a normalised confusion matrix.

    Args:
        y_true: Integer true labels.
        y_pred: Integer predicted labels.
        class_names: Human-readable class names.
        save_path: Output PNG file path.
    """
    import matplotlib
    matplotlib.use("Agg")  # headless
    import matplotlib.pyplot as plt
    import seaborn as sns
    from sklearn.metrics import confusion_matrix

    cm = confusion_matrix(y_true, y_pred, normalize="true")
    fig, ax = plt.subplots(figsize=(max(6, len(class_names)), max(5, len(class_names) - 1)))

    sns.heatmap(
        cm,
        annot=True,
        fmt=".2f",
        cmap="Blues",
        xticklabels=class_names,
        yticklabels=class_names,
        ax=ax,
        linewidths=0.5,
    )
    ax.set_xlabel("Predicted label", fontsize=11)
    ax.set_ylabel("True label", fontsize=11)
    ax.set_title("Confusion Matrix (row-normalised)", fontsize=13)
    plt.xticks(rotation=45, ha="right")
    plt.tight_layout()
    fig.savefig(save_path, dpi=150)
    plt.close(fig)
    logger.info("Confusion matrix saved to %s", save_path)


# ---------------------------------------------------------------------------
# Precision-recall curves
# ---------------------------------------------------------------------------

def plot_pr_curves(
    y_true: np.ndarray,
    probas: np.ndarray,
    class_names: list[str],
    save_path: str | pathlib.Path,
) -> None:
    """Plot per-class precision-recall curves and save as PNG.

    Uses one-vs-rest encoding for each class. The primary metric (PR-AUC)
    is annotated in each subplot legend.

    Args:
        y_true: Integer true labels.
        probas: 2-D array of shape ``(n_samples, n_classes)``.
        class_names: Human-readable class names (same ordering as columns of
            ``probas``).
        save_path: Output PNG file path.
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from sklearn.metrics import average_precision_score, precision_recall_curve

    n_classes = len(class_names)
    ncols = min(3, n_classes)
    nrows = (n_classes + ncols - 1) // ncols
    fig, axes = plt.subplots(nrows, ncols, figsize=(6 * ncols, 4 * nrows))
    axes_flat = np.array(axes).flatten() if n_classes > 1 else [axes]

    for i, (cls_name, ax) in enumerate(zip(class_names, axes_flat)):
        y_bin = (y_true == i).astype(int)
        if y_bin.sum() == 0:
            ax.text(0.5, 0.5, f"No positives\nfor '{cls_name}'", ha="center", va="center")
            ax.set_title(cls_name)
            continue

        prec, rec, _ = precision_recall_curve(y_bin, probas[:, i])
        ap = average_precision_score(y_bin, probas[:, i])
        ax.step(rec, prec, where="post", color="#1f77b4", linewidth=2)
        ax.fill_between(rec, prec, alpha=0.15, color="#1f77b4")
        ax.set_xlabel("Recall", fontsize=10)
        ax.set_ylabel("Precision", fontsize=10)
        ax.set_title(f"{cls_name}\nPR-AUC = {ap:.3f}", fontsize=11)
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1.05)
        ax.grid(True, alpha=0.3)

    # Hide unused subplots
    for ax in axes_flat[n_classes:]:
        ax.set_visible(False)

    fig.suptitle("Per-class Precision-Recall Curves (one-vs-rest)", fontsize=13)
    plt.tight_layout()
    fig.savefig(save_path, dpi=150)
    plt.close(fig)
    logger.info("PR curves saved to %s", save_path)


# ---------------------------------------------------------------------------
# Leakage detection
# ---------------------------------------------------------------------------

def detect_leakage(
    splits: dict[str, pd.DataFrame],
    id_col: str = "well_id",
) -> dict[str, list[str]]:
    """Check for well-level data leakage between train/val/test splits.

    NWIS splits by ``well_id``. This function verifies that no well appears
    in more than one split, which would constitute leakage.

    Args:
        splits: Dict with keys ``"train"``, ``"val"``, ``"test"``.
        id_col: Column containing the group identifier (``well_id``).

    Returns:
        Dict mapping ``"train_val"``, ``"train_test"``, ``"val_test"`` to
        lists of overlapping IDs. All lists should be empty for a clean split.

    Raises:
        ValueError: If any overlap is found (hard failure — do not train with
            a leaky split).
    """
    sets = {name: set(df[id_col].unique()) for name, df in splits.items() if not df.empty}

    overlaps: dict[str, list[str]] = {}

    pairs = [
        ("train_val", "train", "val"),
        ("train_test", "train", "test"),
        ("val_test", "val", "test"),
    ]
    found_leakage = False
    for key, a, b in pairs:
        if a in sets and b in sets:
            overlap = sorted(sets[a] & sets[b])
            overlaps[key] = overlap
            if overlap:
                logger.error(
                    "LEAKAGE DETECTED: wells %s appear in both '%s' and '%s' splits.",
                    overlap,
                    a,
                    b,
                )
                found_leakage = True
        else:
            overlaps[key] = []

    if found_leakage:
        raise ValueError(
            "Well-level data leakage detected between splits. "
            "Do not proceed with training. "
            f"Overlapping wells: {overlaps}"
        )

    logger.info("Leakage check passed — no well appears in multiple splits.")
    return overlaps


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def _cli() -> None:
    parser = argparse.ArgumentParser(
        description="Evaluate a saved NWIS EventClassifier."
    )
    parser.add_argument(
        "--model",
        required=True,
        help="Path to a .joblib EventClassifier file.",
    )
    parser.add_argument(
        "--database-url",
        default=os.environ.get("DATABASE_URL"),
        help="PostgreSQL DSN (defaults to DATABASE_URL env var).",
    )
    parser.add_argument(
        "--target",
        default="event_type",
        help="Target column name (default: event_type).",
    )
    parser.add_argument(
        "--test-wells",
        nargs="+",
        help="Well IDs for the test split.",
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Directory to save confusion matrix and PR curve plots.",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, stream=sys.stdout)

    if not args.database_url:
        logger.error("--database-url or DATABASE_URL env var required.")
        sys.exit(1)

    from ml.features.feature_store import connect_db, build_training_dataset

    engine = connect_db(args.database_url)
    splits = build_training_dataset(
        engine,
        target=args.target,
        test_wells=args.test_wells,
    )
    test_df = splits["test"]

    if test_df.empty:
        logger.error("Test split is empty. Check --test-wells argument.")
        sys.exit(1)

    evaluate_classifier(
        args.model,
        test_df,
        target_col=args.target,
        output_dir=args.output_dir,
    )


if __name__ == "__main__":
    _cli()
