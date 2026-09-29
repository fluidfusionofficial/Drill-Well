"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  FileText,
  Filter,
  Layers3,
  Network,
  Search,
  Target,
  Drill,
} from "lucide-react";
import { AppShell } from "@/components/layout-shell";
import { PageHeader } from "@/components/page-header";
import { useNwisWorkspace } from "@/components/nwis-workspace-context";
import { documents, formationIntervals, wellEvents, wells } from "@/lib/nwis-data";
import type { EventRecord } from "@/lib/nwis-data";
import { ProvenanceChip } from "@/components/ui/ProvenanceChip";
import { EventGlyph } from "@/components/ui/EventGlyph";
import { classifyEvent } from "@/lib/taxonomy";

type GraphNode = {
  id: string;
  kind: "well" | "formation" | "event" | "document";
  label: string;
  sublabel: string;
  column: number;
  row: number;
  meta: Record<string, string>;
  event?: EventRecord;
};

const columnTitles = ["Well", "Stratigraphy", "Event precedent", "Source document"];

const nodeTone: Record<GraphNode["kind"], string> = {
  well: "border-accent/40 bg-primary-soft text-ink",
  formation: "border-line-strong bg-surface-muted text-ink",
  event: "border-status-high/40 bg-status-high-soft text-ink",
  document: "border-line bg-surface text-ink",
};

const nodeAccent: Record<GraphNode["kind"], string> = {
  well: "text-accent",
  formation: "text-ink",
  event: "text-status-high",
  document: "text-ink-2",
};

export default function EvidencePage() {
  const { setCurrentDepth, setSelectedEventId } = useNwisWorkspace();
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<"All" | "High" | "Medium" | "Low">("All");
  const [selected, setSelected] = useState<string | null>(null);

  const { nodes, links } = useMemo(() => {
    const filteredEvents = wellEvents.filter((event) => {
      const matchesSeverity = severity === "All" || event.severity === severity;
      const text = `${event.type} ${event.formation} ${event.source} ${event.description}`.toLowerCase();
      return (
        matchesSeverity &&
        (query.trim() === "" || text.includes(query.trim().toLowerCase()))
      );
    });

    const usedWells = new Set(filteredEvents.map((event) => event.wellId));
    const usedFormations = new Set(filteredEvents.map((event) => event.formation));
    const usedSources = new Set(filteredEvents.map((event) => event.source));

    const graphNodes: GraphNode[] = [];
    const graphLinks: { from: string; to: string; label: string }[] = [];

    wells
      .filter((well) => usedWells.has(well.id))
      .forEach((well, index) => {
        graphNodes.push({
          id: `well:${well.id}`,
          kind: "well",
          label: well.id,
          sublabel: well.formation,
          column: 0,
          row: index,
          meta: { Status: well.status, Rig: well.rig, TD: `${well.actualDepth} m` },
        });
      });

    [...usedFormations].forEach((name, index) => {
      const interval = formationIntervals.find((item) => item.name === name);
      graphNodes.push({
        id: `formation:${name}`,
        kind: "formation",
        label: name,
        sublabel: interval ? `${interval.top}–${interval.bottom} m` : "Reference pick",
        column: 1,
        row: index,
        meta: interval
          ? {
              Lithology: interval.lithology,
              Source: interval.source,
              Confidence: interval.confidence,
            }
          : {},
      });
    });

    filteredEvents.forEach((event, index) => {
      graphNodes.push({
        id: `event:${event.id}`,
        kind: "event",
        label: event.type,
        sublabel: `${event.depth} m · ${event.date}`,
        column: 2,
        row: index,
        meta: {
          Severity: event.severity,
          Formation: event.formation,
          Source: event.source,
          Page: event.sourcePage,
          Confidence: event.confidence,
        },
        event,
      });
      graphLinks.push({
        from: `well:${event.wellId}`,
        to: `formation:${event.formation}`,
        label: event.wellId,
      });
      graphLinks.push({
        from: `formation:${event.formation}`,
        to: `event:${event.id}`,
        label: `${event.depth} m`,
      });
    });

    documents
      .filter(
        (doc) => usedSources.has(doc.kind) || usedSources.has("WCR") || usedSources.has("DDR"),
      )
      .forEach((doc, index) => {
        graphNodes.push({
          id: `document:${doc.name}`,
          kind: "document",
          label: doc.name,
          sublabel: `${doc.kind} · ${doc.wellId} · ${doc.pages} pages`,
          column: 3,
          row: index,
          meta: { Status: doc.status, Date: doc.date, Pages: String(doc.pages) },
        });
      });

    filteredEvents.forEach((event) => {
      const match = documents.find((doc) => doc.kind === event.source) ?? documents[0];
      if (match)
        graphLinks.push({
          from: `event:${event.id}`,
          to: `document:${match.name}`,
          label: event.sourcePage,
        });
    });

    return { nodes: graphNodes, links: graphLinks };
  }, [query, severity]);

  const rows = useMemo(() => {
    const perColumn = new Map<number, number>();
    return nodes.map((node) => {
      const index = perColumn.get(node.column) ?? 0;
      perColumn.set(node.column, index + 1);
      return { node, index };
    });
  }, [nodes]);

  const positionOf = (id: string) => {
    const column = nodes.filter(
      (node) => node.column === nodes.find((n) => n.id === id)?.column,
    );
    return column.findIndex((node) => node.id === id);
  };

  const selectedNode = nodes.find((node) => node.id === selected);

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          title="Evidence & provenance graph"
          description="Trace every recorded incident from well location, through formation strata, to its authoritative source document."
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* Main Graph Canvas */}
          <section className="overflow-hidden rounded-[6px] border border-line bg-surface flex flex-col">
            <header className="flex flex-wrap items-center gap-3 border-b border-line p-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter events, formations, sources…"
                  aria-label="Filter evidence graph"
                  className="w-full rounded-[4px] border border-line bg-surface py-1.5 pl-8 pr-2 text-xs text-ink focus:border-accent focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-ink-3">
                <Filter className="h-3.5 w-3.5" />
                {(["All", "High", "Medium", "Low"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSeverity(option)}
                    aria-pressed={severity === option}
                    className={`rounded-[4px] px-2 py-1 text-xs font-medium transition ${
                      severity === option
                        ? "bg-primary text-white"
                        : "bg-surface border border-line text-ink-2 hover:bg-surface-muted"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </header>

            {/* Column Titles */}
            <div className="grid grid-cols-4 border-b border-line bg-surface-muted/60 text-center text-xs font-semibold text-ink-3">
              {columnTitles.map((title) => (
                <div key={title} className="py-2 px-2 border-r last:border-r-0 border-line">
                  {title}
                </div>
              ))}
            </div>

            {/* Nodes and Links */}
            <div className="min-h-[460px] p-4 flex-1">
              {rows.length === 0 ? (
                <div className="grid h-64 place-items-center text-xs text-ink-3">
                  No evidence matches the current query or severity filter.
                </div>
              ) : (
                <div className="relative">
                  <svg
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    aria-hidden="true"
                  >
                    {links.map((link, index) => {
                      const from = nodes.find((node) => node.id === link.from);
                      const to = nodes.find((node) => node.id === link.to);
                      if (!from || !to) return null;
                      const fromIndex = positionOf(from.id);
                      const toIndex = positionOf(to.id);
                      if (fromIndex < 0 || toIndex < 0) return null;
                      const x1 = ((from.column + 0.9) / 4) * 100;
                      const x2 = ((to.column + 0.1) / 4) * 100;
                      const y1 =
                        ((fromIndex + 0.5) /
                          Math.max(
                            1,
                            nodes.filter((node) => node.column === from.column).length,
                          )) *
                        100;
                      const y2 =
                        ((toIndex + 0.5) /
                          Math.max(
                            1,
                            nodes.filter((node) => node.column === to.column).length,
                          )) *
                        100;
                      const isActive = selected === from.id || selected === to.id;
                      return (
                        <path
                          key={`${link.from}-${link.to}-${index}`}
                          d={`M ${x1}% ${y1}% C ${(x1 + x2) / 2}% ${y1}%, ${
                            (x1 + x2) / 2
                          }% ${y2}%, ${x2}% ${y2}%`}
                          fill="none"
                          stroke={isActive ? "#1D4ED8" : "#C8CED6"}
                          strokeWidth={isActive ? 2 : 1}
                        />
                      );
                    })}
                  </svg>

                  <div className="grid grid-cols-4 gap-3">
                    {[0, 1, 2, 3].map((column) => (
                      <div key={column} className="flex flex-col gap-2">
                        {rows
                          .filter(({ node }) => node.column === column)
                          .map(({ node }) => {
                            const isEvent = node.kind === "event";
                            const cat = isEvent && node.event ? classifyEvent(node.event.type) : null;

                            return (
                              <button
                                key={node.id}
                                type="button"
                                onClick={() => {
                                  setSelected(node.id);
                                  if (node.event) {
                                    setCurrentDepth(node.event.depth);
                                    setSelectedEventId(node.event.id);
                                  }
                                }}
                                className={`relative z-10 rounded-[6px] border px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                                  nodeTone[node.kind]
                                } ${selected === node.id ? "ring-2 ring-accent" : "hover:border-line-strong"}`}
                              >
                                <div className="flex items-center gap-1.5">
                                  {isEvent && cat ? (
                                    <EventGlyph category={cat} size={13} />
                                  ) : node.kind === "well" ? (
                                    <Drill className="h-3 w-3 text-accent shrink-0" />
                                  ) : node.kind === "formation" ? (
                                    <Layers3 className="h-3 w-3 text-ink-3 shrink-0" />
                                  ) : (
                                    <FileText className="h-3 w-3 text-ink-3 shrink-0" />
                                  )}
                                  <span
                                    className={`block truncate text-xs font-semibold ${
                                      nodeAccent[node.kind]
                                    }`}
                                  >
                                    {node.label}
                                  </span>
                                </div>
                                <span className="block truncate text-xs text-ink-3 mt-0.5">
                                  {node.sublabel}
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Shape + Colour Legend Footer */}
            <footer className="flex flex-wrap items-center gap-4 border-t border-line px-4 py-2.5 text-xs text-ink-3 bg-surface-muted/40">
              <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                <Drill className="h-3.5 w-3.5 text-accent" />
                <span>Well identifier</span>
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                <Layers3 className="h-3.5 w-3.5 text-ink-3" />
                <span>Stratigraphy</span>
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                <span className="h-2.5 w-2.5 rounded-full bg-status-high" />
                <span>Hazard incident</span>
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                <FileText className="h-3.5 w-3.5 text-ink-3" />
                <span>Source document</span>
              </span>

              <span className="ml-auto tabular-nums">
                {nodes.length} nodes · {links.length} graph links
              </span>
            </footer>
          </section>

          {/* Node Detail Sidebar */}
          <aside className="space-y-3">
            <section className="rounded-[6px] border border-line bg-surface p-3.5 text-ink">
              <h2 className="flex items-center gap-1.5 text-xs font-semibold text-ink border-b border-line pb-2">
                <Network className="h-3.5 w-3.5 text-accent" />
                <span>Node details</span>
              </h2>

              {selectedNode ? (
                <div className="mt-2.5 space-y-3">
                  <div className="rounded-[4px] border border-line bg-surface-muted p-2.5 text-xs">
                    <div className="font-semibold text-ink">{selectedNode.label}</div>
                    <div className="mt-0.5 text-ink-3">{selectedNode.sublabel}</div>

                    <dl className="mt-2 space-y-1 border-t border-line pt-2 text-xs">
                      {Object.entries(selectedNode.meta).map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-2">
                          <dt className="text-ink-3">{label}</dt>
                          <dd className="truncate font-medium text-ink">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  {selectedNode.event && (
                    <div className="space-y-2 text-xs">
                      <div className="rounded-[4px] border border-line p-2.5 bg-surface">
                        <div className="flex items-center gap-1.5 font-semibold text-ink">
                          <AlertTriangle className="h-3.5 w-3.5 text-status-high" />
                          <span>Incident description</span>
                        </div>
                        <p className="mt-1 leading-relaxed text-ink-2">
                          {selectedNode.event.description}
                        </p>
                      </div>

                      <div className="rounded-[4px] border border-line p-2.5 bg-surface">
                        <div className="flex items-center gap-1.5 font-semibold text-ink">
                          <Target className="h-3.5 w-3.5 text-accent" />
                          <span>Operational response</span>
                        </div>
                        <p className="mt-1 leading-relaxed text-ink-2">
                          {selectedNode.event.response || "No recorded response action."}
                        </p>
                      </div>

                      <div className="rounded-[4px] border border-line p-2.5 bg-surface">
                        <div className="flex items-center gap-1.5 font-semibold text-ink">
                          <BookOpen className="h-3.5 w-3.5 text-status-ok" />
                          <span>Outcome</span>
                        </div>
                        <p className="mt-1 leading-relaxed text-ink-2">
                          {selectedNode.event.outcome || "Normal operations resumed."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-ink-3">
                  Select any node in the graph to inspect metadata, incident responses, and source
                  citations.
                </div>
              )}
            </section>
          </aside>
        </div>

        {/* Footer */}
        <div className="pt-1">
          <ProvenanceChip
            source="Verified Oil India institutional graph"
            recordCount={nodes.length}
            simulatedCount={0}
          />
        </div>
      </div>
    </AppShell>
  );
}
