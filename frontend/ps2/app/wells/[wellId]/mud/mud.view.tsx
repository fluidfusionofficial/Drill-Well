"use client";



import { useMemo } from "react";
import { Droplets } from "lucide-react";
import { WellWorkspaceShell, SourceUnavailable } from "@/components/well-workspace-shell";
import { getMudRecords } from "@/lib/engineering/well-data";
import { normalize, formatWithSource } from "@/lib/engineering/units";

/** Mud weight track: source values plotted with the source unit preserved. */
function MudChart({ records }: { records: ReturnType<typeof getMudRecords> extends { records: infer R } ? R : never }) {
  const points = useMemo(() => {
    const usable = records.filter((record) => Number.isFinite(Number.parseFloat(record.mudWeight)));
    return usable.map((record) => {
      const parsed = normalize(Number.parseFloat(record.mudWeight), record.mudWeight.replace(/^[\d.,\s]+/, "").trim() || "g/cm3", "mud_weight");
      return {
        depth: record.depth,
        date: record.date,
        original: record.mudWeight,
        normalized: parsed?.normalizedValue ?? Number.parseFloat(record.mudWeight),
        unit: parsed?.originalUnit ?? "g/cm3",
        loss: record.fluidLoss,
        notes: record.notes,
      };
    });
  }, [records]);

  if (points.length === 0) return null;

  const min = 1.3;
  const max = 1.65;
  const toY = (depth: number) => 200 - (depth / 1200) * 200;
  const toX = (value: number) => ((value - min) / (max - min)) * 100;

  return (
    <svg viewBox="0 0 100 200" preserveAspectRatio="none" className="h-[320px] w-full" role="img" aria-label="Mud weight against measured depth">
      <defs>
        <linearGradient id="mud-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f766e" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#0f766e" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
        <line key={fraction} x1="0" y1={200 - fraction * 200} x2="100" y2={200 - fraction * 200} stroke="#cbd5e1" strokeWidth="0.4" strokeDasharray="2 3" />
      ))}
      <path d={`M0,200 ${points.map((p) => `L${toX(p.normalized)},${toY(p.depth)}`).join(" ")} L100,200 Z`} fill="url(#mud-fill)" />
      <polyline points={points.map((p) => `${toX(p.normalized)},${toY(p.depth)}`).join(" ")} fill="none" stroke="#0f766e" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
      {points.map((point) => (
        <circle key={`${point.date}-${point.depth}`} cx={toX(point.normalized)} cy={toY(point.depth)} r="1.6" fill="#0f766e" stroke="#ffffff" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

export function WellMudPage({ wellId }: { wellId: string }) {
  const mud = getMudRecords(wellId);

  return (
    <WellWorkspaceShell wellId={wellId}>
      {!mud.available ? (
        <SourceUnavailable
          title="No mud record source for this well"
          reason={mud.reason ?? ""}
          icon={Droplets}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-500">
              <Droplets className="h-3.5 w-3.5" /> Mud weight against depth
            </h2>
            <MudChart records={mud.records} />
            <div className="mt-1 flex justify-between text-[9px] tabular-nums text-slate-500">
              <span>0 m MD</span>
              <span>600 m</span>
              <span>1200 m MD</span>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Records</h3>
            <ul className="mt-2 space-y-1.5">
              {mud.records.map((record) => {
                const value = Number.parseFloat(record.mudWeight);
                const measurement = normalize(value, record.mudWeight.replace(/^[\d.,\s]+/, "").trim() || "g/cm3", "mud_weight");
                return (
                  <li key={`${record.date}-${record.depth}`} className="rounded-lg border border-slate-200 px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-800">{record.date}</span>
                      <span className="text-[11px] font-bold tabular-nums text-teal-700">{measurement ? formatWithSource(measurement) : record.mudWeight}</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-500">
                      {record.depth} m MD · API {record.fluidLoss} · {record.viscosity} · {record.notes}
                    </div>
                    <dl className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
                      {[
                        ["PV", record.pv, "viscosity_cp"],
                        ["YP", record.yp, "yield_point"],
                        ["pH", record.ph, ""],
                      ].map(([label, value, dimension]) => {
                        const parsed = Number.parseFloat(value as string);
                        const measurement = dimension ? normalize(parsed, (value as string).replace(/^[\d.,\s]+/, "").trim(), dimension as string) : null;
                        return (
                          <span key={label as string} className="inline-flex items-center gap-1">
                            <span className="font-semibold text-slate-600">{label as string}</span>
                            <span className="tabular-nums">{measurement ? formatWithSource(measurement, 1) : (value as string)}</span>
                          </span>
                        );
                      })}
                    </dl>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[10px] leading-4 text-slate-600">
              Values are shown exactly as written in the source, with the canonical unit alongside when a conversion was needed. A reading of 1.48 g/cm³ is never displayed as 1.48 ppg.
            </p>
          </section>
        </div>
      )}
    </WellWorkspaceShell>
  );
}
