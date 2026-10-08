"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  Pause,
  Play,
  RotateCcw,
  SkipBack,
} from "lucide-react";
import { useNwisWorkspace } from "@/components/nwis-workspace-context";
import { FormationDepthView } from "@/components/formation-depth-view";
import type { SubsurfaceLayers } from "@/components/subsurface-scene";
import { wells } from "@/lib/nwis-data";
import type { EventRecord } from "@/lib/nwis-data";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { IconButton } from "@/components/ui/Button";

const WellMapCanvas = dynamic(
  () => import("@/components/well-map-canvas").then((module) => module.WellMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center bg-surface-muted text-xs text-ink-3">
        Loading field map…
      </div>
    ),
  },
);

const SubsurfaceScene = dynamic(
  () => import("@/components/subsurface-scene").then((module) => module.SubsurfaceScene),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center bg-surface text-xs text-ink-3">
        Preparing 3D subsurface view…
      </div>
    ),
  },
);

type ViewMode = "subsurface" | "map" | "depth";

export function CommandCenterMap({ className = "" }: { className?: string }) {
  const {
    selectedWell,
    setSelectedWellId,
    currentDepth,
    setCurrentDepth,
    setSelectedEventId,
    radiusKm,
  } = useNwisWorkspace();

  const [focusKey, setFocusKey] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("subsurface");
  const [isPlaying, setIsPlaying] = useState(false);
  const [sceneKey, setSceneKey] = useState(0);
  const [verticalExaggeration, setVerticalExaggeration] = useState(1);
  const [visibleLayers, setVisibleLayers] = useState<SubsurfaceLayers>({
    surface: true,
    formations: true,
    drillstring: true,
    events: true,
  });

  const selectWell = (wellId: string) => {
    const well = wells.find((item) => item.id === wellId);
    if (well) {
      setSelectedWellId(well.id);
      setCurrentDepth(well.currentDepth);
    }
  };

  useEffect(() => {
    if (!isPlaying) return;
    const playback = window.setInterval(() => {
      setCurrentDepth((depth) =>
        depth >= selectedWell.actualDepth
          ? 0
          : Math.min(depth + 10, selectedWell.actualDepth),
      );
    }, 140);
    return () => window.clearInterval(playback);
  }, [isPlaying, selectedWell.actualDepth, setCurrentDepth]);

  const viewOptions = [
    { value: "subsurface", label: "3D subsurface" },
    { value: "map", label: "2D field map" },
    { value: "depth", label: "Depth section" },
  ];

  const scaleOptions = [
    { value: 1, label: "1×" },
    { value: 2, label: "2×" },
    { value: 4, label: "4×" },
  ];

  return (
    <section
      aria-label="Subsurface and field map viewport"
      className={`rounded-[6px] border border-line bg-surface flex flex-col overflow-hidden ${className}`}
    >
      {/* Light Primary Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-line px-3.5 py-2.5 gap-2 bg-surface">
        <div className="flex items-center gap-3">
          <SegmentedControl
            options={viewOptions}
            value={viewMode}
            onChange={(val) => setViewMode(val as ViewMode)}
            size="sm"
          />
          <span className="hidden sm:inline text-xs text-ink-3 tabular-nums">
            {selectedWell.id} · {selectedWell.location} · {Math.round(currentDepth)} m MD
          </span>
        </div>

        {/* Playback & View Controls */}
        <div className="flex items-center gap-1.5">
          <IconButton
            size="sm"
            label={isPlaying ? "Pause depth playback" : "Play depth progression"}
            onClick={() => setIsPlaying((p) => !p)}
            variant={isPlaying ? "primary" : "secondary"}
          >
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </IconButton>

          <IconButton
            size="sm"
            label="Reset depth to surface"
            onClick={() => {
              setIsPlaying(false);
              setCurrentDepth(0);
            }}
            variant="secondary"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </IconButton>

          <IconButton
            size="sm"
            label={viewMode === "subsurface" ? "Reset 3D camera" : "Reset map view"}
            onClick={() => {
              if (viewMode === "subsurface") setSceneKey((k) => k + 1);
              else setFocusKey((k) => k + 1);
            }}
            variant="secondary"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      {/* Secondary Subsurface Layer & Scale Toolbar */}
      {viewMode === "subsurface" && (
        <div className="flex flex-wrap items-center justify-between border-b border-line px-3.5 py-2 gap-3 bg-surface-muted/40 text-xs">
          {/* Layer checkboxes */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium text-ink-3">Layers:</span>
            {(
              [
                ["surface", "Surface"],
                ["formations", "WX-07 formations"],
                ["drillstring", "Drillstring + annulus"],
                ["events", "Historical events"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="inline-flex items-center gap-1.5 cursor-pointer text-ink-2 select-none"
              >
                <input
                  type="checkbox"
                  checked={visibleLayers[key]}
                  onChange={() =>
                    setVisibleLayers((curr) => ({ ...curr, [key]: !curr[key] }))
                  }
                  className="rounded-[3px] border-line text-accent focus:ring-accent focus:ring-offset-1 h-3.5 w-3.5"
                />
                <span>{label}</span>
              </label>
            ))}
            <span className="text-ink-3">Casing: source data unavailable</span>
          </div>

          {/* Vertical Scale Segmented Control */}
          <div className="flex items-center gap-1.5">
            <span className="text-ink-3">Vertical scale:</span>
            <SegmentedControl
              options={scaleOptions}
              value={verticalExaggeration}
              onChange={(val) => setVerticalExaggeration(val)}
              size="sm"
            />
          </div>
        </div>
      )}

      {/* Viewport Canvas (520px high) */}
      <div className="relative h-[520px] w-full bg-surface overflow-hidden">
        {viewMode === "map" && (
          <div className="h-full w-full bg-canvas">
            <WellMapCanvas
              wells={wells}
              activeWell={selectedWell}
              radiusKm={radiusKm}
              focusKey={focusKey}
              onWellSelect={(well) => {
                selectWell(well.id);
                setFocusKey((k) => k + 1);
              }}
            />
            <div className="pointer-events-none absolute left-3 top-3 z-30 rounded-[6px] border border-line bg-surface/95 p-3 shadow-md text-xs text-ink max-w-xs">
              <div className="font-semibold text-sm">{selectedWell.id}</div>
              <div className="text-ink-2">{selectedWell.location} · {selectedWell.rig}</div>
              <div className="text-ink-3 mt-1">{selectedWell.formation}</div>
            </div>
          </div>
        )}

        {viewMode === "subsurface" && (
          <SubsurfaceScene
            key={sceneKey}
            well={selectedWell}
            depth={currentDepth}
            isPlaying={isPlaying}
            verticalExaggeration={verticalExaggeration}
            layers={visibleLayers}
            onEventSelect={(event: EventRecord) => {
              setCurrentDepth(event.depth);
              setSelectedEventId(event.id);
            }}
            onDepthChange={setCurrentDepth}
          />
        )}

        {viewMode === "depth" && (
          <div className="h-full w-full bg-surface overflow-auto">
            <FormationDepthView />
          </div>
        )}
      </div>
    </section>
  );
}
