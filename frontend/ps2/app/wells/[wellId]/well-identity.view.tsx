"use client";



import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { WellWorkspaceShell } from "@/components/well-workspace-shell";
import { wells } from "@/lib/nwis-data";
import { useNwisWorkspace } from "@/components/nwis-workspace-context";
import { dataStateTone, wellSections } from "@/lib/engineering/sections";
import { getDocuments, getEvents, getFormationPicks, coordinateBasis, COORDINATE_DISCLAIMER } from "@/lib/engineering/well-data";

/**
 * Section 1 — Well Identity.
 *
 * This is the entry point of the ordered review sequence. It confirms which well
 * is being reviewed and its current state, then hands the engineer to section 2.
 */
export function WellIdentityPage({ wellId }: { wellId: string }) {
  const { currentDepth, setCurrentDepth } = useNwisWorkspace();
  const well = wells.find((item) => item.id === wellId) ?? wells[0];
  const events = getEvents(well.id);
  const picks = getFormationPicks(well.id);
  const documents = getDocuments(well.id);

  const startReview = wellSections[1];

  return (
    <WellWorkspaceShell wellId={well.id}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-xs uppercase tracking-[0.16em] text-slate-500">Well master record</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Well ID", value: well.id },
              { label: "Location", value: well.location },
              { label: "Status", value: well.status },
              { label: "Rig", value: well.rig },
              { label: "Well type", value: well.wellType },
              { label: "Profile", value: well.profile },
              { label: "Spud date", value: well.spudDate },
              { label: "TD date", value: well.tdDate ?? "—" },
              { label: "Target formation", value: well.targetFormation },
              { label: "Projected TD", value: `${well.projectedTD} m MD` },
              { label: "Actual TD", value: `${well.actualDepth} m MD` },
              { label: "Current depth", value: `${Math.round(currentDepth)} m MD` },
            ].map((tile) => (
              <div key={tile.label} className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="text-[9px] uppercase tracking-[0.14em] text-slate-500">{tile.label}</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-900">{tile.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Coordinate basis</div>
            <p className="mt-0.5 text-[11px] leading-4 text-slate-600">{COORDINATE_DISCLAIMER}</p>
            <p className="mt-1 text-[10px] text-slate-400">basis: {coordinateBasis()}</p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-teal-700" />
            <span className="min-w-0 flex-1 text-[11px] leading-4 text-teal-900">
              Review continues in order. Next: <strong>{startReview.label}</strong> — {startReview.purpose}
            </span>
            <Link
              href={`/wells/${well.id}/${startReview.slug}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-teal-800"
            >
              Start review
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>

        <aside className="space-y-3">
          <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Review sequence</h3>
            <ul className="mt-2 space-y-0.5">
              {wellSections.map((section) => {
                const tone = dataStateTone[section.dataState];
                const Icon = section.icon;
                return (
                  <li key={section.slug || "identity"}>
                    <Link
                      href={`/wells/${well.id}${section.slug ? `/${section.slug}` : ""}`}
                      className="flex items-center gap-2 rounded-md px-1.5 py-1 transition hover:bg-slate-50"
                    >
                      <span className="w-4 shrink-0 text-right text-[9px] tabular-nums text-slate-400">{section.order}</span>
                      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                      <span className="min-w-0 flex-1 truncate text-[11px] text-slate-700">{section.label}</span>
                      <span className={`shrink-0 rounded border px-1 text-[8px] font-bold uppercase ${tone.className}`}>
                        {section.dataState === "source-backed" ? "SRC" : section.dataState === "partial" ? "PART" : "NONE"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Depth cursor</h3>
            <input
              type="range"
              min={0}
              max={well.actualDepth}
              step={5}
              value={Math.min(currentDepth, well.actualDepth)}
              onChange={(event) => setCurrentDepth(Number(event.target.value))}
              aria-label="Depth cursor"
              className="mt-2 w-full"
            />
            <div className="mt-1 flex justify-between text-[10px] tabular-nums text-slate-500">
              <span>0 m</span>
              <span className="font-bold text-slate-800">{Math.round(currentDepth)} m MD</span>
              <span>{well.actualDepth} m</span>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Record coverage</h3>
            <dl className="mt-2 space-y-1 text-[11px]">
              {[
                ["Formation picks", picks.length > 0 ? `${picks.length} units` : "none supplied"],
                ["Recorded events", events.length > 0 ? `${events.length} events` : "none recorded"],
                ["Source documents", documents.length > 0 ? `${documents.length} registered` : "none registered"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-2">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-semibold text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>
    </WellWorkspaceShell>
  );
}
