# Changelog — NWIS Decision Support Platform

All notable changes and architectural engineering decisions for the NWIS (eRTMAC-NWIS) platform (Smart India Hackathon 2026, Problem Statement 26121, Oil India Limited).

---

## [2.0.0] - 2026-09-29

### Complete Engineering Workstation Overhaul

#### 1. Design System & Token Architecture
- **Eliminated AI-prototype aesthetic:** Purged dark navy background, teal-tinted chrome, glassy backdrop blur, glowing borders, card-kit styling, and letter-spaced uppercase labels.
- **Engineered Light Workstation Theme:** Configured Tailwind CSS v4 `@theme` with precise tokens: Canvas (`#F4F6F8`), Surface (`#FFFFFF`), Lines (`#E1E5EA`), Strong Line (`#C8CED6`), Ink (`#16202C`), Primary Accent (`#1D4ED8`), and Semantic Status tiers.
- **Universal Dual-Coded Hazard Taxonomy:** Implemented `EventGlyph` and `EventTypeLegend` providing color + shape encoding for all 6 petroleum engineering hazard categories (Mud loss, Stuck pipe, Kick, Torque/Tight hole, Cementing, Other NPT).
- **Control-Room Typography:** Standardized on IBM Plex Sans with tabular numeral formatting (`tabular-nums`) across all numeric displays and eliminated all micro-typography under 12px.
- **Verification Guarantee:** Achieved 0 design defects across all 5 verification rules in `scripts/check-design.mjs`.

#### 2. Engineering Honesty Layer (`lib/engineering/*`)
- **Level-1 Historical Precedent Alert Engine (`alerts.ts`):**
  - Formulated deterministic precedent detection with explicit wording: *"recorded precedent, not a prediction"*.
  - Added state evaluation (`in-zone`, `ahead`, `passed`) based on active bit depth and approach window.
  - Resolved sorting logic bug where depth delta calculation was previously evaluating to 0.
- **Level-2 Transparent Risk Outlook (`risk.ts`):**
  - Built explainable 0–100 risk score based on proximity weighting, hazard severity, and offset density within the user-defined search radius.
- **Deterministic Extended Dataset (`fixtures/extended-dataset.ts`):**
  - Added 12 deterministic offset wells within a 30 km radius (BGD-01 to BGD-12) with full document and extraction provenance.
- **Active Well Setting:** Set initial active well WX-11 depth to 470 m MD (above the 507–544 m Upper Carbonate hazard interval) so that approaching hazards correctly trigger in the look-ahead window.

#### 3. Command Center & Specialized Modules
- **Command Center (`app/dashboard/page.tsx`):**
  - Rebuilt with Active Well Strip (C1), Risk Outlook Panel (C2), Radius & Look-ahead Controller (C3), Quick Filters (C4), Depth-Correlated Track (C5), Dynamic CARTO Map (C6), Offset Wells Table (C7), Live Precedent Alerts Feed (C8), Recent Engineering Notes (C9), and Data Provenance Summary (C10).
- **Depth-Aligned Offset Comparison (`app/compare/page.tsx`):**
  - Built multi-track log correlation panel with Measured Depth vs Formation Top alignment toggles, depth cursor synchronization, and lithology pattern fills.
- **3D Subsurface & Placement Planning:**
  - Preserved 100% byte-for-byte frozen scene logic above return lines in `subsurface-scene.tsx` and `planning-3d-guidance.tsx`.
  - Re-engineered overlays with clean light panels, radius-6 borders, and tabular depth readouts.
- **Faceted Knowledge Search & Document Ingestion (`app/search`, `app/documents`):**
  - Cross-well document querying with deterministic summary synthesis and snippet citations.
  - Client-side document parsing with extraction confidence badges.
- **Explainable Well Similarity (`app/similar-wells`):**
  - Live criteria weight configurator with real-time candidate re-ranking and component contribution bars.

#### 4. Automated Testing & Compliance
- Extended automated unit tests in `tests/engineering.test.mjs` and `tests/risk.test.mjs` to 43 passing tests.
- Static export build passes cleanly with 18/18 static pages prerendered.
- Preserved CRLF line endings across all repository source files.
