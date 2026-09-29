"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Compass, Hammer, MapPin, Route, Save, Sparkles, XCircle } from "lucide-react";
import { AppShell } from "@/components/layout-shell";
import { PageHeader } from "@/components/page-header";
import { useNwisWorkspace } from "@/components/nwis-workspace-context";
import { PlanningMap } from "@/components/planning-map";
import { formationIntervals, wells } from "@/lib/nwis-data";
import type { Well } from "@/lib/nwis-data";
import {
  CasingProgram,
  buildWellPath,
  distanceKm,
  evaluateOffsets,
  projectPoint,
  runPlanningChecks,
  suggestedSites,
  targetRadius,
} from "@/lib/well-planning";
import type { LatLng } from "@/lib/well-planning";

const Planning3DGuidance = dynamic(() => import("@/components/planning-3d-guidance").then((module) => module.Planning3DGuidance), {
  ssr: false,
  loading: () => <div className="grid h-full min-h-[420px] place-items-center rounded-[6px] bg-canvas text-sm text-ink-3">Preparing 3D placement guidance…</div>,
});

const reference = wells[0].coordinates;

const statusStyle = {
  PASS: { icon: CheckCircle2, className: "border-status-ok/30 bg-status-ok-soft text-status-ok", badge: "bg-status-ok text-white" },
  WARN: { icon: AlertTriangle, className: "border-status-moderate/30 bg-status-moderate-soft text-status-moderate", badge: "bg-status-moderate text-white" },
  FAIL: { icon: XCircle, className: "border-status-critical/30 bg-status-critical-soft text-status-critical", badge: "bg-status-critical text-white" },
} as const;

export default function PlanningPage() {
  const { selectedWell, ingestPlannedWell, plannedWells } = useNwisWorkspace();
  const [site, setSite] = useState<LatLng>(projectPoint(reference, 0.9, 0.7));
  const [wellName, setWellName] = useState("WX-31");
  const [targetFormation, setTargetFormation] = useState("Upper Carbonate");
  const [targetDepth, setTargetDepth] = useState(520);
  const [kickOffDepth, setKickOffDepth] = useState(320);
  const [buildRate, setBuildRate] = useState(2.1);
  const [inclination, setInclination] = useState(45);
  const [azimuth, setAzimuth] = useState(35);
  const [surveyUncertainty, setSurveyUncertainty] = useState(40);
  const [rig, setRig] = useState("Rig-04");
  const [spudDate, setSpudDate] = useState("2026-01-12");
  const [created, setCreated] = useState<Well | null>(null);

  const plan = useMemo(
    () => ({ kickOffDepth, buildRate, inclination, azimuth, targetDepth, surveyUncertainty }),
    [azimuth, buildRate, inclination, kickOffDepth, surveyUncertainty, targetDepth],
  );

  const path = useMemo(() => buildWellPath(plan, site), [plan, site]);
  const clearances = useMemo(() => evaluateOffsets(site, plan, path.end, wells), [path.end, plan, site]);
  const checks = useMemo(() => runPlanningChecks(site, plan, path.end, clearances), [clearances, path.end, plan, site]);
  const radius = useMemo(() => targetRadius(plan), [plan]);
  const suggestions = useMemo(() => suggestedSites(reference), []);

  const blocking = checks.filter((check) => check.status === "FAIL");
  const warnings = checks.filter((check) => check.status === "WARN");
  const canCreate = blocking.length === 0 && wellName.trim().length > 0;

  const createWell = () => {
    if (!canCreate) return;
    const newWell: Well = {
      id: wellName.trim().toUpperCase(),
      location: "Rajasthan · planned prospect",
      wellType: targetFormation.includes("Carbonate") ? "Appraisal" : "Exploration",
      profile: `Directional · KO ${Math.round(kickOffDepth)} m · ${buildRate}°/100 m`,
      rig,
      status: "Standby",
      targetFormation,
      targetDepth: Math.round(targetDepth),
      actualDepth: 0,
      projectedTD: Math.round(targetDepth),
      spudDate,
      coordinates: { lat: site.lat, lng: site.lng },
      formation: targetFormation,
      currentDepth: 0,
      lastActivity: `Planned ${spudDate}`,
      nearbyWells: clearances.length,
    };
    ingestPlannedWell(newWell);
    setCreated(newWell);
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          title="New Well Placement Planner"
          subtitle="Choose a site against offset wells, validate separation in 3D, and register the planned well into the workspace."
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <section className="overflow-hidden rounded-[6px] border border-line bg-surface">
              <header className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 bg-surface">
                <Compass className="h-4 w-4 text-accent" />
                <span className="text-sm font-semibold text-ink">3D placement guidance</span>
                <span className="ml-auto rounded-[4px] bg-canvas border border-line px-2 py-0.5 text-xs font-medium text-ink-2">
                  {blocking.length === 0 ? (warnings.length > 0 ? "Conditional" : "Clear to drill") : "Blocked"}
                </span>
              </header>
              <div className="h-[520px]">
                <Planning3DGuidance site={site} plan={plan} pathPoints={path.points} offsets={wells} clearances={clearances} pathEnd={path.end} />
              </div>
            </section>

            <section className="rounded-[6px] border border-line bg-surface p-3">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
                <ClipboardCheck className="h-3.5 w-3.5" />
                Engineering checks
              </h3>
              <ul className="mt-2 grid gap-2 md:grid-cols-2">
                {checks.map((check) => {
                  const tone = statusStyle[check.status];
                  const Icon = tone.icon;
                  return (
                    <li key={check.id} className={`rounded-[4px] border px-3 py-2 ${tone.className}`}>
                      <div className="flex items-start gap-2">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold">{check.label}</span>
                            <span className={`ml-auto shrink-0 rounded-[4px] px-1.5 py-0.5 text-xs font-medium text-white ${tone.badge}`}>{check.status}</span>
                          </div>
                          <p className="mt-0.5 text-xs leading-4 opacity-90">{check.detail}</p>
                          <p className="mt-1 text-xs font-medium opacity-75">{check.value}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="rounded-[6px] border border-line bg-surface p-3">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
                <Route className="h-3.5 w-3.5" />
                Offset clearance at planned TD
              </h3>
              <table className="mt-2 w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-line text-xs font-medium text-ink-3">
                    <th className="py-1 pr-2 font-semibold">Offset</th>
                    <th className="py-1 pr-2 font-semibold">Surface</th>
                    <th className="py-1 pr-2 font-semibold">At TD</th>
                    <th className="py-1 pr-2 font-semibold">Margin</th>
                    <th className="py-1 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {clearances.map((clearance) => (
                    <tr key={clearance.well.id} className="border-b border-line/60">
                      <td className="py-1.5 pr-2 font-semibold text-ink">{clearance.well.id}</td>
                      <td className="py-1.5 pr-2 tabular-nums text-ink-2">{clearance.surfaceDistanceKm.toFixed(2)} km</td>
                      <td className="py-1.5 pr-2 tabular-nums text-ink-2">{(clearance.horizontalAtTargetM / 1000).toFixed(2)} km</td>
                      <td className="py-1.5 pr-2 tabular-nums font-semibold text-ink">{Math.round(clearance.marginM)} m</td>
                      <td className="py-1.5">
                        <span
                          className={`rounded-[4px] px-1.5 py-0.5 text-xs font-medium ${
                            clearance.marginM < 0 ? "bg-status-critical-soft text-status-critical" : clearance.marginM < 100 ? "bg-status-moderate-soft text-status-moderate" : "bg-status-ok-soft text-status-ok"
                          }`}
                        >
                          {clearance.marginM < 0 ? `conflict @ ${Math.round(clearance.crossesAtDepth ?? 0)} m` : clearance.marginM < 100 ? "tight" : "clear"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <aside className="space-y-3">
            <PlanningMap site={site} pathEnd={path.end} offsets={wells} clearances={clearances} radiusM={radius} onSiteChange={setSite} onPick={setSite} suggestions={suggestions} />

            <section className="rounded-[6px] border border-line bg-surface p-3">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
                <Hammer className="h-3.5 w-3.5" />
                Well design
              </h3>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  { label: "Well name", value: wellName, set: setWellName, type: "text" },
                  { label: "Target formation", value: targetFormation, set: setTargetFormation, type: "select" },
                ].map((field) => (
                  <label key={field.label} className="col-span-1 text-xs font-medium text-ink-2">
                    {field.label}
                    {field.type === "select" ? (
                      <select
                        value={field.value}
                        onChange={(event) => {
                          field.set(event.target.value);
                          const interval = formationIntervals.find((item) => item.name === event.target.value);
                          if (interval) setTargetDepth(Math.round((interval.top + interval.bottom) / 2));
                        }}
                        className="mt-0.5 w-full rounded-[4px] border border-line-strong bg-surface px-2 py-1.5 text-xs font-medium text-ink"
                      >
                        {formationIntervals.map((interval) => (
                          <option key={interval.name}>{interval.name}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={field.value}
                        onChange={(event) => field.set(event.target.value)}
                        className="mt-0.5 w-full rounded-[4px] border border-line-strong bg-surface px-2 py-1.5 text-xs font-medium text-ink"
                      />
                    )}
                  </label>
                ))}

                {[
                  { label: "Planned TD (m)", value: targetDepth, set: setTargetDepth, min: 200, max: 1150, step: 10 },
                  { label: "Kick-off (m)", value: kickOffDepth, set: setKickOffDepth, min: 100, max: 900, step: 10 },
                  { label: "Build rate (°/100 m)", value: buildRate, set: setBuildRate, min: 0.5, max: 4, step: 0.1 },
                  { label: "Final inclination (°)", value: inclination, set: setInclination, min: 15, max: 90, step: 5 },
                ].map((field) => (
                  <label key={field.label} className="text-xs font-medium text-ink-2">
                    {field.label}
                    <input
                      type="number"
                      value={field.value}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      onChange={(event) => field.set(Number(event.target.value))}
                      className="mt-0.5 w-full rounded-[4px] border border-line-strong bg-surface px-2 py-1.5 text-xs font-medium text-ink tabular-nums"
                    />
                  </label>
                ))}

                <label className="text-xs font-medium text-ink-2">
                  Azimuth (°)
                  <input type="number" value={azimuth} min={0} max={359} onChange={(event) => setAzimuth(Number(event.target.value))} className="mt-0.5 w-full rounded-[4px] border border-line-strong bg-surface px-2 py-1.5 text-xs font-medium text-ink tabular-nums" />
                </label>
                <label className="text-xs font-medium text-ink-2">
                  Survey uncertainty (m)
                  <input type="number" value={surveyUncertainty} min={5} max={200} onChange={(event) => setSurveyUncertainty(Number(event.target.value))} className="mt-0.5 w-full rounded-[4px] border border-line-strong bg-surface px-2 py-1.5 text-xs font-medium text-ink tabular-nums" />
                </label>
                <label className="text-xs font-medium text-ink-2">
                  Rig
                  <input value={rig} onChange={(event) => setRig(event.target.value)} className="mt-0.5 w-full rounded-[4px] border border-line-strong bg-surface px-2 py-1.5 text-xs font-medium text-ink" />
                </label>
                <label className="text-xs font-medium text-ink-2">
                  Spud date
                  <input type="date" value={spudDate} onChange={(event) => setSpudDate(event.target.value)} className="mt-0.5 w-full rounded-[4px] border border-line-strong bg-surface px-2 py-1.5 text-xs font-medium text-ink" />
                </label>
              </div>

              <div className="mt-3 rounded-[4px] border border-line bg-surface-muted p-2.5">
                <div className="text-xs font-semibold text-ink-2">Derived survey</div>
                <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  {[
                    ["Target radius", `${Math.round(radius)} m`],
                    ["Horizontal run", `${Math.round(path.horizontalRun)} m`],
                    ["Lateral offset", `${(distanceKm(site, path.end) * 1000).toFixed(0)} m`],
                    ["Nearest offset", clearances[0] ? `${(clearances[0].horizontalAtTargetM / 1000).toFixed(2)} km` : "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-2">
                      <dt className="text-ink-3">{label}</dt>
                      <dd className="font-semibold tabular-nums text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>

            <section className="rounded-[6px] border border-line bg-surface p-3">
              <h3 className="text-xs font-semibold text-ink-2">Casing program</h3>
              <ul className="mt-2 space-y-1.5">
                {CasingProgram.map((run) => (
                  <li key={run.size} className="flex items-center gap-2 rounded-[4px] border border-line px-2 py-1.5">
                    <span className="w-12 shrink-0 text-xs font-bold text-ink">{run.size}</span>
                    <span className="w-14 shrink-0 text-xs tabular-nums text-ink-3">{run.depth} m</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-ink-2">{run.purpose}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-3">Casing depths are schematic until a design basis is issued.</p>
            </section>

            <section className="rounded-[6px] border border-line bg-surface p-3">
              <button
                type="button"
                onClick={createWell}
                disabled={!canCreate}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[4px] bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-ink-3"
              >
                <Save className="h-4 w-4" />
                Create planned well
              </button>
              {blocking.length > 0 && (
                <p className="mt-2 text-xs leading-4 text-status-critical">Resolve {blocking.length} blocking check{blocking.length === 1 ? "" : "s"} before registering the well.</p>
              )}

              {created && (
                <div className="mt-3 rounded-[4px] border border-status-ok/30 bg-status-ok-soft p-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-status-ok">
                    <Sparkles className="h-3.5 w-3.5" />
                    {created.id} registered
                  </div>
                  <p className="mt-1 text-xs leading-4 text-ink-2">
                    Added to the workspace with status Standby. It now appears in the well selector, 3D subsurface workspace and evidence graph. Reference well for this session was{" "}
                    {selectedWell.id}.
                  </p>
                  <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-status-ok">
                    <MapPin className="h-3 w-3" />
                    {created.coordinates.lat.toFixed(4)}, {created.coordinates.lng.toFixed(4)}
                  </p>
                </div>
              )}

              {plannedWells.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-ink-2">Planned this session</div>
                  <ul className="mt-1.5 space-y-1">
                    {plannedWells.map((well) => (
                      <li key={well.id} className="flex items-center justify-between gap-2 rounded-[4px] border border-line px-2 py-1.5 text-xs">
                        <span className="font-semibold text-ink">{well.id}</span>
                        <span className="text-ink-3 tabular-nums">TD {well.targetDepth} m</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
