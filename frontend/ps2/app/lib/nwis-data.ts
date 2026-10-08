import type { Provenance } from "./engineering/provenance.ts";

export type WellStatus = "Active" | "Monitor" | "Completed" | "Drilling Complete" | "Standby" | "Producing" | "Suspended" | "Abandoned";

export type Well = {
  id: string;
  location: string;
  wellType: string;
  profile: string;
  rig: string;
  status: WellStatus;
  targetFormation: string;
  targetDepth: number;
  actualDepth: number;
  projectedTD: number;
  spudDate: string;
  tdDate?: string;
  coordinates: { lat: number; lng: number };
  formation: string;
  currentDepth: number;
  lastActivity: string;
  nearbyWells: number;
};

export type FormationInterval = {
  name: string;
  top: number;
  bottom: number;
  thickness: number;
  lithology: string;
  source: "Prognosed" | "Sample" | "Wireline";
  confidence: "HIGH" | "MEDIUM" | "LOW";
};

export type EventRecord = {
  id: string;
  wellId: string;
  type: string;
  date: string;
  depth: number;
  formation: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  description: string;
  response: string;
  outcome: string;
  source: string;
  sourcePage: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  demo?: boolean;
  origin?: "source" | "simulated";
  provenance?: Provenance;
};

export type MudRecord = {
  date: string;
  depth: number;
  mudWeight: string;
  viscosity: string;
  pv: string;
  yp: string;
  ph: string;
  fluidLoss: string;
  notes: string;
};

export type DocumentItem = {
  name: string;
  kind: "WCR" | "DDR" | "Excel" | "PDF" | "Scan";
  wellId: string;
  date: string;
  status: "Validated" | "Prototype" | "Pending";
  pages: number;
};

export type AlertItem = {
  id: string;
  title: string;
  context: string;
  wellId: string;
  depth: number;
  formation: string;
  evidence: string;
  reasons: string[];
  recommendation: string;
};

export type SimilarWell = {
  id: string;
  score: number;
  reasons: string[];
  formation: string;
  targetDepth: number;
  actualDepth: number;
  distanceKm: number;
};

export type SearchResult = {
  wellId: string;
  date: string;
  depth: number;
  formation: string;
  eventType: string;
  summary: string;
  source: string;
  relevance: number;
};

export type EngineerNote = {
  id: string;
  title: string;
  wellId: string;
  depth: number;
  date: string;
  status: "Draft" | "Pending Review" | "Validated" | "Rejected";
  summary: string;
};

export const wells: Well[] = [
  {
    id: "WX-07",
    location: "LOC-P3",
    wellType: "Vertical / Development",
    profile: "Vertical",
    rig: "RIG-4",
    status: "Drilling Complete",
    targetFormation: "Jodhpur Sandstone Formation",
    targetDepth: 1175,
    actualDepth: 1161,
    projectedTD: 1175,
    spudDate: "2025-07-09",
    tdDate: "2025-08-11",
    coordinates: { lat: 26.92, lng: 71.44 },
    formation: "Jodhpur / Upper Carbonate",
    currentDepth: 1014,
    lastActivity: "Mud loss review",
    nearbyWells: 8,
  },
  {
    id: "WX-11",
    location: "LOC-P9",
    wellType: "Vertical / Development",
    profile: "Vertical",
    rig: "RIG-2",
    status: "Active",
    targetFormation: "Jodhpur Sandstone Formation",
    targetDepth: 1210,
    actualDepth: 1138,
    projectedTD: 1210,
    spudDate: "2025-10-03",
    coordinates: { lat: 26.97, lng: 71.51 },
    formation: "Upper Carbonate",
    currentDepth: 470,
    lastActivity: "Formation tracking",
    nearbyWells: 10,
  },
  {
    id: "WX-19",
    location: "LOC-P5",
    wellType: "Development",
    profile: "Vertical",
    rig: "RIG-6",
    status: "Monitor",
    targetFormation: "Bilara Formation",
    targetDepth: 980,
    actualDepth: 945,
    projectedTD: 980,
    spudDate: "2025-06-14",
    coordinates: { lat: 26.91, lng: 71.38 },
    formation: "Bilara",
    currentDepth: 661,
    lastActivity: "Cementing review",
    nearbyWells: 6,
  },
];

export const currentWell = wells[1];

export const formationIntervals: FormationInterval[] = [
  { name: "Alluvium + Shumar", top: 0, bottom: 90, thickness: 90, lithology: "Alluvial cover + shale-silt interval", source: "Prognosed", confidence: "HIGH" },
  { name: "Jaisalmer + Lathi", top: 90, bottom: 230, thickness: 140, lithology: "Sandstone / siltstone sequence", source: "Sample", confidence: "HIGH" },
  { name: "Bap + Badhaura", top: 230, bottom: 420, thickness: 190, lithology: "Sandstone with claystone interbeds", source: "Sample", confidence: "HIGH" },
  { name: "Upper Carbonate", top: 420, bottom: 560, thickness: 140, lithology: "Limestone / dolostone", source: "Sample", confidence: "HIGH" },
  { name: "Nagaur", top: 560, bottom: 700, thickness: 140, lithology: "Dolomitic limestone", source: "Wireline", confidence: "MEDIUM" },
  { name: "HEG", top: 700, bottom: 806, thickness: 106, lithology: "Evaporitic claystone / carbonate mix", source: "Wireline", confidence: "MEDIUM" },
  { name: "Bilara", top: 806, bottom: 900, thickness: 94, lithology: "Limestone with occasional dolomite", source: "Wireline", confidence: "HIGH" },
  { name: "Lower Bilara", top: 900, bottom: 1030, thickness: 130, lithology: "Carbonate-rich interval", source: "Wireline", confidence: "HIGH" },
  { name: "Jodhpur", top: 1030, bottom: 1130, thickness: 100, lithology: "Sandstone / quartz arenite", source: "Prognosed", confidence: "MEDIUM" },
  { name: "Malani / Basement", top: 1130, bottom: 1161, thickness: 31, lithology: "Basement contact interval", source: "Wireline", confidence: "LOW" },
];

export const wellEvents: EventRecord[] = [
  {
    id: "EV-101",
    wellId: "WX-07",
    type: "Mud Loss",
    date: "2025-07-18",
    depth: 523,
    formation: "Upper Carbonate",
    severity: "High",
    description: "Mud loss of 25 bbl observed while drilling through the carbonate interval.",
    response: "Lost circulation materials and reduced rate of penetration applied.",
    outcome: "Loss stabilized after staged treatment.",
    source: "WCR",
    sourcePage: "Mud Loss Data / Section 5",
    confidence: "HIGH",
  },
  {
    id: "EV-102",
    wellId: "WX-07",
    type: "Mud Loss",
    date: "2025-07-20",
    depth: 544,
    formation: "Limestone / Dolostone",
    severity: "Critical",
    description: "Significant loss of circulation recorded at 544 m; the sanitized reference record reports 209 bbl.",
    response: "Tracked losses and adjusted mud policy with additional loss control materials.",
    outcome: "Unexpected loss volume recorded but drilling continued within planned operating envelope.",
    source: "Daily Drilling Report",
    sourcePage: "20.07.2025",
    confidence: "HIGH",
  },
  {
    id: "EV-103",
    wellId: "WX-07",
    type: "Held Up",
    date: "2025-07-21",
    depth: 507,
    formation: "Upper Carbonate",
    severity: "Medium",
    description: "Held-up interval recorded around 502–507 m with a 5 ton pull while rotating through the carbonate transition.",
    response: "Reaming and torque reduction applied before continued drilling.",
    outcome: "No major NPT recorded beyond short operational pause.",
    source: "WCR",
    sourcePage: "Tight Pull & Held Up Data",
    confidence: "HIGH",
    demo: true,
  },
  {
    id: "EV-104",
    wellId: "WX-11",
    type: "Tight Pull",
    date: "2025-10-17",
    depth: 568,
    formation: "Upper Carbonate",
    severity: "Medium",
    description: "Comparative offset pattern observed during ongoing carbonate drilling.",
    response: "Routine torque management and stick-slip monitoring.",
    outcome: "Well remained stable under control.",
    source: "DDR",
    sourcePage: "17.10.2025",
    confidence: "MEDIUM",
    demo: true,
  },
  {
    id: "EV-105",
    wellId: "WX-19",
    type: "Casing Event",
    date: "2025-06-29",
    depth: 341,
    formation: "Bap + Badhaura",
    severity: "Low",
    description: "Minor casing accessory review during shoe set installation.",
    response: "Field re-check and inspection completed.",
    outcome: "No escalation required.",
    source: "WCR",
    sourcePage: "Casing Details",
    confidence: "HIGH",
  },
  {
    id: "EV-106",
    wellId: "WX-07",
    type: "Held Up",
    date: "2025-07-21",
    depth: 512,
    formation: "Upper Carbonate",
    severity: "Medium",
    description: "Held-up interval recorded at 511–512 m with a 6 ton pull.",
    response: "Not available in the source fixture.",
    outcome: "Not available in the source fixture.",
    source: "WCR",
    sourcePage: "Tight Pull & Held Up Data",
    confidence: "HIGH",
  },
];

export function formationAtReferenceDepth(depth: number) {
  return formationIntervals.find((interval) => depth >= interval.top && depth < interval.bottom);
}

export function offsetEventsForFormation(wellId: string, formation: string) {
  const formationTerms = formation
    .split(/[\/,&]+/)
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);

  return wellEvents.filter((event) => {
    if (event.wellId === wellId) return false;

    const directMatch = formationTerms.some((term) => event.formation.toLowerCase().includes(term));
    if (directMatch) return true;

    if (event.wellId !== "WX-07") return false;
    const referenceFormation = formationAtReferenceDepth(event.depth);
    return Boolean(referenceFormation && formationTerms.some((term) => referenceFormation.name.toLowerCase().includes(term)));
  });
}

export const mudRecords: MudRecord[] = [
  { date: "2025-07-16", depth: 480, mudWeight: "1.42 g/cm³", viscosity: "48 s", pv: "14 cP", yp: "11 lb/100ft²", ph: "9.7", fluidLoss: "7.4 mL", notes: "Stable mud profile with moderate losses." },
  { date: "2025-07-18", depth: 523, mudWeight: "1.45 g/cm³", viscosity: "52 s", pv: "18 cP", yp: "12 lb/100ft²", ph: "9.4", fluidLoss: "12.1 mL", notes: "Mud loss event at carbonate interval." },
  { date: "2025-07-20", depth: 544, mudWeight: "1.48 g/cm³", viscosity: "57 s", pv: "19 cP", yp: "15 lb/100ft²", ph: "9.3", fluidLoss: "16.8 mL", notes: "Loss control maintained with staged treatment." },
  { date: "2025-07-21", depth: 507, mudWeight: "1.46 g/cm³", viscosity: "54 s", pv: "17 cP", yp: "13 lb/100ft²", ph: "9.5", fluidLoss: "9.8 mL", notes: "Held-up event with torque management." },
  { date: "2025-07-25", depth: 610, mudWeight: "1.51 g/cm³", viscosity: "63 s", pv: "21 cP", yp: "16 lb/100ft²", ph: "9.2", fluidLoss: "7.0 mL", notes: "Drilling adaptation for transition zone." },
];

export const documents: DocumentItem[] = [
  { name: "WX-07_WCR_2025_P1.pdf", kind: "WCR", wellId: "WX-07", date: "2025-08-12", status: "Validated", pages: 142 },
  { name: "WX-07_2025_07_20_DDR.xlsx", kind: "Excel", wellId: "WX-07", date: "2025-07-20", status: "Validated", pages: 11 },
  { name: "WX-11_Progress_2025_10_18.pdf", kind: "PDF", wellId: "WX-11", date: "2025-10-18", status: "Prototype", pages: 28 },
  { name: "WX-19_Scan_002.tif", kind: "Scan", wellId: "WX-19", date: "2025-06-29", status: "Pending", pages: 4 },
];

export const alerts: AlertItem[] = [
  {
    id: "AL-01",
    title: "Historical Context Detected",
    context: "Current well is approaching a carbonate interval where previous wells recorded mud loss and held-up response.",
    wellId: "WX-11",
    depth: 545,
    formation: "Upper Carbonate",
    evidence: "WX-07 mud loss at 544 m | 209 bbl | WCR / Mud Loss Data",
    reasons: ["Spatial proximity", "Depth corridor match", "Formation overlap", "Historical event similarity"],
    recommendation: "Review historical record and relevant mud-loss operating procedures before continuing the current interval.",
  },
  {
    id: "AL-02",
    title: "Same-depth event corridor",
    context: "WX-11 is operating within the same formation band as a prior held-up event recorded during nearby offset drilling.",
    wellId: "WX-11",
    depth: 507,
    formation: "Upper Carbonate",
    evidence: "WX-07 held-up event at 502-512 m | WCR/Tight Pull & Held Up Data",
    reasons: ["Similar target depth", "Equivalent formation band", "Offset well pattern"],
    recommendation: "Review torque and reaming plan with the drilling supervisor.",
  },
];

export const similarWells: SimilarWell[] = [
  {
    id: "WX-07",
    score: 88,
    reasons: ["Formation overlap", "Target depth similarity", "Historical event correlation", "Similar mud-loss profile"],
    formation: "Upper Carbonate / Jodhpur",
    targetDepth: 1175,
    actualDepth: 1161,
    distanceKm: 4.6,
  },
  {
    id: "WX-19",
    score: 74,
    reasons: ["Same well-type profile", "Likely basin context", "Comparable casing window"],
    formation: "Bilara / Bap",
    targetDepth: 980,
    actualDepth: 945,
    distanceKm: 3.1,
  },
];

export const searchResults: SearchResult[] = [
  {
    wellId: "WX-07",
    date: "2025-07-18",
    depth: 523,
    formation: "Upper Carbonate",
    eventType: "Mud Loss",
    summary: "Mud loss recorded at 523 m during carbonate drilling; loss volume reached 25 bbl.",
    source: "WCR / Mud Loss Data",
    relevance: 95,
  },
  {
    wellId: "WX-07",
    date: "2025-07-21",
    depth: 507,
    formation: "Upper Carbonate",
    eventType: "Held Up",
    summary: "Held-up event around 502-512 m with torque response and reaming requirement.",
    source: "WCR / Tight Pull & Held Up",
    relevance: 91,
  },
  {
    wellId: "WX-11",
    date: "2025-10-17",
    depth: 568,
    formation: "Upper Carbonate",
    eventType: "Tight Pull",
    summary: "Offset comparison indicates similar tight-pull pattern around this formation band.",
    source: "DDR / 17.10.2025",
    relevance: 81,
  },
];

export const engineerNotes: EngineerNote[] = [
  { id: "N-01", title: "Carbonate transition caution", wellId: "WX-11", depth: 540, date: "2025-10-18", status: "Validated", summary: "Loss pattern in adjacent well at same depth interval suggests a review of mud policy and formation expectation." },
  { id: "N-02", title: "Torque pattern check", wellId: "WX-11", depth: 508, date: "2025-10-18", status: "Draft", summary: "Surface torque rise matches prior held-up signature; consider pre-emptive monitoring and reduced drilling weight." },
  { id: "N-03", title: "Mud loss review", wellId: "WX-07", depth: 544, date: "2025-07-20", status: "Pending Review", summary: "Prior mitigation was effective, but offset well should record any additional fracture indicators." },
];

export const drillingParameters = [
  { label: "ROP", value: 12.4, unit: "m/hr" },
  { label: "WOB", value: 9.8, unit: "ton" },
  { label: "RPM", value: 126, unit: "rpm" },
  { label: "Torque", value: 74, unit: "kN·m" },
  { label: "Standpipe Pressure", value: 2910, unit: "psi" },
  { label: "Mud Weight", value: 1.48, unit: "ppg" },
];

export const timelineEntries = [
  { date: "2025-07-09", operation: "Spud in", depth: 0, event: "Well spud", formation: "Alluvium" },
  { date: "2025-07-16", operation: "Drilling", depth: 480, event: "Target interval observed", formation: "Upper Carbonate" },
  { date: "2025-07-18", operation: "Mud loss event", depth: 523, event: "Loss recorded", formation: "Upper Carbonate" },
  { date: "2025-07-20", operation: "Loss control", depth: 544, event: "Mud loss escalation", formation: "Limestone / Dolostone" },
  { date: "2025-07-21", operation: "Held-up check", depth: 507, event: "Tight pull", formation: "Upper Carbonate" },
  { date: "2025-08-11", operation: "TD reached", depth: 1161, event: "Actual TD recorded", formation: "Malani / Basement" },
];
