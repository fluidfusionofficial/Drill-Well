"use client";

import { useMemo } from "react";
import { ArrowUpRight, Crosshair, LocateFixed } from "lucide-react";
import Link from "next/link";
import { useNwisWorkspace } from "@/components/nwis-workspace-context";
import { formationAtReferenceDepth, offsetEventsForFormation } from "@/lib/nwis-data";
import type { EventRecord } from "@/lib/nwis-data";
import { EventGlyph } from "@/components/ui/EventGlyph";
import { classifyEvent } from "@/lib/taxonomy";

const maxDepth = 1200;

export function DepthEventStrip() {
  const { selectedWell, currentDepth, setCurrentDepth, setSelectedEventId } = useNwisWorkspace();
  const currentInterval =
    selectedWell.id === "WX-07" ? formationAtReferenceDepth(currentDepth) : undefined;
  const relevantEvents = useMemo(
    () => offsetEventsForFormation(selectedWell.id, selectedWell.formation),
    [selectedWell],
  );

  const selectEvent = (event: EventRecord) => {
    setCurrentDepth(event.depth);
    setSelectedEventId(event.id);
  };

  return (
    <section className="rounded-[6px] border border-line bg-surface text-ink">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-accent" />
          <div>
            <h2 className="text-xs font-semibold text-ink">Depth cursor & historical precedents</h2>
            <p className="text-xs text-ink-3">
              Move cursor to correlate depth with offset incidents in regional strata
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1.5 text-ink-2">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Active depth cursor
          </span>
          <span className="inline-flex items-center gap-1.5 text-ink-2">
            <span className="h-2 w-2 rounded-full bg-status-high" />
            Historical incident
          </span>
          <span className="text-ink-3">Reference picks from WX-07</span>
        </div>
      </div>

      <div className="px-4 pb-3 pt-4">
        {/* Strip Track */}
        <div className="relative mx-1 h-12">
          <div className="absolute inset-x-0 top-[18px] h-[1px] bg-line" />
          {relevantEvents.map((event, index) => {
            const cat = classifyEvent(event.type);
            return (
              <button
                key={event.id}
                type="button"
                aria-label={`Inspect ${event.type} at ${event.depth} meters in ${event.wellId}`}
                title={`${event.wellId} · ${event.type} · ${event.depth} m MD · ${event.formation}`}
                onClick={() => selectEvent(event)}
                className="group absolute top-[11px] z-10 -translate-x-1/2 cursor-pointer transition hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                style={{
                  left: `${(event.depth / maxDepth) * 100}%`,
                  transform: `translateX(-50%) translateY(${index % 2 === 0 ? 0 : 4}px)`,
                }}
              >
                <EventGlyph category={cat} size={15} />
              </button>
            );
          })}
          <div
            className="absolute top-0 z-20 h-9 w-[2px] bg-primary"
            style={{ left: `${(currentDepth / maxDepth) * 100}%` }}
          >
            <div className="absolute -left-[5px] top-[14px] h-3 w-3 rounded-full border-2 border-white bg-primary shadow" />
            <div className="absolute left-2 top-0 whitespace-nowrap rounded-[3px] bg-primary px-1.5 py-0.5 text-xs font-semibold text-white tabular-nums">
              {currentDepth} m
            </div>
          </div>
          {[0, 400, 800, maxDepth].map((depth) => (
            <span
              key={depth}
              className="absolute top-[32px] -translate-x-1/2 text-xs tabular-nums text-ink-3"
              style={{ left: `${(depth / maxDepth) * 100}%` }}
            >
              {depth.toLocaleString("en-IN")} m
            </span>
          ))}
        </div>

        {/* Controls and Depth Pick */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <div className="flex min-w-[240px] flex-1 items-center gap-3">
            <label htmlFor="global-depth-cursor" className="shrink-0 text-xs font-medium text-ink">
              Depth cursor
            </label>
            <input
              id="global-depth-cursor"
              aria-label="Current measured depth in meters"
              type="range"
              min={0}
              max={maxDepth}
              step={1}
              value={currentDepth}
              onChange={(event) => setCurrentDepth(Number(event.target.value))}
              className="min-w-0 flex-1 accent-accent cursor-pointer"
            />
            <span className="w-20 shrink-0 text-right text-xs font-semibold tabular-nums text-ink">
              {currentDepth.toLocaleString("en-IN")} m MD
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-[4px] border border-line bg-surface-muted px-2.5 py-1 text-xs">
            <LocateFixed className="h-3.5 w-3.5 text-accent" />
            <span className="text-ink-3">
              {currentInterval ? "WX-07 formation pick:" : "Reference pick:"}
            </span>
            <span className="font-semibold text-ink">
              {currentInterval?.name ?? "Regional correlation (WX-07)"}
            </span>
          </div>
        </div>

        {/* Relevant Events Row */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {relevantEvents.length ? (
            relevantEvents.map((event) => {
              const cat = classifyEvent(event.type);
              return (
                <button
                  key={event.id}
                  type="button"
                  aria-label={`Open source evidence for ${event.type} in ${event.wellId} at ${event.depth} meters`}
                  onClick={() => selectEvent(event)}
                  className="flex min-w-[210px] items-center justify-between gap-3 rounded-[4px] border border-line bg-surface p-2 text-left transition hover:border-line-strong hover:bg-surface-muted"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 truncate text-xs font-semibold text-ink">
                      <EventGlyph category={cat} size={13} />
                      <span>{event.type}</span>
                      <span className="font-normal text-ink-3">· {event.wellId}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-3 tabular-nums">
                      {event.depth} m MD · {event.formation}
                    </span>
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-accent" />
                </button>
              );
            })
          ) : (
            <div className="rounded-[4px] border border-line bg-surface-muted px-3 py-2 text-xs text-ink-3">
              No historical incident precedents recorded for this interval.
            </div>
          )}
          <Link
            href="/map"
            className="ml-auto inline-flex shrink-0 items-center gap-1 self-center px-2 text-xs font-medium text-accent hover:text-accent-hover"
          >
            <span>Open map</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
