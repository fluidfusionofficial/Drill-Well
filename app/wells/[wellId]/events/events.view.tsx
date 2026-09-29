"use client";



import { useMemo } from "react";
import { Target, TrendingUp } from "lucide-react";
import { WellWorkspaceShell, SourceUnavailable } from "@/components/well-workspace-shell";
import { useNwisWorkspace } from "@/components/nwis-workspace-context";
import { getEvents } from "@/lib/engineering/well-data";

const severityTone: Record<string, string> = {
  Critical: "bg-rose-100 text-rose-700",
  High: "bg-orange-100 text-orange-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-slate-100 text-slate-600",
};

export function WellEventsPage({ wellId }: { wellId: string }) {
  const { setCurrentDepth, setSelectedEventId, currentDepth } = useNwisWorkspace();
  const events = useMemo(() => getEvents(wellId), [wellId]);

  const nptTotal = events.length;

  return (
    <WellWorkspaceShell wellId={wellId}>
      {events.length === 0 ? (
        <SourceUnavailable title="No events recorded for this well" reason={`The supplied sanitized dataset contains no event records for ${wellId}. Events recorded on other wells are never attributed to this well.`} icon={Target} />
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Recorded events", value: String(events.length) },
              { label: "NPT events", value: String(nptTotal) },
              { label: "Deepest event", value: `${Math.max(...events.map((event) => event.depth))} m MD` },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{stat.label}</div>
                <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{stat.value}</div>
              </div>
            ))}
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-500">
              <Target className="h-3.5 w-3.5" /> Event log
            </h2>
            <ul className="space-y-2">
              {events.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentDepth(event.depth);
                      setSelectedEventId(event.id);
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition hover:border-amber-400 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                      currentDepth >= event.depth - 5 && currentDepth <= event.depth + 5 ? "border-amber-400 bg-amber-50" : "border-slate-200"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${severityTone[event.severity]}`}>{event.severity}</span>
                        <span className="text-sm font-semibold text-slate-900">{event.type}</span>
                      </span>
                      <span className="text-[11px] font-semibold tabular-nums text-slate-600">
                        {event.depth} m MD · {event.date}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-4 text-slate-600">{event.description}</p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-600">
                      <span className="font-semibold text-slate-700">Response:</span> {event.response}
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-600">
                      <span className="font-semibold text-slate-700">Outcome:</span> {event.outcome}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                      <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5">
                        Source: {event.source} {event.sourcePage}
                      </span>
                      <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5">Formation: {event.formation}</span>
                      <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5">Confidence: {event.confidence}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </WellWorkspaceShell>
  );
}

export function WellDrillingPage({ wellId }: { wellId: string }) {
  return (
    <WellWorkspaceShell wellId={wellId}>
      <SourceUnavailable
        title="Drilling parameter source not present"
        reason={`The WX-07 Final Well Report contains 21 tables and 1,116 drilling-parameter rows, but the source file is not present in this repository. ROP, WOB, RPM, torque and SPP cannot be shown without fabricating values.`}
        icon={TrendingUp}
      />
    </WellWorkspaceShell>
  );
}
