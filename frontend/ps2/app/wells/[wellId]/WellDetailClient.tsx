"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import type { Well } from "@/lib/nwis-data";
import { getEvents, getFormationPicks, getMudRecords, getDocuments } from "@/lib/engineering/well-data";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProvenanceChip } from "@/components/ui/ProvenanceChip";
import { EventGlyph } from "@/components/ui/EventGlyph";
import { classifyEvent } from "@/lib/taxonomy";

interface WellDetailClientProps {
  well: Well;
}

export function WellDetailClient({ well }: WellDetailClientProps) {
  const [activeTab, setActiveTab] = useState("overview");

  const formationPicks = getFormationPicks(well.id);
  const events = getEvents(well.id);
  const mudResult = getMudRecords(well.id);
  const docs = getDocuments(well.id);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "formations", label: `Formations (${formationPicks.length})` },
    { id: "events", label: `Events (${events.length})` },
    { id: "mud", label: "Mud & casing" },
    { id: "documents", label: `Documents (${docs.length})` },
  ];

  return (
    <div className="space-y-4">
      {/* Back button & Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-ink-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 hover:text-ink font-medium text-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Dashboard</span>
        </Link>
        <span>/</span>
        <span className="text-ink">Wells</span>
        <span>/</span>
        <span className="font-semibold text-ink">{well.id}</span>
      </div>

      {/* Well Header Card */}
      <div className="rounded-[6px] border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-ink">{well.id}</h1>
            <Badge
              variant={
                well.status === "Active"
                  ? "accent"
                  : well.status === "Drilling Complete" || well.status === "Completed"
                  ? "ok"
                  : "neutral"
              }
            >
              {well.status}
            </Badge>
            <span className="text-xs text-ink-3">·</span>
            <span className="text-xs text-ink-2 font-medium">{well.location}</span>
            <span className="text-xs text-ink-3">·</span>
            <span className="text-xs text-ink-2">{well.wellType}</span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-[4px] border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-muted transition"
            >
              Command center
            </Link>
            <Link
              href={`/compare?primary=${well.id}`}
              className="rounded-[4px] bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover transition"
            >
              Compare offset
            </Link>
          </div>
        </div>

        {/* Spec Strip */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 border-t border-line pt-3 text-xs">
          <div>
            <div className="text-ink-3">Rig assignment</div>
            <div className="font-medium text-ink mt-0.5">{well.rig}</div>
          </div>
          <div>
            <div className="text-ink-3">Profile</div>
            <div className="font-medium text-ink mt-0.5">{well.profile}</div>
          </div>
          <div>
            <div className="text-ink-3">Target depth (TD)</div>
            <div className="font-medium text-ink tabular-nums mt-0.5">
              {well.targetDepth.toLocaleString("en-IN")} m MD
            </div>
          </div>
          <div>
            <div className="text-ink-3">Current / actual depth</div>
            <div className="font-medium text-ink tabular-nums mt-0.5">
              {well.currentDepth.toLocaleString("en-IN")} m MD
            </div>
          </div>
          <div>
            <div className="text-ink-3">Target formation</div>
            <div className="font-medium text-ink truncate mt-0.5">{well.targetFormation}</div>
          </div>
          <div>
            <div className="text-ink-3">Spud date</div>
            <div className="font-medium text-ink tabular-nums mt-0.5">{well.spudDate}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab Panels */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-[6px] border border-line bg-surface p-4">
              <div className="text-xs font-semibold text-ink-3">Current depth</div>
              <div className="mt-2 text-2xl font-semibold tabular-nums text-ink">
                {well.currentDepth.toLocaleString("en-IN")} m
              </div>
              <div className="mt-1 text-xs text-ink-3">Measured depth (MD)</div>
            </div>
            <div className="rounded-[6px] border border-line bg-surface p-4">
              <div className="text-xs font-semibold text-ink-3">Projected TD</div>
              <div className="mt-2 text-2xl font-semibold tabular-nums text-ink">
                {well.projectedTD.toLocaleString("en-IN")} m
              </div>
              <div className="mt-1 text-xs text-ink-3">
                {well.targetDepth - well.currentDepth > 0
                  ? `${(well.targetDepth - well.currentDepth).toLocaleString("en-IN")} m remaining`
                  : "At total depth"}
              </div>
            </div>
            <div className="rounded-[6px] border border-line bg-surface p-4">
              <div className="text-xs font-semibold text-ink-3">Recorded incidents</div>
              <div className="mt-2 text-2xl font-semibold tabular-nums text-ink">
                {events.length}
              </div>
              <div className="mt-1 text-xs text-ink-3">In ingested documents</div>
            </div>
            <div className="rounded-[6px] border border-line bg-surface p-4">
              <div className="text-xs font-semibold text-ink-3">Nearby offset wells</div>
              <div className="mt-2 text-2xl font-semibold tabular-nums text-ink">
                {well.nearbyWells}
              </div>
              <div className="mt-1 text-xs text-ink-3">In 10 km spatial radius</div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[6px] border border-line bg-surface p-4">
              <h3 className="text-sm font-semibold text-ink mb-3">Well specification</h3>
              <dl className="divide-y divide-line text-xs">
                <div className="flex justify-between py-2">
                  <dt className="text-ink-3">Surface coordinates</dt>
                  <dd className="font-medium text-ink tabular-nums">
                    {well.coordinates.lat.toFixed(4)}° N, {well.coordinates.lng.toFixed(4)}° E
                  </dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-ink-3">Drilling rig</dt>
                  <dd className="font-medium text-ink">{well.rig}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-ink-3">Well profile type</dt>
                  <dd className="font-medium text-ink">{well.profile}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-ink-3">Spud date</dt>
                  <dd className="font-medium text-ink tabular-nums">{well.spudDate}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-ink-3">Total depth date</dt>
                  <dd className="font-medium text-ink tabular-nums">{well.tdDate ?? "In progress"}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-ink-3">Last recorded activity</dt>
                  <dd className="font-medium text-ink">{well.lastActivity}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-[6px] border border-line bg-surface p-4 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-ink mb-2">Operational notes</h3>
                <p className="text-xs leading-relaxed text-ink-2">
                  {well.id} is situated in the {well.location} sector targeting the {well.targetFormation}.
                  Regional offsets indicate potential mud loss intervals and tight pull hazards
                  in the carbonate and sandstone sequences.
                </p>
                <div className="mt-4 rounded-[4px] border border-line bg-surface-muted p-3 text-xs text-ink-2">
                  <div className="font-semibold text-ink mb-1">Honest data provenance notice</div>
                  <div>
                    Records for this well derive from verified Oil India operational reports.
                    Where depth-specific parameter picks are not present in the ingested WCR/DDR set,
                    regional correlation markers are indicated.
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-line">
                <ProvenanceChip
                  source="Oil India master well record"
                  recordCount={1}
                  simulatedCount={0}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "formations" && (
        <div className="rounded-[6px] border border-line bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-ink">Stratigraphic picks</h3>
              <p className="text-xs text-ink-3">
                Formation tops, thickness, and lithology intervals
              </p>
            </div>
            <ProvenanceChip
              source="Ingested WCR formation tops"
              recordCount={formationPicks.length}
              simulatedCount={0}
            />
          </div>

          {formationPicks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-line text-ink-3 bg-surface-muted/50">
                    <th className="py-2.5 px-3 font-semibold">Formation</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Top (m MD)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Bottom (m MD)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Thickness (m)</th>
                    <th className="py-2.5 px-3 font-semibold">Lithology</th>
                    <th className="py-2.5 px-3 font-semibold">Pick source</th>
                    <th className="py-2.5 px-3 font-semibold">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {formationPicks.map((pick) => (
                    <tr key={pick.name} className="hover:bg-surface-muted">
                      <td className="py-2.5 px-3 font-medium text-ink">{pick.name}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-ink">{pick.top}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-ink">{pick.bottom}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-ink">{pick.thickness}</td>
                      <td className="py-2.5 px-3 text-ink-2">{pick.lithology}</td>
                      <td className="py-2.5 px-3 text-ink-2">{pick.source}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant={pick.confidence === "HIGH" ? "ok" : "moderate"}>
                          {pick.confidence}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No formation picks recorded"
              description={`No source-backed formation picks exist for ${well.id} in this dataset. Formation picks belong to WX-07. Offset correlation is recommended.`}
            />
          )}
        </div>
      )}

      {activeTab === "events" && (
        <div className="rounded-[6px] border border-line bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-ink">Operational events</h3>
              <p className="text-xs text-ink-3">
                Precedents of mud loss, stuck pipe, influx, and tight pull
              </p>
            </div>
            <ProvenanceChip
              source="Daily drilling reports & WCR"
              recordCount={events.length}
              simulatedCount={0}
            />
          </div>

          {events.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-line text-ink-3 bg-surface-muted/50">
                    <th className="py-2.5 px-3 font-semibold">Hazard category</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Depth (m MD)</th>
                    <th className="py-2.5 px-3 font-semibold">Formation</th>
                    <th className="py-2.5 px-3 font-semibold">Severity</th>
                    <th className="py-2.5 px-3 font-semibold">Incident description</th>
                    <th className="py-2.5 px-3 font-semibold">Action & outcome</th>
                    <th className="py-2.5 px-3 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {events.map((ev) => {
                    const cat = classifyEvent(ev.type);
                    return (
                      <tr key={ev.id} className="hover:bg-surface-muted">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5 font-medium text-ink">
                            <EventGlyph category={cat} size={13} />
                            <span>{ev.type}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-ink font-semibold">
                          {ev.depth}
                        </td>
                        <td className="py-2.5 px-3 text-ink-2">{ev.formation}</td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant={
                              ev.severity === "Critical"
                                ? "critical"
                                : ev.severity === "High"
                                ? "high"
                                : ev.severity === "Medium"
                                ? "moderate"
                                : "neutral"
                            }
                          >
                            {ev.severity}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-ink max-w-[280px] leading-relaxed">
                          {ev.description}
                        </td>
                        <td className="py-2.5 px-3 text-ink-2 max-w-[220px] leading-relaxed">
                          {ev.response || ev.outcome ? (
                            <span>{ev.response} {ev.outcome && `— ${ev.outcome}`}</span>
                          ) : (
                            <span className="text-ink-3">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 tabular-nums text-ink-3 whitespace-nowrap">
                          {ev.date}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No operational events recorded"
              description={`No historical operational events or incidents were recorded for ${well.id} in the ingested documents.`}
            />
          )}
        </div>
      )}

      {activeTab === "mud" && (
        <div className="rounded-[6px] border border-line bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-ink">Mud recap & properties</h3>
              <p className="text-xs text-ink-3">
                Fluid density, viscosity, and chemical properties by depth
              </p>
            </div>
            {mudResult.available && (
              <ProvenanceChip
                source="WCR mud recap table"
                recordCount={mudResult.records.length}
                simulatedCount={0}
              />
            )}
          </div>

          {mudResult.available && mudResult.records.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-line text-ink-3 bg-surface-muted/50">
                    <th className="py-2.5 px-3 font-semibold">Date</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Depth (m MD)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Mud wt (g/cm³)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Viscosity (s)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">PV (cP)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">YP (lb/100ft²)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">pH</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Fluid loss (ml)</th>
                    <th className="py-2.5 px-3 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {mudResult.records.map((r, i) => (
                    <tr key={i} className="hover:bg-surface-muted">
                      <td className="py-2.5 px-3 tabular-nums text-ink">{r.date}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-medium text-ink">
                        {r.depth}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-ink">{r.mudWeight}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-ink">{r.viscosity}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-ink">{r.pv}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-ink">{r.yp}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-ink">{r.ph}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-ink">{r.fluidLoss}</td>
                      <td className="py-2.5 px-3 text-ink-2 max-w-[200px] truncate">{r.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No mud records available"
              description={
                mudResult.reason ??
                `No mud recap or casing records exist in the ingested documents for ${well.id}.`
              }
            />
          )}
        </div>
      )}

      {activeTab === "documents" && (
        <div className="rounded-[6px] border border-line bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-ink">Ingested source documents</h3>
              <p className="text-xs text-ink-3">
                WCR, DDR, and completion reports linked to this well
              </p>
            </div>
            <ProvenanceChip
              source="Oil India repository register"
              recordCount={docs.length}
              simulatedCount={0}
            />
          </div>

          {docs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-line text-ink-3 bg-surface-muted/50">
                    <th className="py-2.5 px-3 font-semibold">Document name</th>
                    <th className="py-2.5 px-3 font-semibold">Type</th>
                    <th className="py-2.5 px-3 font-semibold">Date</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Pages</th>
                    <th className="py-2.5 px-3 font-semibold">Availability</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {docs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-surface-muted">
                      <td className="py-2.5 px-3 font-medium text-ink">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-accent shrink-0" />
                          <span>{doc.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-ink-2">{doc.kind}</td>
                      <td className="py-2.5 px-3 tabular-nums text-ink-2">{doc.date}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-ink">{doc.pages}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant={doc.availability === "available" ? "ok" : "neutral"}>
                          {doc.availability === "available" ? "Available" : "Not supplied"}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={
                            doc.status === "Validated"
                              ? "ok"
                              : doc.status === "Prototype"
                              ? "moderate"
                              : "neutral"
                          }
                        >
                          {doc.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No documents ingested"
              description={`No documents have been ingested for well ${well.id}. Upload a WCR or DDR to extract well parameters.`}
            />
          )}
        </div>
      )}
    </div>
  );
}
