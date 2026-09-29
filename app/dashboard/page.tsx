"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/layout-shell";
import { CommandCenterMap } from "@/components/command-center-map";
import { useNwisWorkspace } from "@/components/nwis-workspace-context";
import { formationAtReferenceDepth } from "@/lib/nwis-data";
import { evaluateHistoricalContext } from "@/lib/engineering/alerts";
import { calculateAllHazardRisks } from "@/lib/engineering/risk";
import { getAllEvents, getAllWells } from "@/lib/fixtures/extended-dataset";
import { Badge } from "@/components/ui/Badge";
import { KpiTile } from "@/components/ui/KpiTile";
import { OffsetCorrelationChart } from "@/components/charts/OffsetCorrelationChart";
import { TimeDepthChart } from "@/components/charts/TimeDepthChart";
import { NptBreakdownChart } from "@/components/charts/NptBreakdownChart";
import { HazardMatrixChart } from "@/components/charts/HazardMatrixChart";
import { RiskOutlookPanel } from "@/components/RiskOutlookPanel";
import { AlertsFeedPanel } from "@/components/AlertsFeedPanel";
import { OffsetWellsTable } from "@/components/OffsetWellsTable";
import { HazardCategory } from "@/lib/taxonomy";

export default function DashboardPage() {
  const {
    selectedWell,
    currentDepth,
    radiusKm,
    lookAheadM,
  } = useNwisWorkspace();

  const [highlightedCategory, setHighlightedCategory] = useState<HazardCategory | null>(null);
  const [selectedOffsetWellId, setSelectedOffsetWellId] = useState<string | null>(null);

  const allWells = useMemo(() => getAllWells(), []);
  const allEvents = useMemo(() => getAllEvents(), []);

  // Formation pick at current depth
  const refFormation = formationAtReferenceDepth(currentDepth);
  const formationName = refFormation?.name ?? selectedWell.formation;
  const isFormationBorrowed = selectedWell.id !== "WX-07";

  // Days since spud
  const daysSinceSpud = useMemo(() => {
    try {
      const spud = new Date(selectedWell.spudDate);
      const now = new Date("2025-10-14"); // Reference operational date
      const diffTime = Math.abs(now.getTime() - spud.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return isNaN(diffDays) ? 11 : diffDays;
    } catch {
      return 11;
    }
  }, [selectedWell.spudDate]);

  // Offset wells in radius
  const offsetWellsInRadius = useMemo(() => {
    return allWells.filter((w) => w.id !== selectedWell.id && (w.distanceFromWx11Km ?? 0) <= radiusKm);
  }, [allWells, selectedWell.id, radiusKm]);

  const matchedFormationCount = useMemo(() => {
    return offsetWellsInRadius.filter(
      (w) =>
        w.formation.toLowerCase() === selectedWell.formation.toLowerCase() ||
        w.formation.toLowerCase().includes("carbonate"),
    ).length;
  }, [offsetWellsInRadius, selectedWell.formation]);

  // Events in current formation
  const eventsInFormation = useMemo(() => {
    return allEvents.filter(
      (e) =>
        e.formation.toLowerCase() === formationName.toLowerCase() ||
        e.formation.toLowerCase().includes(formationName.toLowerCase()),
    );
  }, [allEvents, formationName]);

  // Risk scores
  const hazardRisks = useMemo(() => {
    return calculateAllHazardRisks(allEvents, selectedWell, currentDepth, allWells, {
      radiusKm,
      lookAheadM,
      activeFormation: formationName,
    });
  }, [allEvents, selectedWell, currentDepth, allWells, radiusKm, lookAheadM, formationName]);

  const highestRisk = hazardRisks[0] ?? {
    category: "Mud loss" as HazardCategory,
    index: 0,
    band: "Low",
  };

  // Next recorded hazard
  const activeAlerts = useMemo(() => {
    return evaluateHistoricalContext(selectedWell, currentDepth, {
      approachWindowM: lookAheadM,
      contextRadiusKm: radiusKm,
      requireFormationMatch: false,
    });
  }, [selectedWell, currentDepth, radiusKm, lookAheadM]);

  const nearestAlert = activeAlerts.find((a) => a.state === "ahead" || a.state === "in-zone");

  let nextHazardLabel = `None within ${lookAheadM} m`;
  let nextHazardSubtext = "Operating within normal offset corridor";
  if (nearestAlert) {
    const primaryEvent = nearestAlert.events[0];
    if (nearestAlert.state === "in-zone") {
      nextHazardLabel = `In zone: ${primaryEvent?.type ?? "Hazard"}`;
      nextHazardSubtext = `${primaryEvent?.formation ?? formationName} at bit depth`;
    } else {
      nextHazardLabel = `+${nearestAlert.metresAhead} m, ${primaryEvent?.type ?? "Hazard"}`;
      nextHazardSubtext = `Nearest in ${primaryEvent?.formation ?? formationName}`;
    }
  }

  return (
    <AppShell>
      <div className="space-y-4">
        {/* C1: Well Header (one clean row, spacing separation, no dots) */}
        <section
          aria-label="Well context header"
          className="rounded-[6px] border border-line bg-surface p-4 flex flex-wrap items-center justify-between gap-4"
        >
          {/* Well ID & Status */}
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-ink leading-tight">
              {selectedWell.id}
            </h1>
            <Badge
              variant={selectedWell.status === "Active" ? "ok" : "neutral"}
              dot
            >
              {selectedWell.status}
            </Badge>
          </div>

          {/* Operational Metadata Items with spacing */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-2">
            <div>
              <span className="text-ink-3">Rig:</span>{" "}
              <span className="font-medium text-ink">{selectedWell.rig}</span>
            </div>

            <div>
              <span className="text-ink-3">Profile:</span>{" "}
              <span className="font-medium text-ink">{selectedWell.profile}</span>
            </div>

            <div>
              <span className="text-ink-3">Depth MD:</span>{" "}
              <span className="font-semibold text-accent tabular-nums">
                {currentDepth.toLocaleString("en-IN")} m
              </span>
            </div>

            <div>
              <span className="text-ink-3">Formation:</span>{" "}
              <span className="font-medium text-ink">{formationName}</span>
              {isFormationBorrowed && (
                <span className="ml-1 text-xs text-ink-3" title="Formation pick not available for WX-11; showing the WX-07 reference pick.">
                  (WX-07 pick)
                </span>
              )}
            </div>

            <div>
              <span className="text-ink-3">Planned TD:</span>{" "}
              <span className="font-medium text-ink tabular-nums">
                {selectedWell.projectedTD.toLocaleString("en-IN")} m
              </span>
            </div>

            <div>
              <span className="text-ink-3">Spud:</span>{" "}
              <span className="font-medium text-ink">
                {selectedWell.spudDate} ({daysSinceSpud} days)
              </span>
            </div>
          </div>

          {/* Open Well Link */}
          <div>
            <Link
              href={`/wells/${selectedWell.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[4px] px-2 py-1"
            >
              <span>Open well</span>
              <ArrowUpRight className="h-3.5 w-3.5 stroke-[1.75]" />
            </Link>
          </div>
        </section>

        {/* C2: KPI Row (4 tiles) */}
        <section aria-label="Key operational indicators" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiTile
            label={`Offset wells within ${radiusKm} km`}
            value={offsetWellsInRadius.length}
            subtext={`${matchedFormationCount} formation-matched`}
            onClick={() => setSelectedOffsetWellId(null)}
          />

          <KpiTile
            label="Recorded events in this formation"
            value={eventsInFormation.length}
            subtext={`Across ${offsetWellsInRadius.length} offset archives`}
            onClick={() => setHighlightedCategory(null)}
          />

          <KpiTile
            label="Next recorded hazard"
            value={
              <span className="text-[22px] truncate block leading-tight font-semibold" title={nextHazardLabel}>
                {nextHazardLabel}
              </span>
            }
            subtext={nextHazardSubtext}
            selected={Boolean(nearestAlert)}
            onClick={() => {
              if (nearestAlert && nearestAlert.events[0]) {
                const cat = nearestAlert.events[0].type as HazardCategory;
                setHighlightedCategory(cat);
              }
            }}
          />

          <KpiTile
            label="Highest historical risk index"
            value={`${highestRisk.index} / 100`}
            subtext={`${highestRisk.band} · ${highestRisk.category}`}
            selected={highlightedCategory === highestRisk.category}
            onClick={() => setHighlightedCategory(highestRisk.category)}
            badge={
              <Badge
                variant={
                  highestRisk.band === "High"
                    ? "critical"
                    : highestRisk.band === "Moderate"
                    ? "moderate"
                    : "ok"
                }
              >
                {highestRisk.band}
              </Badge>
            }
          />
        </section>

        {/* Row 3: Viewport (8 cols) + Risk Outlook & Alerts Feed (4 cols) */}
        <section aria-label="Spatial viewport and risk outlook" className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
          {/* Viewport: 8 cols, 520 px high */}
          <div className="xl:col-span-8 min-h-[520px]">
            <CommandCenterMap className="h-full" />
          </div>

          {/* Right Column: 4 cols stacked (Risk outlook + Alerts feed) */}
          <div className="xl:col-span-4 flex flex-col gap-4">
            <RiskOutlookPanel
              selectedCategory={highlightedCategory}
              onSelectCategory={setHighlightedCategory}
              className="flex-1"
            />
            <AlertsFeedPanel className="flex-1" />
          </div>
        </section>

        {/* Row 4: Offset Correlation (8 cols) + Offset Wells Table (4 cols) */}
        <section aria-label="Depth-aligned correlation and offset table" className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
          <div className="xl:col-span-8">
            <OffsetCorrelationChart
              highlightedCategory={highlightedCategory}
              className="h-full"
            />
          </div>

          <div className="xl:col-span-4">
            <OffsetWellsTable
              selectedWellId={selectedOffsetWellId}
              onSelectWell={(id) => setSelectedOffsetWellId(id)}
              className="h-full"
            />
          </div>
        </section>

        {/* Row 5: Time-depth (5 cols) + NPT Breakdown (3 cols) + Hazard Matrix (4 cols) */}
        <section aria-label="Progression and hazard analytics" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4 items-stretch">
          <div className="xl:col-span-5 md:col-span-2">
            <TimeDepthChart className="h-full" />
          </div>

          <div className="xl:col-span-3 md:col-span-1">
            <NptBreakdownChart className="h-full" />
          </div>

          <div className="xl:col-span-4 md:col-span-1">
            <HazardMatrixChart
              onCellClick={(_fmt, cat) => setHighlightedCategory(cat)}
              className="h-full"
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
