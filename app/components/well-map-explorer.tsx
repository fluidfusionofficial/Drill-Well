"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Activity, Crosshair, MapPinned, Search, SlidersHorizontal } from "lucide-react";
import { alerts, currentWell, wells, wellEvents } from "@/lib/nwis-data";
import type { Well } from "@/lib/nwis-data";
import { useNwisWorkspace } from "@/components/nwis-workspace-context";
import { ProvenanceChip } from "@/components/ui/ProvenanceChip";

const statusColors: Record<string, string> = {
  Active: "#1D4ED8",
  Monitor: "#A96F00",
  "Drilling Complete": "#2E7D32",
  Completed: "#2E7D32",
  Standby: "#D9560B",
  Producing: "#2E7D32",
  Suspended: "#A96F00",
  Abandoned: "#667085",
};

const WellMapCanvas = dynamic(
  () => import("@/components/well-map-canvas").then((module) => module.WellMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-surface-muted text-sm text-ink-3">
        Loading spatial layers…
      </div>
    ),
  },
);

function distanceKm(from: Well, to: Well) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latDistance = radians(to.coordinates.lat - from.coordinates.lat);
  const lngDistance = radians(to.coordinates.lng - from.coordinates.lng);
  const a =
    Math.sin(latDistance / 2) ** 2 +
    Math.cos(radians(from.coordinates.lat)) *
      Math.cos(radians(to.coordinates.lat)) *
      Math.sin(lngDistance / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function WellMapExplorer() {
  const { radiusKm: contextRadiusKm, setRadiusKm: setContextRadiusKm } = useNwisWorkspace();
  const [radiusKm, setRadiusKm] = useState(contextRadiusKm || 15);
  const [formation, setFormation] = useState("All formations");
  const [eventType, setEventType] = useState("All events");
  const [activeWellId, setActiveWellId] = useState(currentWell.id);
  const [focusKey, setFocusKey] = useState(0);

  const activeWell = useMemo(
    () => wells.find((well) => well.id === activeWellId) ?? currentWell,
    [activeWellId],
  );

  const visibleWells = useMemo(
    () =>
      wells.filter((well) => {
        const withinRadius = distanceKm(activeWell, well) <= radiusKm || well.id === activeWell.id;
        const matchesFormation =
          formation === "All formations" ||
          well.formation.toLowerCase().includes(formation.toLowerCase());
        const matchesEvent =
          eventType === "All events" ||
          wellEvents.some(
            (event) =>
              event.wellId === well.id &&
              event.type.toLowerCase().includes(eventType.toLowerCase().replace(" event", "")),
          );

        return withinRadius && matchesFormation && matchesEvent;
      }),
    [activeWell, eventType, formation, radiusKm],
  );

  const selectWell = (well: Well) => {
    setActiveWellId(well.id);
    setFocusKey((key) => key + 1);
  };

  const handleRadiusChange = (newRadius: number) => {
    setRadiusKm(newRadius);
    setContextRadiusKm(newRadius);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
      {/* Sidebar Controls */}
      <aside className="rounded-[6px] border border-line bg-surface p-4 text-ink flex flex-col gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-ink-3">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Spatial filters</span>
        </div>

        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="well-radius" className="text-xs font-medium text-ink">
                Search radius
              </label>
              <span className="text-xs font-semibold tabular-nums text-accent">{radiusKm} km</span>
            </div>
            <input
              id="well-radius"
              type="range"
              min="1"
              max="50"
              value={radiusKm}
              onChange={(event) => handleRadiusChange(Number(event.target.value))}
              className="w-full accent-accent cursor-pointer"
            />
            <div className="mt-1 flex justify-between text-xs text-ink-3 tabular-nums">
              <span>1 km</span>
              <span>50 km</span>
            </div>
          </div>

          <div>
            <label htmlFor="formation-filter" className="mb-1.5 block text-xs font-medium text-ink">
              Formation
            </label>
            <select
              id="formation-filter"
              value={formation}
              onChange={(event) => setFormation(event.target.value)}
              className="w-full rounded-[4px] border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            >
              <option>All formations</option>
              <option>Upper Carbonate</option>
              <option>Jodhpur</option>
              <option>Bilara</option>
            </select>
          </div>

          <div>
            <label htmlFor="event-filter" className="mb-1.5 block text-xs font-medium text-ink">
              Event type
            </label>
            <select
              id="event-filter"
              value={eventType}
              onChange={(event) => setEventType(event.target.value)}
              className="w-full rounded-[4px] border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            >
              <option>All events</option>
              <option>Mud Loss</option>
              <option>Tight Pull</option>
              <option>Casing Event</option>
            </select>
          </div>

          <div className="rounded-[4px] border border-accent/20 bg-primary-soft p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
              <Search className="h-3.5 w-3.5" />
              <span>Search context</span>
            </div>
            <div className="mt-1.5 text-xs leading-relaxed text-ink-2">{alerts[0].context}</div>
          </div>

          <div className="rounded-[4px] border border-line p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-3">
              <Activity className="h-3.5 w-3.5" />
              <span>Visible wells</span>
            </div>
            <div className="mt-1.5 text-2xl font-semibold tabular-nums text-ink">
              {visibleWells.length}
            </div>
            <div className="text-xs text-ink-3">Wells match current filters</div>
            <ul className="mt-3 space-y-1 max-h-[220px] overflow-y-auto pr-0.5">
              {visibleWells.map((well) => (
                <li key={well.id}>
                  <button
                    type="button"
                    onClick={() => selectWell(well)}
                    className={`flex w-full items-center justify-between gap-2 rounded-[4px] border px-2 py-1.5 text-left transition ${
                      well.id === activeWell.id
                        ? "border-accent bg-primary-soft text-accent"
                        : "border-line hover:border-line-strong hover:bg-surface-muted text-ink"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: statusColors[well.status] ?? "#667085" }}
                      />
                      <span className="truncate text-xs font-medium">{well.id}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-ink-3">
                      {well.actualDepth.toLocaleString("en-IN")} m
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      {/* Main Map View */}
      <section className="overflow-hidden rounded-[6px] border border-line bg-surface p-4 flex flex-col">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-ink">
            <MapPinned className="h-3.5 w-3.5 text-accent" />
            <span>Rajasthan basin · Active well area</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-ink-2">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Selected well
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-ink-2" />
              Offset well
            </span>
            {Object.entries(statusColors)
              .filter(([status]) => wells.some((well) => well.status === status))
              .slice(0, 3)
              .map(([status, color]) => (
                <span key={status} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  {status}
                </span>
              ))}
            <span className="rounded-[4px] border border-line bg-surface-muted px-2 py-0.5 text-xs text-ink-3">
              MapLibre GL Vector
            </span>
          </div>
        </div>

        <div className="relative h-[600px] overflow-hidden rounded-[4px] border border-line bg-canvas">
          <WellMapCanvas
            wells={visibleWells}
            activeWell={activeWell}
            radiusKm={radiusKm}
            onWellSelect={selectWell}
            focusKey={focusKey}
          />
          {/* Selected context hover card */}
          <div className="pointer-events-none absolute left-3 top-3 z-[500] max-w-[240px] rounded-[6px] border border-line bg-surface/95 p-2.5 shadow-md text-ink">
            <div className="text-xs font-semibold text-accent">Active context</div>
            <div className="mt-0.5 text-sm font-semibold text-ink">
              {activeWell.id} · {activeWell.formation}
            </div>
            <div className="mt-0.5 text-xs text-ink-2 tabular-nums">
              {visibleWells.length} locations within {radiusKm} km radius
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-3 right-3 z-[500] hidden max-w-[260px] rounded-[6px] border border-line bg-surface/95 p-2.5 text-xs leading-normal text-ink-2 shadow-md sm:block">
            <div className="flex items-center gap-1.5 font-semibold text-ink">
              <Crosshair className="h-3.5 w-3.5 text-accent" />
              <span>Map guide</span>
            </div>
            <div className="mt-1 text-ink-3">
              Dashed ring indicates {radiusKm} km context radius from {activeWell.id}.
            </div>
            <div className="mt-0.5 text-ink-3">
              Open-source styles available in the top-right MapLibre control.
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <ProvenanceChip
            source="Oil India field coordinates"
            recordCount={wells.length}
            simulatedCount={0}
          />
          <span className="text-xs text-ink-3">
            Powered by MapLibre GL open-source tools · © OpenFreeMap · © OpenStreetMap contributors
          </span>
        </div>
      </section>
    </div>
  );
}
