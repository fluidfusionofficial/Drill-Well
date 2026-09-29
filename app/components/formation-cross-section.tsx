import { AlertTriangle, BarChart3, Layers3, Mountain } from "lucide-react";
import { currentWell, formationIntervals, wells, wellEvents } from "@/lib/nwis-data";
import { Badge } from "@/components/ui/Badge";
import { ProvenanceChip } from "@/components/ui/ProvenanceChip";

const maxDepth = 1200;

function layerColor(lithology: string) {
  const description = lithology.toLowerCase();
  if (description.includes("basement")) return "#9AA0AA";
  if (description.includes("evaporitic") || description.includes("evaporite")) return "#E3CFE0";
  if (
    description.includes("carbonate") ||
    description.includes("limestone") ||
    description.includes("dolomite")
  )
    return "#BFCBDB";
  if (description.includes("sandstone")) return "#E8D5A3";
  if (description.includes("siltstone")) return "#DCCFB0";
  if (description.includes("claystone")) return "#BDBFB6";
  return "#DCCFB0";
}

function layerPattern(lithology: string) {
  const description = lithology.toLowerCase();
  if (description.includes("sandstone") || description.includes("siltstone")) {
    return "repeating-linear-gradient(135deg, transparent 0 7px, rgb(120 83 41 / 14%) 7px 8px)";
  }
  if (
    description.includes("carbonate") ||
    description.includes("limestone") ||
    description.includes("dolomite")
  ) {
    return "repeating-linear-gradient(0deg, transparent 0 8px, rgb(15 77 76 / 12%) 8px 9px)";
  }
  if (description.includes("evaporitic") || description.includes("evaporite")) {
    return "repeating-linear-gradient(45deg, transparent 0 9px, rgb(91 63 113 / 12%) 9px 10px)";
  }
  if (description.includes("basement")) {
    return "repeating-linear-gradient(135deg, transparent 0 7px, rgb(255 255 255 / 20%) 7px 8px)";
  }
  return "repeating-linear-gradient(0deg, transparent 0 9px, rgb(71 85 105 / 10%) 9px 10px)";
}

export function FormationCrossSection() {
  const referenceWell = wells.find((well) => well.id === "WX-07") ?? currentWell;
  const referenceEvents = wellEvents.filter((event) => event.wellId === referenceWell.id);
  const eventStart = Math.min(...referenceEvents.map((event) => event.depth));
  const eventEnd = Math.max(...referenceEvents.map((event) => event.depth));
  const eventMidpoint = (eventStart + eventEnd) / 2;
  const markerPct = (currentWell.currentDepth / maxDepth) * 100;
  const eventPct = (eventMidpoint / maxDepth) * 100;

  return (
    <section className="rounded-[6px] border border-line bg-surface p-4 text-ink">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-accent">
            <Layers3 className="h-3.5 w-3.5" />
            <span>Formation architecture</span>
          </div>
          <h2 className="mt-1 text-base font-semibold text-ink">Lithology & depth model</h2>
          <p className="text-xs text-ink-3">
            Depth-aligned stratigraphic column and offset reference corridor
          </p>
        </div>
        <Badge variant="neutral">Reference offset · {referenceWell.id}</Badge>
      </div>

      <div className="rounded-[4px] border border-line bg-surface-muted/40 p-3">
        <div className="mb-2 flex items-center justify-between pl-16 pr-1 text-xs font-semibold text-ink-3">
          <span>Reference stratigraphy</span>
          <span className="hidden sm:inline">Lithology & source confidence</span>
        </div>

        <div className="relative h-[380px] overflow-hidden rounded-[4px] border border-line bg-surface">
          {/* Depth Axis */}
          <div className="absolute inset-y-0 left-0 z-10 w-16 border-r border-line bg-surface-muted/90">
            <div className="absolute left-2.5 top-2 text-xs font-semibold text-ink-3">Depth</div>
            {[0, 400, 800, 1200].map((depth) => (
              <div
                key={depth}
                className={`absolute left-2.5 flex items-center gap-1 text-xs tabular-nums text-ink-2 ${
                  depth === 0
                    ? "translate-y-0"
                    : depth === maxDepth
                    ? "-translate-y-full"
                    : "-translate-y-1/2"
                }`}
                style={{ top: `${(depth / maxDepth) * 100}%` }}
              >
                <span>{depth.toLocaleString("en-IN")}m</span>
              </div>
            ))}
          </div>

          {/* Formations Track */}
          <div className="absolute inset-y-0 left-16 right-0 overflow-hidden">
            {formationIntervals.map((interval) => {
              const topPct = (interval.top / maxDepth) * 100;
              const heightPct = (interval.thickness / maxDepth) * 100;
              const color = layerColor(interval.lithology);

              return (
                <div
                  key={interval.name}
                  title={`${interval.name} · ${interval.top}–${interval.bottom} m · ${interval.lithology} · ${interval.source}`}
                  className="absolute inset-x-0 border-b border-line"
                  style={{
                    top: `${topPct}%`,
                    height: `${heightPct}%`,
                    backgroundColor: color,
                    backgroundImage: layerPattern(interval.lithology),
                  }}
                >
                  {heightPct >= 7 && (
                    <div className="flex h-full items-center justify-between gap-2 px-3">
                      <div className="min-w-0">
                        <div className="truncate text-xs text-ink-3">
                          {interval.source} · {interval.confidence}
                        </div>
                        <div className="truncate text-xs font-semibold text-ink">
                          {interval.name}
                        </div>
                      </div>
                      <div className="hidden shrink-0 text-right text-xs text-ink sm:block tabular-nums">
                        <div>
                          {interval.top}–{interval.bottom} m
                        </div>
                        <div className="text-ink-3">{interval.lithology}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Micro-interval labels */}
            {formationIntervals
              .filter((interval) => (interval.thickness / maxDepth) * 100 < 7)
              .map((interval) => (
                <div
                  key={`${interval.name}-label`}
                  className="absolute right-2 z-[2] rounded-[3px] border border-line bg-surface/90 px-1.5 py-0.5 text-xs font-medium text-ink shadow-sm"
                  style={{ top: `${(interval.top / maxDepth) * 100}%` }}
                >
                  {interval.name}
                </div>
              ))}

            {/* Active bit cursor */}
            <div
              className="absolute inset-x-0 z-[3] border-t-2 border-dashed border-accent"
              style={{ top: `${markerPct}%` }}
            >
              <span className="absolute right-2 top-0 -translate-y-1/2 rounded-[3px] bg-primary px-2 py-0.5 text-xs font-semibold text-white shadow tabular-nums">
                {currentWell.id} · {currentWell.currentDepth} m MD
              </span>
            </div>

            {/* Offset event corridor */}
            {referenceEvents.length > 0 && (
              <div
                className="absolute inset-x-0 z-[4] border-t-2 border-status-high"
                style={{ top: `${eventPct}%` }}
              >
                <span className="absolute left-2 top-0 -translate-y-1/2 rounded-[3px] border border-status-high/30 bg-status-high-soft px-2 py-0.5 text-xs font-semibold text-status-high shadow tabular-nums">
                  {referenceWell.id} event cluster · {eventStart}–{eventEnd} m
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3 text-xs">
        <div className="rounded-[4px] border border-line bg-surface-muted p-3">
          <div className="flex items-center gap-1.5 font-semibold text-accent">
            <Mountain className="h-3.5 w-3.5" />
            <span>Active formation</span>
          </div>
          <div className="mt-1.5 font-semibold text-ink">{currentWell.formation}</div>
          <div className="mt-0.5 text-ink-3">
            Current MD {currentWell.currentDepth.toLocaleString("en-IN")} m · Regional pick
          </div>
        </div>

        <div className="rounded-[4px] border border-line bg-surface-muted p-3">
          <div className="flex items-center gap-1.5 font-semibold text-status-high">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Offset event corridor</span>
          </div>
          <div className="mt-1.5 font-semibold text-ink tabular-nums">
            {eventStart}–{eventEnd} m · {referenceEvents.length} recorded events
          </div>
          <div className="mt-0.5 text-ink-3 truncate">
            {referenceEvents[0]?.type} in {referenceEvents[0]?.formation}
          </div>
        </div>

        <div className="rounded-[4px] border border-line bg-surface-muted p-3">
          <div className="flex items-center gap-1.5 font-semibold text-ink-2">
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Evidence provenance</span>
          </div>
          <div className="mt-1.5 font-semibold text-ink">Source-attributed intervals</div>
          <div className="mt-0.5 text-ink-3">
            Prognosed, sample, and wireline records retain source confidence labels.
          </div>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-line">
        <ProvenanceChip
          source="WX-07 reference stratigraphy"
          recordCount={formationIntervals.length}
          simulatedCount={0}
        />
      </div>
    </section>
  );
}
