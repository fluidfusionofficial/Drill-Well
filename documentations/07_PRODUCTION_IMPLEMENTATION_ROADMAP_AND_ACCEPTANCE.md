# 07: Production Implementation Roadmap, Acceptance Testing & SIH 2026 Demo Script

**Project:** eRTMAC-NWIS (Nearby Wells Intelligence System)  
**Target Organization:** Oil India Limited (OIL)  
**Hackathon Target:** Smart India Hackathon (SIH) 2026 | Problem Statement: SIH26121  

---

## 1. Complete Four-Phase Software Build Roadmap

```
                          FOUR-PHASE PRODUCTION BUILD ROADMAP
                                           
        +---------------------------------------------------------------+
        | PHASE 0: THE VERTICAL SLICE (Hackathon Core Proof-of-Concept) |
        | - Ingest WX-07 & WX-11 sanitized datasets                     |
        | - Parse WCR formation tops, daily timelines & event tables    |
        | - Render 2D GIS map with 5 km offset distance buffer          |
        | - Display interactive dual-well stratigraphic correlation      |
        | - Trigger deterministic Level 1 Historical Precedent Alert    |
        | - Click alert to view verified source document provenance     |
        +---------------------------------------------------------------+
                                           |
                                           v
        +---------------------------------------------------------------+
        | PHASE 1: ENTERPRISE DATA INGESTION & DOCUMENT INTELLIGENCE    |
        | - Vision-based layout parsing (Docling TableFormer + LayoutLM)|
        | - Fuzzy label-alias dictionary for heterogeneous Excel DDRs   |
        | - Automated PetroNER narrative extraction for drilling events |
        | - Complete relational PostgreSQL schema (24 canonical tables) |
        +---------------------------------------------------------------+
                                           |
                                           v
        +---------------------------------------------------------------+
        | PHASE 2: GEOSPATIAL & MULTI-DIMENSIONAL CORRELATION ENGINE   |
        | - PostGIS spatial indexing across 100,000+ wellbore heads     |
        | - Minimum Curvature Method (MCM) 3D trajectory interpolation  |
        | - 5-Dimensional explainable similar-well ranking algorithm    |
        | - Structural dip & fault throw depth correction (TVD / TST)   |
        +---------------------------------------------------------------+
                                           |
                                           v
        +---------------------------------------------------------------+
        | PHASE 3: PROGRESSIVE ALERT ENGINE & eRTMAC STREAMING BRIDGE   |
        | - Level 1 (Deterministic) + Level 2 (Statistical Baseline)    |
        | - WITSML 1.4 / ETP real-time active bit depth consumer       |
        | - Auditable engineer alert acknowledgment & dismissal logging |
        | - Hybrid GraphRAG search over historical lessons learned      |
        +---------------------------------------------------------------+
                                           |
                                           v
        +---------------------------------------------------------------+
        | PHASE 4: PRODUCTION HARDENING, EDGE DEPLOYMENT & SOVEREIGNTY  |
        | - "NWIS Rig-Box" containerized edge deployment (Docker / K8s) |
        | - Store-and-forward offline caching during VSAT outages       |
        | - MoPNG / MeitY Indian sovereign cloud compliance verification|
        +---------------------------------------------------------------+
```

---

## 2. Quantitative Acceptance Criteria & Quality Metrics

To ensure enterprise-grade reliability, the NWIS platform must satisfy strict, measurable acceptance thresholds prior to operational sign-off:

| System Subsystem | Quantitative Acceptance Metric | Target Benchmark Threshold | Verification Methodology |
| :--- | :--- | :--- | :--- |
| **Document Ingestion** | Header Key-Value Extraction Accuracy | **≥ 98.0%** | Benchmarked against 100 hand-verified WCR first-page summaries. |
| **Table Parsing** | Cell-Level Precision & Recall in Excel DDRs | **≥ 99.0%** | Tested across shifted row layouts in WX-07 and WX-11. |
| **Narrative Event NER** | PetroNER F1-Score on Drilling Hazards | **≥ 92.0%** | Evaluated on 1,000 annotated daily operations text snippets. |
| **Geospatial GIS** | 5 km Radius Spatial Query Latency | **< 150 ms** | Executed in PostGIS against 100,000 synthetic wellhead points. |
| **Trajectory Engine** | 3D Position Accuracy (TVD, North, East) | **100.0% Exact** | Validated against analytical Minimum Curvature ground truth. |
| **Stratigraphic Matching** | Formation Entry Prognosis Error (Δ z) | **< 3.0 meters** | Evaluated across offset wells in structurally continuous blocks. |
| **Alert Engine** | Historical Precedent Alert Recall | **≥ 95.0%** | Zero missed historical hazards within active ± 30 m TVD window. |
| **Source Provenance** | Clickable Document Citation Coverage | **100.0% Strict** | Every UI data point links to Document ID, Page, and Cell. |
| **System Availability** | Rigsite Edge Offline Operation | **100% Functionality** | Continues alerting when satellite link is disconnected for 48 hrs. |

---

## 3. Edge Deployment Architecture: "NWIS Rig-Box"

In the remote jungle and alluvial environments of the Upper Assam Basin, satellite communications (VSAT) suffer from frequent monsoonal rain fade and round-trip latency of 800–1,500 ms.

```
                           "NWIS RIG-BOX" EDGE ARCHITECTURE
                                           
        +---------------------------------------------------------------+
        |                       CENTRAL HUB (Duliajan eRTMAC)           |
        | - Full Subsurface Data Lake (All WCRs, DDRs, Seismic)         |
        | - Enterprise PostgreSQL / PostGIS Master Cluster              |
        +---------------------------------------------------------------+
                                        ^
                                        | High-Latency VSAT / 4G VPN Link
                                        | Store-and-Forward Sync
                                        v
        +---------------------------------------------------------------+
        |                 "NWIS RIG-BOX" (Rig Instrumentation Cabin)    |
        | - Fanless Ruggedized Industrial PC (IPC, DIN-rail mounted)     |
        | - Local SQLite / DuckDB Replica: 5 km Offset Radius Cache     |
        | - Local Python FastAPI Engine & Next.js Static Export UI      |
        | - Direct WITS0 / WITSML Serial/LAN Feed from Mud Logging Unit |
        +---------------------------------------------------------------+
                                        |
                                        v
        +---------------------------------------------------------------+
        |               DRILLER & COMPANY MAN DISPLAYS (Touchscreen)    |
        | - Zero-Latency Proactive Precedent Alerts (Sub-second)        |
        | - Full Operational Functionality during Complete Sat Outages   |
        +---------------------------------------------------------------+
```

### Store-and-Forward Mechanics
1. **Local Caching:** Prior to spudding, the central eRTMAC pushes a compact SQLite package containing all historical well dossiers within a 10 km radius to the Rig-Box.
2. **Offline Inference:** While drilling, the Rig-Box computes Level 1 and Level 2 alerts locally from the mud logging unit's WITS serial feed with **zero reliance on cloud or internet connectivity**.
3. **Delta Synchronization:** When VSAT connectivity is available, the Rig-Box pushes newly recorded daily logs, bit wear observations, and engineer comments back to the Duliajan central database.

---

## 4. End-to-End SIH 2026 Jury Demonstration Scenario

Below is the scripted, step-by-step walkthrough to present the working prototype to the Smart India Hackathon judging panel, showcasing the integration between **Well WX-07** (historical offset) and **Well WX-11** (active drilling well).

```
+-------------------------------------------------------------------------------+
|                      SIH 2026 LIVE DEMONSTRATION WORKFLOW                     |
+-------------------------------------------------------------------------------+
|                                                                               |
|  Step 1: Open Geospatial Map -> Select Active Well LOC-P9 (WX-11)             |
|          System auto-identifies LOC-P3 (WX-07) as primary offset (840m NW)    |
|                                                                               |
|  Step 2: Review Dual-Well Stratigraphic Cross-Section                         |
|          Notice 55m downward formation shift between WX-07 and WX-11          |
|                                                                               |
|  Step 3: Advance Active Bit Depth from 1,080m MD to 1,128m MD                 |
|          Bit enters Bilara Formation; Active Depth crosses 1,112m TVD         |
|                                                                               |
|  Step 4: PROACTIVE LEVEL 1 ALERT TRIGGERS ON SCREEN                           |
|          "RECORDED PRECEDENT: WX-07 lost 40 bbl in Bilara at 1,068m MD"       |
|                                                                               |
|  Step 5: Click "Inspect Provenance Evidence"                                  |
|          Modal opens displaying WCR_WX-07.docx, Page 12, Table 4.2 snippet    |
|                                                                               |
|  Step 6: Display Explainable Multi-Factor Similarity Radar                    |
|          Showcase 87% similarity decomposed across Spatial, Strat & Hazards   |
|                                                                               |
+-------------------------------------------------------------------------------+
```

### Detailed Demonstration Script for the Presenter

#### Step 1: The Operational Challenge & Geospatial Intelligence
- **Action:** Open the NWIS dashboard. Select Active Well: `LOC-P9 (Well WX-11)`.
- **Narration:**
  > *"Respected Jury, imagine you are the drilling superintendent at Oil India Limited’s eRTMAC center. Well WX-11 is currently drilling ahead. On our MapLibre GIS display, NWIS immediately visualizes the active well and queries our PostGIS database within a 5 km operational buffer. It highlights Well WX-07, located 840 meters to the Northwest, as our primary offset well."*

#### Step 2: Subsurface Stratigraphic Correlation
- **Action:** Click the "Stratigraphic Correlation" tab.
- **Narration:**
  > *"Notice what a naive system would miss: although WX-07 and WX-11 are close horizontally, their subsurface structures are not identical. Because of regional structural dip, the Bilara Formation top in WX-07 occurred at 1,062 m TVD, but in our active well WX-11, it arrives at 1,128 m TVD—a 55-meter vertical depth shift. NWIS tracks both planned seismic tops and wireline tops, never overwriting historical data."*

#### Step 3: Real-Time eRTMAC Integration & Proactive Alert Triggering
- **Action:** Slide the depth simulator from 1,080 m MD down to 1,128 m MD (entering the Bilara formation).
- **Narration:**
  > *"As our active bit approaches 1,128 meters MD, watch the alert feed. A critical Level 1 Historical Precedent Alert flashes on the console: 'CRITICAL PRECEDENT: Offset Well WX-07 experienced a 40 bbl mud loss at 1,068 m MD in the Bilara carbonate, resulting in 18 hours of NPT. Mud weight was 10.4 ppg.' NWIS remembered what happened to our previous well, warning the driller before the bit penetrates the loss zone."*

#### Step 4: The Ultimate Trust Test: Clickable Provenance
- **Action:** Click the "View Evidence" button on the alert card.
- **Narration:**
  > *"This is the feature industry engineers love most: Zero Black-Box Hallucinations. Clicking the alert opens the Provenance Drawer. It displays the exact source document: WCR_WX-07_sanitised.docx, Page 12, Table 4.2, highlighting the verbatim extracted sentence and extraction confidence of 0.98. The driller can trust this alert because the original evidence is right before their eyes."*

#### Step 5: Multi-Factor Similarity & Management Retrospectives
- **Action:** Open the "Similar Wells" radar breakdown and the "NPT Retrospective" analytics tab.
- **Narration:**
  > *"Finally, NWIS decomposes similarity across 5 transparent dimensions: Spatial (92%), Stratigraphy (95%), Architecture (80%), Mud Chemistry (85%), and Event History (75%). Management can review fleet-wide NPT trends, compare bit performance, and capture post-well lessons learned, ensuring institutional memory is preserved for future generations of Oil India engineers."*

---
*End of Documentation Suite. All files saved to `d:\Drill Well\documentations\`.*
