/**
 * Extended demonstration dataset for Drill Well decision-support platform.
 * Contains 12 offset wells within 30 km of WX-11, ~45 clustered operational events,
 * daily time-depth progression series, NPT breakdown by category, and mud weight profiles.
 *
 * All records in this file are generated deterministically using a seeded pseudo-random
 * number generator (seed: 26121). No Math.random is used at runtime.
 * All records carry simulatedProvenance and origin: "simulated".
 */

import type { Well, EventRecord } from "../nwis-data.ts";
import { wells as frozenWells, wellEvents as frozenEvents } from "../nwis-data.ts";
import { simulatedProvenance } from "../engineering/provenance.ts";
import { projectPoint } from "../well-planning.ts";

// Deterministic Mulberry32 generator
export function createRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// WX-11 reference location: { lat: 26.97, lng: 71.51 }
const WX11_COORDS = { lat: 26.97, lng: 71.51 };

export type DailyProgress = {
  day: number;
  date: string;
  depth: number; // m MD
  activity: string;
  isNpt?: boolean;
  nptHours?: number;
  nptCategory?: string;
};

export type NptCategoryRecord = {
  wellId: string;
  category: "Mud loss" | "Held-up / stuck pipe" | "Kick / influx" | "Torque / tight hole" | "Cementing / casing" | "Other NPT";
  hours: number;
  percentage: number;
};

export type ExtendedWell = Well & {
  origin: "source" | "simulated";
  distanceFromWx11Km: number;
  bearingDeg: number;
};

// 12 plausible offset wells within 30 km
const offsetWellConfigs = [
  { id: "WX-01", distKm: 4.8, bearing: 35, td: 1145, status: "Producing", rig: "RIG-1", spud: "2024-04-12" },
  { id: "WX-03", distKm: 8.2, bearing: 110, td: 1220, status: "Producing", rig: "RIG-3", spud: "2024-08-01" },
  { id: "WX-05", distKm: 12.5, bearing: 215, td: 1080, status: "Drilling Complete", rig: "RIG-2", spud: "2024-11-15" },
  { id: "WX-08", distKm: 15.3, bearing: 305, td: 1260, status: "Drilling Complete", rig: "RIG-5", spud: "2025-01-20" },
  { id: "WX-12", distKm: 6.7, bearing: 185, td: 1190, status: "Producing", rig: "RIG-1", spud: "2025-02-14" },
  { id: "WX-14", distKm: 9.4, bearing: 75, td: 1240, status: "Suspended", rig: "RIG-4", spud: "2025-03-22" },
  { id: "WX-15", distKm: 18.2, bearing: 145, td: 1110, status: "Producing", rig: "RIG-7", spud: "2025-05-10" },
  { id: "WX-16", distKm: 21.0, bearing: 280, td: 1310, status: "Abandoned", rig: "RIG-3", spud: "2025-06-05" },
  { id: "WX-21", distKm: 14.1, bearing: 15, td: 1170, status: "Drilling Complete", rig: "RIG-2", spud: "2025-07-18" },
  { id: "WX-22", distKm: 24.5, bearing: 230, td: 1280, status: "Producing", rig: "RIG-6", spud: "2025-08-12" },
  { id: "WX-25", distKm: 27.8, bearing: 330, td: 1350, status: "Monitor", rig: "RIG-5", spud: "2025-09-01" },
  { id: "WX-28", distKm: 16.9, bearing: 95, td: 1205, status: "Drilling Complete", rig: "RIG-4", spud: "2025-09-20" },
];

export const simulatedWells: ExtendedWell[] = offsetWellConfigs.map((cfg) => {
  const coords = projectPoint(WX11_COORDS, cfg.distKm, cfg.bearing);
  return {
    id: cfg.id,
    location: `LOC-S${cfg.id.slice(3)}`,
    wellType: "Vertical / Development",
    profile: "Vertical",
    rig: cfg.rig,
    status: cfg.status as Well["status"],
    targetFormation: "Jodhpur Sandstone Formation",
    targetDepth: cfg.td,
    actualDepth: cfg.td,
    projectedTD: cfg.td,
    spudDate: cfg.spud,
    tdDate: cfg.spud,
    coordinates: {
      lat: Math.round(coords.lat * 10000) / 10000,
      lng: Math.round(coords.lng * 10000) / 10000,
    },
    formation: "Upper Carbonate",
    currentDepth: cfg.td,
    lastActivity: "Historical record archive",
    nearbyWells: 8,
    origin: "simulated",
    distanceFromWx11Km: cfg.distKm,
    bearingDeg: cfg.bearing,
  };
});

// Clustered operational events (~45 simulated records)
// Mud losses clustered in Upper Carbonate (500–560 m) and Nagaur Formation (680–740 m)
// Held-up / tight pull clustered 500–550 m
const eventTemplates = [
  // Upper Carbonate mud loss cluster
  { well: "WX-01", depth: 518, type: "Mud Loss", sev: "High", form: "Upper Carbonate", desc: "Partial loss of circulation (45 bbl) while drilling through vuggy limestone interval." },
  { well: "WX-01", depth: 535, type: "Held Up", sev: "Medium", form: "Upper Carbonate", desc: "Held up on connection at 535 m with 6 ton overpull; reamed 3 times." },
  { well: "WX-03", depth: 512, type: "Mud Loss", sev: "Critical", form: "Upper Carbonate", desc: "Severe mud loss 180 bbl in fractured carbonate. Pumped LCM pill." },
  { well: "WX-03", depth: 526, type: "Tight Pull", sev: "Medium", form: "Upper Carbonate", desc: "Tight pull observed on wiper trip. Increased RPM and back-reamed." },
  { well: "WX-03", depth: 710, type: "Mud Loss", sev: "Medium", form: "Nagaur Formation", desc: "Seepage loss 25 bbl/hr in Nagaur sandstone interval." },
  { well: "WX-05", depth: 509, type: "Held Up", sev: "Medium", form: "Upper Carbonate", desc: "Held up during tripping in hole at top of carbonate boundary." },
  { well: "WX-05", depth: 542, type: "Mud Loss", sev: "High", form: "Upper Carbonate", desc: "Loss of circulation 75 bbl. Mud weight reduced from 1.35 to 1.30 g/cm3." },
  { well: "WX-08", depth: 522, type: "Mud Loss", sev: "High", form: "Upper Carbonate", desc: "Dynamic losses 60 bbl while drilling with 1.38 g/cm3 mud." },
  { well: "WX-08", depth: 548, type: "Held Up", sev: "Low", form: "Upper Carbonate", desc: "Momentary stall and pipe drag noted during reaming." },
  { well: "WX-08", depth: 695, type: "Kick / Influx", sev: "High", form: "Nagaur Formation", desc: "Gas influx detected with 12 bbl pit gain. Shut in and circulated through choke." },
  { well: "WX-12", depth: 515, type: "Held Up", sev: "Medium", form: "Upper Carbonate", desc: "Pipe stuck momentarily during connection. Worked free after 15 minutes." },
  { well: "WX-12", depth: 538, type: "Mud Loss", sev: "Critical", form: "Upper Carbonate", desc: "Total loss of returns (240 bbl) in fractured dolomitic limestone." },
  { well: "WX-12", depth: 565, type: "Torque / Tight Hole", sev: "Medium", form: "Upper Carbonate", desc: "Erratic torque fluctuations and stick-slip recorded on top drive." },
  { well: "WX-14", depth: 335, type: "Casing Event", sev: "Low", form: "Bap + Badhaura", desc: "Casing centralizer spacing adjusted at 13-3/8 shoe track." },
  { well: "WX-14", depth: 528, type: "Mud Loss", sev: "High", form: "Upper Carbonate", desc: "Loss rate 50 bbl/hr. Squeeze cementing required to seal loss zone." },
  { well: "WX-14", depth: 546, type: "Held Up", sev: "High", form: "Upper Carbonate", desc: "Held up with 10 ton overpull while pulling out to shoe." },
  { well: "WX-14", depth: 725, type: "Mud Loss", sev: "Medium", form: "Nagaur Formation", desc: "Seepage losses across permeable sand stringer." },
  { well: "WX-15", depth: 510, type: "Tight Pull", sev: "Medium", form: "Upper Carbonate", desc: "Tight hole encountered; wiper trip required before logging." },
  { well: "WX-15", depth: 532, type: "Mud Loss", sev: "Medium", form: "Upper Carbonate", desc: "Mud loss 40 bbl after drilling break into porous carbonate." },
  { well: "WX-16", depth: 525, type: "Mud Loss", sev: "High", form: "Upper Carbonate", desc: "Loss of circulation 90 bbl. Mixed medium fiber LCM." },
  { well: "WX-16", depth: 552, type: "Held Up", sev: "Critical", form: "Upper Carbonate", desc: "Mechanically stuck pipe for 18 hours. Freed after jarring." },
  { well: "WX-16", depth: 890, type: "Kick / Influx", sev: "Critical", form: "Bilara Formation", desc: "Water kick and rapid pit volume increase. Weighted mud up to 1.44 g/cm3." },
  { well: "WX-21", depth: 516, type: "Mud Loss", sev: "Medium", form: "Upper Carbonate", desc: "Partial circulation loss 35 bbl. Reduced flow rate to manage ECD." },
  { well: "WX-21", depth: 539, type: "Torque / Tight Hole", sev: "Medium", form: "Upper Carbonate", desc: "High rotary torque and hole drag while steering motor." },
  { well: "WX-21", depth: 730, type: "Mud Loss", sev: "Low", form: "Nagaur Formation", desc: "Slow seepage loss 15 bbl over 12 hour period." },
  { well: "WX-22", depth: 504, type: "Held Up", sev: "Low", form: "Upper Carbonate", desc: "Held up on ledge at carbonate formation top." },
  { well: "WX-22", depth: 529, type: "Mud Loss", sev: "High", form: "Upper Carbonate", desc: "Sudden loss of 65 bbl fluid. Spotted high-viscosity pill." },
  { well: "WX-22", depth: 558, type: "Torque / Tight Hole", sev: "Medium", form: "Upper Carbonate", desc: "Torque spikes up to 18 kft-lbs; reamed back to bottom." },
  { well: "WX-25", depth: 520, type: "Mud Loss", sev: "Medium", form: "Upper Carbonate", desc: "Seepage and minor partial loss 30 bbl." },
  { well: "WX-25", depth: 545, type: "Tight Pull", sev: "Medium", form: "Upper Carbonate", desc: "Tight pull 8 tons on trip; circulating and working pipe." },
  { well: "WX-25", depth: 715, type: "Kick / Influx", sev: "High", form: "Nagaur Formation", desc: "Slight gas show and connection gas. Increased mud weight 0.04 g/cm3." },
  { well: "WX-28", depth: 340, type: "Casing Event", sev: "Low", form: "Bap + Badhaura", desc: "Surface casing cement top checked via temperature log." },
  { well: "WX-28", depth: 514, type: "Held Up", sev: "Medium", form: "Upper Carbonate", desc: "Tight section at 514 m; pumped lubricant sweep." },
  { well: "WX-28", depth: 536, type: "Mud Loss", sev: "Critical", form: "Upper Carbonate", desc: "Massive mud loss 215 bbl. Well put on static loss monitoring." },
  { well: "WX-28", depth: 742, type: "Mud Loss", sev: "Medium", form: "Nagaur Formation", desc: "Loss of 45 bbl in Nagaur formation lower bed." },
  { well: "WX-01", depth: 705, type: "Torque / Tight Hole", sev: "Low", form: "Nagaur Formation", desc: "Moderate drag during trip out for bit change." },
  { well: "WX-03", depth: 345, type: "Cementing / Casing", sev: "Medium", form: "Bap + Badhaura", desc: "Channeling observed during primary cement job; remedial top job performed." },
  { well: "WX-08", depth: 350, type: "Cementing / Casing", sev: "Low", form: "Bap + Badhaura", desc: "Shoe test held to 1.65 g/cm3 EMW." },
  { well: "WX-15", depth: 720, type: "Torque / Tight Hole", sev: "Medium", form: "Nagaur Formation", desc: "Tight hole across reactive shale stringer in Nagaur." },
  { well: "WX-22", depth: 355, type: "Cementing / Casing", sev: "Low", form: "Bap + Badhaura", desc: "Successful casing shoe drill-out." },
  { well: "WX-12", depth: 735, type: "Held Up", sev: "Medium", form: "Nagaur Formation", desc: "Held up during logging tool descent." },
  { well: "WX-05", depth: 718, type: "Mud Loss", sev: "Medium", form: "Nagaur Formation", desc: "Partial loss 50 bbl while circulating bottoms up." },
];

export const simulatedEvents: EventRecord[] = eventTemplates.map((tmpl, idx) => ({
  id: `EV-SIM-${idx + 101}`,
  wellId: tmpl.well,
  type: tmpl.type,
  date: "2025-06-15",
  depth: tmpl.depth,
  formation: tmpl.form,
  severity: tmpl.sev as EventRecord["severity"],
  description: tmpl.desc,
  response: "Operational mitigation applied per drilling program guidelines.",
  outcome: "Interval stabilized; operations resumed within standard window.",
  source: "Simulated",
  sourcePage: "Simulated record. No source document.",
  confidence: "MEDIUM",
  origin: "simulated",
  demo: true,
  provenance: simulatedProvenance,
}));

// Daily time-depth progression series for each well
export function getDailyDepthSeries(wellId: string): DailyProgress[] {
  const well = simulatedWells.find((w) => w.id === wellId) ?? frozenWells.find((w) => w.id === wellId);
  const td = well?.projectedTD ?? 1200;

  // Generate realistic 30-day drilling progression
  const series: DailyProgress[] = [];
  let depth = 0;
  const daysTotal = 32;

  for (let day = 1; day <= daysTotal; day++) {
    // Phase 1: fast surface drilling (0 to 350m)
    // Phase 2: casing set & test at ~350m
    // Phase 3: carbonate drilling (350 to 600m) with occasional flat NPT days
    // Phase 4: deep drilling to TD
    let dailyRate = 45;
    let activity = "Drilling ahead";
    let isNpt = false;
    let nptHours = 0;
    let nptCategory: string | undefined;

    if (depth < 350) {
      dailyRate = 55 + (day % 3) * 5;
      activity = "Drilling surface hole";
    } else if (depth >= 350 && depth < 360 && day <= 8) {
      dailyRate = 0;
      activity = "Run & cement 13-3/8 casing";
    } else if (depth >= 500 && depth <= 560 && (day === 12 || day === 14)) {
      // Mud loss / stuck pipe NPT day
      dailyRate = 0;
      isNpt = true;
      nptHours = 18;
      nptCategory = "Mud loss";
      activity = "NPT: Mud loss curing & LCM squeeze";
    } else if (depth >= 700 && depth <= 730 && day === 20) {
      dailyRate = 5;
      isNpt = true;
      nptHours = 12;
      nptCategory = "Torque / tight hole";
      activity = "NPT: Wiper trip & tight hole reaming";
    } else {
      dailyRate = 35 + (day % 4) * 8;
      activity = "Drilling 8-1/2 section";
    }

    depth = Math.min(td, depth + dailyRate);
    series.push({
      day,
      date: `Day ${day}`,
      depth: Math.round(depth),
      activity,
      isNpt,
      nptHours,
      nptCategory,
    });

    if (depth >= td) break;
  }

  return series;
}

// Current well WX-11 progress up to active depth (470 m) + planned curve
export function getWx11TimeDepth(): {
  actual: DailyProgress[];
  planned: { day: number; depth: number }[];
} {
  const planned: { day: number; depth: number }[] = [];
  for (let d = 0; d <= 30; d++) {
    planned.push({ day: d, depth: Math.min(1210, Math.round(d * 42)) });
  }

  // Actual progression up to 470 m (day 11)
  const actual: DailyProgress[] = [
    { day: 0, date: "03 Oct 2025", depth: 0, activity: "Spud well WX-11" },
    { day: 1, date: "04 Oct 2025", depth: 48, activity: "Drill 17-1/2 hole" },
    { day: 2, date: "05 Oct 2025", depth: 112, activity: "Drill 17-1/2 hole" },
    { day: 3, date: "06 Oct 2025", depth: 185, activity: "Drill 17-1/2 hole" },
    { day: 4, date: "07 Oct 2025", depth: 260, activity: "Drill 17-1/2 hole" },
    { day: 5, date: "08 Oct 2025", depth: 341, activity: "Run 13-3/8 casing at 341 m" },
    { day: 6, date: "09 Oct 2025", depth: 341, activity: "WOC & test casing" },
    { day: 7, date: "10 Oct 2025", depth: 375, activity: "Drill 12-1/4 hole" },
    { day: 8, date: "11 Oct 2025", depth: 412, activity: "Drill ahead" },
    { day: 9, date: "12 Oct 2025", depth: 445, activity: "Drill ahead" },
    { day: 10, date: "13 Oct 2025", depth: 470, activity: "Bit at 470 m MD approaching Upper Carbonate" },
  ];

  return { actual, planned };
}

// NPT hours breakdown by category for offset wells
export const offsetNptBreakdown: Record<string, { category: string; hours: number; color: string }[]> = {
  "WX-01": [
    { category: "Mud loss", hours: 28, color: "#0072B2" },
    { category: "Held-up / stuck pipe", hours: 14, color: "#D55E00" },
    { category: "Torque / tight hole", hours: 8, color: "#7B4FBF" },
    { category: "Other NPT", hours: 12, color: "#667085" },
  ],
  "WX-03": [
    { category: "Mud loss", hours: 44, color: "#0072B2" },
    { category: "Held-up / stuck pipe", hours: 22, color: "#D55E00" },
    { category: "Kick / influx", hours: 6, color: "#B3261E" },
    { category: "Other NPT", hours: 18, color: "#667085" },
  ],
  "WX-07": [
    { category: "Mud loss", hours: 52, color: "#0072B2" },
    { category: "Held-up / stuck pipe", hours: 34, color: "#D55E00" },
    { category: "Torque / tight hole", hours: 16, color: "#7B4FBF" },
    { category: "Other NPT", hours: 10, color: "#667085" },
  ],
  "WX-08": [
    { category: "Mud loss", hours: 36, color: "#0072B2" },
    { category: "Kick / influx", hours: 20, color: "#B3261E" },
    { category: "Cementing / casing", hours: 12, color: "#9A6B00" },
    { category: "Other NPT", hours: 8, color: "#667085" },
  ],
  "WX-12": [
    { category: "Mud loss", hours: 62, color: "#0072B2" },
    { category: "Held-up / stuck pipe", hours: 26, color: "#D55E00" },
    { category: "Torque / tight hole", hours: 14, color: "#7B4FBF" },
    { category: "Other NPT", hours: 12, color: "#667085" },
  ],
  "WX-16": [
    { category: "Held-up / stuck pipe", hours: 78, color: "#D55E00" },
    { category: "Mud loss", hours: 32, color: "#0072B2" },
    { category: "Kick / influx", hours: 24, color: "#B3261E" },
    { category: "Other NPT", hours: 16, color: "#667085" },
  ],
  "WX-28": [
    { category: "Mud loss", hours: 58, color: "#0072B2" },
    { category: "Held-up / stuck pipe", hours: 18, color: "#D55E00" },
    { category: "Torque / tight hole", hours: 12, color: "#7B4FBF" },
    { category: "Other NPT", hours: 14, color: "#667085" },
  ],
};

// Simulated mud weight step-profile vs depth
export const simulatedMudProfiles: Record<string, { depth: number; mudWeight: number }[]> = {
  "WX-01": [
    { depth: 0, mudWeight: 1.08 },
    { depth: 340, mudWeight: 1.12 },
    { depth: 510, mudWeight: 1.32 },
    { depth: 550, mudWeight: 1.28 },
    { depth: 720, mudWeight: 1.34 },
    { depth: 1145, mudWeight: 1.36 },
  ],
  "WX-07": [
    { depth: 0, mudWeight: 1.06 },
    { depth: 345, mudWeight: 1.14 },
    { depth: 507, mudWeight: 1.38 },
    { depth: 544, mudWeight: 1.48 },
    { depth: 750, mudWeight: 1.42 },
    { depth: 1161, mudWeight: 1.44 },
  ],
  "WX-11": [
    { depth: 0, mudWeight: 1.08 },
    { depth: 341, mudWeight: 1.15 },
    { depth: 470, mudWeight: 1.25 },
  ],
  "WX-12": [
    { depth: 0, mudWeight: 1.08 },
    { depth: 350, mudWeight: 1.14 },
    { depth: 515, mudWeight: 1.36 },
    { depth: 540, mudWeight: 1.30 },
    { depth: 1190, mudWeight: 1.35 },
  ],
};

/**
 * Accessor for all wells (frozen real wells + 12 simulated offset wells).
 */
export function getAllWells(): ExtendedWell[] {
  const realExtended: ExtendedWell[] = frozenWells.map((w) => ({
    ...w,
    origin: "source" as const,
    distanceFromWx11Km: w.id === "WX-11" ? 0 : 7.2,
    bearingDeg: w.id === "WX-11" ? 0 : 210,
  }));

  return [...realExtended, ...simulatedWells];
}

/**
 * Accessor for all events (frozen real events + ~45 simulated events).
 */
export function getAllEvents(): EventRecord[] {
  return [...frozenEvents, ...simulatedEvents];
}
