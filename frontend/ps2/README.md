# Drill Well (eRTMAC-Drill Well) — Well Engineering Decision Support Platform

**Smart India Hackathon 2026 · Problem Statement 26121 · Oil India Limited (OIL)**

Standalone operational decision-support workstation running alongside the eRTMAC real-time monitoring infrastructure. Drill Well delivers deterministic institutional memory from offset (nearby, historical) wells to control-room engineers, drilling superintendents, and wellsite supervisors before operational hazards occur.

---

## 1. System Architecture & Engineering Principles

Drill Well is designed with the ergonomics of a specialized well-engineering workstation (Petrel, Techlog, WellView class) rather than a promotional web dashboard:
- **Calm, High-Density Information Hierarchy:** Optimized for control-room monitors (1440–1920 px) and ruggedized site tablets. Visual weight is concentrated on the 3D subsurface spatial view and the depth-aligned offset correlation tracks.
- **Honesty Layer (`app/lib/engineering/*`):** Zero simulated values presented as ground truth without clear provenance. Every depth, formation pick, and event carries an explicit extraction method, reference datum (MD vs TVD), and document citation.
- **Deterministic Alert Engine (Level-1):** Historical context warnings explicitly phrase observations as *"recorded precedent, not a prediction"*, eliminating hallucinated or unsupported ML forecasts while drilling.
- **Explainable Multi-Factor Similarity:** Weighted scoring across spatial proximity, stratigraphy overlap, depth trajectory, and event-type relevance with interactive weight adjustment and component breakdown.
- **Static Export Architecture:** Built with Next.js 16 App Router using `output: "export"` for offline deployment in remote drilling camps, air-gapped rigs, and internal OIL intranet networks.

---

## 2. Jobs to Be Done & Feature Modules

1. **Active Well Command Center (`/dashboard`):** Real-time monitoring context (active well WX-11 at 470 m MD), live hazard look-ahead window, interactive search radius selector (5–50 km), transparent Level-2 Risk Outlook index, and depth-correlated offset previews.
2. **Depth-Aligned Offset Correlation (`/compare`):** Multi-well tracks synchronized by depth cursor with an align-by toggle (Measured Depth vs Formation Top), showing formation intervals, lithological patterns, and shape+color hazard glyphs.
3. **Interactive Subsurface Map (`/map`):** High-performance MapLibre GL open-source vector map (OpenFreeMap Positron, MapLibre Demo, and OSM), dynamic GeoJSON context radius, and interactive wellhead markers.
4. **3D Subsurface Wellbore Workspace (`/subsurface`):** Three.js 3D viewport illustrating trajectory, formation stratigraphy, and spatial offset hazard spheres matched with light control overlays.
5. **New Well Placement Planner (`/planning`):** Directional well profile design (kick-off depth, build rate, target depth, survey uncertainty), anti-collision offset clearance verification, and 3D placement guidance.
6. **Faceted Knowledge & Document Search (`/search`, `/documents`):** Cross-well DDR/WCR search with deterministic summary generation, snippet citation preview, and document confidence metrics.
7. **Explainable Well Similarity (`/similar-wells`):** Interactive criteria weight tuner with real-time candidate ranking and component breakdown bars.
8. **Historical Context Alerts (`/alerts`):** State-filtered hazard warnings (`in-zone`, `ahead`, `passed`) with acknowledgement tracking and precedent event links.
9. **Engineering Observations (`/engineer`):** Rig engineer handover notes, status tracking, and observation creation drawer.

---

## 3. Design System & Accessibility

- **Palette:** Light workstation theme utilizing defined tokens:
  - Canvas `#F4F6F8`, Surface `#FFFFFF`, Surface Muted `#F8F9FB`
  - Lines `#E1E5EA`, Strong Line `#C8CED6`, Ink `#16202C`, Secondary Ink `#4A5565`
  - Accent / Primary `#1D4ED8`, Soft Accent `#EAF0FE`
  - Hazard Categories (dual color + shape encoding):
    - Mud loss: `#0072B2` (inverted triangle)
    - Stuck pipe / held-up: `#D55E00` (square)
    - Kick / influx: `#B3261E` (diamond)
    - Torque / tight hole: `#7B4FBF` (triangle)
    - Cementing / casing: `#9A6B00` (hexagon)
    - Other NPT: `#667085` (circle)
- **Typography:** IBM Plex Sans (`next/font/google`), strict `tabular-nums` for all engineering measurements, no micro-type under 12px, zero all-caps letter-spacing.
- **Charts:** Custom accessible SVG visualizations built with `d3-scale`, `d3-shape`, and `d3-array` adhering to IBM Carbon 3:1 data-viz contrast ratios, paired with table data fallbacks.

---

## 4. Verification & Guardrails

The repository enforces strict architectural and design guardrails:

```bash
# Run complete verification suite
npm run check

# Individual verification steps:
npm run check:3d       # Verifies frozen 3D SHA-256 hashes and data exports
npm run check:design   # Enforces zero design defects (micro-type, uppercase tracking, teal/dark surfaces, card-kit)
npm run typecheck      # TypeScript static check (0 errors)
npm run lint           # ESLint verification (0 warnings)
npm run test           # 43 automated unit & engineering domain tests
npm run build          # Static export build (18/18 static pages rendered)
```

---

## 5. Technology Stack

- **Framework:** Next.js 16.3.6 (App Router, static export `output: "export"`)
- **Runtime & UI:** React 19.2.8, TypeScript 5, Tailwind CSS v4 (@theme tokens)
- **3D Subsurface:** Three.js 0.186
- **Geospatial & Mapping:** MapLibre GL JS (open-source vector & raster mapping engine)
- **Data Visualization:** D3 Scale, D3 Shape, D3 Array
- **Icons:** Lucide React
