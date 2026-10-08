"""Feature extraction for the NWIS ML pipeline.

Design rules:
- All data is read from the database; nothing is fabricated.
- Missing values stay as NaN with column-level documentation.
- Splits are by well_id, never random, to prevent cross-well leakage.
- MD and TVD columns are kept separate; callers must choose one explicitly.
- Provenance columns (source_document_id, extraction_confidence) are available
  as pass-through features so callers can weight or filter by confidence.
"""

from __future__ import annotations

import logging
from typing import Literal

import numpy as np
import pandas as pd
from sqlalchemy import Engine, text

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Database connection
# ---------------------------------------------------------------------------

def connect_db(database_url: str) -> Engine:
    """Create a synchronous SQLAlchemy engine for ML batch jobs.

    The ML pipeline runs as offline batch processes, not inside the async
    FastAPI server, so a synchronous engine is appropriate here.

    Args:
        database_url: PostgreSQL DSN, e.g.
            ``postgresql+psycopg2://user:pw@host:5432/nwis``

    Returns:
        A configured :class:`sqlalchemy.Engine`.
    """
    from sqlalchemy import create_engine

    engine = create_engine(
        database_url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
    )
    logger.info("ML feature store connected to database")
    return engine


# ---------------------------------------------------------------------------
# Well-level features
# ---------------------------------------------------------------------------

_WELL_FEATURE_SQL = text(
    """
    SELECT
        wm.well_id,
        wm.api_number,
        wm.spud_date,
        wm.completion_date,
        wm.well_type,
        wm.well_status,
        -- Formation top depths (MD)
        COUNT(DISTINCT ft.id)                          AS formation_top_count,
        MIN(ft.depth_md_m)                             AS shallowest_formation_md_m,
        MAX(ft.depth_md_m)                             AS deepest_formation_md_m,
        -- Provenance quality proxy
        AVG(ft.extraction_confidence)                  AS avg_formation_confidence,
        -- Mud-loss events
        COUNT(DISTINCT ml.id)                          AS mud_loss_event_count,
        COALESCE(SUM(ml.volume_lost_m3), 0)            AS total_mud_loss_m3,
        -- Daily drilling statistics (from DDR records)
        AVG(ddr.rop_m_per_hr)                          AS avg_rop_m_per_hr,
        STDDEV(ddr.rop_m_per_hr)                       AS stddev_rop_m_per_hr,
        AVG(ddr.wob_tonnes)                            AS avg_wob_tonnes,
        AVG(ddr.rpm)                                   AS avg_rpm,
        AVG(ddr.torque_kn_m)                           AS avg_torque_kn_m,
        AVG(ddr.standpipe_pressure_bar)                AS avg_spp_bar,
        AVG(ddr.flow_rate_lpm)                         AS avg_flow_lpm,
        AVG(ddr.mud_weight_kg_m3)                      AS avg_mud_weight_kg_m3,
        -- Total depth drilled (MD)
        MAX(ddr.depth_end_md_m) - MIN(ddr.depth_start_md_m) AS total_depth_drilled_md_m
    FROM well_master wm
    LEFT JOIN formation_tops ft
           ON ft.well_id = wm.well_id
    LEFT JOIN mud_loss_events ml
           ON ml.well_id = wm.well_id
    LEFT JOIN daily_drilling_records ddr
           ON ddr.well_id = wm.well_id
    WHERE wm.well_id = :well_id
    GROUP BY
        wm.well_id,
        wm.api_number,
        wm.spud_date,
        wm.completion_date,
        wm.well_type,
        wm.well_status
    """
)


def extract_well_features(engine: Engine, well_id: str) -> pd.DataFrame:
    """Extract aggregate features for a single well.

    Returns a single-row DataFrame keyed on ``well_id``. All depth columns are
    MD (measured depth); TVD columns are not included to prevent silent
    MD/TVD conflation.

    Args:
        engine: Synchronous SQLAlchemy engine.
        well_id: The canonical well identifier (e.g. ``"WX-07"``).

    Returns:
        A ``pd.DataFrame`` with one row. Missing values are ``NaN``.

    Raises:
        ValueError: If ``well_id`` is not found in the database.
    """
    with engine.connect() as conn:
        df = pd.read_sql(_WELL_FEATURE_SQL, conn, params={"well_id": well_id})

    if df.empty:
        raise ValueError(
            f"Well '{well_id}' not found in database. "
            "Cannot fabricate features for unknown well."
        )

    logger.info("Extracted %d feature columns for well %s", len(df.columns), well_id)
    return df


# ---------------------------------------------------------------------------
# Event-level features
# ---------------------------------------------------------------------------

_EVENT_FEATURE_SQL = text(
    """
    SELECT
        e.event_id,
        e.well_id,
        e.event_type,
        e.event_label,
        e.description_text,
        e.depth_md_m,
        e.depth_reference_type,
        e.duration_hours,
        e.severity,
        e.source_document_id,
        e.extraction_method,
        e.extraction_confidence,
        -- Drilling parameters at time of event (from same DDR record)
        ddr.rop_m_per_hr        AS rop_at_event,
        ddr.wob_tonnes          AS wob_at_event,
        ddr.rpm                 AS rpm_at_event,
        ddr.torque_kn_m         AS torque_at_event,
        ddr.standpipe_pressure_bar AS spp_at_event,
        ddr.flow_rate_lpm       AS flow_at_event,
        ddr.mud_weight_kg_m3    AS mud_weight_at_event,
        -- Formation context
        ft.formation_name       AS nearest_formation,
        ft.depth_md_m           AS formation_top_md_m
    FROM drilling_events e
    LEFT JOIN daily_drilling_records ddr
           ON ddr.well_id = e.well_id
          AND ddr.report_date = e.event_date
    LEFT JOIN LATERAL (
        SELECT formation_name, depth_md_m
        FROM formation_tops
        WHERE well_id = e.well_id
          AND depth_md_m <= e.depth_md_m
        ORDER BY depth_md_m DESC
        LIMIT 1
    ) ft ON TRUE
    WHERE e.event_id = :event_id
    """
)


def extract_event_features(engine: Engine, event_id: int) -> pd.DataFrame:
    """Extract features for a single drilling event.

    Joins drilling parameters and nearest formation context. All depth values
    are MD. ``depth_reference_type`` is preserved so downstream models can
    inspect the source.

    Args:
        engine: Synchronous SQLAlchemy engine.
        event_id: Primary key of the drilling event.

    Returns:
        A single-row ``pd.DataFrame``. Missing values are ``NaN``.

    Raises:
        ValueError: If ``event_id`` is not found.
    """
    with engine.connect() as conn:
        df = pd.read_sql(_EVENT_FEATURE_SQL, conn, params={"event_id": event_id})

    if df.empty:
        raise ValueError(
            f"Event id={event_id} not found in database. "
            "Cannot fabricate features for unknown event."
        )

    return df


# ---------------------------------------------------------------------------
# Training dataset builder
# ---------------------------------------------------------------------------

_ALL_EVENTS_SQL = text(
    """
    SELECT
        e.event_id,
        e.well_id,
        e.event_type,
        e.event_label,
        e.description_text,
        e.depth_md_m,
        e.depth_reference_type,
        e.duration_hours,
        e.severity,
        e.source_document_id,
        e.extraction_method,
        e.extraction_confidence,
        ddr.rop_m_per_hr        AS rop_at_event,
        ddr.wob_tonnes          AS wob_at_event,
        ddr.rpm                 AS rpm_at_event,
        ddr.torque_kn_m         AS torque_at_event,
        ddr.standpipe_pressure_bar AS spp_at_event,
        ddr.flow_rate_lpm       AS flow_at_event,
        ddr.mud_weight_kg_m3    AS mud_weight_at_event,
        ft.formation_name       AS nearest_formation,
        ft.depth_md_m           AS formation_top_md_m
    FROM drilling_events e
    LEFT JOIN daily_drilling_records ddr
           ON ddr.well_id = e.well_id
          AND ddr.report_date = e.event_date
    LEFT JOIN LATERAL (
        SELECT formation_name, depth_md_m
        FROM formation_tops
        WHERE well_id = e.well_id
          AND depth_md_m <= e.depth_md_m
        ORDER BY depth_md_m DESC
        LIMIT 1
    ) ft ON TRUE
    """
)


SplitResult = dict[Literal["train", "val", "test"], pd.DataFrame]


def build_training_dataset(
    engine: Engine,
    target: str,
    val_wells: list[str] | None = None,
    test_wells: list[str] | None = None,
) -> SplitResult:
    """Build train/val/test splits from all drilling events.

    **Critical:** Splits are by ``well_id``, never random. Splitting randomly
    across events from the same well would constitute data leakage because
    sequential events share formation context, mud properties, and crew
    procedures.

    Args:
        engine: Synchronous SQLAlchemy engine.
        target: Column name to use as the prediction target
            (e.g. ``"event_type"`` or ``"severity"``).
        val_wells: Well IDs assigned to validation split. If ``None``, the
            last well alphabetically is used.
        test_wells: Well IDs assigned to test split. If ``None``, the second-
            to-last well alphabetically is used.

    Returns:
        Dict with keys ``"train"``, ``"val"``, ``"test"``, each a DataFrame.

    Raises:
        ValueError: If ``target`` column is not present or all wells would
            fall in a single split.
    """
    with engine.connect() as conn:
        df = pd.read_sql(_ALL_EVENTS_SQL, conn)

    if df.empty:
        raise ValueError(
            "No drilling events found in database. "
            "Populate the database from source documents before training."
        )

    if target not in df.columns:
        raise ValueError(
            f"Target column '{target}' not in event features. "
            f"Available columns: {sorted(df.columns.tolist())}"
        )

    all_wells = sorted(df["well_id"].unique().tolist())
    if len(all_wells) < 3:
        raise ValueError(
            f"Need at least 3 distinct wells for train/val/test split; "
            f"found {len(all_wells)}: {all_wells}"
        )

    # Assign default splits if not specified
    if test_wells is None:
        test_wells = [all_wells[-1]]
    if val_wells is None:
        val_wells = [all_wells[-2]]

    overlap = set(val_wells) & set(test_wells)
    if overlap:
        raise ValueError(f"val_wells and test_wells share wells: {overlap}")

    held_out = set(val_wells) | set(test_wells)
    train_wells = [w for w in all_wells if w not in held_out]

    if not train_wells:
        raise ValueError("All wells are in val/test splits; no training data remains.")

    splits: SplitResult = {
        "train": df[df["well_id"].isin(train_wells)].copy(),
        "val": df[df["well_id"].isin(val_wells)].copy(),
        "test": df[df["well_id"].isin(test_wells)].copy(),
    }

    for name, sdf in splits.items():
        logger.info(
            "Split %-5s — %4d rows from %d wells: %s",
            name,
            len(sdf),
            sdf["well_id"].nunique(),
            sorted(sdf["well_id"].unique().tolist()),
        )

    return splits
