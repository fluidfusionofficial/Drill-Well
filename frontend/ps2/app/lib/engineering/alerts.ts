/**
 * Level 1 historical-context alert engine.
 *
 * These are deterministic evidence rules, not predictions. The engine never
 * states that an event will occur — only that historical context was detected
 * and that linked cases exist for review.
 */
import type { Well } from "../nwis-data.ts";
import { wells as allWells } from "../nwis-data.ts";
import { getEvents, getFormationPicks } from "./well-data.ts";
import { distanceKm } from "../well-planning.ts";
import type { EventRecord } from "../nwis-data.ts";

export type AlertState = "in-zone" | "ahead" | "passed";

export type AlertRuleConfig = {
  /** Approach distance in metres that arms the alert. */
  approachWindowM: number;
  /** Spatial context radius in km. */
  contextRadiusKm: number;
  /** Require the formation to match as well as the depth. */
  requireFormationMatch: boolean;
  /** Whether to include passed alerts behind the bit. */
  includePassed?: boolean;
};

export const defaultAlertConfig: AlertRuleConfig = {
  approachWindowM: 100,
  contextRadiusKm: 15,
  requireFormationMatch: true,
  includePassed: false,
};

export type HistoricalContextAlert = {
  id: string;
  rule: string;
  ruleKind: "LEVEL_1_DETERMINISTIC";
  headline: string;
  /** Deliberately phrased as detected context, never as a prediction. */
  statement: string;
  activeWellId: string;
  activeDepth: number;
  activeFormation: string | null;
  supportingWells: { wellId: string; distanceKm: number }[];
  events: EventRecord[];
  evidenceQuality: "HIGH" | "MEDIUM" | "LOW";
  citations: string[];
  severity: "Critical" | "High" | "Medium" | "Low";
  acknowledged: boolean;
  state: AlertState;
  metresAhead: number;
};

function formationAt(depth: number, wellId: string): string | null {
  const picks = getFormationPicks(wellId);
  const match = picks.find((pick) => depth >= pick.top && depth <= pick.bottom);
  return match?.name ?? null;
}

/**
 * Evaluate Level 1 rules for the active well at the given depth.
 * Returns zero or more alerts. Deterministic — same inputs, same output.
 */
export function evaluateHistoricalContext(
  activeWell: Well,
  depth: number,
  config: AlertRuleConfig = defaultAlertConfig,
): HistoricalContextAlert[] {
  const activeFormation = formationAt(depth, activeWell.id);
  const alerts: HistoricalContextAlert[] = [];

  const candidateWells = [activeWell, ...allWells];
  const seen = new Set<string>();

  for (const well of candidateWells) {
    if (seen.has(well.id)) continue;
    seen.add(well.id);

    const events = getEvents(well.id);
    if (events.length === 0) continue;

    const isOffset = well.id !== activeWell.id;
    if (isOffset) {
      const distance = distanceKm(activeWell.coordinates, well.coordinates);
      if (distance > config.contextRadiusKm) continue;
    }

    // Group nearby events so a 502-512 m cluster is one alert, not ten.
    const clusters = clusterByDepth(events, config.approachWindowM);

    for (const cluster of clusters) {
      const delta = depth - cluster.centreDepth;
      const diff = cluster.centreDepth - depth; // positive = ahead, negative = passed

      // Compute alert state based on depth relative to bit
      let state: AlertState;
      if (Math.abs(diff) <= 25) {
        state = "in-zone";
      } else if (diff > 0 && diff <= config.approachWindowM) {
        state = "ahead";
      } else {
        state = "passed";
      }

      // Filter: if includePassed is false, only keep in-zone or ahead within approach window
      if (!config.includePassed) {
        if (state === "passed") continue;
        if (Math.abs(delta) > config.approachWindowM && state !== "in-zone") continue;
      }

      if (
        config.requireFormationMatch &&
        cluster.formation &&
        activeFormation &&
        cluster.formation !== activeFormation
      ) {
        continue;
      }

      const citation = cluster.events
        .map((event) => `${event.source} ${event.sourcePage}`.trim())
        .filter(Boolean)[0];

      const isMudLoss = cluster.events.some((event) =>
        event.type.toLowerCase().includes("mud loss"),
      );
      const isHeldUp = cluster.events.some(
        (event) =>
          event.type.toLowerCase().includes("held up") ||
          event.type.toLowerCase().includes("tight pull"),
      );

      const relation =
        delta < 0
          ? `${Math.abs(delta)} m above current depth`
          : delta > 0
          ? `${Math.abs(delta)} m below current depth`
          : "at current depth";

      alerts.push({
        id: `HC-${well.id}-${cluster.events[0].id}`,
        rule: isMudLoss
          ? "historical-mud-loss-horizon"
          : isHeldUp
          ? "historical-mechanical-horizon"
          : "historical-event-horizon",
        ruleKind: "LEVEL_1_DETERMINISTIC",
        headline: isMudLoss
          ? "Historical mud-loss context detected"
          : isHeldUp
          ? "Historical held-up context detected"
          : "Historical event context detected",
        statement: `Historical context detected ${relation} in ${well.id}${
          cluster.formation ? ` within ${cluster.formation}` : ""
        }. Review the linked historical cases. This is a recorded precedent, not a prediction.`,
        activeWellId: activeWell.id,
        activeDepth: depth,
        activeFormation,
        supportingWells: [
          {
            wellId: well.id,
            distanceKm: isOffset
              ? distanceKm(activeWell.coordinates, well.coordinates)
              : 0,
          },
        ],
        events: cluster.events,
        evidenceQuality: cluster.events.every((event) => event.confidence === "HIGH")
          ? "HIGH"
          : cluster.events.some((event) => event.confidence === "HIGH")
          ? "MEDIUM"
          : "LOW",
        citations: citation ? [citation] : [],
        severity: isMudLoss ? "High" : isHeldUp ? "Medium" : "Low",
        acknowledged: false,
        state,
        metresAhead: Math.round(diff),
      });
    }
  }

  return alerts.sort((a, b) => {
    const stateOrder = { "in-zone": 0, ahead: 1, passed: 2 } as const;
    const severityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 } as const;

    return (
      stateOrder[a.state] - stateOrder[b.state] ||
      severityOrder[a.severity] - severityOrder[b.severity] ||
      Math.abs(a.metresAhead) - Math.abs(b.metresAhead)
    );
  });
}

type EventCluster = { centreDepth: number; formation: string | null; events: EventRecord[] };

export function clusterByDepth(events: EventRecord[], windowM: number): EventCluster[] {
  const sorted = [...events].sort((a, b) => a.depth - b.depth);
  const clusters: EventCluster[] = [];
  for (const event of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(event.depth - last.centreDepth) <= windowM) {
      last.events.push(event);
      last.centreDepth =
        last.events.reduce((sum, item) => sum + item.depth, 0) / last.events.length;
    } else {
      clusters.push({
        centreDepth: event.depth,
        formation: event.formation,
        events: [event],
      });
    }
  }
  return clusters;
}
