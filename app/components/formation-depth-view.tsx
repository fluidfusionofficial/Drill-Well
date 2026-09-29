"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Activity, Crosshair, Expand, Eye, Layers3, Minimize2, Ruler, TriangleAlert, Waves, X } from "lucide-react";
import { useNwisWorkspace } from "@/components/nwis-workspace-context";
import { formationIntervals, mudRecords, wellEvents } from "@/lib/nwis-data";
import type { FormationInterval } from "@/lib/nwis-data";

const maxDepth = 1200;
const referenceEvents = wellEvents.filter((event) => event.wellId === "WX-07");
const referenceWellId = "WX-07";

type LithologyKey = "alluvium" | "sandstone" | "mixed" | "carbonate" | "claystone" | "evaporite" | "basement";

const lithologyStyles: Record<LithologyKey, { label: string; base: string; deep: string }> = {
  alluvium: { label: "Alluvial / clastic", base: "#cdb183", deep: "#9a7c50" },
  sandstone: { label: "Sandstone", base: "#dcb87e", deep: "#ab8148" },
  mixed: { label: "Sandstone + clay", base: "#cbb089", deep: "#8b7754" },
  carbonate: { label: "Carbonate", base: "#a3babe", deep: "#6d868d" },
  claystone: { label: "Claystone", base: "#adb4a8", deep: "#7b8479" },
  evaporite: { label: "Evaporite / mixed", base: "#baabc6", deep: "#7e6f91" },
  basement: { label: "Basement", base: "#7c848f", deep: "#49515b" },
};

const legendOrder: LithologyKey[] = ["alluvium", "sandstone", "mixed", "carbonate", "claystone", "evaporite", "basement"];

/** Pure-CSS lithology texture. Works anywhere (including portalled overlays) — no SVG def dependency. */
function lithologyTexture(key: LithologyKey): { image: string; size: string } {
  const { base, deep } = lithologyStyles[key];
  switch (key) {
    case "alluvium":
      return {
        image: `radial-gradient(circle at 28% 32%, rgba(84,64,36,0.5) 0 1.4px, transparent 1.5px),
                radial-gradient(circle at 72% 66%, rgba(255,242,214,0.45) 0 1.1px, transparent 1.2px),
                radial-gradient(circle at 55% 12%, rgba(120,96,58,0.35) 0 1.8px, transparent 1.9px),
                linear-gradient(168deg, ${base}, ${deep})`,
        size: "9px 9px, 13px 13px, 17px 17px, 100% 100%",
      };
    case "sandstone":
      return {
        image: `repeating-linear-gradient(180deg, rgba(120,88,44,0.22) 0 1px, transparent 1px 7px),
                repeating-linear-gradient(90deg, rgba(255,246,222,0.16) 0 1px, transparent 1px 5px),
                linear-gradient(172deg, ${base}, ${deep})`,
        size: "100% 8px, 6px 100%, 100% 100%",
      };
    case "mixed":
      return {
        image: `repeating-linear-gradient(180deg, rgba(150,160,140,0.85) 0 5px, rgba(150,160,140,0) 5px 17px),
                repeating-linear-gradient(180deg, rgba(255,244,220,0.2) 0 1px, transparent 1px 9px),
                linear-gradient(172deg, ${base}, ${deep})`,
        size: "100% 18px, 100% 9px, 100% 100%",
      };
    case "carbonate":
      return {
        image: `repeating-linear-gradient(176deg, rgba(78,104,112,0.3) 0 1.2px, transparent 1.2px 9px),
                repeating-linear-gradient(4deg, rgba(255,255,255,0.16) 0 1px, transparent 1px 14px),
                linear-gradient(170deg, ${base}, ${deep})`,
        size: "100% 10px, 100% 15px, 100% 100%",
      };
    case "claystone":
      return {
        image: `repeating-linear-gradient(180deg, rgba(104,112,100,0.24) 0 1px, transparent 1px 5px),
                linear-gradient(174deg, ${base}, ${deep})`,
        size: "100% 6px, 100% 100%",
      };
    case "evaporite":
      return {
        image: `radial-gradient(ellipse 5px 3px at 26% 32%, rgba(240,232,250,0.6) 0 60%, transparent 62%),
                radial-gradient(ellipse 4px 3px at 72% 68%, rgba(96,80,120,0.45) 0 60%, transparent 62%),
                repeating-linear-gradient(180deg, rgba(255,255,255,0.12) 0 1px, transparent 1px 11px),
                linear-gradient(168deg, ${base}, ${deep})`,
        size: "19px 19px, 23px 23px, 100% 12px, 100% 100%",
      };
    case "basement":
      return {
        image: `repeating-linear-gradient(45deg, rgba(38,44,52,0.35) 0 1px, transparent 1px 7px),
                repeating-linear-gradient(-45deg, rgba(38,44,52,0.35) 0 1px, transparent 1px 7px),
                radial-gradient(circle at 50% 50%, rgba(190,200,210,0.22) 0 1.6px, transparent 1.7px),
                linear-gradient(166deg, ${base}, ${deep})`,
        size: "100% 8px, 100% 8px, 11px 11px, 100% 100%",
      };
  }
}

function lithologyKey(interval: FormationInterval): LithologyKey {
  const text = `${interval.name} ${interval.lithology}`.toLowerCase();
  if (text.includes("basement")) return "basement";
  if (text.includes("evaporit")) return "evaporite";
  if (text.includes("alluvium")) return "alluvium";
  if (text.includes("interbed")) return "mixed";
  if (text.includes("carbonate") || text.includes("limestone") || text.includes("dolomit")) return "carbonate";
  if (text.includes("clay")) return "claystone";
  if (text.includes("sandstone") || text.includes("arenite") || text.includes("siltstone")) return "sandstone";
  return "mixed";
}

function createRandom(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

type Track = {
  key: string;
  label: string;
  longLabel: string;
  unit: string;
  min: number;
  max: number;
  simulated: boolean;
  path: string;
  area: string;
  picks?: { depth: number; value: number }[];
};

function buildTracks() {
  const random = createRandom(20250928);
  const samples = 90;
  const gaussian = (depth: number, center: number, spread: number) => Math.exp(-((depth - center) ** 2) / (2 * spread ** 2));

  const series = (valueAt: (depth: number, jitter: number) => number) => {
    const points: { depth: number; value: number }[] = [];
    for (let index = 0; index <= samples; index += 1) {
      const depth = (index / samples) * maxDepth;
      points.push({ depth, value: valueAt(depth, (random() - 0.5) * 2) });
    }
    return points;
  };

  const toPath = (points: { depth: number; value: number }[], min: number, max: number) =>
    points
      .map((point, index) => {
        const x = Math.max(0, Math.min(100, ((point.value - min) / (max - min)) * 100));
        const y = (point.depth / maxDepth) * 1200;
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(1)}`;
      })
      .join(" ");

  const toArea = (points: { depth: number; value: number }[], min: number, max: number) => {
    if (points.length === 0) return "";
    const firstX = Math.max(0, Math.min(100, ((points[0].value - min) / (max - min)) * 100));
    const lastY = (points[points.length - 1].depth / maxDepth) * 1200;
    return `${toPath(points, min, max)} L${firstX.toFixed(2)},${lastY.toFixed(1)} L0,${lastY.toFixed(1)} Z`;
  };

  const rop = series((depth, jitter) => {
    const soft = depth < 230 ? 22 : depth < 420 ? 15 : depth < 560 ? 9 : depth < 700 ? 12 : depth < 900 ? 7 : 14;
    return Math.max(0, soft - gaussian(depth, 540, 26) * 5 + jitter * 1.4);
  });
  const wob = series((depth, jitter) => Math.max(0, 6.5 + (depth / maxDepth) * 4.2 + jitter * 0.18));
  const torque = series((depth, jitter) => Math.max(0, 58 + (depth / maxDepth) * 26 + gaussian(depth, 512, 9) * 34 + gaussian(depth, 741, 8) * 18 + jitter * 1.1));
  const spp = series((depth, jitter) => Math.max(0, 2450 + (depth / maxDepth) * 900 + jitter * 18));
  const caliper = series((depth, jitter) => Math.max(0, 8.5 + gaussian(depth, 528, 22) * 2.4 + gaussian(depth, 507, 8) * 0.9 + jitter * 0.05));

  const mudPicks = mudRecords
    .map((record) => ({ depth: record.depth, value: Number.parseFloat(record.mudWeight) }))
    .filter((pick) => Number.isFinite(pick.value))
    .sort((a, b) => a.depth - b.depth);

  return [
    { key: "rop", label: "ROP", longLabel: "Rate of penetration", unit: "m/hr", min: 0, max: 26, simulated: true, path: toPath(rop, 0, 26), area: toArea(rop, 0, 26) },
    { key: "wob", label: "WOB", longLabel: "Weight on bit", unit: "t", min: 0, max: 13, simulated: true, path: toPath(wob, 0, 13), area: toArea(wob, 0, 13) },
    { key: "tq", label: "TQ", longLabel: "Torque", unit: "kN·m", min: 40, max: 130, simulated: true, path: toPath(torque, 40, 130), area: toArea(torque, 40, 130) },
    { key: "spp", label: "SPP", longLabel: "Standpipe pressure", unit: "psi", min: 2200, max: 3600, simulated: true, path: toPath(spp, 2200, 3600), area: toArea(spp, 2200, 3600) },
    { key: "cal", label: "CAL", longLabel: "Caliper", unit: "in", min: 7.4, max: 12, simulated: true, path: toPath(caliper, 7.4, 12), area: toArea(caliper, 7.4, 12) },
    { key: "mw", label: "MW", longLabel: "Mud weight", unit: "g/cm³", min: 1.35, max: 1.58, simulated: false, path: "", area: "", picks: mudPicks },
  ] satisfies Track[];
}

const trackColors: Record<string, string> = {
  rop: "#0f766e",
  wob: "#b45309",
  tq: "#b91c1c",
  spp: "#1d4ed8",
  cal: "#7c3aed",
  mw: "#0f172a",
};

type Density = "compact" | "expanded";

type Filters = { hiddenClasses: Set<LithologyKey>; hiddenTracks: Set<string> };

function DepthComposite({ density, tracks, filters }: { density: Density; tracks: Track[]; filters: Filters }) {
  const { selectedWell, currentDepth, setCurrentDepth, setSelectedEventId } = useNwisWorkspace();
  const [hoveredFormation, setHoveredFormation] = useState<string | null>(null);
  const compact = density === "compact";
  const { hiddenClasses, hiddenTracks } = filters;

  const axisWidth = compact ? "w-[46px]" : "w-[60px] xl:w-[78px]";
  const casingWidth = compact ? "w-[20px]" : "w-[30px] xl:w-[40px]";
  const trackWidth = compact ? "w-[30px]" : "w-[44px] xl:w-[66px]";
  const eventsWidth = compact ? "w-[88px]" : "w-[112px] xl:w-[172px]";
  const textXs = compact ? "text-[8px]" : "text-[11px]";
  const textSm = compact ? "text-[7px]" : "text-[9px]";
  const headerHeight = compact ? "h-[16px]" : "h-[26px]";

  const cursorPct = Math.min(100, (currentDepth / maxDepth) * 100);
  const tdPct = Math.min(100, (selectedWell.actualDepth / maxDepth) * 100);
  const isReferenceOwner = selectedWell.id === referenceWellId;
  const activeFormation = formationIntervals.find((interval) => currentDepth >= interval.top && currentDepth < interval.bottom);
  const visibleTracks = tracks.filter((track) => !hiddenTracks.has(track.key));

  // Stagger event chips so labels never overlap; keep a tick at the true depth.
  const eventLayout = useMemo(() => {
    const minGapPct = compact ? 5 : 3.4;
    return [...referenceEvents]
      .sort((a, b) => a.depth - b.depth)
      .reduce<{ event: (typeof referenceEvents)[number]; truePct: number; top: number; nudged: boolean }[]>((accumulated, event) => {
        const truePct = (event.depth / maxDepth) * 100;
        const top = accumulated.length === 0 ? truePct : Math.max(truePct, accumulated[accumulated.length - 1].top + minGapPct);
        accumulated.push({ event, truePct, top, nudged: top - truePct > 0.4 });
        return accumulated;
      }, []);
  }, [compact]);

  const handleBodyClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const ratio = (event.clientY - bounds.top) / bounds.height;
      const nextDepth = Math.round(Math.max(0, Math.min(maxDepth, ratio * maxDepth)));
      setCurrentDepth(Math.min(selectedWell.actualDepth, nextDepth));
    },
    [selectedWell.actualDepth, setCurrentDepth],
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#fbfcfa]">
      {/* Header row — every label on its own line, never clipped */}
      <div className={`flex shrink-0 items-stretch border-b border-slate-400 bg-slate-100 ${headerHeight}`}>
        <div className={`flex shrink-0 items-center justify-center border-r border-slate-300 ${axisWidth}`}>
          <span className={`${textXs} font-bold uppercase tracking-[0.1em] text-slate-600`}>MD</span>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1 border-r border-slate-300 px-1.5">
          <Layers3 className={`${compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} shrink-0 text-[#4f7a6b]`} />
          <span className={`${textXs} truncate font-bold uppercase tracking-[0.08em] text-slate-700`}>Lithology</span>
          {!isReferenceOwner && (
            <span
              className={`${textSm} shrink-0 rounded bg-slate-700 px-1 font-bold uppercase tracking-wide text-white`}
              title={`Formation picks in this dataset belong to ${referenceWellId}. They are shown as offset reference and are not picks of ${selectedWell.id}.`}
            >
              {referenceWellId} ref
            </span>
          )}
          {hiddenClasses.size > 0 && (
            <span className={`${textSm} shrink-0 rounded bg-amber-500/90 px-1 font-bold uppercase tracking-wide text-white`}>
              {hiddenClasses.size} class{hiddenClasses.size === 1 ? "" : "es"} muted
            </span>
          )}
        </div>
        <div className={`flex shrink-0 items-center justify-center border-r border-slate-300 ${casingWidth}`} title="Casing schematic">
          <span className={`${textSm} font-bold uppercase tracking-[0.06em] text-slate-600`}>CAS</span>
        </div>
        {tracks.map((track) => {
          const isOn = !hiddenTracks.has(track.key);
          return (
            <div
              key={track.key}
              className={`flex shrink-0 flex-col items-center justify-center border-r border-slate-200 leading-none ${trackWidth} ${isOn ? "bg-slate-100" : "bg-slate-200/70"}`}
              title={`${track.longLabel} (${track.unit}) · ${isOn ? "visible" : "hidden"} · ${track.simulated ? "simulated reference profile" : "WCR fixture records"}`}
            >
              <span
                className={`${textSm} font-bold ${isOn ? "" : "text-slate-400 line-through"}`}
                style={isOn ? { color: trackColors[track.key] } : undefined}
              >
                {track.label}
              </span>
              {!compact && <span className="text-[7px] text-slate-500">{track.unit}</span>}
            </div>
          );
        })}
        <div className={`flex shrink-0 items-center justify-between gap-1 border-l border-slate-300 px-1 ${eventsWidth}`}>
          <span
            className={`${textSm} shrink-0 font-bold uppercase tracking-[0.06em] text-slate-600`}
            title={`Events shown are those recorded on ${referenceWellId}. No events are recorded for ${selectedWell.id} in this dataset.`}
          >
            Events · {referenceWellId}
          </span>
          <span className={`shrink-0 rounded-sm bg-sky-900 px-1 font-bold tabular-nums leading-none text-white ${compact ? "text-[7px]" : "text-[10px]"}`} title="Shared depth cursor">
            {currentDepth} m
          </span>
        </div>
      </div>

      {/* Depth-aligned body */}
      <div
        role="slider"
        tabIndex={0}
        aria-label="Depth cursor. Click the column or use arrow keys to change depth."
        aria-valuemin={0}
        aria-valuemax={selectedWell.actualDepth}
        aria-valuenow={currentDepth}
        onClick={handleBodyClick}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setCurrentDepth(Math.min(selectedWell.actualDepth, currentDepth + 10));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setCurrentDepth(Math.max(0, currentDepth - 10));
          }
        }}
        className="relative flex min-h-0 flex-1 cursor-crosshair overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-600"
      >
        {/* MD axis */}
        <div className={`relative shrink-0 border-r border-slate-300 bg-gradient-to-b from-slate-50 to-slate-100 ${axisWidth}`}>
          {Array.from({ length: 25 }, (_, index) => index * 50).map((depth) => (
            <div key={depth} className="absolute inset-x-0 flex items-center" style={{ top: `${(depth / maxDepth) * 100}%` }}>
              {depth % 200 === 0 ? (
                <>
                  <span className="ml-1 shrink-0 text-[8px] font-medium tabular-nums leading-none text-slate-600">{depth}</span>
                  <span className="ml-auto mr-1 h-px w-1.5 bg-slate-400" />
                </>
              ) : (
                <span className="ml-auto mr-1 h-px w-1 bg-slate-300" />
              )}
            </div>
          ))}
        </div>

        {/* Lithology column */}
        <div className="relative min-w-0 flex-1 border-r border-slate-300 bg-white">
          {formationIntervals.map((interval) => {
            const key = lithologyKey(interval);
            const texture = lithologyTexture(key);
            const isMuted = hiddenClasses.has(key);
            const isActive = activeFormation?.name === interval.name;
            const isHovered = hoveredFormation === interval.name;
            const heightPct = (interval.thickness / maxDepth) * 100;
            const roomy = heightPct > (compact ? 11 : 5.5);
            return (
              <button
                key={interval.name}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setCurrentDepth(Math.round((interval.top + interval.bottom) / 2));
                }}
                onMouseEnter={() => setHoveredFormation(interval.name)}
                onMouseLeave={() => setHoveredFormation(null)}
                title={`${interval.name} · ${interval.top}–${interval.bottom} m · ${interval.lithology} · ${lithologyStyles[key].label} · source: ${interval.source} · confidence ${interval.confidence}${isMuted ? " · muted by filter" : ""}`}
                className={`absolute inset-x-0 flex items-center justify-between overflow-hidden border-b border-slate-900/30 text-left transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-700 ${
                  isMuted ? "opacity-25 grayscale" : isActive || isHovered ? "brightness-[1.08] saturate-[1.1]" : ""
                }`}
                style={{
                  top: `${(interval.top / maxDepth) * 100}%`,
                  height: `${heightPct}%`,
                  backgroundImage: texture.image,
                  backgroundSize: texture.size,
                  boxShadow: isActive ? "inset 3px 0 0 #0f172a" : undefined,
                }}
              >
                <span className="pointer-events-none min-w-0 flex-1 px-1.5">
                  <span className={`block truncate font-bold leading-tight text-slate-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.65)] ${textXs}`}>{interval.name}</span>
                  {roomy && <span className={`block truncate leading-tight text-slate-900/85 drop-shadow-[0_1px_0_rgba(255,255,255,0.5)] ${textSm}`}>{interval.lithology}</span>}
                </span>
                {roomy && (
                  <span className={`pointer-events-none shrink-0 whitespace-nowrap pr-1.5 text-right font-semibold tabular-nums leading-tight text-slate-900/85 drop-shadow-[0_1px_0_rgba(255,255,255,0.5)] ${textSm}`}>
                    {interval.top}–{interval.bottom} m
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Casing + cement */}
        <div className={`relative shrink-0 border-r border-slate-300 bg-slate-50 ${casingWidth}`}>
          {[
            { top: 0, bottom: 430, label: "17½″", color: "#334155" },
            { top: 430, bottom: 806, label: "9⅝″", color: "#1e293b" },
          ].map((run) => (
            <div key={run.label} className="absolute inset-x-[2px]" style={{ top: `${(run.top / maxDepth) * 100}%`, height: `${((run.bottom - run.top) / maxDepth) * 100}%` }}>
              <div className="h-full w-full" style={{ background: "#cbd5e1", boxShadow: `inset 2px 0 0 ${run.color}, inset -2px 0 0 ${run.color}, inset 0 0 0 1px rgb(51 65 85 / 0.45)` }} />
              <div className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-slate-600" title={`${run.label} casing shoe at ${run.bottom} m`} />
              {compact && <span className="absolute left-1/2 top-1 -translate-x-1/2 text-[6px] font-bold text-slate-700">{run.label}</span>}
            </div>
          ))}
          <div
            className="absolute inset-x-[1px]"
            style={{
              top: 0,
              height: `${(430 / maxDepth) * 100}%`,
              backgroundImage: "repeating-linear-gradient(45deg, rgb(201 189 162 / 0.75) 0 2px, rgb(232 226 210 / 0.35) 2px 5px)",
            }}
          />
          <div className="absolute inset-x-0 border-t-2 border-slate-800" style={{ top: `${tdPct}%` }}>
            <span className={`absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-slate-800 px-0.5 font-bold leading-none text-white ${compact ? "text-[5px]" : "text-[7px]"}`}>TD</span>
          </div>
        </div>

        {/* Log tracks */}
        {visibleTracks.map((track) => (
          <div key={track.key} className={`relative shrink-0 border-r border-slate-200 bg-white ${trackWidth}`}>
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-x-0 top-1/4 border-t border-dotted border-slate-300" />
              <div className="absolute inset-x-0 top-1/2 border-t border-dotted border-slate-300" />
              <div className="absolute inset-x-0 top-3/4 border-t border-dotted border-slate-300" />
            </div>
            {track.picks ? (
              <>
                <div
                  className="absolute inset-x-0 border-y border-dashed border-slate-300 bg-slate-100/70"
                  style={{
                    top: `${(track.picks[0].depth / maxDepth) * 100}%`,
                    height: `${((track.picks[track.picks.length - 1].depth - track.picks[0].depth) / maxDepth) * 100}%`,
                  }}
                  title="Fixture record coverage only"
                />
                <svg viewBox="0 0 100 1200" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                  <polyline
                    points={track.picks.map((pick) => `${(((pick.value - track.min) / (track.max - track.min)) * 100).toFixed(1)},${((pick.depth / maxDepth) * 1200).toFixed(1)}`).join(" ")}
                    fill="none"
                    stroke={trackColors[track.key]}
                    strokeWidth="1.3"
                    strokeDasharray="5 4"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                {track.picks.map((pick) => (
                  <span
                    key={pick.depth}
                    title={`WCR mud record · ${pick.value.toFixed(2)} g/cm³ at ${pick.depth} m`}
                    className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-white bg-slate-900"
                    style={{ left: `${((pick.value - track.min) / (track.max - track.min)) * 100}%`, top: `${(pick.depth / maxDepth) * 100}%` }}
                  />
                ))}
              </>
            ) : (
              <svg viewBox="0 0 100 1200" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                <path d={track.area} fill={trackColors[track.key]} opacity="0.18" />
                <path d={track.path} fill="none" stroke={trackColors[track.key]} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              </svg>
            )}
          </div>
        ))}

        {/* Events column */}
        <div className={`relative shrink-0 overflow-hidden border-l border-slate-300 bg-slate-50/70 ${eventsWidth}`}>
          {eventLayout.map(({ event, truePct, top, nudged }) => {
            const isCritical = event.severity === "Critical" || event.severity === "High";
            const chipHeight = compact ? 15 : 27;
            return (
              <div key={event.id}>
                {nudged && <div className="absolute inset-x-0 border-t border-dotted border-amber-500/70" style={{ top: `${truePct}%` }} />}
                <button
                  type="button"
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation();
                    setCurrentDepth(event.depth);
                    setSelectedEventId(event.id);
                  }}
                  className="absolute left-0 right-0 flex items-center gap-1 border-b border-slate-200/70 px-1 text-left transition hover:bg-amber-50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500"
                  style={{ top: `${top}%`, height: chipHeight, transform: "translateY(-1px)" }}
                  title={`${event.type} · ${event.depth} m · ${event.formation} · ${event.wellId} · ${event.source} ${event.sourcePage}`}
                >
                  <TriangleAlert className={`h-2.5 w-2.5 shrink-0 ${isCritical ? "text-red-600" : "text-amber-600"}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate font-bold leading-tight text-slate-800 ${compact ? "text-[7px]" : "text-[10px]"}`}>{event.type}</span>
                    {!compact && <span className="block truncate text-[8px] leading-tight text-slate-500">{event.formation}</span>}
                  </span>
                  <span className={`shrink-0 font-semibold tabular-nums text-slate-600 ${compact ? "text-[7px]" : "text-[9px]"}`}>{event.depth}m</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Planned TD */}
        <div className="pointer-events-none absolute inset-x-0 z-20 border-t border-dashed border-slate-500" style={{ top: `${(selectedWell.targetDepth / maxDepth) * 100}%` }}>
          <span className={`absolute left-1 top-0 -translate-y-1/2 rounded-sm bg-slate-600 px-1 font-bold uppercase leading-none tracking-wide text-white ${compact ? "text-[6px]" : "text-[8px]"}`}>
            Planned TD {selectedWell.targetDepth} m
          </span>
        </div>

        {/* Shared depth cursor */}
        <div className="pointer-events-none absolute inset-x-0 z-30 border-t-2 border-sky-900" style={{ top: `${cursorPct}%` }}>
          <span className="absolute left-0 top-0 h-0 w-0 -translate-y-[7px] border-x-[5px] border-t-[7px] border-x-transparent border-t-sky-900" />
        </div>
      </div>
    </div>
  );
}

function Legend({
  density,
  filters,
  onToggleClass,
  onClear,
  onToggleTrack,
}: {
  density: Density;
  filters: Filters;
  onToggleClass: (key: LithologyKey) => void;
  onClear: () => void;
  onToggleTrack: (key: string) => void;
}) {
  const compact = density === "compact";
  const { hiddenClasses, hiddenTracks } = filters;
  return (
    <div className={`flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-slate-300 bg-slate-50 px-2 py-1 text-slate-700 ${compact ? "text-[8px]" : "text-[10px]"}`}>
      <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-slate-800">
        <Layers3 className="h-3 w-3 text-[#4f7a6b]" />
        Filter lithology
      </span>
      {legendOrder.map((key) => {
        const texture = lithologyTexture(key);
        const isOn = !hiddenClasses.has(key);
        const count = formationIntervals.filter((interval) => lithologyKey(interval) === key).length;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggleClass(key)}
            aria-pressed={isOn}
            title={`${isOn ? "Mute" : "Show"} ${lithologyStyles[key].label} (${count} unit${count === 1 ? "" : "s"})`}
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-1 py-0.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${
              isOn ? "hover:bg-white" : "bg-slate-200/80 text-slate-400"
            }`}
          >
            <span
              className={`h-3 w-3 shrink-0 rounded-[2px] ring-1 ring-slate-600/50 ${isOn ? "" : "opacity-40 grayscale"}`}
              style={{ backgroundImage: texture.image, backgroundSize: texture.size }}
            />
            {lithologyStyles[key].label}
            <span className="tabular-nums opacity-60">{count}</span>
          </button>
        );
      })}
      <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap border-l border-slate-300 pl-2 font-semibold text-slate-800">
        <Eye className="h-3 w-3 text-slate-500" />
        Tracks
      </span>
      {["rop", "wob", "tq", "spp", "cal", "mw"].map((key) => {
        const isOn = !hiddenTracks.has(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggleTrack(key)}
            aria-pressed={isOn}
            title={isOn ? `Hide ${key.toUpperCase()} track` : `Show ${key.toUpperCase()} track`}
            className={`inline-flex items-center gap-0.5 whitespace-nowrap rounded px-1 py-0.5 font-bold uppercase transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${
              isOn ? "bg-white/70 hover:bg-white" : "bg-slate-200/80 text-slate-400 line-through"
            }`}
            style={isOn ? { color: trackColors[key] } : undefined}
          >
            {key}
          </button>
        );
      })}
      {(hiddenClasses.size > 0 || hiddenTracks.size > 0) && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 font-semibold text-white transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
        >
          <X className="h-2.5 w-2.5" />
          Reset
        </button>
      )}
      <span className="ml-auto hidden shrink-0 items-center gap-2.5 whitespace-nowrap text-slate-500 lg:inline-flex">
        <span className="inline-flex items-center gap-1"><Waves className="h-3 w-3" />MW ◆ = WCR records</span>
        <span className="inline-flex items-center gap-1"><Activity className="h-3 w-3 text-teal-700" />others simulated</span>
        <span className="inline-flex items-center gap-1"><Ruler className="h-3 w-3 text-amber-700" />casing schematic</span>
        <span className="inline-flex items-center gap-1"><Crosshair className="h-3 w-3 text-sky-900" />click column to set depth</span>
        <span className="font-semibold uppercase tracking-[0.08em]">Not a measured log</span>
      </span>
    </div>
  );
}

function EngineeringSidebar({ onPickEvent, hiddenClasses }: { onPickEvent: (eventId: string, depth: number) => void; hiddenClasses: Set<LithologyKey> }) {
  const { selectedWell, currentDepth } = useNwisWorkspace();
  const cursorFormation = formationIntervals.find((interval) => currentDepth >= interval.top && currentDepth < interval.bottom);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-slate-50">
      <section className="border-b border-slate-200 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">At cursor</h3>
          <span className="rounded bg-sky-900 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">{currentDepth} m MD</span>
        </div>
        {cursorFormation ? (
          <div className="mt-2 rounded-md border border-slate-300 bg-white p-2.5">
            <div className="flex items-start gap-2">
              <span
                className="mt-0.5 h-10 w-4 shrink-0 rounded-[2px] ring-1 ring-slate-600/50"
                style={{ backgroundImage: lithologyTexture(lithologyKey(cursorFormation)).image, backgroundSize: lithologyTexture(lithologyKey(cursorFormation)).size }}
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-slate-900">{cursorFormation.name}</div>
                <div className="mt-0.5 text-[10px] leading-tight text-slate-600">{cursorFormation.lithology}</div>
              </div>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-slate-200 pt-2 text-[10px]">
              {[
                ["Top", `${cursorFormation.top} m`],
                ["Base", `${cursorFormation.bottom} m`],
                ["Thickness", `${cursorFormation.thickness} m`],
                ["Class", lithologyStyles[lithologyKey(cursorFormation)].label],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-2">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="truncate font-semibold tabular-nums text-slate-800">{value}</dd>
                </div>
              ))}
              <div className="col-span-2 flex items-center justify-between gap-2">
                <dt className="text-slate-500">Source</dt>
                <dd className="flex items-center gap-1 font-semibold text-slate-800">
                  {cursorFormation.source}
                  <ConfidenceBadge confidence={cursorFormation.confidence} />
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className="mt-2 rounded-md border border-slate-300 bg-white p-2.5 text-[10px] text-slate-500">Cursor is above the shallowest reference pick.</p>
        )}
      </section>

      <section className="border-b border-slate-200 p-3">
        <h3 className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Reference intervals · WX-07</h3>
        <table className="mt-2 w-full text-left text-[10px]">
          <thead>
            <tr className="border-b border-slate-300 text-[9px] uppercase tracking-wide text-slate-500">
              <th className="py-1 pr-1 font-semibold">Unit</th>
              <th className="py-1 pr-1 font-semibold">Depth</th>
              <th className="py-1 font-semibold">Source</th>
            </tr>
          </thead>
          <tbody>
            {formationIntervals.map((interval) => {
              const texture = lithologyTexture(lithologyKey(interval));
              const isMuted = hiddenClasses.has(lithologyKey(interval));
              return (
                <tr key={interval.name} className={`border-b border-slate-200 align-top ${isMuted ? "opacity-35" : ""}`}>
                  <td className="py-1.5 pr-1">
                    <span className="flex items-center gap-1.5">
                      <span className="h-4 w-2.5 shrink-0 rounded-[2px] ring-1 ring-slate-600/40" style={{ backgroundImage: texture.image, backgroundSize: texture.size }} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-800">{interval.name}</span>
                        <span className="block truncate text-[9px] text-slate-500">{interval.lithology}</span>
                      </span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-1 tabular-nums text-slate-600">
                    {interval.top}–{interval.bottom}
                  </td>
                  <td className="whitespace-nowrap py-1.5 text-slate-600">
                    {interval.source}
                    <ConfidenceBadge confidence={interval.confidence} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="border-b border-slate-200 p-3">
        <h3 className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Mud records · WCR fixture</h3>
        <table className="mt-2 w-full text-left text-[10px]">
          <thead>
            <tr className="border-b border-slate-300 text-[9px] uppercase tracking-wide text-slate-500">
              <th className="py-1 pr-1 font-semibold">Date</th>
              <th className="py-1 pr-1 font-semibold">Depth</th>
              <th className="py-1 pr-1 font-semibold">MW</th>
              <th className="py-1 font-semibold">API</th>
            </tr>
          </thead>
          <tbody>
            {[...mudRecords]
              .sort((a, b) => a.depth - b.depth)
              .map((record) => (
                <tr key={`${record.date}-${record.depth}`} className="border-b border-slate-200">
                  <td className="whitespace-nowrap py-1 pr-1 text-slate-600">{record.date}</td>
                  <td className="whitespace-nowrap py-1 pr-1 tabular-nums text-slate-800">{record.depth} m</td>
                  <td className="whitespace-nowrap py-1 pr-1 font-semibold tabular-nums text-slate-800">{record.mudWeight.split(" ")[0]}</td>
                  <td className="whitespace-nowrap py-1 tabular-nums text-slate-600">{record.fluidLoss}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      <section className="p-3">
        <h3 className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Historical events · WX-07</h3>
        <ul className="mt-2 space-y-1.5">
          {referenceEvents.map((event) => (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => onPickEvent(event.id, event.depth)}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-left transition hover:border-amber-400 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <TriangleAlert className={`h-3 w-3 shrink-0 ${event.severity === "Critical" || event.severity === "High" ? "text-red-600" : "text-amber-600"}`} />
                    <span className="truncate text-[10px] font-bold text-slate-800">{event.type}</span>
                  </span>
                  <span className="shrink-0 text-[10px] font-semibold tabular-nums text-slate-600">{event.depth} m</span>
                </span>
                <span className="mt-0.5 block text-[9px] text-slate-500">
                  {event.formation} · {event.date} · {event.source} {event.sourcePage}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-[9px] leading-4 text-amber-900">
          Prototype composite. Casing depths are schematic, ROP/WOB/TQ/SPP/CAL are simulated, and WX-07 events are historical reference — none of it is a prediction for {selectedWell.id}.
        </p>
      </section>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const tone =
    confidence === "HIGH" ? "bg-emerald-100 text-emerald-700" : confidence === "MEDIUM" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
  return <span className={`ml-1 rounded px-1 text-[8px] font-bold ${tone}`}>{confidence}</span>;
}

export function FormationDepthView() {
  const { selectedWell, currentDepth, setCurrentDepth, setSelectedEventId } = useNwisWorkspace();
  const [expanded, setExpanded] = useState(false);
  const [hiddenClasses, setHiddenClasses] = useState<Set<LithologyKey>>(() => new Set());
  const [hiddenTracks, setHiddenTracks] = useState<Set<string>>(() => new Set());
  const tracks = useMemo(() => buildTracks(), []);
  const filters: Filters = useMemo(() => ({ hiddenClasses, hiddenTracks }), [hiddenClasses, hiddenTracks]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [expanded]);

  const toggleClass = useCallback((key: LithologyKey) => {
    setHiddenClasses((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleTrack = useCallback((key: string) => {
    setHiddenTracks((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setHiddenClasses(new Set());
    setHiddenTracks(new Set());
  }, []);

  const compactView = (
    <div className="relative flex h-full min-h-[330px] w-full flex-col overflow-hidden bg-[#eef1ee]">
      <div className="relative flex min-h-0 flex-1 flex-col p-2">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-400/70 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.5)]">
          <div className="relative min-h-0 flex-1">
            <DepthComposite density="compact" tracks={tracks} filters={filters} />
            <button
              type="button"
              onClick={() => setExpanded(true)}
              title="Enlarge depth composite (all tracks + full detail)"
              aria-label="Enlarge depth composite view"
              className="absolute right-1.5 top-[19px] z-40 inline-flex items-center gap-1 rounded border border-slate-400 bg-white/95 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.06em] text-slate-700 shadow-sm transition hover:bg-sky-50 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
            >
              <Expand className="h-2.5 w-2.5" />
              Enlarge
            </button>
          </div>
          <Legend density="compact" filters={filters} onToggleClass={toggleClass} onClear={clearFilters} onToggleTrack={toggleTrack} />
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return compactView;

  return (
    <>
      {compactView}
      {expanded &&
        createPortal(
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/75 p-2 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label="Enlarged depth composite">
            <button type="button" aria-label="Close enlarged view" onClick={() => setExpanded(false)} className="absolute inset-0 cursor-default" />
            <div className="relative flex h-[96vh] w-full max-w-[1680px] flex-col overflow-hidden rounded-xl border border-slate-500/60 bg-white shadow-2xl">
              <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b-2 border-slate-800 bg-slate-900 px-3 py-2 text-white sm:px-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em] text-teal-300">
                    <Layers3 className="h-3.5 w-3.5 shrink-0" />
                    Oil India Ltd · NWIS
                  </div>
                  <h2 className="mt-0.5 truncate text-sm font-bold sm:text-base">Depth &amp; Historical Context Composite</h2>
                  <p className="truncate text-[10px] text-slate-300">
                    {selectedWell.id} · {selectedWell.formation} · reference picks from WX-07
                  </p>
                </div>
                <dl className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-[9px] leading-tight">
                  {[
                    ["Total depth", `${selectedWell.actualDepth} m`],
                    ["Planned TD", `${selectedWell.targetDepth} m`],
                    ["Current depth", `${Math.round(currentDepth)} m`],
                    ["Scale", "0–1200 m MD"],
                  ].map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <dt className="uppercase tracking-[0.1em] text-slate-400">{label}</dt>
                      <dd className="text-[11px] font-bold tabular-nums text-white">{value}</dd>
                    </div>
                  ))}
                </dl>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-md border border-white/25 bg-white/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                  Close
                </button>
              </header>

              <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(240px,1fr)_minmax(0,40vh)] overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(280px,24rem)] lg:grid-rows-[minmax(0,1fr)]">
                <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
                  <div className="min-h-0 min-w-0 flex-1">
                    <DepthComposite density="expanded" tracks={tracks} filters={filters} />
                  </div>
                  <Legend density="expanded" filters={filters} onToggleClass={toggleClass} onClear={clearFilters} onToggleTrack={toggleTrack} />
                </div>
                <div className="min-h-0 min-w-0 border-t border-slate-300 lg:border-l lg:border-t-0">
                  <EngineeringSidebar
                    hiddenClasses={hiddenClasses}
                    onPickEvent={(eventId, depth) => {
                      setCurrentDepth(depth);
                      setSelectedEventId(eventId);
                      setExpanded(false);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
