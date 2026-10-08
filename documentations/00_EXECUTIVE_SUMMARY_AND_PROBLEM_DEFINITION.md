# 00: Executive Summary & Problem Definition — SIH26121

**Platform:** eRTMAC-NWIS (Nearby Wells Intelligence System)  
**Hackathon:** Smart India Hackathon (SIH) 2026  
**Problem Statement ID:** SIH26121  
**Category:** Software | **Theme:** Smart Automation  
**Sponsoring Organization:** Oil India Limited (OIL)  
**Operational Center:** eRTMAC (Enhanced Real-Time Monitoring & Analytics Centre), Duliajan, Assam  
**Target Basin:** Upper Assam Shelf / Rajasthan / KG Basin Operational Assets  

---

## 1. Official Problem Statement Breakdown

### 1.1 Problem Background
Oil India Limited (OIL), a Maharatna National Oil Company under the Ministry of Petroleum and Natural Gas (MoPNG), Government of India, operates a centralized digital real-time monitoring center known as **eRTMAC (Enhanced Real-Time Monitoring & Analytics Centre)** at its field headquarters in Duliajan, Assam. 

eRTMAC is a state-of-the-art command center that ingests surface sensor streams, downhole Measurement While Drilling / Logging While Drilling (MWD/LWD) telemetry, and mud logging parameters from active drilling rigs operating across complex onshore and foothill basins.

Despite the continuous telemetry streams received by eRTMAC, **drilling in geologically complex, tectonically active formations cannot be optimized or made safe by real-time sensor monitoring alone**. Subsurface well construction is fundamentally a predictive, correlation-driven discipline. Safe operational decisions require knowing what geological hazards, pressure ramps, fluid loss zones, and mechanical drillstring impediments were encountered by **offset wells** previously drilled through the same stratigraphic sequence.

Currently, this vital historical intelligence is trapped in:
- Hundreds of multi-page **Well Completion Reports (WCRs)** stored as scanned PDFs or legacy Word documents.
- Disparate **Daily Drilling Reports (DDRs)** recorded in varied Excel spreadsheets with inconsistent layouts.
- Directional Drilling Decision Plans (DDDPs), Mud Logging End of Well Reports (EOWR), and casing/cementing tallies.
- The subjective **institutional memory of veteran drilling superintendents**, which is lost upon retirement or rotation.

### 1.2 The Operational Problem
When an active well experiences sudden torque fluctuations, rate of penetration (ROP) slowdowns, or pit level drops, drilling engineers must rapidly answer:
> *"Has an offset well within 3 km ever experienced lost circulation, tight pull, or gas kicks at this True Vertical Depth (TVD) in this formation? If so, what was the exact mud weight, what mitigation pill was pumped, and did the drillstring get stuck?"*

Today, answering that query requires manual, high-latency searches through unstructured archives, or worse, reliance on guesswork. The consequence is **delayed decision-making**, recurring **Non-Productive Time (NPT)**, and catastrophic downhole failures.

### 1.3 Expected Solution Objectives (eRTMAC-NWIS)
To eliminate this institutional memory gap, Oil India Limited has tasked participants with building **NWIS (Nearby Wells Intelligence System)** — an AI/ML-enabled, standalone offset well knowledge and decision-support platform designed to operate alongside eRTMAC. 

The system must fulfill seven primary mandates:
1. **Automated Document Intelligence:** Ingest and structure historical drilling reports (WCRs, DDRs, DDDPs) using AI, OCR, Layout-aware parsing, and Natural Language Processing.
2. **Interactive Geospatial Visualization:** Provide a map-based GIS interface displaying offset wells within user-defined operational radii (e.g., 1 km, 3 km, 5 km, 10 km).
3. **Searchable Knowledge Repository:** Create an indexed, searchable repository of past drilling events, NPT occurrences, bit records, mud rheologies, and lessons learned.
4. **Subsurface Stratigraphic Correlation:** Correlate geological formations, lithology intervals, and drilling parameters across wells based on Measured Depth (MD), True Vertical Depth (TVD), and True Stratigraphic Thickness (TST).
5. **Predictive & Contextual Risk Engine:** Generate proactive alerts when an active well approaches depths or formations where offset wells encountered hazards (mud losses, differential sticking, hole pack-off, overpressures, kicks, or torque spikes).
6. **Strict Evidence Provenance:** Ensure every fact, alert, and correlation references its exact source document, page, sheet, and raw text, eliminating black-box AI hallucinations.
7. **User-Friendly Dual-Tier Dashboard:** Deliver intuitive, low-cognitive-load interfaces tailored for both rigsite drilling engineers and corporate RTOC superintendents.

---

## 2. The Core Philosophy: "eRTMAC vs. NWIS"

The relationship between eRTMAC and NWIS is foundational to the entire system architecture:

```
+-------------------------------------------------------------------------------+
|                       THE DUAL OPERATIONAL CONTROL PILLARS                    |
+-------------------------------------------------------------------------------+
|                                                                               |
|   eRTMAC (Real-Time Monitoring & Analytics)      NWIS (Nearby Wells Intelligence)     |
|   "WHAT IS HAPPENING NOW"                       "WHAT HAPPENED BEFORE"                |
|   ----------------------------------------      -----------------------------------   |
|   - Real-time sensor telemetry (1-10 Hz)         - Historical institutional memory    |
|   - WITS / WITSML / OPC-UA live feeds           - WCRs, DDRs, EOWRs, Mud Logs         |
|   - Active rig parameter monitoring:            - Subsurface stratigraphic correlation|
|     * Hookload, WOB, RPM, Torque, SPP           - Multi-well similarity scoring       |
|     * Flow in/out, Pit volumes, ECD             - Proactive historical precedent      |
|   - Instantaneous threshold alerts              - Lessons learned & mitigation logs   |
|   - Tactical rig floor control                  - Strategic subsurface risk context   |
|                                                                               |
+-------------------------------------------------------------------------------+
```

### Why eRTMAC Alone Fails to Prevent Catastrophes
A real-time monitoring center monitors parameters as they cross critical safety thresholds:
- When a flow-out sensor detects a kick, eRTMAC alarms. However, by that second, hydrocarbon gas has already entered the wellbore, requiring immediate blowout preventer (BOP) activation.
- When hookload drops and surface torque spikes, eRTMAC alarms. By then, the drillstring is already mechanically stuck or packed off in sloughing shale.

**NWIS inverts this paradigm from reactive detection to proactive anticipation.** Hours or days before the bit penetrates a hazardous zone, NWIS correlates the active well's trajectory with offset well histories, warning the drilling engineer:
> *"WARNING — Recorded Precedent: Entering the Barail Sandstone at 2,840 m TVD. In Offset Well WX-07 (840 m NW), a total mud loss of 45 bbl occurred at 2,842 m with a mud weight of 10.4 ppg, resulting in 18 hours of NPT. Recommended action: Stage 25 bbl coarse LCM pill on standby and reduce pump rate prior to penetration."*

---

## 3. Financial & Operational Stakes in Upstream Well Construction

Drilling oil and gas wells is among the most capital-intensive industrial operations in the world:

### 3.1 Daily Rig Operating Costs
- **Onshore Rigs (Upper Assam / Rajasthan):** Operating costs range from **15,000 to45,000 USD (₹12 Lakh to ₹38 Lakh INR) per day**, including rig charter, fuel, mud chemicals, third-party directional drilling services, and crew logistics.
- **Deep Exploration / HPHT Rigs:** Can exceed **60,000 to100,000 USD per day**.
- **Offshore Rigs (KG Basin / Western Offshore):** Jackup rigs cost **80,000 to150,000 USD/day**; deepwater drillships cost **350,000 to500,000+ USD/day**.

### 3.2 Non-Productive Time (NPT) Breakdown
Industry-wide studies across SPE literature reveal that **Non-Productive Time accounts for 20% to 35% of total drilling expenditure**. In complex onshore geological basins like the Assam-Arakan thrust belt, NPT can exceed 40% of well duration.

The dominant contributors to NPT are:
1. **Stuck Pipe Incidents:** Accounts for ~40% of all drilling NPT. Freeing stuck pipe, backing off, fishing, or sidetracking costs anywhere from ₹50 Lakh to tens of Crores per occurrence.
2. **Lost Circulation:** In severe loss zones (e.g., fractured carbonates or depleted sands), thousands of barrels of drilling fluid are lost into the formation, causing reservoir damage, loss of hydrostatic head, and secondary kicks.
3. **Wellbore Instability (Sloughing Shales):** Swelling clays (e.g., Girujan Formation) cause borehole closure, tight hole, pack-off, and extensive reaming time.
4. **Catastrophic Blowouts:** Uncontrolled well control incidents (such as the Baghjan blowout in Upper Assam in 2020) result in devastating environmental impact, loss of natural resources, and hundreds of crores in remediation costs.

**ROI of NWIS:** Preventing just **one stuck pipe event or two days of lost circulation NPT per drilling campaign** saves Oil India Limited between **₹30 Lakh and ₹2.5 Crore INR**, instantly justifying the entire software development and deployment cost.

---

## 4. Key Stakeholders & System Personas

| Persona | Operational Context | Primary NWIS Need | Critical UX Expectation |
| :--- | :--- | :--- | :--- |
| **Rigsite Drilling Engineer (Company Man)** | Drilling cabin on location; harsh environment; high cognitive load; intermittent connectivity. | Rapid verification of upcoming risks over the next 100 meters; quick lookups of offset casing seats and mud weights. | Zero clutter; one-click distance-to-hazard queries; offline-capable cached alerts. |
| **Operations Geologist (Wellsite & Office)** | Correlating rock cuttings and MWD logs against prognosed lithology; picking casing points. | Stratigraphic cross-sections; planned vs. actual formation top shifts; lithology discrepancies. | Interactive well log viewer; formation normalization; side-by-side offset correlation. |
| **eRTMAC Lead Engineer (Duliajan RTOC)** | Monitoring 10–20 active rigs concurrently from video walls in Duliajan. | High-level geospatial fleet map; real-time exception monitoring; automated historical context feeds. | Multi-rig hazard heatmaps; multi-factor similar-well rankings; push notifications. |
| **Drilling Operations General Manager (OIL HQ)** | Strategic oversight; budget adherence; post-well retrospectives; vendor performance benchmarking. | Fleet-wide NPT analytics; bit wear benchmarks; recurrent hazard frequency maps; lessons learned compliance. | Executive dashboards; aggregate NPT metrics; cross-field performance trends. |

---

## 5. Non-Negotiable System Principles (Core Tenets)

Derived from the verified reference package and the *NWIS Software Development Master Guiding Manual*, the platform must strictly adhere to seven architectural principles:

1. **Standalone Independence:** NWIS must operate as an independent platform with its own database, analytics engine, and user interface. It is a consumer of eRTMAC's live well context, not an embedded module or control override.
2. **Decision Support, Never Autonomous Control:** NWIS provides historical context, recorded precedents, and advisory risk probabilities. It **never issues autonomous physical rig control commands** or claims absolute certainty about future events.
3. **Mandatory Provenance & Source Traceability:** Every extracted fact, depth interval, formation pick, and historical alert must carry an immutable provenance record (`source_document_id`, `page_number`, `sheet_name`, `bounding_box`, and `extraction_confidence`). A user must be able to click any data point in the UI and immediately view the original document excerpt.
4. **Strict Separation of Measured Depth (MD) and True Vertical Depth (TVD):** Depth references must never be silently interchanged. Directional surveys calculated via the Minimum Curvature Method are mandatory for any spatial conversion.
5. **Preservation of Planned vs. Actual Discrepancies:** Prognosed geological tops and wireline-confirmed tops must be stored as separate records. Neither may overwrite the other.
6. **No Silent Data Invention:** If coordinates, mud weights, or casing depths are missing from historical records, they must remain `NULL` with an explicit reason code. Fabricating or borrowing values from adjacent wells is strictly forbidden.
7. **Advisory Verbiage Compliance:** The system must use phrasing such as *"Recorded historical precedent in Offset Well WX-07"* rather than speculative phrases like *"The well will experience a kick"*.

---
*Next Section: [01_GEOLOGY_AND_DRILLING_HAZARDS_UPPER_ASSAM_SHELF.md](./01_GEOLOGY_AND_DRILLING_HAZARDS_UPPER_ASSAM_SHELF.md)*
