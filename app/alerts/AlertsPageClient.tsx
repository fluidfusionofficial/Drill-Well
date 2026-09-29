"use client";

import React, { useState, useMemo } from "react";
import {
  Check,
  Filter,
  Eye,
  Info,
} from "lucide-react";
import { useNwisWorkspace } from "@/components/nwis-workspace-context";
import { evaluateHistoricalContext } from "@/lib/engineering/alerts";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProvenanceChip } from "@/components/ui/ProvenanceChip";
import { EventGlyph } from "@/components/ui/EventGlyph";
import { classifyEvent } from "@/lib/taxonomy";

export function AlertsPageClient() {
  const {
    selectedWell,
    currentDepth,
    radiusKm,
    lookAheadM,
    setSelectedEventId,
  } = useNwisWorkspace();

  const [filterState, setFilterState] = useState<"all" | "in-zone" | "ahead" | "passed">("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());

  // Evaluate alerts using depth-aware rules with includePassed: true
  const evaluatedAlerts = useMemo(() => {
    return evaluateHistoricalContext(selectedWell, currentDepth, {
      approachWindowM: lookAheadM,
      contextRadiusKm: radiusKm,
      requireFormationMatch: false,
      includePassed: true,
    });
  }, [selectedWell, currentDepth, lookAheadM, radiusKm]);

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    return evaluatedAlerts.filter((alert) => {
      const matchesState = filterState === "all" || alert.state === filterState;
      const matchesSev = filterSeverity === "all" || alert.severity === filterSeverity;
      return matchesState && matchesSev;
    });
  }, [evaluatedAlerts, filterState, filterSeverity]);

  const toggleAcknowledge = (id: string) => {
    setAcknowledgedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Context banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-line bg-surface p-4 text-xs">
        <div>
          <div className="text-xs font-semibold text-ink">
            Active monitoring context: {selectedWell.id} at {Math.round(currentDepth)} m MD
          </div>
          <div className="mt-0.5 text-xs text-ink-3">
            Search radius {radiusKm} km · Look-ahead window {lookAheadM} m · Deterministic Level-1
            evidence rules
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-ink-3">
            <Filter className="h-3.5 w-3.5" />
            <span>State:</span>
          </div>
          {(["all", "in-zone", "ahead", "passed"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterState(st)}
              className={`rounded-[4px] px-2.5 py-1 text-xs font-medium border transition ${
                filterState === st
                  ? "bg-primary border-accent text-white"
                  : "bg-surface border-line text-ink-2 hover:bg-surface-muted"
              }`}
            >
              {st === "all"
                ? "All"
                : st === "in-zone"
                ? "In-zone"
                : st === "ahead"
                ? "Ahead"
                : "Passed"}
            </button>
          ))}

          <div className="h-4 w-[1px] bg-line mx-1" />

          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="rounded-[4px] border border-line bg-surface px-2 py-1 text-xs text-ink focus:border-accent"
          >
            <option value="all">All severities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      {/* Alerts list */}
      <div className="space-y-3">
        {filteredAlerts.map((alert) => {
          const isAcked = acknowledgedIds.has(alert.id);
          const cat = classifyEvent(alert.headline);

          return (
            <div
              key={alert.id}
              className={`rounded-[6px] border p-4 text-ink transition ${
                isAcked
                  ? "border-line bg-surface opacity-75"
                  : alert.severity === "Critical"
                  ? "border-status-critical/40 bg-status-critical-soft/30"
                  : alert.severity === "High"
                  ? "border-status-high/40 bg-status-high-soft/30"
                  : "border-line bg-surface"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <EventGlyph category={cat} size={15} />
                  <span className="text-sm font-semibold text-ink">{alert.headline}</span>
                  <span className="text-xs text-ink-3">·</span>
                  <Badge
                    variant={
                      alert.state === "in-zone"
                        ? "critical"
                        : alert.state === "ahead"
                        ? "high"
                        : "neutral"
                    }
                  >
                    {alert.state === "in-zone"
                      ? "In-zone hazard"
                      : alert.state === "ahead"
                      ? `${alert.metresAhead ?? 0}m ahead`
                      : "Passed behind bit"}
                  </Badge>
                  <Badge
                    variant={
                      alert.severity === "Critical"
                        ? "critical"
                        : alert.severity === "High"
                        ? "high"
                        : "moderate"
                    }
                  >
                    {alert.severity}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant={isAcked ? "secondary" : "secondary"}
                    size="sm"
                    onClick={() => toggleAcknowledge(alert.id)}
                  >
                    {isAcked ? (
                      <>
                        <Check className="h-3 w-3 text-status-ok mr-1" />
                        Acknowledged
                      </>
                    ) : (
                      "Acknowledge"
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedEventId(alert.events[0]?.id ?? null)}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Inspect evidence
                  </Button>
                </div>
              </div>

              {/* Statement */}
              <div className="mt-2.5 text-xs leading-relaxed text-ink">{alert.statement}</div>

              {/* Linked Precedents */}
              <div className="mt-3 rounded-[4px] border border-line bg-surface p-2.5 text-xs">
                <div className="font-semibold text-ink mb-1.5 flex items-center justify-between">
                  <span>Linked offset precedents ({alert.events.length})</span>
                  <span className="text-xs text-ink-3 font-normal">
                    Target formation: {alert.activeFormation ?? "General section"}
                  </span>
                </div>

                <div className="divide-y divide-line">
                  {alert.events.map((e) => {
                    const dist = alert.supportingWells.find((w) => w.wellId === e.wellId)?.distanceKm;
                    return (
                      <div
                        key={e.id}
                        className="py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <strong className="text-ink font-medium">{e.wellId}</strong>
                          <span className="tabular-nums text-ink-2 font-medium">
                            {e.depth} m MD
                          </span>
                          <span className="text-ink-3">({e.formation})</span>
                          <span className="text-ink truncate max-w-[340px]">{e.type}</span>
                        </div>

                        <div className="flex items-center gap-2 text-ink-3">
                          {dist !== undefined && (
                            <>
                              <span className="tabular-nums">{dist.toFixed(1)} km</span>
                              <span>·</span>
                            </>
                          )}
                          <span>{e.source}</span>
                          <span>·</span>
                          <span>{e.date}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recommended Action */}
              <div className="mt-3 flex items-start gap-2 rounded-[4px] border border-line bg-surface-muted p-2.5 text-xs text-ink">
                <Info className="h-3.5 w-3.5 text-accent mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold text-ink">Recommended operational review: </span>
                  <span className="text-ink-2">
                    Review offset drilling records and bit records for {alert.activeFormation ?? "this interval"} before reaching {Math.round(alert.activeDepth + (alert.metresAhead ?? 0))} m MD.
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {filteredAlerts.length === 0 && (
          <div className="rounded-[6px] border border-line bg-surface p-8 text-center text-xs text-ink-3">
            No alerts match active filters for current well depth.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-1">
        <ProvenanceChip
          source="Deterministic Level-1 historical-context rule engine"
          recordCount={evaluatedAlerts.length}
          simulatedCount={0}
        />
      </div>
    </div>
  );
}
