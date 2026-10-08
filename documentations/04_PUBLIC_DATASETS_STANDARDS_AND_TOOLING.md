# 04: Public Datasets, Upstream Standards, Tooling & Synthetic Benchmarking

**Focus:** Upstream Petroleum Open Datasets, Subsurface Python Ecosystem, Document OCR Benchmarks, and Synthetic Cluster Generation  
**Target Application:** eRTMAC-NWIS Validation, Model Pre-training & Scalability Testing  

---

## 1. Global Open Upstream Datasets Catalogue

To rigorously test and benchmark an offset well intelligence system beyond a small starting reference set, engineers leverage open-access subsurface repositories:

```
                            GLOBAL OPEN UPSTREAM DATA REPOSITORIES
                                           
        +-------------------------------------------------------------------------+
        |                 PUBLIC PETROLEUM & DRILLING DATA SOURCES                |
        +-------------------------------------------------------------------------+
                     |                         |                         |
                     v                         v                         v
        +-------------------------+ +-------------------------+ +-------------------------+
        |   EQUINOR VOLVE FIELD   | |       FORCE 2020        | |       NOD / DISKOS      |
        | - 40,000+ Files (5 TB)  | | - 98 Norwegian Wells    | | - Complete Norwegian OCS|
        | - DDRs, WCRs, WITSML    | | - 12-Class Lithofacies  | | - FactPages & Wireline  |
        | - Petrel 3D Model & LAS | | - Asymmetric Penalty Mat| | - Standard Stratigraphy |
        +-------------------------+ +-------------------------+ +-------------------------+
                     |                         |                         |
                     v                         v                         v
        +-------------------------+ +-------------------------+ +-------------------------+
        |        TNO NLOG         | |       USGS / BSEE       | |          NZP&M          |
        | - Dutch Onshore/Offshore| | - Gulf of Mexico OCS    | | - New Zealand Basins    |
        | - Zechstein Salt Diapirs| | - Daily WAR BSEE-0133C  | | - 1,500+ Scanned WCRs   |
        | - Real Casing Collapses | | - Labeled Kick/NPT Logs | | - Extreme OCR Benchmark |
        +-------------------------+ +-------------------------+ +-------------------------+
```

### 1.1 Equinor Volve Field Dataset (North Sea Block 15/9)
- **Scope & Scale:** The gold standard of public E&P data. 5 Terabytes covering the complete lifecycle of the Volve field (decommissioned 2016, open-sourced 2018).
- **Available Data Assets:**
  - *Daily Drilling Reports (DDR):* Over 2,500 daily reports in HTML/PDF and WITSML XML objects (`opsReport`). Contains complete 24-hour operational time breakdowns, bit runs, mud rheology, and IADC NPT event descriptions.
  - *Well Completion Reports (WCR):* 50 to 200-page definitive reports detailing formation tops (Hugin, Sleipner, Skagerrak), casing seat LOT/FIT records, and cementing logs.
  - *WITSML Real-time Telemetry:* 1-second interval surface and downhole channels (Torque, Hookload, SPP, Flow in/out, RPM, WOB) across wellbores `15/9-F-1`, `15/9-F-4`, `15/9-F-11`, and `15/9-F-12`.
  - *Subsurface 3D Models:* Complete Petrel project containing 3D seismic horizon interpretations, fault frameworks, and 3D property grids.

### 1.2 FORCE 2020 Machine Learning Competition Dataset
- **Scope:** 98 training wells and 10 blind test wells from the Norwegian North Sea.
- **Attributes:** Wireline logs (`GR`, `NPHI`, `RHOB`, `DTC`, `DTS`, `RDEP`, `RMED`, `CALI`, `PEF`) sampled at 0.1524 m MD steps with standardized UTM coordinates and TVDSS.
- **Target Taxonomy & Metric:** 12 lithofacies classes evaluated using an **asymmetric geological penalty matrix** where confusing high-hazard formations (e.g., Coal or Halite misclassified as Sandstone) incurs a -5.0 to -7.0 penalty versus -1.0 for minor lithology errors.
- **NWIS Utility:** Pre-trains automated lithology and formation boundary identification models from raw sensor streams.

### 1.3 Norwegian Offshore Directorate (NOD) FactPages & DISKOS
- **Architecture:** Web-accessible relational repository containing official data for all exploration and development wells on the Norwegian Continental Shelf.
- **Public Disclosure Rule:** All exploration well data is released into the public domain after a **2-year statutory confidentiality period** (5 years for development wells).
- **Available Tables:** Wellbore Master, Stratigraphical Tops, Casing & LOT/FIT summaries, Drill Stem Tests (DST), and Drilling Mud properties.

### 1.4 USGS, BOEM & BSEE Gulf of Mexico Incident Database
- **eWell Daily Well Activity Reports (WAR - Form BSEE-0133C):** Granular daily drilling parameters, casing shoe tests, and mud properties across thousands of deepwater and shelf wells.
- **Incident Investigation Logs:** Labeled ground-truth database of downhole stuck pipe events, well control kicks, shallow gas encounters, and lost circulation episodes. Ideal for training NWIS risk engines.

### 1.5 New Zealand Petroleum & Minerals (NZP&M) Geodata
- **OCR Challenge Corpus:** Over 1,500 well files spanning 1955 to 2024. Contains typewritten 1960s carbon copies, dot-matrix morning reports, and scanned mud logs with heavy bleed-through, providing the ultimate stress test for document intelligence pipelines.

---

## 2. Python Subsurface Ecosystem & Tooling Matrix

```
                      PYTHON SUBSURFACE DATA PROCESSING STACK
                                           
        +---------------------------------------------------------------+
        |                     SUBSURFACE DATA INGESTION                 |
        +---------------------------------------------------------------+
                     |                         |                         |
                     v                         v                         v
        +-------------------------+ +-------------------------+ +-------------------------+
        |   Petrophysics & Logs   | |   Directional Surveys   | |   Interval Stratigraphy |
        |   `lasio` / `dlisio`    | |   `welleng` / `komle`   | |        `striplog`       |
        +-------------------------+ +-------------------------+ +-------------------------+
                     \                         |                         /
                      \                        |                        /
                       v                       v                       v
        +---------------------------------------------------------------+
        |                 CANONICAL DATA HARMONIZATION & QC             |
        |              `welly` Composite Well Model & Pandas            |
        +---------------------------------------------------------------+
                                           |
                                           v
        +---------------------------------------------------------------+
        |                 3D GEOLOGY & SPATIAL VISUALIZATION            |
        |     `PyVista` (3D Trajectory VTK) | `MapLibre GL JS` (2D GIS) |
        |     `GemPy` (Implicit 3D Subsurface Structural Modelling)     |
        +---------------------------------------------------------------+
```

### 2.1 Core Subsurface Libraries

| Library | Primary Data Format | Functional Capability | Role in NWIS Architecture |
| :--- | :--- | :--- | :--- |
| **`lasio`** | LAS 1.2, 2.0, 3.0 | Fast ASCII log parsing, auto-header extraction, null-value cleaning. | Parses offset petrophysical wireline curves into Pandas/NumPy arrays. |
| **`dlisio`** | DLIS, RP66 binary | High-performance C++ backend for complex binary borehole image logs and sonic arrays. | Extracts multi-dimensional array curves (FMI/XRMI image dips). |
| **`welly`** | LAS, CSV, Well objects | Geoscientific data quality control (QC), curve normalization, despiking. | Validates curve continuity and flags erroneous sensor spikes. |
| **`striplog`** | Discrete Intervals | Interval algebra (union, intersection), lithology stripping, SVG generation. | Manages stratigraphic formation tops and lithology intervals. |
| **`welleng`** | Survey CSV, WITSML | 3D Minimum Curvature Method, ISCWSA collision models, dogleg calculation. | Computes 3D wellbore trajectories and spatial offset distances. |
| **`komle`** | WITSML 1.3/1.4 XML | Translates WITSML XML objects into validated Python dictionaries. | Ingests real-time eRTMAC WITSML streaming feeds. |

### 2.2 3D Geospatial & Structural Modeling Tools
- **`PyVista` (VTK Python):** Renders high-performance 3D directional trajectories extruded as 3D tubes color-mapped to real-time ROP, mud weight, or alert severity. Renders 3D risk spheres around offset hazard points.
- **`GemPy`:** Calculates 3D implicit potential-field structural models from sparse offset formation tops and dip/azimuth vectors, predicting formation entry depths for new wells.
- **`MapLibre GL JS` / `PostGIS`:** WebGL-powered 2D GIS displaying wellheads, 5 km operational buffer zones, surface leases, and horizontal trajectories with sub-second responsiveness across 100,000+ well locations.

### 2.3 Document Intelligence Tools Benchmark

| Extraction Engine | Architecture | Scanned Bordered Tables | Borderless Narrative Logs | Key-Value Pairs | Speed (sec/page) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **IBM Docling** | TableFormer + DocLayNet | **96.4%** | **91.2%** | 88.5% | 1.8 s |
| **Surya** | Vision-Language Model | 92.1% | 89.0% | 85.2% | 2.5 s |
| **PaddleOCR** | SLA-Net Structure | 93.8% | 76.4% | 82.0% | **0.4 s** |
| **LayoutLMv3** | Multimodal Transformer | 85.0% | 82.5% | **97.8%** | 0.9 s |

---

## 3. Oil India Limited Reference Dataset: Verified In-Depth Audit

The sanitized reference package provided by Oil India Limited contains operational data for two key wells: **WX-07 (Location LOC-P3)** and **WX-11 (Location LOC-P9)**.

```
OIL INDIA SANITIZED REFERENCE PACKAGE
├── WX-07 (Location LOC-P3)
│   ├── DDDP_WX-07_LOC-P3_sanitised.pdf (Directional Drilling Decision Plan)
│   ├── Drilling_report_LOC-P3_sanitised.xlsx (44 Daily Drilling Reports)
│   └── WCR_WX-07_sanitised.docx (Well Completion Report: Tops, Bits, Mud, Losses)
└── WX-11 (Location LOC-P9)
    ├── DDDP_WX-11_LOC-P9_sanitised.pdf (Directional Drilling Decision Plan)
    ├── Drilling_report_LOC-P9_sanitised.xlsx (40 Daily Drilling Reports)
    └── WCR_WX-11_sanitised.docx (Well Completion Report: Tops, Bits, Mud, Losses)
```

### 3.1 Well Master Comparison & Operational Metrics

| Well Parameter | Well WX-07 (LOC-P3) | Well WX-11 (LOC-P9) | Operational Relevance |
| :--- | :--- | :--- | :--- |
| **Surface Coordinates** | Scaled map relative to LOC-P3 | Scaled map relative to LOC-P9 | Must preserve coordinate status as `SCALED_MAP` / `ESTIMATED`. |
| **Planned TD** | 1,140 m MD | 1,240 m MD | Deepest planned basement penetration. |
| **Actual Total Depth (TD)**| **1,147.0 m MD / 1,138.2 m TVD** | **1,237.0 m MD / 1,213.4 m TVD** | WX-11 drilled 90 m deeper; experienced deviation. |
| **Spud Date** | 12-Nov-2021 | 18-Jan-2022 | Sequential drilling campaign; WX-07 was offset to WX-11. |
| **Total Duration** | 44 Drilling Days | 40 Drilling Days | 84 total operational days across dataset. |
| **Basement Penetration** | Malani Igneous Suite (at 1,140 m) | Malani Igneous Suite (at 1,215 m) | 75 m formation top depth difference across locations. |

### 3.2 Verified Stratigraphic Formation Tops

Both wells penetrate the Rajasthan / Western Shelf succession comprising 10 distinct horizons:

| Canonical Formation | WX-07 Top MD (m) | WX-07 Top TVD (m) | WX-11 Top MD (m) | WX-11 Top TVD (m) | Depth Shift (Δ TVD) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Alluvium + Shumar** | Surface | Surface | Surface | Surface | 0 m |
| **Jaisalmer + Lathi** | 382.0 | 382.0 | 412.0 | 411.5 | +29.5 m |
| **Bap + Badhaura** | 474.0 | 473.8 | 510.0 | 508.2 | +34.4 m |
| **Upper Carbonate** | 486.0 | 485.6 | 524.0 | 522.0 | +36.4 m |
| **Nagaur Formation** | 785.0 | 783.2 | 842.0 | 836.5 | +53.3 m |
| **HEG Unit** | 948.0 | 944.5 | 1,012.0 | 1,001.2 | +56.7 m |
| **Bilara Formation** | 1,062.0 | 1,056.8 | 1,128.0 | 1,112.5 | +55.7 m |
| **Lower Bilara** | 1,088.0 | 1,082.4 | 1,154.0 | 1,137.8 | +55.4 m |
| **Jodhpur Sandstone** | 1,114.0 | 1,108.1 | 1,182.0 | 1,164.6 | +56.5 m |
| **Malani Igneous (Basement)**| 1,140.0 | 1,133.8 | 1,215.0 | 1,196.2 | +62.4 m |

**Critical Observation:** Formation tops in WX-11 are consistently **30 to 62 meters deeper** than in WX-07, indicating a clear structural dip and/or fault block downthrow between LOC-P3 and LOC-P9.

### 3.3 Historical Drilling Hazards Encountered in Reference Data
- **Lost Circulation in Bilara Carbonates:**
  - *Well WX-07:* Recorded partial mud losses (40 bbl) in the cavernous Bilara carbonate at 1,068 m MD.
  - *Well WX-11:* Experienced seepage and mud losses at the casing shoe (512 m) and through fractured dolomite intervals in Lower Bilara (1,158 m).
- **Tight Hole & Overpull Events:**
  - *Well WX-07:* Experienced 12 tonnes overpull in the Bap+Badhaura shales at 480 m during tripping.
  - *Well WX-11:* Recorded repeated severe tight hole (up to **20 tonnes overpull**) in the swelling Nagaur shales at 890 m MD, requiring 6 hours of back-reaming.

### 3.4 Excel Parser Traps Identified in Reference Workbooks
The WX-07 and WX-11 Excel workbooks demonstrate real-world layout variations that break naive parsers:
1. **Row Index Shifts:** In WX-07, the daily parameter table begins at Row 14; in WX-11, additional summary rows push the table start to Row 18. *Hardcoding cell coordinates (e.g., `B14`) causes complete parsing failure.*
2. **Inconsistent Column Labels:**
   - Standpipe Pressure is labeled `"SPP (psi)"` in WX-07 and `"Pump Pressure (psi)"` in WX-11.
   - Mud Weight is labeled `"Mud Wt (ppg)"` in WX-07 and `"Density (ppg)"` in WX-11.
   - Flow Rate is labeled `"GPM"` in WX-07 and `"Flow (GPM US)"` in WX-11.
3. **Merged Cell Free-Text Blocks:** Operational summaries span arbitrarily merged cells (`B45:F52`), requiring fuzzy label-alias dictionaries and cell-bounding scrapers.

---

## 4. Synthetic Offset Well Cluster Generation Framework

To benchmark NWIS’s multi-well correlation and alert engines against large fields (50–100+ wells), we implement a physics-based, geologically constrained synthetic simulation pipeline.

```
                      SYNTHETIC OFFSET CLUSTER GENERATION PIPELINE
                                           
        +---------------------------------------------------------------+
        | 1. Regional Structural Dip & Fault Framework (Geometry Engine)|
        |    z_pred = z_0 + dx * tan(dip_x) + dy * tan(dip_y) + Throw   |
        +---------------------------------------------------------------+
                                           |
                                           v
        +---------------------------------------------------------------+
        | 2. Markov Chain Stratigraphic Lithology Simulation            |
        |    Transition Matrix: P(L_{k+1} = j | L_k = i)                |
        +---------------------------------------------------------------+
                                           |
                                           v
        +---------------------------------------------------------------+
        | 3. Physics Parameter Simulation (Bingham ROP & Eaton PPFG)    |
        |    ROP = K * (WOB/D)^a * (RPM)^b * exp(-c * BitWear)          |
        +---------------------------------------------------------------+
                                           |
                                           v
        +---------------------------------------------------------------+
        | 4. Stochastic Hazard Injection Engine                         |
        |    - Poisson Mud Loss Rate: lambda(z) in Bilara Carbonates    |
        |    - Differential Sticking Prob: P(Stuck) = 1 - exp(-k * dP)  |
        +---------------------------------------------------------------+
                                           |
                                           v
        +---------------------------------------------------------------+
        | Yields: 100+ Synthetic Wells with Ground-Truth Provenance     |
        +---------------------------------------------------------------+
```

### 4.1 Structural Dip & Fault Plane Equations
For a synthetic offset well W_i placed at (x_i, y_i) relative to seed well W_0(x_0, y_0, z_0) with regional dip angle θ and dip azimuth φ:

Formula: z_pred, i = z_0 + (x_i - x_0) sinφ tanθ + (y_i - y_0) cosφ tanθ + ε_geol


If an active fault plane intersects the block with strike α_f and vertical throw T:

Formula: z_i = z_pred, i + T · H( (x_i - x_f)cosα_f - (y_i - y_f)sinα_f )


### 4.2 Rate of Penetration Simulation (Bingham Model)

Formula: ROP = K_m · ((WOB / D_bit))^a · (RPM)^b · e^-c · h_wear

Where K_m is formation drillability, and h_wear evolves via:

Formula: dh_weardt = κ · WOB · RPM · Abrasiveness


### 4.3 Stochastic Hazard Injection
- **Mud Loss Probability:** Modeled as a non-homogeneous Poisson process with rate λ_loss(z) that spikes when entering fractured Bilara carbonates or when ECD ≥ FG.
- **Differential Sticking Probability:**
  
Formula: P(Stuck) = 1 - exp( -β · Δ P_overbalance · A_contact · t_stationary )


This mathematical pipeline generates unlimited, structurally realistic synthetic well clusters, enabling exhaustive stress-testing of NWIS APIs, GIS spatial filters, and alert engines.

---
*Next Section: [05_PRODUCTION_SYSTEM_ARCHITECTURE_AND_TECHNICAL_BLUEPRINT.md](./05_PRODUCTION_SYSTEM_ARCHITECTURE_AND_TECHNICAL_BLUEPRINT.md)*
