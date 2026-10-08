# eRTMAC-NWIS: Master Research & Technical Documentation Suite

**Project:** Nearby Wells Intelligence System (NWIS)  
**Hackathon:** Smart India Hackathon (SIH) 2026  
**Problem Statement ID:** SIH26121  
**Category:** Software | **Theme:** Smart Automation  
**Sponsoring Organization:** Oil India Limited (OIL)  
**Operational Center:** eRTMAC (Enhanced Real-Time Monitoring & Analytics Centre), Duliajan, Assam  
**Team:** Fluid Fusion  

---

## Documentation Suite Overview

This documentation suite represents an exhaustive, publication-grade research and engineering blueprint for **eRTMAC-NWIS**. It was synthesized by deploying multi-agent research teams investigating commercial platforms, academic petroleum literature (SPE, IEEE, SEG), subsurface public datasets (Volve, FORCE 2020, DISKOS), and the verified Oil India Limited reference dataset (WX-07 and WX-11).

### Master Navigation Index

| Document | Title | Key Themes & Coverage |
| :--- | :--- | :--- |
| [**00: Executive Summary & Problem Definition**](./00_EXECUTIVE_SUMMARY_AND_PROBLEM_DEFINITION.md) | Official SIH26121 Mandate & Core Philosophy | Problem background, eRTMAC vs NWIS ("What is happening now vs what happened before"), NPT financial costs (15k–100k/day), stakeholder personas, and core engineering tenets. |
| [**01: Subsurface Geology & Drilling Hazards**](./01_GEOLOGY_AND_DRILLING_HAZARDS_UPPER_ASSAM_SHELF.md) | Upper Assam Shelf & Basin Geomechanics | Tectonics (Himalayan foreland & Naga thrust), stratigraphic column (Alluvium to Basement), Girujan shale swelling, Tipam sandstone mud losses, Barail coal breakout, and PPFG drilling windows. |
| [**02: Existing Industry Solutions & Benchmarks**](./02_EXISTING_INDUSTRY_SOLUTIONS_AND_COMPETITIVE_LANDSCAPE.md) | Commercial Upstream Landscape | SLB (DrillOps, DrillPlan, Delfi), Halliburton Landmark (EDT, OpenWells, COMPASS, DecisionSpace 365), Baker Hughes (JewelSuite, WellLink), Corva.ai, ROGII, OSDU, WITSML 1.4 vs 2.0 (ETP), and NOC comparative matrix. |
| [**03: Academic Research & SPE Literature**](./03_ACADEMIC_RESEARCH_AND_SPE_LITERATURE_REVIEW.md) | Physics-Informed ML & Algorithms | Stuck pipe mechanics (differential, mechanical, pack-off), Eaton & Bowers pore pressure equations, 3D Minimum Curvature Method (SPE-84246), Multidimensional DTW log alignment, PetroNER, GraphRAG, and 10 landmark SPE papers. |
| [**04: Public Datasets, Standards & Tooling**](./04_PUBLIC_DATASETS_STANDARDS_AND_TOOLING.md) | Subsurface Data Ecosystem & Benchmarks | Equinor Volve Field (5 TB), FORCE 2020 (98 wells), NOD FactPages, TNO NLOG, BSEE/BOEM, Python tools (`lasio`, `dlisio`, `welly`, `striplog`, `welleng`, `PyVista`), and synthetic cluster simulation math. |
| [**05: Production Architecture & Blueprint**](./05_PRODUCTION_SYSTEM_ARCHITECTURE_AND_TECHNICAL_BLUEPRINT.md) | Enterprise System Architecture | Independence from eRTMAC, 24 canonical relational entities with complete PostgreSQL + PostGIS DDL, 17 RESTful APIs, 5D explainable similar-well vector, 3-tier alert engine, and UI/UX design. |
| [**06: Critical Engineering Nuances**](./06_CRITICAL_ENGINEERING_NUANCES_WHAT_HUMANS_MISS.md) | What Non-Petroleum Engineers Miss | Depth reference traps (MD vs TVD vs TVDSS, KB/GL datums), structural dip vs 2D Euclidean distance, planned vs actual geology preservation, mud chemistry mismatches, LOT/FIT vs dynamic ECD surges, and alarm fatigue. |
| [**07: Production Implementation Roadmap**](./07_PRODUCTION_IMPLEMENTATION_ROADMAP_AND_ACCEPTANCE.md) | Implementation, Testing & Demo Script | Four-phase software build roadmap, quantitative acceptance thresholds, "NWIS Rig-Box" containerized edge architecture, store-and-forward caching, and the step-by-step SIH 2026 jury demonstration scenario. |

---

## Architectural Summary: The Core Value Proposition

```
+-------------------------------------------------------------------------------+
|                       eRTMAC-NWIS VALUE PROPOSITION                           |
+-------------------------------------------------------------------------------+
|                                                                               |
|   1. ZERO UNSTRUCTURED BLIND SPOTS:                                           |
|      Ingests and parses decades of legacy scanned PDF completion reports      |
|      and non-standard Excel daily drilling reports with layout-aware OCR.     |
|                                                                               |
|   2. EXPLAINABLE PRECEDENT ALERTS:                                            |
|      Replaces black-box probability scores with verifiable, deterministic     |
|      citations of past offset incidents within upcoming depth windows.        |
|                                                                               |
|   3. 100% PROVENANCE & TRUST:                                                 |
|      Every alert, formation top, and mud weight is clickable, instantly       |
|      revealing the original source document, page, table, and verbatim text.  |
|                                                                               |
|   4. 100% INDIAN DATA SOVEREIGNTY:                                            |
|      Fully on-premise / sovereign cloud containerized deployment complying    |
|      with MoPNG, MeitY, and DGMS regulations. Free from vendor lock-in.       |
|                                                                               |
+-------------------------------------------------------------------------------+
```

---
*All files reside directly in `d:\Drill Well\documentations\`.*
