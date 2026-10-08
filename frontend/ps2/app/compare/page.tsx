"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, CalendarDays, Crosshair, Link2, MapPin } from "lucide-react";
import { AppShell } from "@/components/layout-shell";
import { PageHeader } from "@/components/page-header";
import { useNwisWorkspace } from "@/components/nwis-workspace-context";
import { formationIntervals, wellEvents, wells } from "@/lib/nwis-data";
import type { Well } from "@/lib/nwis-data";
import { Badge } from "@/components/ui/Badge";
import { ProvenanceChip } from "@/components/ui/ProvenanceChip";
import { EventGlyph } from "@/components/ui/EventGlyph";
import { classifyEvent } from "@/lib/taxonomy";

const maxDepth = 1200;
const formationColors = [
  "#E8D5A3",
  "#DCCFB0",
  "#BDBFB6",
  "#BFCBDB",
  "#CDC3DE",
  "#E3CFE0",
  "#9AA0AA",
  "#BFCBDB",
  "#E8D5A3",
  "#9AA0AA",
];

export default function ComparePage() {
  const { selectedWell, currentDepth, setCurrentDepth, setSelectedEventId } = useNwisWorkspace();
  const candidateWells = wells.filter((well) => well.id !== selectedWell.id);
  const [requestedOffsetWellId, setRequestedOffsetWellId] = useState(
    () => candidateWells[0]?.id ?? wells[0].id,
  );
  const [syncDepth, setSyncDepth] = useState(true);
  const [offsetDepth, setOffsetDepth] = useState(currentDepth);
  const [alignMode, setAlignMode] = useState<"surface" | "formation">("surface");

  const offsetWell =
    candidateWells.find((well) => well.id === requestedOffsetWellId) ??
    candidateWells[0] ??
    wells[0];
  const offsetWellId = offsetWell.id;

  const offsetEvents = useMemo(
    () =>
      wellEvents.filter(
        (event) => event.wellId === selectedWell.id || event.wellId === offsetWell.id,
      ),
    [offsetWell.id, selectedWell.id],
  );

  const selectOffsetWell = (wellId: string) => {
    setRequestedOffsetWellId(wellId);
    const nextWell = wells.find((well) => well.id === wellId);
    if (nextWell && !syncDepth) setOffsetDepth(nextWell.currentDepth);
  };

  const toggleDepthSync = () => {
    if (syncDepth) setOffsetDepth(currentDepth);
    setSyncDepth((enabled) => !enabled);
  };

  const selectEvent = (eventId: string, eventDepth: number) => {
    setCurrentDepth(eventDepth);
    setOffsetDepth(eventDepth);
    setSelectedEventId(eventId);
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          title="Well correlation & comparison"
          description="Depth-aligned offset comparison and incident precedent analysis across active and offset wells."
        />

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-line bg-surface p-3 text-xs">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div>
              <span className="mr-1.5 text-ink-3">Active well:</span>
              <strong className="text-ink font-semibold">{selectedWell.id}</strong>
              <span className="ml-1.5 text-ink-2">({selectedWell.location})</span>
            </div>
            <div className="inline-flex items-center gap-1.5 text-ink-2">
              <Crosshair className="h-3.5 w-3.5 text-accent" />
              <span className="tabular-nums font-medium text-ink">
                {Math.round(currentDepth)} m MD
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-ink-3">Align by:</span>
              <button
                type="button"
                onClick={() => setAlignMode("surface")}
                className={`rounded-[4px] px-2 py-1 text-xs font-medium border transition ${
                  alignMode === "surface"
                    ? "bg-primary border-accent text-white"
                    : "bg-surface border-line text-ink-2 hover:bg-surface-muted"
                }`}
              >
                Surface 0 m
              </button>
              <button
                type="button"
                onClick={() => setAlignMode("formation")}
                className={`rounded-[4px] px-2 py-1 text-xs font-medium border transition ${
                  alignMode === "formation"
                    ? "bg-primary border-accent text-white"
                    : "bg-surface border-line text-ink-2 hover:bg-surface-muted"
                }`}
              >
                Upper Carbonate top
              </button>
            </div>

            <label className="flex items-center gap-2 text-xs text-ink-2">
              <span className="text-ink-3">Offset well:</span>
              <select
                value={offsetWellId}
                onChange={(event) => selectOffsetWell(event.target.value)}
                className="h-8 rounded-[4px] border border-line bg-surface px-2.5 text-xs font-medium text-ink outline-none focus:border-accent"
              >
                {candidateWells.map((well) => (
                  <option key={well.id} value={well.id}>
                    {well.id} · {well.location} ({well.targetDepth} m)
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Depth Correlation Viewport */}
        <section className="overflow-hidden rounded-[6px] border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5 bg-surface-muted/30">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink">
              <ArrowRightLeft className="h-4 w-4 text-accent" />
              <span>Depth-aligned correlation track</span>
            </div>
            <button
              type="button"
              aria-pressed={syncDepth}
              onClick={toggleDepthSync}
              className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2.5 py-1 text-xs font-medium transition ${
                syncDepth
                  ? "border-accent bg-primary-soft text-accent"
                  : "border-line bg-surface text-ink-2 hover:bg-surface-muted"
              }`}
            >
              <Link2 className="h-3.5 w-3.5" />
              Depth sync: {syncDepth ? "Locked" : "Independent"}
            </button>
          </div>

          <div className="grid divide-y divide-line lg:grid-cols-2 lg:divide-x lg:divide-y-0">
            <WellDepthTrack
              well={selectedWell}
              depth={currentDepth}
              roleLabel="Active well"
              events={offsetEvents.filter((event) => event.wellId === selectedWell.id)}
            />
            <WellDepthTrack
              well={offsetWell}
              depth={syncDepth ? currentDepth : offsetDepth}
              roleLabel="Offset well"
              events={offsetEvents.filter((event) => event.wellId === offsetWell.id)}
            />
          </div>

          <div className="border-t border-line bg-surface-muted/40 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-[260px] flex-1 items-center gap-3">
                <label
                  htmlFor="compare-depth"
                  className="shrink-0 text-xs font-medium text-ink"
                >
                  Depth cursor
                </label>
                <input
                  id="compare-depth"
                  aria-label="Comparison measured depth"
                  type="range"
                  min="0"
                  max={maxDepth}
                  value={syncDepth ? currentDepth : offsetDepth}
                  onChange={(event) =>
                    syncDepth
                      ? setCurrentDepth(Number(event.target.value))
                      : setOffsetDepth(Number(event.target.value))
                  }
                  className="min-w-0 flex-1 accent-accent cursor-pointer"
                />
                <span className="w-20 shrink-0 text-right text-xs font-semibold tabular-nums text-ink">
                  {(syncDepth ? currentDepth : offsetDepth).toLocaleString("en-IN")} m MD
                </span>
              </div>
              <span className="text-xs text-ink-3">
                {syncDepth
                  ? "Cursor locked to active well depth across tracks."
                  : "Offset cursor moves independently."}
              </span>
            </div>
          </div>
        </section>

        {/* Anchored Events Table */}
        <section className="overflow-hidden rounded-[6px] border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <h2 className="text-xs font-semibold text-ink">Depth-anchored event precedents</h2>
              <p className="text-xs text-ink-3">
                Click any incident to move the depth cursor to that depth
              </p>
            </div>
            <Badge variant="neutral">{offsetEvents.length} recorded events</Badge>
          </div>
          <div className="divide-y divide-line">
            {offsetEvents.length ? (
              offsetEvents.map((event) => {
                const cat = classifyEvent(event.type);
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => selectEvent(event.id, event.depth)}
                    className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-left hover:bg-surface-muted transition text-xs"
                  >
                    <span className="inline-flex min-w-[140px] items-center gap-2 font-medium text-ink">
                      <EventGlyph category={cat} size={14} />
                      <span>{event.type}</span>
                    </span>
                    <span className="font-semibold text-ink tabular-nums">
                      {event.wellId} · {event.depth} m MD
                    </span>
                    <span className="text-ink-2">{event.formation}</span>
                    <span className="inline-flex items-center gap-1 text-ink-3 tabular-nums">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {event.date}
                    </span>
                    <Badge
                      variant={
                        event.severity === "Critical"
                          ? "critical"
                          : event.severity === "High"
                          ? "high"
                          : "moderate"
                      }
                    >
                      {event.severity}
                    </Badge>
                    <span className="ml-auto text-xs text-ink-3 truncate max-w-[200px]">
                      {event.source} · {event.sourcePage}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-5 text-xs text-ink-3">
                No recorded event precedents exist for this well pair in current records.
              </div>
            )}
          </div>
        </section>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-3 pt-1">
          <ProvenanceChip
            source="Oil India correlation register"
            recordCount={offsetEvents.length}
            simulatedCount={0}
          />
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 font-medium text-accent hover:text-accent-hover"
          >
            <MapPin className="h-3.5 w-3.5" />
            <span>Return to command center</span>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function WellDepthTrack({
  well,
  depth,
  roleLabel,
  events,
}: {
  well: Well;
  depth: number;
  roleLabel: string;
  events: typeof wellEvents;
}) {
  const hasFormationPicks = well.id === "WX-07";

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
        <div>
          <div className="text-xs font-semibold text-ink-3">{roleLabel}</div>
          <div className="mt-0.5 text-base font-semibold text-ink">
            {well.id}{" "}
            <span className="text-xs font-normal text-ink-3">· {well.location}</span>
          </div>
          <div className="mt-0.5 text-xs text-ink-2">
            {well.profile} · {well.rig} · {well.status}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold text-ink-3">
            {hasFormationPicks ? "Reference formation top" : "Formation"}
          </div>
          <div className="mt-0.5 max-w-[160px] text-xs font-semibold text-ink truncate">
            {hasFormationPicks
              ? formationIntervals.find(
                  (interval) => depth >= interval.top && depth < interval.bottom,
                )?.name ?? "Outside reference picks"
              : well.formation}
          </div>
          <div className="mt-0.5 text-xs font-semibold tabular-nums text-accent">
            {depth.toLocaleString("en-IN")} m MD
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[56px_minmax(0,1fr)] gap-2">
        <div className="relative h-[340px] border-r border-line text-xs tabular-nums text-ink-3">
          {[0, 200, 400, 600, 800, 1000, 1200].map((tick) => (
            <span
              key={tick}
              className="absolute left-0 -translate-y-1/2"
              style={{ top: `${(tick / maxDepth) * 100}%` }}
            >
              {tick}m
            </span>
          ))}
        </div>
        <div className="relative h-[340px] overflow-hidden border border-line bg-surface-muted/30">
          {hasFormationPicks ? (
            formationIntervals.map((interval, index) => (
              <div
                key={interval.name}
                className="absolute inset-x-0 flex items-center justify-between border-b border-line px-2 text-xs"
                style={{
                  top: `${(interval.top / maxDepth) * 100}%`,
                  height: `${(interval.thickness / maxDepth) * 100}%`,
                  backgroundColor: formationColors[index % formationColors.length],
                }}
              >
                <span className="truncate text-xs font-medium text-ink">{interval.name}</span>
                <span className="hidden text-xs text-ink-3 sm:inline">{interval.source}</span>
              </div>
            ))
          ) : (
            <div className="absolute inset-x-0 top-0 flex h-full items-center justify-center border-y border-dashed border-line bg-surface p-4 text-center">
              <span className="max-w-[220px] text-xs leading-normal text-ink-3">
                No depth-specific formation picks in this well fixture. Recorded well formation:{" "}
                <strong className="text-ink font-semibold">{well.formation}</strong>
              </span>
            </div>
          )}

          {events.map((event, index) => {
            const cat = classifyEvent(event.type);
            return (
              <span
                key={event.id}
                title={`${event.type} · ${event.depth} m MD · ${event.source}`}
                className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${32 + (index % 3) * 18}%`,
                  top: `${(event.depth / maxDepth) * 100}%`,
                }}
              >
                <EventGlyph category={cat} size={15} />
              </span>
            );
          })}

          <div
            className="absolute inset-x-0 z-30 border-t-2 border-dashed border-accent"
            style={{ top: `${Math.min((depth / maxDepth) * 100, 100)}%` }}
          >
            <span className="absolute right-1 top-0 -translate-y-1/2 rounded-[3px] bg-primary px-1.5 py-0.5 text-xs font-semibold text-white tabular-nums">
              {well.id} · {Math.round(depth)}m
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-3">
        <span>
          Planned TD:{" "}
          <strong className="text-ink font-medium">
            {well.projectedTD.toLocaleString("en-IN")} m
          </strong>
        </span>
        <span>
          Actual TD:{" "}
          <strong className="text-ink font-medium">
            {well.actualDepth.toLocaleString("en-IN")} m
          </strong>
        </span>
        <span>
          Target:{" "}
          <strong className="text-ink font-medium truncate max-w-[120px]">
            {well.targetFormation}
          </strong>
        </span>
      </div>
    </div>
  );
}
