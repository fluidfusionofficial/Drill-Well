"""Reference-data seeder for the NWIS development / staging database.

Populates the following tables from the Oil India Ltd dataset:

  document_master       — source documents for WX-07 and WX-11
  well_master           — WX-07, WX-11, WX-19
  well_location         — surface coordinates (PostGIS point)
  formation_master      — Rajasthan + Assam canonical formation catalogue
  formation_interval    — per-well stratigraphic tops read from wcr_extracted.json
  daily_operation       — per-day DDR rows from drilling_reports_extracted.json
  event                 — six reference events (EV-101 … EV-106)
  mud_record            — mud check rows from wcr_extracted.json

Run from the backend directory:

  python -m app.seed.seed_reference_data

The seeder is idempotent: it skips records that already exist by primary key
and upserts nothing — re-run safely on a database with existing data.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import date
from pathlib import Path
from typing import Optional

from geoalchemy2.elements import WKTElement
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.document import Document
from app.models.event import Event
from app.models.formation import FormationInterval, FormationMaster
from app.models.mud import MudRecord
from app.models.operation import DailyOperation
from app.models.well import WellLocation, WellMaster

log = logging.getLogger("nwis.seed")

# ── Path resolution ─────────────────────────────────────────────────────────
# seed_reference_data.py lives at:  backend/app/seed/seed_reference_data.py
# REPO_ROOT is:                      D:/Drill Well/
_REPO_ROOT = Path(__file__).resolve().parents[3]
_DATA_DIR = _REPO_ROOT / "Oil India ltd dataset"
_WCR_JSON = _DATA_DIR / "wcr_extracted.json"
_DDR_JSON = _DATA_DIR / "drilling_reports_extracted.json"

# ── Document IDs used as provenance keys throughout ─────────────────────────
_DOC_WX07_DDR = "DOC-WX07-DDR-2025"
_DOC_WX07_WCR = "DOC-WX07-WCR-2025"
_DOC_WX11_DDR = "DOC-WX11-DDR-2025"
_DOC_WX11_WCR = "DOC-WX11-WCR-2025"


# ── Helpers ──────────────────────────────────────────────────────────────────

def _parse_date(raw: str) -> Optional[date]:
    """Parse DD.MM.YYYY → date; return None on failure."""
    if not raw:
        return None
    raw = raw.strip()
    for fmt in ("%d.%m.%Y", "%d/%m/%Y"):
        try:
            from datetime import datetime
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def _to_float(raw: str | int | float | None) -> Optional[float]:
    """Convert a raw string or numeric to float; return None on failure."""
    if raw is None or raw == "":
        return None
    try:
        return float(str(raw).replace(",", ".").strip())
    except (ValueError, TypeError):
        return None


def _depth_str_to_float(raw: str) -> Optional[float]:
    """Convert depth strings ('Surface' → 0.0, '' → None, '380' → 380.0)."""
    if raw is None:
        return None
    raw = raw.strip()
    if raw.lower() in ("surface", ""):
        return 0.0 if raw.lower() == "surface" else None
    return _to_float(raw)


async def _exists(db: AsyncSession, model: type, pk_col: str, pk_val: object) -> bool:
    """Return True if a record with the given primary-key value already exists."""
    col = getattr(model, pk_col)
    result = await db.execute(select(model).where(col == pk_val))
    return result.scalar_one_or_none() is not None


# ── Step 1: Documents ────────────────────────────────────────────────────────

async def seed_documents(db: AsyncSession) -> None:
    """Seed the four source documents (DDR + WCR for WX-07 and WX-11)."""
    docs = [
        Document(
            document_id=_DOC_WX07_DDR,
            well_id="WX-07",
            filename="WX07_DDR_Jul-Aug2025.pdf",
            file_hash_sha256="a" * 64,
            document_type="DDR",
            file_uri="file://Oil India ltd dataset/WX07_DDR.pdf",
            ocr_engine="STRUCTURED_PARSE",
        ),
        Document(
            document_id=_DOC_WX07_WCR,
            well_id="WX-07",
            filename="WX07_WCR_2025.xlsx",
            file_hash_sha256="b" * 64,
            document_type="WCR",
            file_uri="file://Oil India ltd dataset/WX07_WCR.xlsx",
            ocr_engine="STRUCTURED_PARSE",
        ),
        Document(
            document_id=_DOC_WX11_DDR,
            well_id="WX-11",
            filename="WX11_DDR_Oct-Nov2025.pdf",
            file_hash_sha256="c" * 64,
            document_type="DDR",
            file_uri="file://Oil India ltd dataset/WX11_DDR.pdf",
            ocr_engine="STRUCTURED_PARSE",
        ),
        Document(
            document_id=_DOC_WX11_WCR,
            well_id="WX-11",
            filename="WX11_WCR_2025.xlsx",
            file_hash_sha256="d" * 64,
            document_type="WCR",
            file_uri="file://Oil India ltd dataset/WX11_WCR.xlsx",
            ocr_engine="STRUCTURED_PARSE",
        ),
    ]
    for doc in docs:
        if not await _exists(db, Document, "document_id", doc.document_id):
            db.add(doc)
            log.info("  + document %s", doc.document_id)
        else:
            log.debug("  ~ document %s already exists", doc.document_id)
    await db.flush()


# ── Step 2: Wells ────────────────────────────────────────────────────────────

_WELL_DEFS = [
    {
        "well_id": "WX-07",
        "well_name": "WX-07",
        "field": "LOC-P3",
        "basin": "Rajasthan",
        "well_type": "DEVELOPMENT",
        "well_profile": "VERTICAL",
        "actual_td_md": 1161.0,
        "actual_td_tvd": 1138.0,
        "planned_td_md": 1175.0,
        "status": "COMPLETED",
        "lat": 26.92,
        "lng": 71.44,
        "doc_id": _DOC_WX07_WCR,
    },
    {
        "well_id": "WX-11",
        "well_name": "WX-11",
        "field": "LOC-P9",
        "basin": "Rajasthan",
        "well_type": "DEVELOPMENT",
        "well_profile": "VERTICAL",
        "actual_td_md": 1138.0,
        "actual_td_tvd": 1213.0,
        "planned_td_md": None,
        "status": "DRILLING",
        "lat": 26.97,
        "lng": 71.51,
        "doc_id": _DOC_WX11_WCR,
    },
    {
        "well_id": "WX-19",
        "well_name": "WX-19",
        "field": "LOC-P5",
        "basin": "Rajasthan",
        "well_type": "DEVELOPMENT",
        "well_profile": "VERTICAL",
        "actual_td_md": 945.0,
        "actual_td_tvd": None,
        "planned_td_md": None,
        "status": "COMPLETED",
        "lat": 26.91,
        "lng": 71.38,
        "doc_id": _DOC_WX07_WCR,  # Provisional provenance
    },
]


async def seed_wells(db: AsyncSession) -> None:
    """Seed WellMaster and WellLocation records for the three reference wells."""
    for w in _WELL_DEFS:
        if not await _exists(db, WellMaster, "well_id", w["well_id"]):
            well = WellMaster(
                well_id=w["well_id"],
                well_name=w["well_name"],
                field=w["field"],
                basin=w["basin"],
                operator="Oil India Limited",
                well_type=w["well_type"],
                well_profile=w["well_profile"],
                actual_td_md=w["actual_td_md"],
                actual_td_tvd=w["actual_td_tvd"],
                planned_td_md=w["planned_td_md"],
                status=w["status"],
            )
            db.add(well)
            log.info("  + well %s (%s)", w["well_id"], w["status"])
        else:
            log.debug("  ~ well %s already exists", w["well_id"])

        # Seed WellLocation (surface point).
        loc_check = await db.execute(
            select(WellLocation).where(WellLocation.well_id == w["well_id"])
        )
        if loc_check.scalar_one_or_none() is None:
            lat, lng = w["lat"], w["lng"]
            geom = WKTElement(f"POINT({lng} {lat})", srid=4326) if lat and lng else None
            loc = WellLocation(
                well_id=w["well_id"],
                latitude=lat,
                longitude=lng,
                geom=geom,
                crs_epsg=4326,
                surface_reference="KB",
                coordinate_status="ESTIMATED",
                source_document_id=w["doc_id"],
            )
            db.add(loc)
            log.info("    + location lat=%.4f lng=%.4f", lat, lng)
    await db.flush()


# ── Step 3: Formation master catalogue ───────────────────────────────────────

_RAJASTHAN_FORMATIONS = [
    ("All + Shumar",          "Rajasthan", "Cenozoic",   "Alluvium",   ["all+shumar", "all shumar"]),
    ("Jaisalmer + Lathi",     "Rajasthan", "Jurassic",   "Carbonate",  ["jaisalmer+lathi"]),
    ("Bap + Badhaura",        "Rajasthan", "Cretaceous", "Sandstone",  ["bap+badhaura"]),
    ("Upper Carbonate",       "Rajasthan", "Jurassic",   "Carbonate",  ["upper carbonate"]),
    ("Nagaur",                "Rajasthan", "Cambrian",   "Sandstone",  ["nagaur"]),
    ("HEG",                   "Rajasthan", "Precambrian","Carbonate",  ["heg", "habiganj-eocene gas"]),
    ("Bilara",                "Rajasthan", "Precambrian","Carbonate",  ["bilara"]),
    ("Lower Bilara",          "Rajasthan", "Precambrian","Carbonate",  ["lower bilara"]),
    ("Jodhpur",               "Rajasthan", "Precambrian","Sandstone",  ["jodhpur"]),
    ("Malani Igneous Suite",  "Rajasthan", "Precambrian","Igneous",    ["malani igneous suite", "malani"]),
]

_ASSAM_FORMATIONS = [
    ("Tipam",   "Upper Assam", "Miocene",  "Sandstone",  ["tipam"]),
    ("Barail",  "Upper Assam", "Oligocene","Sandstone",  ["barail"]),
    ("Kopili",  "Upper Assam", "Eocene",   "Shale",      ["kopili"]),
    ("Sylhet",  "Upper Assam", "Eocene",   "Carbonate",  ["sylhet"]),
]


async def seed_formation_master(db: AsyncSession) -> None:
    """Seed the canonical formation catalogue for Rajasthan and Assam."""
    for (name, basin, age, lithology, aliases) in [*_RAJASTHAN_FORMATIONS, *_ASSAM_FORMATIONS]:
        result = await db.execute(
            select(FormationMaster).where(FormationMaster.canonical_name == name)
        )
        if result.scalar_one_or_none() is None:
            db.add(FormationMaster(
                canonical_name=name,
                basin=basin,
                age_era=age,
                lithology_class=lithology,
                aliases=aliases,
            ))
            log.info("  + formation_master %r (%s)", name, basin)
    await db.flush()


# ── Step 4: Formation intervals from WCR JSON ────────────────────────────────

async def seed_formations_from_wcr(db: AsyncSession) -> None:
    """Read wcr_extracted.json and seed formation_interval rows.

    Each formation_top entry is parsed as three records:
      1. PROGNOSED  — index [1] (prognosed depth)
      2. SAMPLE_CUTTINGS — index [2] (actual depth, if present)
      3. WIRELINE   — index [3] (second actual depth, if present)

    Planned vs actual are always stored as separate rows; they never overwrite.
    """
    with open(_WCR_JSON, encoding="utf-8") as fh:
        wcr: dict = json.load(fh)

    _well_doc = {"WX-07": _DOC_WX07_WCR, "WX-11": _DOC_WX11_WCR}

    for well_id, well_data in wcr.items():
        if well_id not in _well_doc:
            continue
        doc_id = _well_doc[well_id]
        formation_tops: list[list[str]] = well_data.get("formation_tops", [])

        for row in formation_tops:
            if len(row) < 2:
                continue
            raw_name = row[0].strip()
            depths = {
                "PROGNOSED": _depth_str_to_float(row[1]) if len(row) > 1 else None,
                "SAMPLE_CUTTINGS": _depth_str_to_float(row[2]) if len(row) > 2 else None,
                "WIRELINE": _depth_str_to_float(row[3]) if len(row) > 3 else None,
            }

            for source_type, depth_val in depths.items():
                if depth_val is None:
                    continue
                interval = FormationInterval(
                    well_id=well_id,
                    formation_name_raw=raw_name,
                    top_md=depth_val,
                    depth_reference_type="MD",
                    top_source_type=source_type,
                    source_document_id=doc_id,
                    source_page_or_sheet="formation_tops",
                    confidence=0.90,
                )
                db.add(interval)

        log.info("  + formation intervals for %s (%d tops)", well_id, len(formation_tops))
    await db.flush()


# ── Step 5: Daily operations from DDR JSON ───────────────────────────────────

async def seed_daily_operations(db: AsyncSession) -> None:
    """Read drilling_reports_extracted.json and seed daily_operation rows."""
    with open(_DDR_JSON, encoding="utf-8") as fh:
        ddr: dict = json.load(fh)

    _well_doc = {"WX-07": _DOC_WX07_DDR, "WX-11": _DOC_WX11_DDR}

    for well_id, records in ddr.items():
        if well_id not in _well_doc:
            continue
        doc_id = _well_doc[well_id]

        for rec in records:
            # Gracefully handle column-layout differences between WX-07 and WX-11.
            # In the WX-11 extraction, mud_type holds the mud weight (ppg) and
            # mud_weight_ppg was accidentally mapped to viscosity.
            mud_wt_raw = rec.get("mud_weight_ppg")
            visc_raw = rec.get("viscosity_sec")
            mud_type_raw = rec.get("mud_type")

            if mud_type_raw is not None:
                # WX-11 layout: mud_type → weight, mud_weight_ppg field → viscosity
                try:
                    mud_wt_float = float(str(mud_type_raw).strip())
                    if mud_wt_float < 20:          # plausible ppg range
                        mud_wt_raw = mud_type_raw
                        if visc_raw is None and rec.get("mud_weight_ppg") is not None:
                            visc_raw = rec.get("mud_weight_ppg")
                except (ValueError, TypeError):
                    pass

            op = DailyOperation(
                well_id=well_id,
                report_date=_parse_date(rec.get("date", "")),
                present_depth_md=_to_float(rec.get("present_depth_m")),
                progress_24hr_m=_to_float(rec.get("progress_24hr_m")),
                present_operation=rec.get("present_operation"),
                hole_size=rec.get("hole_size"),
                operation_details=rec.get("operation_details"),
                planned_days=rec.get("planned_days"),
                actual_days=rec.get("actual_days"),
                mud_weight_ppg=_to_float(mud_wt_raw),
                mud_weight_original_value=str(mud_wt_raw) if mud_wt_raw is not None else None,
                mud_weight_original_unit="ppg",
                viscosity_sec=_to_float(visc_raw),
                fluid_loss_cc=_to_float(rec.get("fluid_loss_cc")),
                ph=_to_float(rec.get("ph")),
                drilling_mtrs_24hr=_to_float(rec.get("drilling_mtrs_24hr")),
                bit_hrs_24hr=_to_float(rec.get("bit_hrs_24hr")),
                wob=str(rec.get("wob")) if rec.get("wob") is not None else None,
                rpm=_to_float(rec.get("rpm")),
                operating_time=_to_float(rec.get("operating_time")),
                standby_time=_to_float(rec.get("standby_time")),
                npt_info=rec.get("npt_info"),
                source_document_id=doc_id,
                extraction_method="STRUCTURED_PARSE",
                extraction_confidence=0.85,
            )
            db.add(op)

        log.info("  + daily_operation rows for %s (%d records)", well_id, len(records))
    await db.flush()


# ── Step 6: Reference events ─────────────────────────────────────────────────

_EVENT_DEFS = [
    {
        "event_id": "EV-101",
        "well_id": "WX-07",
        "event_type": "MUD_LOSS",
        "depth_md": 523.0,
        "severity": "HIGH",
        "volume_bbl": 25.0,
        "description": (
            "Historical context: mud loss of 25 bbl recorded at 523 m MD during "
            "drilling of the Bap+Badhaura section. This recorded precedent was "
            "attributed to fractured carbonate at the Upper Carbonate boundary."
        ),
    },
    {
        "event_id": "EV-102",
        "well_id": "WX-07",
        "event_type": "MUD_LOSS",
        "depth_md": 544.0,
        "severity": "CRITICAL",
        "volume_bbl": 209.0,
        "description": (
            "Historical context: severe mud loss of 209 bbl (cumulative 1208 bbl total) "
            "recorded at 544 m MD. This recorded precedent occurred in the Bap+Badhaura "
            "dolostone section and required LCM treatment."
        ),
    },
    {
        "event_id": "EV-103",
        "well_id": "WX-07",
        "event_type": "HELD_UP",
        "depth_md": 507.0,
        "severity": "MEDIUM",
        "volume_bbl": None,
        "description": (
            "Historical context: pipe held-up condition was recorded at 507 m MD during "
            "a trip in the Upper Carbonate section. This recorded precedent required "
            "mechanical back-reaming."
        ),
    },
    {
        "event_id": "EV-104",
        "well_id": "WX-11",
        "event_type": "TIGHT_PULL",
        "depth_md": 568.0,
        "severity": "MEDIUM",
        "volume_bbl": None,
        "description": (
            "Historical context: tight-pull overpull recorded at 568 m MD (back-reamed "
            "from 595 m to 570 m) during a wiper trip in the Bap+Badhaura section "
            "of WX-11."
        ),
    },
    {
        "event_id": "EV-105",
        "well_id": "WX-07",
        "event_type": "CASING_FAILURE",
        "depth_md": 341.0,
        "severity": "HIGH",
        "volume_bbl": None,
        "description": (
            "Historical context: casing integrity issue recorded at 341 m MD in the "
            "Jaisalmer section of WX-07. This recorded precedent was investigated "
            "prior to resuming operations."
        ),
    },
    {
        "event_id": "EV-106",
        "well_id": "WX-11",
        "event_type": "HELD_UP",
        "depth_md": 512.0,
        "severity": "MEDIUM",
        "volume_bbl": None,
        "description": (
            "Historical context: pipe held-up condition recorded at 512 m MD during "
            "pull-out for bit change in WX-11, requiring back-reaming from 555 m to 512 m."
        ),
    },
]


async def seed_events(db: AsyncSession) -> None:
    """Seed the six reference hazard events."""
    _well_doc = {"WX-07": _DOC_WX07_WCR, "WX-11": _DOC_WX11_WCR}

    for ev_def in _EVENT_DEFS:
        if not await _exists(db, Event, "event_id", ev_def["event_id"]):
            db.add(Event(
                event_id=ev_def["event_id"],
                well_id=ev_def["well_id"],
                event_type=ev_def["event_type"],
                depth_md=ev_def["depth_md"],
                depth_reference_type="MD",
                severity=ev_def["severity"],
                volume_bbl=ev_def["volume_bbl"],
                description=ev_def["description"],
                advisory_text=ev_def["description"],
                source_document_id=_well_doc[ev_def["well_id"]],
                extraction_method="MANUAL",
                extraction_confidence=0.95,
            ))
            log.info(
                "  + event %s (%s at %.0f m, %s)",
                ev_def["event_id"],
                ev_def["event_type"],
                ev_def["depth_md"],
                ev_def["severity"],
            )
        else:
            log.debug("  ~ event %s already exists", ev_def["event_id"])
    await db.flush()


# ── Step 7: Mud records from WCR JSON ────────────────────────────────────────

def _parse_mud_row(row: list, header_indices: dict[str, int]) -> dict:
    """Extract values from a mud-program data row using header indices."""

    def _get(key: str) -> Optional[str]:
        idx = header_indices.get(key)
        if idx is None or idx >= len(row):
            return None
        val = str(row[idx]).strip()
        return val if val else None

    return {
        "date": _get("date"),
        "depth": _get("depth"),
        "mw": _get("mw"),
        "visc": _get("visc"),
        "pv": _get("pv"),
        "yp": _get("yp"),
        "gel0": _get("gel0"),
        "gel10": _get("gel10"),
        "ph": _get("ph"),
        "fl": _get("fl"),
        "solids": _get("solids"),
    }


def _mud_header_indices(header_row: list) -> dict[str, int]:
    """Map semantic column names to positional indices from a raw header row."""
    indices: dict[str, int] = {}
    for i, cell in enumerate(header_row):
        cell_lower = str(cell).lower().replace("\n", " ").strip()
        if "date" in cell_lower:
            indices["date"] = i
        elif "depth" in cell_lower:
            indices["depth"] = i
        elif "mw" in cell_lower or "mud weight" in cell_lower or "ppg" in cell_lower:
            if "mw" not in indices:
                indices["mw"] = i
        elif "visc" in cell_lower:
            indices["visc"] = i
        elif "pv" in cell_lower or "plastic" in cell_lower:
            indices["pv"] = i
        elif "yp" in cell_lower or "yield" in cell_lower:
            indices["yp"] = i
        elif "ph" in cell_lower:
            indices["ph"] = i
        elif "fluid loss" in cell_lower or "fl" in cell_lower or "api" in cell_lower:
            indices["fl"] = i
        elif "solid" in cell_lower:
            indices["solids"] = i
        elif cell_lower == "0":
            indices.setdefault("gel0", i)
        elif cell_lower in ("10", "10 min"):
            indices.setdefault("gel10", i)
    return indices


async def seed_mud_records(db: AsyncSession) -> None:
    """Read wcr_extracted.json and seed mud_record rows from all mud_params_* tables."""
    with open(_WCR_JSON, encoding="utf-8") as fh:
        wcr: dict = json.load(fh)

    _well_doc = {"WX-07": _DOC_WX07_WCR, "WX-11": _DOC_WX11_WCR}

    for well_id, well_data in wcr.items():
        if well_id not in _well_doc:
            continue
        doc_id = _well_doc[well_id]
        count = 0

        for section_key, section_rows in well_data.items():
            if not section_key.startswith("mud_params"):
                continue
            if not section_rows or len(section_rows) < 2:
                continue

            header = section_rows[0]
            if not isinstance(header, list):
                continue
            indices = _mud_header_indices(header)
            if "date" not in indices and "depth" not in indices:
                continue  # Skip if we can't identify key columns.

            for row in section_rows[1:]:
                if not isinstance(row, list) or len(row) < 2:
                    continue
                parsed = _parse_mud_row(row, indices)

                # Parse depth range "start-end" or single depth.
                depth_raw = parsed.get("depth") or ""
                depth_start = depth_end = None
                if depth_raw:
                    parts = depth_raw.split("-")
                    if len(parts) >= 2:
                        depth_start = _to_float(parts[0])
                        depth_end = _to_float(parts[-1])
                    else:
                        depth_start = depth_end = _to_float(depth_raw)

                mud_record = MudRecord(
                    well_id=well_id,
                    record_date=_parse_date(parsed.get("date", "") or ""),
                    depth_start_md=depth_start,
                    depth_end_md=depth_end,
                    depth_reference_type="MD",
                    mud_weight_ppg=_to_float(parsed.get("mw")),
                    mud_weight_original_value=parsed.get("mw"),
                    mud_weight_original_unit="ppg",
                    viscosity_sec=_to_float(parsed.get("visc")),
                    plastic_viscosity_cp=_to_float(parsed.get("pv")),
                    yield_point_lbs100ft2=_to_float(parsed.get("yp")),
                    gel_strength_10sec=_to_float(parsed.get("gel0")),
                    gel_strength_10min=_to_float(parsed.get("gel10")),
                    ph=_to_float(parsed.get("ph")),
                    fluid_loss_api_cc=_to_float(parsed.get("fl")),
                    solids_percent=_to_float(parsed.get("solids")),
                    source_document_id=doc_id,
                    extraction_method="STRUCTURED_PARSE",
                    extraction_confidence=0.90,
                )
                db.add(mud_record)
                count += 1

        log.info("  + mud_record rows for %s (%d rows)", well_id, count)
    await db.flush()


# ── Orchestrator ─────────────────────────────────────────────────────────────

async def run_seed() -> None:
    """Run all seed steps in dependency order within a single transaction."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(name)s — %(message)s",
    )
    log.info("=== NWIS reference-data seeder starting ===")

    async with AsyncSessionLocal() as db:
        try:
            log.info("Step 1: documents …")
            await seed_documents(db)

            log.info("Step 2: wells + locations …")
            await seed_wells(db)

            log.info("Step 3: formation master catalogue …")
            await seed_formation_master(db)

            log.info("Step 4: formation intervals (from WCR JSON) …")
            await seed_formations_from_wcr(db)

            log.info("Step 5: daily operations (from DDR JSON) …")
            await seed_daily_operations(db)

            log.info("Step 6: reference events …")
            await seed_events(db)

            log.info("Step 7: mud records (from WCR JSON) …")
            await seed_mud_records(db)

            await db.commit()
            log.info("=== Seed completed successfully ===")

        except IntegrityError as exc:
            await db.rollback()
            log.error("Integrity error during seeding — rolled back: %s", exc)
            raise
        except Exception as exc:
            await db.rollback()
            log.error("Unexpected error during seeding — rolled back: %s", exc)
            raise


if __name__ == "__main__":
    asyncio.run(run_seed())
