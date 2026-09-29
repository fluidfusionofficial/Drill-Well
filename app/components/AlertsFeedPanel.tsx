"use client";

import React, { useState, useMemo } from "react";
import { useNwisWorkspace } from "@/components/nwis-workspace-context";
import { evaluateHistoricalContext, HistoricalContextAlert } from "@/lib/engineering/alerts";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ChevronDown, ChevronUp, Check, ExternalLink } from "lucide-react";

export interface AlertsFeedPanelProps {
  className?: string;
}

export function AlertsFeedPanel({ className = "" }: AlertsFeedPanelProps) {
  const { selectedWell, currentDepth, radiusKm, lookAheadM, setSelectedEventId } = useNwisWorkspace();
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  const [passedCollapsed, setPassedCollapsed] = useState(true);

  // Evaluate alerts with includePassed: true
  const allAlerts: HistoricalContextAlert[] = useMemo(() => {
    return evaluateHistoricalContext(selectedWell, currentDepth, {
      approachWindowM: lookAheadM,
      contextRadiusKm: radiusKm,
      requireFormationMatch: false,
      includePassed: true,
    });
  }, [selectedWell, currentDepth, radiusKm, lookAheadM]);

  // Separate active (in-zone & ahead) and passed
  const activeAlerts = useMemo(() => {
    return allAlerts.filter((a) => a.state === "in-zone" || a.state === "ahead");
  }, [allAlerts]);

  const passedAlerts = useMemo(() => {
    return allAlerts.filter((a) => a.state === "passed");
  }, [allAlerts]);

  const toggleAcknowledge = (id: string) => {
    setAcknowledgedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderAlertCard = (alert: HistoricalContextAlert) => {
    const isAck = acknowledgedIds.has(alert.id);
    const primaryEvent = alert.events[0];

    // Depth relation wording
    let relationText = "";
    if (alert.state === "in-zone") {
      relationText = "in zone";
    } else if (alert.state === "ahead") {
      relationText = `${alert.metresAhead > 0 ? "+" : ""}${alert.metresAhead} m ahead`;
    } else {
      relationText = `passed ${Math.abs(alert.metresAhead)} m ago`;
    }

    return (
      <div
        key={alert.id}
        className={`rounded-[6px] border p-3 text-xs transition-colors flex flex-col justify-between gap-2 ${
          isAck
            ? "border-line bg-surface-muted/30 opacity-70"
            : alert.state === "in-zone"
            ? "border-status-critical/40 bg-status-critical-soft/30"
            : "border-line bg-surface hover:border-line-strong"
        }`}
      >
        {/* Header: Severity + Headline + Relation */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 flex-wrap">
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
              <span className="font-semibold text-xs text-ink">{alert.headline}</span>
            </div>

            <span
              className={`rounded-[4px] px-1.5 py-0.5 text-xs font-semibold tabular-nums shrink-0 ${
                alert.state === "in-zone"
                  ? "bg-status-critical text-white"
                  : alert.state === "ahead"
                  ? "bg-primary-soft text-accent"
                  : "bg-surface-muted text-ink-3"
              }`}
            >
              {relationText}
            </span>
          </div>

          {/* Statement */}
          <p className="text-xs text-ink-2 leading-relaxed mt-1">
            {alert.statement}
          </p>
        </div>

        {/* Supporting Wells & Meta */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-line/60 text-xs text-ink-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              Offset:{" "}
              <strong className="text-ink font-medium">
                {alert.supportingWells.map((w) => `${w.wellId} (${w.distanceKm.toFixed(1)} km)`).join(", ")}
              </strong>
            </span>
            <span aria-hidden="true" className="text-line-strong">/</span>
            <span>Quality: {alert.evidenceQuality}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {primaryEvent && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedEventId(primaryEvent.id)}
                icon={<ExternalLink className="h-3 w-3" />}
              >
                View evidence
              </Button>
            )}

            <Button
              variant={isAck ? "secondary" : "ghost"}
              size="sm"
              onClick={() => toggleAcknowledge(alert.id)}
              icon={isAck ? <Check className="h-3 w-3 text-status-ok" /> : undefined}
            >
              {isAck ? "Acknowledged" : "Acknowledge"}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`rounded-[6px] border border-line bg-surface flex flex-col justify-between ${className}`}>
      {/* Header */}
      <div className="border-b border-line px-4 py-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-ink leading-tight">
            Alerts feed
          </h3>
          <p className="text-xs text-ink-3 mt-0.5">
            Level 1 deterministic historical precedents
          </p>
        </div>
        <Badge variant={activeAlerts.length > 0 ? "critical" : "ok"}>
          {activeAlerts.length} active
        </Badge>
      </div>

      {/* Feed List */}
      <div className="p-3 space-y-2.5 flex-1 overflow-y-auto max-h-[380px]">
        {activeAlerts.length === 0 ? (
          <div className="p-6 text-center text-xs text-ink-3">
            No active hazards detected within look-ahead window ({lookAheadM} m).
          </div>
        ) : (
          activeAlerts.slice(0, 3).map(renderAlertCard)
        )}

        {/* Collapsed Passed Group */}
        {passedAlerts.length > 0 && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setPassedCollapsed(!passedCollapsed)}
              className="w-full flex items-center justify-between p-2 rounded-[4px] bg-surface-muted hover:bg-surface-muted/80 text-xs text-ink-2 font-medium cursor-pointer transition-colors"
            >
              <span>{passedAlerts.length} passed hazards (above bit depth)</span>
              {passedCollapsed ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5" />
              )}
            </button>

            {!passedCollapsed && (
              <div className="mt-2 space-y-2 pl-2 border-l border-line">
                {passedAlerts.map(renderAlertCard)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mandatory Single Recorded Precedent Notice Footer */}
      <div className="border-t border-line px-4 py-2 bg-surface-muted/30 rounded-b-[5px]">
        <p className="text-xs text-ink-3 leading-normal">
          Recorded precedent, not a prediction. Level 1 deterministic historical rules.
        </p>
      </div>
    </div>
  );
}
