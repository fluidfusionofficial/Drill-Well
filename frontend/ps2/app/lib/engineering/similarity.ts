/**
 * Explainable similar-well engine.
 *
 * No score is presented unless it was actually computed from these components.
 * Weights are visible and configurable. Every ranked candidate carries the
 * component evidence that produced its score.
 */
import { formationIntervals, wells } from "../nwis-data.ts";
import type { Well } from "../nwis-data.ts";
import { getEvents, getFormationPicks } from "./well-data.ts";
import { distanceKm } from "../well-planning.ts";

export type SimilarityWeights = {
  spatial: number;
  formationOverlap: number;
  depthSimilarity: number;
  eventSimilarity: number;
  wellType: number;
};

export const defaultWeights: SimilarityWeights = {
  spatial: 0.2,
  formationOverlap: 0.3,
  depthSimilarity: 0.2,
  eventSimilarity: 0.2,
  wellType: 0.1,
};

export type SimilarityComponent = {
  key: keyof SimilarityWeights;
  label: string;
  /** 0..1 */
  score: number;
  weight: number;
  weightedScore: number;
  evidence: string;
};

export type SimilarityResult = {
  wellId: string;
  /** 0..100, computed — never hardcoded. */
  score: number;
  distanceKm: number;
  matchingFormations: string[];
  components: SimilarityComponent[];
  /** "Selected because …" sentence built from the components that scored. */
  explanation: string;
  caveats: string[];
};

function formationOverlap(a: string[], b: string[]) {
  if (a.length === 0 || b.length === 0) return { ratio: 0, matches: [] as string[] };
  const setB = new Set(b.map((name) => name.toLowerCase()));
  const matches = a.filter((name) => setB.has(name.toLowerCase()));
  return { ratio: matches.length / new Set(a.map((n) => n.toLowerCase())).size, matches };
}

function depthSimilarity(a: number, b: number, toleranceM: number) {
  const delta = Math.abs(a - b);
  if (delta > toleranceM) return 0;
  return 1 - delta / toleranceM;
}

function eventSimilarity(a: string[], b: string[]) {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b.map((t) => t.toLowerCase()));
  const matches = a.filter((t) => setB.has(t.toLowerCase()));
  return matches.length / new Set(a.map((t) => t.toLowerCase())).size;
}

/** Formation tops that agree within a configured tolerance, in the same depth reference. */
function matchFormationTops(active: { name: string; top: number; depthReference: string }[], candidate: { name: string; top: number; depthReference: string }[], toleranceM: number) {
  if (active.length === 0 || candidate.length === 0) return { ratio: 0, matches: [] as string[] };
  const matches: string[] = [];
  for (const pick of active) {
    const other = candidate.find((item) => item.name.toLowerCase() === pick.name.toLowerCase());
    if (!other) continue;
    if (pick.depthReference !== other.depthReference) continue; // never compare MD against TVD
    if (Math.abs(pick.top - other.top) <= toleranceM) matches.push(pick.name);
  }
  return { ratio: matches.length / active.length, matches };
}

export function findSimilarWells(
  activeWell: Well,
  options: { weights?: Partial<SimilarityWeights>; formationToleranceM?: number; depthToleranceM?: number; limit?: number } = {},
): SimilarityResult[] {
  const weights: SimilarityWeights = { ...defaultWeights, ...options.weights };
  const formationToleranceM = options.formationToleranceM ?? 25;
  const depthToleranceM = options.depthToleranceM ?? 200;
  const limit = options.limit ?? 5;

  const activeFormations = getFormationPicks(activeWell.id);
  const activeFormationNames = activeFormations.length > 0 ? activeFormations.map((pick) => pick.name) : formationIntervals.map((i) => i.name);
  const activeEvents = getEvents(activeWell.id).map((event) => event.type);

  const results = wells
    .filter((well) => well.id !== activeWell.id)
    .map<SimilarityResult>((candidate) => {
      const distance = distanceKm(activeWell.coordinates, candidate.coordinates);
      const candidateFormations = getFormationPicks(candidate.id);
      const candidateFormationNames = candidateFormations.length > 0 ? candidateFormations.map((pick) => pick.name) : [];
      const candidateEvents = getEvents(candidate.id).map((event) => event.type);

      const hasOwnFormations = candidateFormations.length > 0;
      const overlap = formationOverlap(activeFormationNames, candidateFormationNames);
      const topMatches = hasOwnFormations ? matchFormationTops(activeFormations, candidateFormations, formationToleranceM) : null;

      // Formation score blends unit-name overlap with top-depth agreement.
      // With no candidate picks the score is 0 and the caveat says so.
      const formationScore = hasOwnFormations ? overlap.ratio * 0.5 + (topMatches?.ratio ?? 0) * 0.5 : 0;

      const components: SimilarityComponent[] = [
        {
          key: "spatial",
          label: "Spatial proximity",
          score: Math.max(0, 1 - distance / 15),
          weight: weights.spatial,
          weightedScore: 0,
          evidence: `${distance.toFixed(2)} km from ${activeWell.id}`,
        },
        {
          key: "formationOverlap",
          label: "Formation overlap",
          score: formationScore,
          weight: weights.formationOverlap,
          weightedScore: 0,
          evidence: hasOwnFormations
            ? `${overlap.matches.length} shared unit(s)${topMatches && topMatches.matches.length > 0 ? `; ${topMatches.matches.length} top(s) within ${formationToleranceM} m` : ""}`
            : `no source-backed formation picks for ${candidate.id}`,
        },
        {
          key: "depthSimilarity",
          label: "Depth relationship",
          score: depthSimilarity(activeWell.actualDepth, candidate.actualDepth, depthToleranceM),
          weight: weights.depthSimilarity,
          weightedScore: 0,
          evidence: `TD ${activeWell.actualDepth} m vs ${candidate.actualDepth} m (Δ ${Math.abs(activeWell.actualDepth - candidate.actualDepth)} m)`,
        },
        {
          key: "eventSimilarity",
          label: "Event relationship",
          score: eventSimilarity(activeEvents, candidateEvents),
          weight: weights.eventSimilarity,
          weightedScore: 0,
          evidence: candidateEvents.length > 0 ? `${candidateEvents.length} recorded event type(s): ${[...new Set(candidateEvents)].join(", ")}` : `no recorded events for ${candidate.id}`,
        },
        {
          key: "wellType",
          label: "Well profile",
          score: activeWell.wellType === candidate.wellType ? 1 : activeWell.profile === candidate.profile ? 0.6 : 0,
          weight: weights.wellType,
          weightedScore: 0,
          evidence: `${activeWell.wellType} vs ${candidate.wellType}`,
        },
      ];

      let weightedTotal = 0;
      let weightSum = 0;
      for (const component of components) {
        component.weightedScore = component.score * component.weight;
        weightedTotal += component.weightedScore;
        weightSum += component.weight;
      }
      const score = weightSum > 0 ? Math.round((weightedTotal / weightSum) * 100) : 0;

      const caveats: string[] = [];
      if (!hasOwnFormations) caveats.push(`${candidate.id} has no source-backed formation picks in this dataset.`);
      if (activeFormations.length === 0) caveats.push("Active well formation picks are unavailable; formation component uses the shared reference column.");
      caveats.push("Score is a weighted heuristic over the listed components, not a validated ML output.");

      const strongest = [...components].sort((a, b) => b.weightedScore - a.weightedScore).slice(0, 3);
      const explanation = `Selected because: ${strongest.map((component) => `${component.evidence.toLowerCase()}`).join("; ")}.`;

      return {
        wellId: candidate.id,
        score,
        distanceKm: distance,
        matchingFormations: overlap.matches,
        components,
        explanation,
        caveats,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return results;
}
