# 05: Production System Architecture & Technical Blueprint

**System Name:** eRTMAC-NWIS (Nearby Wells Intelligence System)  
**Target Environment:** Oil India Limited (Duliajan eRTMAC Command Center & Edge Rigs)  
**Technology Stack:** Next.js 16 (React / Tailwind / WebGL) + FastAPI (Python 3.12 / Pydantic) + PostgreSQL 16 (PostGIS / TimescaleDB / pgvector)  

---

## 1. High-Level System Architecture & eRTMAC Decoupling

NWIS is architected as an **independent, standalone decision-support platform** operating alongside eRTMAC. It decouples high-frequency real-time telemetry from historical subsurface knowledge retrieval.

```
                           TARGET PRODUCTION ARCHITECTURE
                                           
   +---------------------------------------+     +---------------------------------------+
   |             ACTIVE RIGSITE            |     |        eRTMAC COMMAND CENTER          |
   | Mud Logging Unit / Surface Sensors    |     | (Duliajan Video Wall / Telemetry Hub) |
   +---------------------------------------+     +---------------------------------------+
                       |                                             |
                       | WITS / WITSML 1.4                           | Active Well Stream
                       v                                             v
   +-------------------------------------------------------------------------------------+
   |                      eRTMAC STREAMING & TELEMETRY BROKER                            |
   |                  (Apache Kafka / MQTT / WITSML Server Store)                        |
   +-------------------------------------------------------------------------------------+
                                             |
                                             | Read-Only Live Context (Well ID, Bit MD, TVD)
                                             v
   +-------------------------------------------------------------------------------------+
   |                              NWIS BACKEND CORE SERVICE                              |
   |                         (FastAPI Microservice / Python 3.12)                        |
   +-------------------------------------------------------------------------------------+
        |                     |                       |                       |
        v                     v                       v                       v
   +----------+         +-----------+           +-----------+           +-----------+
   | INGESTION|         | CORRELATOR|           | SIMILARITY|           |   ALERT   |
   | PIPELINE |         |  ENGINE   |           |  ENGINE   |           |  ENGINE   |
   | LayoutLM |         |  MD/TVD   |           | 5D Vector |           | 3 Levels  |
   | Docling  |         | DTW Match |           | Spatial+Geo|          | Precedent |
   +----------+         +-----------+           +-----------+           +-----------+
        \                     |                       |                      /
         \                    |                       |                     /
          v                   v                       v                    v
   +-------------------------------------------------------------------------------------+
   |                        CANONICAL SUBSURFACE DATA STORE                              |
   |    - PostgreSQL 16: Relational Tables (WCR, DDR, Bits, Casing, Mud)                |
   |    - PostGIS: Geospatial Vectors & 5 km Offset Distance Buffers                     |
   |    - pgvector / Neo4j: Domain Embeddings & Incident Knowledge Graph                 |
   +-------------------------------------------------------------------------------------+
                                             |
                                             | RESTful JSON APIs / WebSocket Stream
                                             v
   +-------------------------------------------------------------------------------------+
   |                           NWIS FRONTEND USER EXPERIENCE                             |
   |                           (Next.js 16 / TypeScript / MapLibre)                      |
   |   - Geospatial Map: 5 km Offset Radius  - Dual-Well Stratigraphic Cross-Section    |
   |   - Proactive Precedent Alert Feed      - Clickable Provenance Drawer               |
   +-------------------------------------------------------------------------------------+
```

### Architectural Tenets
1. **Decoupled Failure Domain:** If eRTMAC goes offline or experiences a satellite telemetry failure, NWIS remains 100% operational, allowing engineers to query historical offset well dossiers, formation tops, and casing designs without interruption.
2. **Read-Only Telemetry Consumer:** NWIS consumes live bit depth and trajectory coordinates from eRTMAC over standard WITSML queries. It never sends write commands back to the rig instrumentation.
3. **Edge Resilience (Store-and-Forward):** A lightweight containerized version ("NWIS Rig-Box") runs locally on the rigsite network, caching nearby offset data for offline operational continuity.

---

## 2. Canonical Relational Data Model (24 Core Entities)

The database schema implements strict **provenance**, **depth-reference typing**, and **planned vs. actual separation**:

```
                         CANONICAL RELATIONAL ENTITY GRAPH
                                           
       +-----------------------+                    +-------------------------+
       |      well_master      |1                  *|      well_location      |
       |-----------------------|------------------->|-------------------------|
       | PK well_id            |                    | PK location_id          |
       |    well_name          |                    | FK well_id              |
       |    actual_td_md       |                    |    geom (PostGIS Point) |
       |    actual_td_tvd      |                    |    coordinate_status    |
       +-----------------------+                    +-------------------------+
            |1             |1
            |              +-----------------------------------+
            |*                                                 |*
+-------------------------+                         +-------------------------+
|    daily_operation      |                         |   formation_interval    |
|-------------------------|                         |-------------------------|
| PK daily_op_id          |                         | PK interval_id          |
| FK well_id              |                         | FK well_id              |
|    operation_date       |                         | FK formation_id         |
|    present_depth_md     |                         |    top_md, base_md      |
|    progress_24h         |                         |    top_tvd, base_tvd    |
|    operation_text       |                         |    top_source_type      |
+-------------------------+                         +-------------------------+
       |1             |1                                   |1
       |*             |*                                   |*
+--------------+ +--------------+                   +-------------------------+
|  bit_run     | |  mud_record  |                   |   event (Hazard/Alert)  |
|--------------| |--------------|                   |-------------------------|
| PK bit_id    | | PK mud_id    |                   | PK event_id             |
| FK daily_op  | | FK daily_op  |                   | FK well_id              |
|    bit_no    | |    mud_wt_ppg|                   |    start_md, end_md     |
|    iadc_code | |    viscosity |                   |    event_type           |
|    in_md     | |    pv, yp    |                   |    severity             |
|    out_md    | |    fl_loss   |                   |    npt_hours            |
+--------------+ +--------------+                   +-------------------------+
```

### PostgreSQL + PostGIS DDL Specification

```sql
-- Canonical NWIS Database Schema
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Well Master Table
CREATE TABLE well_master (
    well_id VARCHAR(64) PRIMARY KEY,
    well_name VARCHAR(128) NOT NULL,
    field VARCHAR(64) NOT NULL,
    basin VARCHAR(64) NOT NULL DEFAULT 'Upper Assam',
    operator VARCHAR(128) DEFAULT 'Oil India Limited',
    well_type VARCHAR(32) CHECK (well_type IN ('EXPLORATION', 'DEVELOPMENT', 'APPRAISAL')),
    well_profile VARCHAR(32) CHECK (well_profile IN ('VERTICAL', 'DIRECTIONAL_J', 'DIRECTIONAL_S', 'HORIZONTAL')),
    spud_date DATE,
    td_date DATE,
    planned_td_md NUMERIC(8, 2),
    actual_td_md NUMERIC(8, 2),
    actual_td_tvd NUMERIC(8, 2),
    kb_elevation_m NUMERIC(6, 2),
    ground_elevation_m NUMERIC(6, 2),
    status VARCHAR(32) CHECK (status IN ('COMPLETED', 'ABANDONED', 'DRILLING', 'SUSPENDED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Well Location (Geospatial PostGIS)
CREATE TABLE well_location (
    location_id SERIAL PRIMARY KEY,
    well_id VARCHAR(64) REFERENCES well_master(well_id) ON DELETE CASCADE,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    geom GEOMETRY(Point, 4326),
    crs_epsg INT DEFAULT 4326,
    surface_reference VARCHAR(32) DEFAULT 'KB',
    coordinate_status VARCHAR(32) CHECK (coordinate_status IN ('OFFICIAL_SURVEY', 'SCALED_MAP', 'ESTIMATED')),
    source_document_id VARCHAR(128) NOT NULL
);
CREATE INDEX idx_well_location_geom ON well_location USING GIST (geom);

-- 3. Source Document Ledger (Provenance)
CREATE TABLE document_master (
    document_id VARCHAR(128) PRIMARY KEY,
    well_id VARCHAR(64) REFERENCES well_master(well_id),
    filename VARCHAR(255) NOT NULL,
    file_hash_sha256 VARCHAR(64) NOT NULL,
    document_type VARCHAR(32) CHECK (document_type IN ('DDR', 'WCR', 'DDDP', 'MUD_LOG', 'LOG_LAS')),
    file_uri VARCHAR(512) NOT NULL,
    ocr_engine VARCHAR(64),
    ingestion_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Canonical Formation Master
CREATE TABLE formation_master (
    formation_id SERIAL PRIMARY KEY,
    canonical_name VARCHAR(128) UNIQUE NOT NULL,
    basin VARCHAR(64) NOT NULL,
    age_era VARCHAR(64),
    lithology_class VARCHAR(64),
    aliases TEXT[]
);

-- 5. Formation Intervals (Stratigraphic Tops)
CREATE TABLE formation_interval (
    interval_id SERIAL PRIMARY KEY,
    well_id VARCHAR(64) REFERENCES well_master(well_id) ON DELETE CASCADE,
    formation_id INT REFERENCES formation_master(formation_id),
    formation_name_raw VARCHAR(128) NOT NULL,
    top_md NUMERIC(8, 2) NOT NULL,
    base_md NUMERIC(8, 2),
    top_tvd NUMERIC(8, 2),
    base_tvd NUMERIC(8, 2),
    depth_reference_type VARCHAR(16) DEFAULT 'MD' CHECK (depth_reference_type IN ('MD', 'TVD', 'TVDSS')),
    top_source_type VARCHAR(32) CHECK (top_source_type IN ('PROGNOSED', 'SAMPLE_CUTTINGS', 'WIRELINE')),
    confidence NUMERIC(3, 2) CHECK (confidence BETWEEN 0.0 AND 1.0),
    source_document_id VARCHAR(128) REFERENCES document_master(document_id),
    source_page_or_sheet VARCHAR(64)
);

-- 6. Daily Operations (DDR)
CREATE TABLE daily_operation (
    daily_op_id SERIAL PRIMARY KEY,
    well_id VARCHAR(64) REFERENCES well_master(well_id) ON DELETE CASCADE,
    operation_date DATE NOT NULL,
    present_depth_md NUMERIC(8, 2) NOT NULL,
    progress_24h NUMERIC(8, 2),
    operation_state VARCHAR(64),
    hole_size VARCHAR(32),
    operation_text TEXT,
    npt_hours NUMERIC(4, 2) DEFAULT 0.0,
    source_document_id VARCHAR(128) REFERENCES document_master(document_id),
    source_page_or_sheet VARCHAR(64)
);

-- 7. Mud Records
CREATE TABLE mud_record (
    mud_record_id SERIAL PRIMARY KEY,
    daily_op_id INT REFERENCES daily_operation(daily_op_id) ON DELETE CASCADE,
    mud_type VARCHAR(64),
    mud_weight_ppg NUMERIC(4, 2),
    mud_weight_sg NUMERIC(4, 3),
    viscosity_sec NUMERIC(5, 1),
    pv_cp NUMERIC(4, 1),
    yp_lb_100sqft NUMERIC(4, 1),
    gel_10s NUMERIC(4, 1),
    gel_10m NUMERIC(4, 1),
    fluid_loss_api_cc NUMERIC(4, 1),
    ph NUMERIC(3, 1),
    solids_pct NUMERIC(4, 1),
    source_document_id VARCHAR(128) REFERENCES document_master(document_id)
);

-- 8. Bit Runs
CREATE TABLE bit_run (
    bit_run_id SERIAL PRIMARY KEY,
    daily_op_id INT REFERENCES daily_operation(daily_op_id) ON DELETE CASCADE,
    bit_no VARCHAR(16),
    hole_size_in NUMERIC(4, 2),
    make VARCHAR(64),
    serial_no VARCHAR(64),
    iadc_code VARCHAR(16),
    in_md NUMERIC(8, 2),
    out_md NUMERIC(8, 2),
    meterage NUMERIC(8, 2),
    bit_hours NUMERIC(5, 1),
    rop_m_hr NUMERIC(5, 2),
    wob_ton NUMERIC(4, 1),
    rpm NUMERIC(4, 1),
    dull_grading VARCHAR(32)
);

-- 9. Operational Events & Hazards
CREATE TABLE event (
    event_id SERIAL PRIMARY KEY,
    well_id VARCHAR(64) REFERENCES well_master(well_id) ON DELETE CASCADE,
    event_type VARCHAR(64) CHECK (event_type IN ('MUD_LOSS', 'STUCK_PIPE', 'TIGHT_PULL', 'KICK', 'PACK_OFF', 'CASING_FAILURE')),
    severity VARCHAR(16) CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    start_md NUMERIC(8, 2) NOT NULL,
    end_md NUMERIC(8, 2),
    start_tvd NUMERIC(8, 2),
    end_tvd NUMERIC(8, 2),
    event_date DATE,
    formation_id INT REFERENCES formation_master(formation_id),
    description_raw TEXT NOT NULL,
    normalized_description TEXT,
    npt_hours NUMERIC(5, 2) DEFAULT 0.0,
    mud_loss_bbl NUMERIC(6, 2),
    source_document_id VARCHAR(128) REFERENCES document_master(document_id),
    source_page_or_sheet VARCHAR(64),
    extraction_confidence NUMERIC(3, 2)
);
```

---

## 3. The 17 RESTful APIs Blueprint

| HTTP Verb | Endpoint Path | Query / Body Parameters | Purpose & Output Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/ingestion/files` | Multipart: `file`, `document_type`, `well_id` | Upload and trigger asynchronous document extraction pipeline. |
| `GET` | `/api/ingestion/jobs/{id}`| Path: `id` (Job UUID) | Query extraction status, OCR confidence, and parsing warnings. |
| `GET` | `/api/wells` | Query: `basin`, `field`, `operator`, `status` | List wells with metadata and spatial bounding box. |
| `GET` | `/api/wells/{well_id}` | Path: `well_id` | Return complete well master profile and surface location. |
| `GET` | `/api/wells/{well_id}/timeline` | Path: `well_id` | Retrieve 24-hr daily drilling progress (MD vs Date curve). |
| `GET` | `/api/wells/{well_id}/formations`| Path: `well_id` | Return prognosed and wireline formation tops with provenance. |
| `GET` | `/api/wells/{well_id}/events` | Path: `well_id`, Query: `event_type`, `min_severity`| Retrieve historical hazards, mud losses, and NPT occurrences. |
| `GET` | `/api/wells/{well_id}/documents` | Path: `well_id` | List ingested source files with hashes and parsing metrics. |
| `GET` | `/api/wells/{well_id}/offsets` | Path: `well_id`, Query: `radius_km` (default 5.0) | **PostGIS spatial query** returning offset wells within radius. |
| `GET` | `/api/wells/{well_id}/similar` | Path: `well_id`, Query: `limit` (default 5) | Return multi-factor ranked similar wells with dimensional scores. |
| `GET` | `/api/wells/{well_id}/depth-context`| Path: `well_id`, Query: `md`, `window_m` (default 50)| Fetch historical events, mud weight, and ROP within depth corridor.|
| `POST` | `/api/search` | Body: `{ "query": "string", "well_id": "optional" }`| Hybrid semantic vector + keyword search over drilling narratives. |
| `POST` | `/api/active-context` | Body: `{ "well_id": "string", "bit_md": 2840.5 }` | Synchronize live active well context from eRTMAC. |
| `GET` | `/api/alerts` | Query: `active_well_id`, `status` (`NEW`, `DISMISSED`) | Retrieve proactive distance-to-hazard alerts for active well. |
| `POST` | `/api/alerts/{id}/dismiss` | Path: `id`, Body: `{ "engineer_reason": "string" }` | Mark alert as acknowledged with auditable engineer rationale. |
| `POST` | `/api/lessons` | Body: `{ "well_id", "formation_id", "lesson_text" }` | Capture engineer operational retrospective and mitigation advice. |
| `GET` | `/api/sources/{id}` | Path: `id` (Document UUID) | Fetch verified source excerpt metadata, image URI, and bbox. |

---

## 4. The 5-Dimensional Explainable Similar-Well Algorithm

Offset well selection must not rely on simple 2D distance. NWIS calculates an explainable similarity vector across five geological and engineering dimensions:

```
                      5-DIMENSIONAL SIMILARITY VECTOR ENGINE
                                           
        Candidate Well W_i evaluated against Active Well W_0
                                   |
         +-------------------------+-------------------------+
         |                         |                         |
         v                         v                         v
  [ 1. Spatial Proximity ]  [ 2. Geology & Strat ]   [ 3. Well Architecture ]
  S_sp = exp(-d / d_norm)   S_geo = Jaccard(F_0,F_i) S_arch = Profile + Hole
         |                         |                         |
         +-------------------------+-------------------------+
                                   |
                   +---------------+---------------+
                   |                               |
                   v                               v
         [ 4. Drilling Mechanics ]       [ 5. Hazard Precedent ]
         S_mech = Correlate(ROP,MW)      S_haz = Overlap(Events)
                                   |
                                   v
         +--------------------------------------------------+
         | Total Similarity Score (Normalized 0.0 to 1.0)   |
         | S_total = sum( w_k * S_k )                       |
         | Fully decomposed into transparent sub-scores     |
         +--------------------------------------------------+
```

### Mathematical Formulation

Formula: Similarity(W_0, W_i) = Σ_k=1^5 w_k · S_k(W_0, W_i) where Σ w_k = 1.0


1. **Spatial Proximity Dimension (w_1 = 0.30):**
   
Formula: S_spatial = exp( -(Distance(W_0, W_i) / D_reference) ) with D_reference = 5,000 m

2. **Stratigraphic & Formation Overlap (w_2 = 0.25):**
   
Formula: S_geology = (|F_0 cap F_i| / |F_0 cup F_i|) · (1 - |Δ TVD_target|100)

   Evaluates Jaccard overlap of penetrated formations and vertical target depth difference.
3. **Well Architecture & Trajectory Profile (w_3 = 0.15):**
   Matches well profile (Vertical vs. Directional vs. Horizontal) and final hole size program.
4. **Drilling Mud & Mechanics Envelope (w_4 = 0.15):**
   Cosine similarity between operational mud weight regimes and hydraulics flow rates.
5. **Historical Event Relevance (w_5 = 0.15):**
   Measures presence of documented NPT, mud losses, or stuck pipe events in the upcoming formation.

**Explainability Mandate:** NWIS never outputs a naked percentage (e.g., *"Well WX-07 is 87% similar"*). The UI presents a radar decomposition displaying exact sub-scores:
> *"WX-07 Overall Match: 87% [Spatial: 92%, Stratigraphy: 95%, Architecture: 80%, Mud System: 85%, Hazard History: 75%]"*

---

## 5. Three-Tier Progressive Alert Engine

```
                             THREE-TIER ALERT PROGRESSION
                                           
        +---------------------------------------------------------------+
        |  LEVEL 1: DETERMINISTIC HISTORICAL EVIDENCE RULES             |
        |  - Condition: Bit depth approaches offset hazard depth window |
        |  - Threshold: Active MD within +/- 30 m TVD of offset event   |
        |  - Output: Direct historical citation with source evidence    |
        +---------------------------------------------------------------+
                                           |
                                           v
        +---------------------------------------------------------------+
        |  LEVEL 2: STATISTICAL PARAMETER CORRELATION ENVELOPE          |
        |  - Condition: Active drilling parameter deviates from offset  |
        |    safe envelope (Min / Median / Max historical baseline)     |
        |  - Output: Parametric drift alert (e.g., Torque > 90th %ile)  |
        +---------------------------------------------------------------+
                                           |
                                           v
        +---------------------------------------------------------------+
        |  LEVEL 3: PROBABILISTIC MACHINE LEARNING RISK CLASSIFIER     |
        |  - Condition: High multi-channel feature correlation (PINN)   |
        |  - Output: Calibrated risk probability + TreeSHAP explainers  |
        |  - Status: Activated ONLY after 10+ wells historical training |
        +---------------------------------------------------------------+
```

### Level 1 Implementation: Deterministic Historical Context
- **Trigger Logic:** Bit reaches depth where offset well experienced an incident:
  
Formula: |TVD_bit - TVD_offset_event| ≤ 30 meters AND Formation_active == Formation_offset

- **Advisory Verbiage Rule:**
  > *"RECORDED PRECEDENT: Offset Well WX-07 (840 m NW) experienced 40 bbl mud loss at 1,068 m MD (1,062 m TVD) in the Bilara Formation. Mud weight at time of loss: 10.4 ppg. (Source: WCR_WX-07, Page 12, Table 4.2)."*

---

## 6. Frontend / UX Design System

```
+---------------------------------------------------------------------------------------------------+
|  eRTMAC-NWIS  |  Active Well: LOC-P9 (WX-11) | Current MD: 1,040 m | TVD: 1,032 m | Formation: HEG|
+---------------------------------------------------------------------------------------------------+
| [GIS MAP (5 km Buffer)]           | [STRATIGRAPHIC CORRELATION]     | [PROACTIVE ALERT STREAM]    |
|                                   | Depth (m) WX-11       WX-07     |                             |
|       * LOC-P3 (WX-07) [Offset]   | 800 - [Nagaur]        [Nagaur]  | [CRITICAL] 28m to Hazard    |
|         \                         |       |               |         | Recorded Bilara Mud Loss    |
|          \ 840 m                  | 1000- [HEG]           [HEG]     | in WX-07 at 1,068m MD       |
|           \                       |       | BIT NOW       |         | [View Evidence] [Dismiss]   |
|            * LOC-P9 (Active)      | 1100- [Bilara]        [Bilara]* |                             |
|                                   |       (1,128m)        (1,062m)  | [WARNING] Parameter Drift   |
| [Filter: All Hazards (3)]         |       |               *Loss     | Active Torque > 85th %ile   |
+-----------------------------------+---------------------------------+-----------------------------+
| [CLICKABLE PROVENANCE DRAWER: Source: WCR_WX-07.docx | Page 12 | Table 4.2 | Confidence: 0.98]     |
+---------------------------------------------------------------------------------------------------+
```

The user interface adheres to a **dual-tier operational layout**:
1. **Left Panel: High-Performance GIS Canvas (MapLibre GL JS):** Renders active wellhead and surrounding offset wells within a dynamic circular buffer (1 km, 3 km, 5 km). Wells are color-coded by operational status and hazard history.
2. **Center Panel: Stratigraphic Depth Timeline:** Visualizes dual-well correlation cross-sections, highlighting formation entry shifts (Δ z) and positioning the active bit relative to upcoming geological boundaries.
3. **Right Panel: Live Precedent Alert Feed:** Chronological advisory cards citing recorded historical hazards.
4. **Bottom Modal: Clickable Provenance Drawer:** Clicking any alert or formation boundary opens an inspection drawer showing the exact source document, page snippet, and verbatim extraction text.

---
*Next Section: [06_CRITICAL_ENGINEERING_NUANCES_WHAT_HUMANS_MISS.md](./06_CRITICAL_ENGINEERING_NUANCES_WHAT_HUMANS_MISS.md)*
