/**
 * The engineering review order for a well.
 *
 * NWIS deliberately follows the sequence a drilling engineer works in, so the
 * workspace reads as one guided document rather than a set of scattered pages.
 * Order is fixed by discipline, not by implementation convenience.
 */
import {
  BookOpen,
  Compass,
  Droplets,
  FileText,
  Flag,
  Layers3,
  Mountain,
  Network,
  Ruler,
  ScrollText,
  Target,
  TrendingUp,
  Wrench,
} from "lucide-react";

export type DataState = "source-backed" | "partial" | "unavailable";

export type WellSection = {
  slug: string;
  label: string;
  order: number;
  group: "identity" | "geology" | "operations" | "construction" | "knowledge";
  icon: typeof Mountain;
  purpose: string;
  /** What the engineer decides on this screen. */
  decision: string;
  dataState: DataState;
  dataNote: string;
};

export const wellSections: WellSection[] = [
  {
    slug: "",
    label: "Well Identity",
    order: 1,
    group: "identity",
    icon: Flag,
    purpose: "Confirm which well, which target, which current state.",
    decision: "Is this the well I am reviewing?",
    dataState: "source-backed",
    dataNote: "Well master record.",
  },
  {
    slug: "geology",
    label: "Geology & Formation Tops",
    order: 2,
    group: "geology",
    icon: Mountain,
    purpose: "Stratigraphic column, formation tops with source class, and lithology.",
    decision: "What rock am I in, and how certain are the tops?",
    dataState: "source-backed",
    dataNote: "Formation picks carry source, confidence and depth reference.",
  },
  {
    slug: "cross-section",
    label: "Cross Section",
    order: 3,
    group: "geology",
    icon: Layers3,
    purpose: "Correlate this well against offset wells across the section.",
    decision: "How does this correlate to the neighbours?",
    dataState: "partial",
    dataNote: "Correlation uses WX-07 picks; no survey-derived TVD available, so MD only.",
  },
  {
    slug: "drilling",
    label: "Drilling Performance",
    order: 4,
    group: "operations",
    icon: TrendingUp,
    purpose: "ROP, WOB, RPM, torque and SPP against depth.",
    decision: "How is the hole drilling compared with plan?",
    dataState: "unavailable",
    dataNote: "Parameter source file is not present in this repository.",
  },
  {
    slug: "bits",
    label: "Bit Runs",
    order: 5,
    group: "operations",
    icon: Wrench,
    purpose: "Bit number, type, meterage and hours per run.",
    decision: "Which bit is in, and how is it performing?",
    dataState: "unavailable",
    dataNote: "No bit-run schedule source supplied.",
  },
  {
    slug: "mud",
    label: "Mud Intelligence",
    order: 6,
    group: "operations",
    icon: Droplets,
    purpose: "Mud weight, rheology, fluid loss and cumulative losses.",
    decision: "Is the mud programme holding, and what is it costing?",
    dataState: "source-backed",
    dataNote: "Source units are preserved alongside normalized values.",
  },
  {
    slug: "events",
    label: "Events & NPT",
    order: 7,
    group: "operations",
    icon: Target,
    purpose: "Recorded events with severity, NPT and mitigation.",
    decision: "What has gone wrong here, and when?",
    dataState: "source-backed",
    dataNote: "Every event carries a source document and page.",
  },
  {
    slug: "construction",
    label: "Casing & Cementing",
    order: 8,
    group: "construction",
    icon: Ruler,
    purpose: "Hole sections, casing points, float collars and cement jobs.",
    decision: "What is set, and where does the string sit?",
    dataState: "unavailable",
    dataNote: "No casing or cement source data supplied — depths are never invented.",
  },
  {
    slug: "logging",
    label: "Logging",
    order: 9,
    group: "construction",
    icon: Compass,
    purpose: "Wireline and LWD runs with tops and interpreted features.",
    decision: "Do the logs agree with the picks?",
    dataState: "unavailable",
    dataNote: "No logging run source data supplied.",
  },
  {
    slug: "timeline",
    label: "Timeline",
    order: 10,
    group: "knowledge",
    icon: ScrollText,
    purpose: "Chronological operations, events and decisions by date.",
    decision: "What happened, and in what order?",
    dataState: "source-backed",
    dataNote: "Built from recorded events and operations.",
  },
  {
    slug: "lessons",
    label: "Lessons & Observations",
    order: 11,
    group: "knowledge",
    icon: BookOpen,
    purpose: "Engineer observations, mitigations and outcomes with review state.",
    decision: "What did we learn, and is it captured?",
    dataState: "partial",
    dataNote: "Observation workflow is functional; review queue is client-side only.",
  },
  {
    slug: "similar",
    label: "Similar Wells",
    order: 12,
    group: "knowledge",
    icon: Network,
    purpose: "Explainable ranking with component evidence and visible weights.",
    decision: "Which offset well is the best precedent?",
    dataState: "partial",
    dataNote: "Score is a weighted heuristic over listed components, not a validated model.",
  },
  {
    slug: "evidence",
    label: "Evidence",
    order: 13,
    group: "knowledge",
    icon: FileText,
    purpose: "Every fact traced to document, page, table and cell.",
    decision: "Can I defend this conclusion with a source?",
    dataState: "source-backed",
    dataNote: "Source records only — no AI-generated summaries in place of evidence.",
  },
];

export const sectionGroups: { id: WellSection["group"]; label: string }[] = [
  { id: "identity", label: "Identity" },
  { id: "geology", label: "Geology" },
  { id: "operations", label: "Operations" },
  { id: "construction", label: "Construction" },
  { id: "knowledge", label: "Knowledge" },
];

export function getSection(slug: string) {
  return wellSections.find((section) => section.slug === slug) ?? wellSections[0];
}

export function nextSection(slug: string) {
  const index = wellSections.findIndex((section) => section.slug === slug);
  return index >= 0 ? wellSections[index + 1] : undefined;
}

export function previousSection(slug: string) {
  const index = wellSections.findIndex((section) => section.slug === slug);
  return index > 0 ? wellSections[index - 1] : undefined;
}

export function sectionHref(wellId: string, slug: string) {
  return slug ? `/wells/${wellId}/${slug}` : `/wells/${wellId}`;
}

export const dataStateTone: Record<DataState, { label: string; className: string }> = {
  "source-backed": { label: "Source-backed", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  partial: { label: "Partial", className: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  unavailable: { label: "No source data", className: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
};
