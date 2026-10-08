"use client";



import { useMemo } from "react";
import { Mountain } from "lucide-react";
import { WellWorkspaceShell, SourceUnavailable } from "@/components/well-workspace-shell";
import { GeologicalPatterns, LithologyUnit, inferLithology, lithologySymbols } from "@/components/geological-symbols";
import { useNwisWorkspace } from "@/components/nwis-workspace-context";
import { getFormationAvailability, getFormationPicks } from "@/lib/engineering/well-data";

const maxDepth = 1200;
const columnWidth = 92;
const trackHeight = 620;

export function WellGeologyPage({ wellId }: { wellId: string }) {
  const { setCurrentDepth, currentDepth } = useNwisWorkspace();
  const picks = useMemo(() => getFormationPicks(wellId), [wellId]);
  const availability = getFormationAvailability(wellId);

  const positions = picks.map((pick) => ({
    ...pick,
    y: (pick.top / maxDepth) * trackHeight,
    h: Math.max(4, (pick.thickness / maxDepth) * trackHeight),
    lithology: inferLithology(pick.lithology, pick.name),
  }));

  const cursorY = (Math.min(currentDepth, maxDepth) / maxDepth) * trackHeight;

  return (
    <WellWorkspaceShell wellId={wellId}>
      <GeologicalPatterns />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-500">
              <Mountain className="h-3.5 w-3.5" /> Stratigraphic column
            </h2>
            <span className="text-[10px] text-slate-400">Depth 0–{maxDepth} m MD</span>
          </div>

          <div className="flex gap-3">
            {/* MD ruler */}
            <div className="relative w-12 shrink-0" style={{ height: trackHeight }}>
              {Array.from({ length: 13 }, (_, index) => index * 100).map((depth) => (
                <div key={depth} className="absolute inset-x-0 -translate-y-1/2" style={{ top: `${(depth / maxDepth) * 100}%` }}>
                  <div className="flex items-center gap-1">
                    <span className="ml-auto text-[9px] tabular-nums text-slate-500">{depth}</span>
                    <span className="h-px w-1.5 bg-slate-400" />
                  </div>
                </div>
              ))}
            </div>

            {/* Lithology column drawn with geological symbols */}
            <div className="relative shrink-0" style={{ height: trackHeight, width: columnWidth }}>
              <svg width={columnWidth} height={trackHeight} className="rounded border border-slate-400">
                {positions.map((pick) => (
                  <foreignObject key={pick.name} x="0" y={pick.y} width={columnWidth} height={pick.h}>
                    <div style={{ width: columnWidth, height: pick.h }}>
                      <svg width={columnWidth} height={pick.h} style={{ display: "block" }}>
                        <LithologyUnit lithology={pick.lithology} formationName={pick.name} width={columnWidth} height={pick.h} />
                      </svg>
                    </div>
                  </foreignObject>
                ))}
                {/* unit boundaries */}
                {positions.map((pick) => (
                  <line key={`b-${pick.name}`} x1="0" y1={pick.y} x2={columnWidth} y2={pick.y} stroke="#0f172a" strokeWidth="1" opacity="0.55" />
                ))}
              </svg>
              <div className="pointer-events-none absolute inset-y-0 left-0 w-full" style={{ top: cursorY }}>
                <div className="relative" style={{ transform: "translateY(-1px)" }}>
                  <div className="h-0 w-full border-t-2 border-sky-700" />
                </div>
              </div>
            </div>

            {/* Formation table beside the column */}
            <div className="min-w-0 flex-1 overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-slate-300 text-[9px] uppercase tracking-wide text-slate-500">
                    <th className="py-1 pr-2 font-semibold">Unit</th>
                    <th className="py-1 pr-2 font-semibold">Lithology</th>
                    <th className="py-1 pr-2 font-semibold">Top</th>
                    <th className="py-1 pr-2 font-semibold">Base</th>
                    <th className="py-1 pr-2 font-semibold">Source</th>
                    <th className="py-1 font-semibold">Conf.</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pick) => (
                    <tr
                      key={pick.name}
                      onClick={() => setCurrentDepth(Math.round((pick.top + pick.bottom) / 2))}
                      className={`cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 ${
                        currentDepth >= pick.top && currentDepth < pick.bottom ? "bg-sky-50" : ""
                      }`}
                    >
                      <td className="py-1.5 pr-2 font-semibold text-slate-800">{pick.name}</td>
                      <td className="py-1.5 pr-2">
                        <span className="flex items-center gap-1.5">
                          <span className="h-3 w-3 shrink-0 rounded-[2px] border border-slate-600/40" style={{ backgroundColor: lithologySymbols[pick.lithology].fill }} />
                          <span className="text-slate-600">{lithologySymbols[pick.lithology].label}</span>
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 tabular-nums text-slate-600">{pick.top} m</td>
                      <td className="py-1.5 pr-2 tabular-nums text-slate-600">{pick.bottom} m</td>
                      <td className="py-1.5 pr-2 text-slate-600">{pick.source}</td>
                      <td className="py-1.5">
                        <span
                          className={`rounded px-1 text-[9px] font-bold ${
                            pick.confidence === "HIGH" ? "bg-emerald-100 text-emerald-700" : pick.confidence === "MEDIUM" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {pick.confidence}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {picks.length > 0 && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Planned vs actual</div>
                  <p className="mt-1 text-[11px] leading-4 text-slate-600">
                    {picks.some((pick) => pick.prognosedTop || pick.sampleTop || pick.wirelineTop)
                      ? picks
                          .filter((pick) => pick.prognosedTop || pick.sampleTop || pick.wirelineTop)
                          .map((pick) => `${pick.name}: ${[pick.prognosedTop ? `prognosed ${pick.prognosedTop}` : null, pick.sampleTop ? `sample ${pick.sampleTop}` : null, pick.wirelineTop ? `wireline ${pick.wirelineTop}` : null].filter(Boolean).join(", ")}`)
                          .join(" · ")
                      : "The supplied dataset provides one pick per unit. No second source class exists, so no prognosed-vs-actual delta is shown."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-3">
          <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Lithology key</h3>
            <ul className="mt-2 space-y-1.5">
              {Object.entries(lithologySymbols)
                .filter(([key]) => key !== "unknown")
                .map(([key, symbol]) => (
                  <li key={key} className="flex items-center gap-2 text-[11px]">
                    <span className="h-4 w-6 shrink-0 rounded-[2px] border border-slate-500/40" style={{ backgroundColor: symbol.fill }} />
                    <span className="font-mono text-[9px] font-bold text-slate-500">{symbol.short}</span>
                    <span className="text-slate-700">{symbol.label}</span>
                  </li>
                ))}
            </ul>
            <p className="mt-2 text-[10px] leading-4 text-slate-500">
              Units are drawn with lithological conventions: cross-bedded sets in sandstone, stylolite seams and fossil traces in limestone, cryptobrecciated vugs in dolomite, fine
              laminae in shale, sorted clasts in conglomerate and a crystalline fabric in basement.
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Provenance</h3>
            <ul className="mt-2 space-y-1.5">
              {picks.slice(0, 4).map((pick) => (
                <li key={pick.name} className="rounded-lg border border-slate-200 px-2 py-1.5">
                  <div className="text-[11px] font-semibold text-slate-800">{pick.name}</div>
                  <div className="mt-0.5 text-[10px] leading-4 text-slate-500">{pick.provenance.citation}</div>
                  <div className="mt-0.5 text-[9px] uppercase tracking-wide text-slate-400">
                    {pick.provenance.extractionMethod} · {pick.provenance.extractionConfidence} · {pick.depthReference}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {!availability.available && (
            <SourceUnavailable title="No formation picks for this well" reason={availability.reason ?? ""} icon={Mountain} />
          )}
        </aside>
      </div>
    </WellWorkspaceShell>
  );
}
