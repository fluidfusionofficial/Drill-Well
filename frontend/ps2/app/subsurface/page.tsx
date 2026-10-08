"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Activity, CircleDot, Compass, Layers3, Maximize2, Ruler, Waves } from "lucide-react";
import { AppShell } from "@/components/layout-shell";
import { PageHeader } from "@/components/page-header";
import { useNwisWorkspace } from "@/components/nwis-workspace-context";
import { formationIntervals, wellEvents, wells } from "@/lib/nwis-data";
import type { SubsurfaceLayers } from "@/components/subsurface-scene";

const SubsurfaceScene = dynamic(
  () => import("@/components/subsurface-scene").then((module) => module.SubsurfaceScene),
  {
    ssr: false,
    loading: () => <div className="grid h-full place-items-center bg-canvas text-sm text-ink-3">Preparing 3D well view…</div>,
  },
);

const layerOptions: { key: keyof SubsurfaceLayers; label: string; icon: typeof Layers3; hint: string }[] = [
  { key: "surface", label: "Rig & surface", icon: Compass, hint: "Derrick, top drive, mud pits, wellhead" },
  { key: "formations", label: "Stratigraphy", icon: Layers3, hint: "WX-07 reference depth bands" },
  { key: "drillstring", label: "Hole & string", icon: Ruler, hint: "Bore, annulus, casing, drill pipe, BHA" },
  { key: "events", label: "Events", icon: CircleDot, hint: "Offset-well event markers" },
];

export default function SubsurfacePage() {
  const { selectedWell, currentDepth, setCurrentDepth, setSelectedEventId } = useNwisWorkspace();
  const [verticalExaggeration, setVerticalExaggeration] = useState(2);
  const [isPlaying, setPlaying] = useState(false);
  const [layers, setLayers] = useState<SubsurfaceLayers>({ surface: true, formations: true, drillstring: true, events: true });
  const [isFullscreen, setFullscreen] = useState(false);

  const events = useMemo(() => wellEvents.filter((event) => event.wellId === "WX-07"), []);
  const activeFormation = formationIntervals.find((interval) => currentDepth >= interval.top && currentDepth < interval.bottom);
  const nearbyEvents = events.filter((event) => Math.abs(event.depth - currentDepth) <= 120).sort((a, b) => Math.abs(a.depth - currentDepth) - Math.abs(b.depth - currentDepth));

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          title="3D Subsurface Workspace"
          subtitle="Schematic wellbore, reference stratigraphy and offset-well event correlation for the selected well."
        />

        <div className={`grid gap-4 ${isFullscreen ? "h-[calc(100vh-8.5rem)] grid-cols-1" : "xl:grid-cols-[minmax(0,1fr)_320px]"}`}>
          <section className="flex min-h-0 flex-col overflow-hidden rounded-[6px] border border-line bg-surface">
            <header className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 bg-surface">
              <select
                aria-label="Active well"
                value={selectedWell.id}
                onChange={(event) => {
                  const next = wells.find((well) => well.id === event.target.value);
                  if (next) setDepthSafe(next.actualDepth);
                }}
                className="rounded-[4px] border border-line-strong bg-surface px-2 py-1.5 text-xs font-semibold text-ink"
              >
                {wells.map((well) => (
                  <option key={well.id} value={well.id}>
                    {well.id} · {well.formation}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-2 text-xs font-medium text-ink-2">
                <span className="whitespace-nowrap">Depth {Math.round(currentDepth)} m</span>
                <input
                  type="range"
                  min={0}
                  max={selectedWell.actualDepth}
                  step={5}
                  value={currentDepth}
                  onChange={(event) => setCurrentDepth(Number(event.target.value))}
                  className="w-40"
                />
              </label>

              <label className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
                <span className="whitespace-nowrap">Exagg {verticalExaggeration}×</span>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={1}
                  value={verticalExaggeration}
                  onChange={(event) => setVerticalExaggeration(Number(event.target.value))}
                  className="w-20"
                />
              </label>

              <button
                type="button"
                onClick={() => setPlaying((value) => !value)}
                className={`rounded-[4px] px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isPlaying ? "bg-primary text-white" : "bg-canvas text-ink-2 hover:bg-surface-muted border border-line"
                }`}
              >
                {isPlaying ? "Pause playback" : "Play demo"}
              </button>

              <button
                type="button"
                onClick={() => setFullscreen((value) => !value)}
                className="ml-auto inline-flex items-center gap-1.5 rounded-[4px] border border-line-strong px-2.5 py-1.5 text-xs font-semibold text-ink-2 transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                {isFullscreen ? "Exit full view" : "Full view"}
              </button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="relative min-h-[420px] flex-1">
                <SubsurfaceScene
                  well={selectedWell}
                  depth={currentDepth}
                  isPlaying={isPlaying}
                  verticalExaggeration={verticalExaggeration}
                  layers={layers}
                  onEventSelect={(event) => {
                    setCurrentDepth(event.depth);
                    setSelectedEventId(event.id);
                  }}
                  onDepthChange={setCurrentDepth}
                />
              </div>
            </div>
          </section>

          <aside className="space-y-3 overflow-y-auto">
            <section className="rounded-[6px] border border-line bg-surface p-3">
              <h2 className="text-xs font-semibold text-ink-2">Layers</h2>
              <div className="mt-2 space-y-1.5">
                {layerOptions.map(({ key, label, icon: Icon, hint }) => (
                  <label key={key} className="flex cursor-pointer items-start gap-2 rounded-[4px] border border-line px-2 py-1.5 transition hover:bg-surface-muted">
                    <input
                      type="checkbox"
                      checked={layers[key]}
                      onChange={() => setLayers((previous) => ({ ...previous, [key]: !previous[key] }))}
                      className="mt-0.5 accent-[#1D4ED8]"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                        <Icon className="h-3.5 w-3.5 text-ink-3" />
                        {label}
                      </span>
                      <span className="block text-xs text-ink-3">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-[6px] border border-line bg-surface p-3">
              <h2 className="text-xs font-semibold text-ink-2">At cursor</h2>
              <div className="mt-2 rounded-[4px] border border-line bg-surface-muted p-2.5">
                <div className="flex items-center justify-between">
                  <span className="rounded-[4px] bg-primary px-1.5 py-0.5 text-xs font-bold tabular-nums text-white">{Math.round(currentDepth)} m</span>
                  <span className="text-xs text-ink-3">TD {selectedWell.actualDepth} m</span>
                </div>
                {activeFormation ? (
                  <div className="mt-2">
                    <div className="text-sm font-semibold text-ink">{activeFormation.name}</div>
                    <div className="mt-0.5 text-xs text-ink-2">{activeFormation.lithology}</div>
                    <div className="mt-1 text-xs text-ink-3">
                      {activeFormation.top}–{activeFormation.bottom} m · {activeFormation.source} · {activeFormation.confidence}
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-ink-3">Outside reference picks.</p>
                )}
              </div>
            </section>

            <section className="rounded-[6px] border border-line bg-surface p-3">
              <h2 className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
                <Activity className="h-3.5 w-3.5" />
                Offset events within ±120 m
              </h2>
              <ul className="mt-2 space-y-1.5">
                {nearbyEvents.length === 0 && <li className="text-xs text-ink-3">No WX-07 events recorded near this depth.</li>}
                {nearbyEvents.map((event) => (
                  <li key={event.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentDepth(event.depth);
                        setSelectedEventId(event.id);
                      }}
                      className="w-full rounded-[4px] border border-line px-2 py-1.5 text-left transition hover:border-line-strong hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-ink">{event.type}</span>
                        <span className="text-xs tabular-nums text-ink-2">{event.depth} m</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-3">
                        {event.formation} · {event.date} · {event.source}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-[6px] border border-line bg-surface p-3">
              <h2 className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
                <Waves className="h-3.5 w-3.5" />
                How to read this
              </h2>
              <ul className="mt-2 space-y-1.5 text-xs leading-5 text-ink-2">
                <li>Drag to orbit, scroll to zoom, right-drag to pan.</li>
                <li>Click any event sphere to open its source record.</li>
                <li>Use Drill / Trip / Hold inside the scene to run a stand-by-stand operation.</li>
                <li>Vertical exaggeration stretches depth only — widths are not to scale.</li>
                <li>Casing is a schematic envelope; fixture has no casing source depths.</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );

  function setDepthSafe(depth: number) {
    setCurrentDepth(Math.max(0, Math.min(selectedWell.actualDepth, depth)));
  }
}
