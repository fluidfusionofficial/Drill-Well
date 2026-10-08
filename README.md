<p align="center">
  <img src="https://img.shields.io/badge/SIH_2026-Problem_26121-FF6B35?style=for-the-badge&labelColor=1a1a2e" alt="SIH 2026" />
  <img src="https://img.shields.io/badge/Oil_India_Limited-Sponsor-0D7C66?style=for-the-badge&labelColor=1a1a2e" alt="OIL" />
  <img src="https://img.shields.io/badge/Team-Fluid_Fusion-1D4ED8?style=for-the-badge&labelColor=1a1a2e" alt="Team" />
</p>

<h1 align="center">
  🛢️ Drill Well
</h1>

<h3 align="center">
  <strong>Nearby Wells Intelligence System</strong>
</h3>

<p align="center">
  <em>AI-powered offset-well knowledge platform for Oil India Limited</em><br/>
  <strong>"eRTMAC shows what is happening. Drill Well remembers what happened."</strong>
</p>

---

<br/>

## 🎯 The Problem — Why Drillers Fly Blind

<table>
<tr>
<td width="50%">

### ❌ Today (Without Drill Well)
```
Driller hits 2,800m → torque spikes

"Has any nearby well seen this before?"

⏳ Hours of digging through paper WCRs
📄 Hundreds of scanned PDFs from 1970s–2025
🧠 Knowledge locked in retiring veterans
💰 Rig burns ₹12–38 Lakh/day waiting

→ Delayed decision → NPT → Catastrophic failure
```

</td>
<td width="50%">

### ✅ With Drill Well
```
Driller approaches 2,800m

🔔 ALERT appears automatically:

  "RECORDED PRECEDENT: Well WX-07
   (840m NW) lost 40 bbl mud at
   1,068m MD in Bilara Formation.
   MW: 10.4 ppg"

   📎 [Click → Original WCR Page 12]

→ Warned BEFORE the hazard → Zero NPT
```

</td>
</tr>
</table>

> **ROI:** Preventing just **one stuck pipe event** per campaign saves Oil India **₹30 Lakh – ₹2.5 Crore** — paying for the entire system instantly.

<br/>

## 💡 Core Innovation

<table>
<tr>
<td align="center" width="25%">
<h3>🔍</h3>
<strong>Zero Black Box</strong><br/>
<sub>Every alert links to the exact document, page, table, and verbatim text. Engineers trust what they can verify.</sub>
</td>
<td align="center" width="25%">
<h3>📐</h3>
<strong>5D Similarity</strong><br/>
<sub>Wells ranked by Spatial + Geology + Depth + Mud System + Hazard History — not just distance.</sub>
</td>
<td align="center" width="25%">
<h3>🧠</h3>
<strong>Semantic Parsing</strong><br/>
<sub>Excel DDRs parsed by label, not row number. Handles layout variations across decades of reports.</sub>
</td>
<td align="center" width="25%">
<h3>🇮🇳</h3>
<strong>100% Sovereign</strong><br/>
<sub>Fully on-premise. Docker containerized. No foreign cloud dependency. MoPNG compliant.</sub>
</td>
</tr>
</table>

<br/>

## 🏗️ System Architecture

```
                              ┌─────────────────────────┐
                              │    DRILLING ENGINEER     │
                              │   (Final Decision Maker) │
                              └───────────┬─────────────┘
                                          │
                    ┌─────────────────────┴──────────────────────┐
                    │        DRILL WELL WEB APPLICATION           │
                    │         Next.js 16 · TypeScript · React 19 │
                    │                                            │
                    │  ┌────────┐ ┌──────────┐ ┌──────────────┐ │
                    │  │ GIS Map│ │Depth View│ │ Alert Feed   │ │
                    │  │MapLibre│ │ D3 + SVG │ │ Evidence-    │ │
                    │  │  GL JS │ │Correlated│ │ backed cards │ │
                    │  └────────┘ └──────────┘ └──────────────┘ │
                    └─────────────────────┬──────────────────────┘
                                          │ REST API
                    ┌─────────────────────┴──────────────────────┐
                    │        DRILL WELL BACKEND SERVICE            │
                    │         FastAPI · Python 3.12 · Async       │
                    │                                             │
                    │  ┌──────────┐ ┌──────────┐ ┌────────────┐  │
                    │  │Ingestion │ │Similarity│ │   Alert    │  │
                    │  │ Pipeline │ │  Engine  │ │  Engine    │  │
                    │  │OCR·NLP·  │ │5D Scored │ │ L1: Rules  │  │
                    │  │LabAlias  │ │Explainabl│ │ L2: Stats  │  │
                    │  └──────────┘ └──────────┘ └────────────┘  │
                    └──────────┬──────────┬──────────┬───────────┘
                               │          │          │
                    ┌──────────┴┐  ┌──────┴───┐  ┌──┴──────────┐
                    │PostgreSQL │  │ pgvector  │  │   Object    │
                    │ + PostGIS │  │ Embeddings│  │   Storage   │
                    │ 22 Tables │  │  Semantic │  │ Source Docs │
                    └───────────┘  └──────────┘  └─────────────┘
```

<br/>

## 🔬 How It Works — The Demo Flow

```
 Step 1                Step 2                 Step 3                Step 4
┌──────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ Open Map │      │ See Offset   │      │ Bit Enters   │      │ Click Alert  │
│ Select   │ ───► │ WX-07 is     │ ───► │ Bilara Fm    │ ───► │ See EXACT    │
│ WX-11    │      │ 840m NW      │      │ 🔔 ALERT!    │      │ WCR page 12  │
│ (Active) │      │ 55m dip shift│      │ Mud loss     │      │ Table 4.2    │
└──────────┘      └──────────────┘      │ precedent    │      │ Confidence   │
                                        └──────────────┘      │ 0.98         │
                                                              └──────────────┘
                                                                     │
                                                                     ▼
                                                              ┌──────────────┐
                                                              │ Engineer     │
                                                              │ DECIDES with │
                                                              │ full evidence│
                                                              └──────────────┘
```

<br/>

## 📊 What Sets Drill Well Apart

| Capability | SLB DrillOps | Halliburton | Corva.ai | **Drill Well** |
|:-----------|:---:|:---:|:---:|:---:|
| Unstructured PDF/WCR OCR Ingestion | ❌ | ❌ | ❌ | ✅ |
| Clickable Source Provenance | ❌ | ❌ | Partial | ✅ **100%** |
| Explainable Multi-Factor Similarity | ❌ | ❌ | Partial | ✅ **5D** |
| Evidence-Based Precedent Alerts | ❌ | ❌ | ❌ | ✅ |
| Indian Data Sovereignty (On-Prem) | ❌ | ❌ | ❌ | ✅ |
| Zero Vendor Lock-In | ❌ | ❌ | ❌ | ✅ |

<br/>

## 🛡️ Engineering Guardrails

These are **non-negotiable**. Violating them breaks the trust model.

| Rule | Why |
|:-----|:----|
| **Provenance is mandatory** | Every fact → source doc, page, table, confidence |
| **MD ≠ TVD** | System refuses depth conversion without survey data |
| **Planned ≠ Actual** | Prognosed / Sample / Wireline stored separately, never overwritten |
| **Advisory only** | "Recorded precedent" — never "this will happen" |
| **No invented data** | Missing = null with reason, never fabricated |
| **No hardcoded rows** | Parsers find fields by label (WX-07 row 14 ≠ WX-11 row 18) |

<br/>

## 🧰 Tech Stack

<p>
<img src="https://img.shields.io/badge/Next.js_16-black?style=flat-square&logo=next.js" />
<img src="https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black" />
<img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/Tailwind_4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" />
<img src="https://img.shields.io/badge/Three.js-000?style=flat-square&logo=three.js" />
<img src="https://img.shields.io/badge/D3.js-F9A03C?style=flat-square&logo=d3.js&logoColor=black" />
<img src="https://img.shields.io/badge/MapLibre_GL-396CB2?style=flat-square" />
</p>
<p>
<img src="https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white" />
<img src="https://img.shields.io/badge/Python_3.12-3776AB?style=flat-square&logo=python&logoColor=white" />
<img src="https://img.shields.io/badge/PostgreSQL_16-4169E1?style=flat-square&logo=postgresql&logoColor=white" />
<img src="https://img.shields.io/badge/PostGIS-5CAE58?style=flat-square" />
<img src="https://img.shields.io/badge/pgvector-FF6F00?style=flat-square" />
<img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" />
</p>
<p>
<img src="https://img.shields.io/badge/scikit--learn-F7931E?style=flat-square&logo=scikit-learn&logoColor=white" />
<img src="https://img.shields.io/badge/XGBoost-FF6600?style=flat-square" />
<img src="https://img.shields.io/badge/spaCy-09A3D5?style=flat-square&logo=spacy&logoColor=white" />
<img src="https://img.shields.io/badge/PaddleOCR-0062B0?style=flat-square" />
</p>

<br/>

## 📁 Repository Structure

```
drill-well/
├── frontend/ps2/              ← Next.js 16 application
│   ├── app/
│   │   ├── dashboard/         ← Command center
│   │   ├── map/               ← GIS well explorer
│   │   ├── compare/           ← Dual-well correlation
│   │   ├── subsurface/        ← 3D wellbore view
│   │   ├── alerts/            ← Precedent alert feed
│   │   ├── search/            ← Knowledge search
│   │   ├── similar-wells/     ← 5D similarity engine
│   │   ├── evidence/          ← Source provenance viewer
│   │   ├── planning/          ← Well placement planner
│   │   └── lib/engineering/   ← Core engineering logic
│   │       ├── alerts.ts      ← Level 1 deterministic engine
│   │       ├── similarity.ts  ← 5D explainable scoring
│   │       ├── depth.ts       ← MD/TVD type safety
│   │       ├── units.ts       ← Unit normalization
│   │       └── provenance.ts  ← Source traceability
│   └── tests/                 ← 43 engineering tests
│
├── backend/                   ← FastAPI service
│   ├── app/
│   │   ├── models/            ← 22-table PostgreSQL schema
│   │   ├── api/               ← 17 REST endpoints
│   │   ├── services/
│   │   │   ├── ingestion/     ← 11-step document pipeline
│   │   │   ├── normalization/ ← Units, depths, formations
│   │   │   ├── similarity.py  ← 5D ranking engine
│   │   │   └── alerts.py      ← 3-level alert engine
│   │   └── seed/              ← Reference data seeder
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── ml/                        ← ML pipeline
│   ├── models/                ← Event classifier, anomaly detector
│   ├── features/              ← Feature store
│   └── training/              ← Training + evaluation scripts
│
└── Oil India ltd dataset/     ← Sanitized reference data
    ├── WX-07 (LOC-P3)        ← 44-day drilling campaign
    └── WX-11 (LOC-P9)        ← 40-day drilling campaign
```

<br/>

## 🚀 Quick Start

```bash
# Frontend (static export — works offline)
cd frontend/ps2
npm install
npm run dev                              # → http://localhost:3000

# Backend
cd backend
docker-compose up -d                     # PostgreSQL + Redis
pip install -r requirements.txt
python -m app.seed.seed_reference_data   # Seed WX-07 + WX-11 data
uvicorn app.main:app --reload            # → http://localhost:8000

# Verify
npm run check                            # Frontend: types + lint + 43 tests + build
pytest                                   # Backend: 5 test suites
```

<br/>

## 📈 Impact Metrics

<table>
<tr>
<td align="center" width="25%">
<h2>₹2.5Cr</h2>
<sub>Saved per prevented<br/>stuck pipe event</sub>
</td>
<td align="center" width="25%">
<h2>84</h2>
<sub>Daily reports ingested<br/>from 2 reference wells</sub>
</td>
<td align="center" width="25%">
<h2>22</h2>
<sub>Canonical database<br/>tables (PostGIS)</sub>
</td>
<td align="center" width="25%">
<h2>100%</h2>
<sub>Provenance coverage<br/>on every data point</sub>
</td>
</tr>
</table>

<br/>

## 👥 Team Fluid Fusion

Built for **Smart India Hackathon 2026** · Problem Statement **SIH26121**  
Category: **Software** · Theme: **Smart Automation**  
Sponsoring Organization: **Oil India Limited (OIL)**

---

<p align="center">
  <sub><strong>Drill Well is decision support. The drilling engineer is always the final decision-maker.</strong></sub>
</p>
