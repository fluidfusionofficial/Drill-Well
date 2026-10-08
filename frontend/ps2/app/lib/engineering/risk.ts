/**
 * Level 2 historical risk index engine.
 * Transparent, deterministic calculation of historical risk by hazard type.
 *
 * Formula:
 * index(h) = 100 * (1 - exp(-sum over events e of h: sev(e) * dist(e) * form(e) * prox(e) * conf(e)))
 */

import type { EventRecord, Well } from "../nwis-data.ts";
import { distanceKm } from "../well-planning.ts";
import type { HazardCategory } from "../taxonomy.ts";
import { classifyEvent, HAZARD_CATEGORIES } from "../taxonomy.ts";

export type RiskBand = "Low" | "Moderate" | "High";

export interface EventRiskContribution {
  event: EventRecord;
  hazardCategory: HazardCategory;
  sev: number;
  dist: number;
  form: number;
  prox: number;
  conf: number;
  weight: number;
}

export interface HazardRiskOutlook {
  category: HazardCategory;
  index: number; // 0 to 100
  rawSum: number;
  band: RiskBand;
  eventCount: number;
  supportingWellCount: number;
  nearestAheadM: number | null;
  nearestFormation: string | null;
  aheadText: string;
  basisText: string;
  supportingEvents: EventRecord[];
  contributions: EventRiskContribution[];
}

export interface RiskIndexOptions {
  radiusKm?: number;
  lookAheadM?: number;
  activeFormation?: string | null;
}

export function severityWeight(severity: EventRecord["severity"]): number {
  switch (severity) {
    case "Critical":
      return 1.0;
    case "High":
      return 0.8;
    case "Medium":
      return 0.5;
    case "Low":
    default:
      return 0.25;
  }
}

export function confidenceWeight(confidence: EventRecord["confidence"]): number {
  switch (confidence) {
    case "HIGH":
      return 1.0;
    case "MEDIUM":
      return 0.7;
    case "LOW":
    default:
      return 0.4;
  }
}

export function proximityWeight(
  eventDepth: number,
  cursor: number,
  lookAheadM: number,
): number {
  if (eventDepth < cursor) {
    // Already passed the bit
    return 0;
  }
  if (eventDepth <= cursor + lookAheadM) {
    // Inside the look-ahead window
    return 1.0;
  }
  // Gaussian decay below look-ahead window (sigma = 40 m)
  const delta = eventDepth - (cursor + lookAheadM);
  const sigma = 40;
  return Math.exp(-(delta * delta) / (2 * sigma * sigma));
}

export function distanceWeight(
  activeCoordinates: { lat: number; lng: number },
  eventCoordinates: { lat: number; lng: number } | null | undefined,
  radiusKm: number,
  isSameWell: boolean,
): number {
  if (isSameWell) return 1.0;
  if (!eventCoordinates || radiusKm <= 0) return 0;
  const dKm = distanceKm(activeCoordinates, eventCoordinates);
  return Math.max(0, 1 - dKm / radiusKm);
}

export function formationWeight(
  eventFormation: string | null | undefined,
  activeFormation: string | null | undefined,
): number {
  if (!activeFormation || !eventFormation) return 0.4;
  const a = activeFormation.toLowerCase().trim();
  const e = eventFormation.toLowerCase().trim();
  if (a === e || a.includes(e) || e.includes(a)) {
    return 1.0;
  }
  return 0.4;
}

export function getRiskBand(index: number): RiskBand {
  if (index < 25) return "Low";
  if (index <= 55) return "Moderate";
  return "High";
}

/**
 * Calculates historical risk index for a single hazard category.
 */
export function calculateHazardRisk(
  category: HazardCategory,
  events: EventRecord[],
  activeWell: Well,
  cursorDepth: number,
  wellsMap: Map<string, Well>,
  options: RiskIndexOptions = {},
): HazardRiskOutlook {
  const radiusKm = options.radiusKm ?? 10;
  const lookAheadM = options.lookAheadM ?? 100;
  const activeFormation = options.activeFormation ?? activeWell.formation;

  let sum = 0;
  const contributions: EventRiskContribution[] = [];
  const supportingWellsSet = new Set<string>();
  const matchingEvents: EventRecord[] = [];
  let minAheadM: number | null = null;
  let nearestFormation: string | null = null;

  for (const event of events) {
    const eventCategory = classifyEvent(event.type);
    if (eventCategory !== category) continue;

    const isSameWell = event.wellId === activeWell.id;
    const eventWell = wellsMap.get(event.wellId) ?? (isSameWell ? activeWell : null);
    const eventCoords = eventWell?.coordinates ?? activeWell.coordinates;

    const sev = severityWeight(event.severity);
    const dist = distanceWeight(activeWell.coordinates, eventCoords, radiusKm, isSameWell);
    const form = formationWeight(event.formation, activeFormation);
    const prox = proximityWeight(event.depth, cursorDepth, lookAheadM);
    const conf = confidenceWeight(event.confidence);

    const weight = sev * dist * form * prox * conf;
    sum += weight;

    if (dist > 0 && prox > 0) {
      matchingEvents.push(event);
      supportingWellsSet.add(event.wellId);

      const diff = event.depth - cursorDepth;
      if (diff >= 0 && (minAheadM === null || diff < minAheadM)) {
        minAheadM = diff;
        nearestFormation = event.formation ?? null;
      }
    }

    contributions.push({
      event,
      hazardCategory: category,
      sev,
      dist,
      form,
      prox,
      conf,
      weight,
    });
  }

  // index(h) = 100 * (1 - exp(-sum))
  const index = Math.min(100, Math.max(0, Math.round(100 * (1 - Math.exp(-sum)))));
  const band = getRiskBand(index);

  const eventCount = matchingEvents.length;
  const wellCount = supportingWellsSet.size;
  const basisText = `basis: ${eventCount} record${eventCount === 1 ? "" : "s"}, ${wellCount} well${wellCount === 1 ? "" : "s"}`;

  let aheadText = "None recorded ahead";
  if (minAheadM !== null) {
    const roundedM = Math.round(minAheadM);
    const prefix = roundedM === 0 ? "at depth" : `+${roundedM} m`;
    aheadText = `nearest ahead ${prefix}${nearestFormation ? ` in ${nearestFormation}` : ""}`;
  }

  return {
    category,
    index,
    rawSum: sum,
    band,
    eventCount,
    supportingWellCount: wellCount,
    nearestAheadM: minAheadM !== null ? Math.round(minAheadM) : null,
    nearestFormation,
    aheadText,
    basisText,
    supportingEvents: matchingEvents,
    contributions,
  };
}

/**
 * Calculates historical risk outlook across all standard hazard types.
 */
export function calculateAllHazardRisks(
  allEvents: EventRecord[],
  activeWell: Well,
  cursorDepth: number,
  allWells: Well[],
  options: RiskIndexOptions = {},
): HazardRiskOutlook[] {
  const wellsMap = new Map<string, Well>();
  for (const w of allWells) {
    wellsMap.set(w.id, w);
  }

  const results: HazardRiskOutlook[] = [];
  for (const category of HAZARD_CATEGORIES) {
    results.push(
      calculateHazardRisk(
        category,
        allEvents,
        activeWell,
        cursorDepth,
        wellsMap,
        options,
      ),
    );
  }

  // Sort by risk index descending
  return results.sort((a, b) => b.index - a.index);
}
