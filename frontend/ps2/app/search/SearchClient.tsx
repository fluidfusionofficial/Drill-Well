"use client";

import React, { useState, useMemo } from "react";
import { Search as SearchIcon, Filter, X, FileText, ChevronRight } from "lucide-react";
import { wells } from "@/lib/nwis-data";
import { getAllEvents } from "@/lib/fixtures/extended-dataset";
import { classifyEvent, HAZARD_CATEGORIES } from "@/lib/taxonomy";
import { EventGlyph } from "@/components/ui/EventGlyph";
import { Badge } from "@/components/ui/Badge";
import { ProvenanceChip } from "@/components/ui/ProvenanceChip";
import Link from "next/link";

export function SearchClient() {
  const [query, setQuery] = useState("Mud loss in Upper Carbonate");
  const [selectedFormation, setSelectedFormation] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedWell, setSelectedWell] = useState("All");

  const allAvailableEvents = useMemo(() => getAllEvents(), []);

  // Filter and score results
  const filteredResults = useMemo(() => {
    const qLower = query.toLowerCase().trim();
    const terms = qLower.split(/\s+/).filter(Boolean);

    return allAvailableEvents
      .map((ev) => {
        const cat = classifyEvent(ev.type);
        const textToMatch = `${ev.type} ${ev.formation} ${ev.description} ${ev.response ?? ""} ${
          ev.outcome ?? ""
        } ${ev.wellId}`.toLowerCase();

        let matches = 0;
        for (const term of terms) {
          if (textToMatch.includes(term)) matches++;
        }

        const matchesFormation =
          selectedFormation === "All" ||
          ev.formation.toLowerCase().includes(selectedFormation.toLowerCase());
        const matchesCategory = selectedCategory === "All" || cat === selectedCategory;
        const matchesWell = selectedWell === "All" || ev.wellId === selectedWell;

        const isMatch = (terms.length === 0 || matches > 0) && matchesFormation && matchesCategory && matchesWell;
        const relevance = terms.length > 0 ? Math.min(100, Math.round((matches / terms.length) * 100)) : 80;

        return {
          event: ev,
          category: cat,
          relevance,
          isMatch,
        };
      })
      .filter((r) => r.isMatch)
      .sort((a, b) => b.relevance - a.relevance);
  }, [query, selectedFormation, selectedCategory, selectedWell, allAvailableEvents]);

  // Deterministic summary sentence
  const summarySentence = useMemo(() => {
    if (filteredResults.length === 0) {
      return `No records matched '${query}'. Try broadening the search terms or filters.`;
    }

    const wellIds = Array.from(new Set(filteredResults.map((r) => r.event.wellId)));
    const depths = filteredResults.map((r) => r.event.depth);
    const minD = Math.min(...depths);
    const maxD = Math.max(...depths);

    return `Found ${filteredResults.length} incident record${
      filteredResults.length === 1 ? "" : "s"
    } across ${wellIds.length} well${wellIds.length === 1 ? "" : "s"} (${wellIds.slice(0, 3).join(", ")}${
      wellIds.length > 3 ? "..." : ""
    }) between ${minD} m and ${maxD} m MD.`;
  }, [filteredResults, query]);

  return (
    <div className="space-y-4">
      {/* Search Bar & Filters */}
      <div className="rounded-[6px] border border-line bg-surface p-4 text-ink space-y-3">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by hazard, formation, well ID, or operational description..."
            className="w-full rounded-[4px] border border-line bg-surface py-2 pl-9 pr-8 text-xs text-ink focus:border-accent focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Facet Selectors */}
        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
          <div className="flex items-center gap-1.5 text-ink-3">
            <Filter className="h-3.5 w-3.5" />
            <span>Facets:</span>
          </div>

          <label className="flex items-center gap-1.5 text-ink-2">
            <span>Well:</span>
            <select
              value={selectedWell}
              onChange={(e) => setSelectedWell(e.target.value)}
              className="rounded-[4px] border border-line bg-surface px-2 py-1 text-xs text-ink focus:border-accent"
            >
              <option value="All">All wells</option>
              {wells.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.id}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-ink-2">
            <span>Formation:</span>
            <select
              value={selectedFormation}
              onChange={(e) => setSelectedFormation(e.target.value)}
              className="rounded-[4px] border border-line bg-surface px-2 py-1 text-xs text-ink focus:border-accent"
            >
              <option value="All">All formations</option>
              <option value="Upper Carbonate">Upper Carbonate</option>
              <option value="Jodhpur">Jodhpur Sandstone</option>
              <option value="Bilara">Bilara Formation</option>
              <option value="Nagaur">Nagaur Formation</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-ink-2">
            <span>Hazard category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-[4px] border border-line bg-surface px-2 py-1 text-xs text-ink focus:border-accent"
            >
              <option value="All">All categories</option>
              {HAZARD_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>

          {(selectedFormation !== "All" || selectedCategory !== "All" || selectedWell !== "All") && (
            <button
              type="button"
              onClick={() => {
                setSelectedFormation("All");
                setSelectedCategory("All");
                setSelectedWell("All");
              }}
              className="text-xs text-accent hover:underline ml-auto"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Summary Sentence Banner */}
      <div className="rounded-[4px] border border-accent/20 bg-primary-soft p-3 text-xs text-ink">
        <div className="font-semibold text-accent mb-0.5">Deterministic search summary</div>
        <div className="text-ink-2">{summarySentence}</div>
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {filteredResults.map(({ event: ev, category: cat, relevance }) => (
          <div
            key={ev.id}
            className="rounded-[6px] border border-line bg-surface p-4 text-ink hover:border-line-strong transition"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2.5">
              <div className="flex items-center gap-2">
                <EventGlyph category={cat} size={15} />
                <span className="text-sm font-semibold text-ink">{ev.type}</span>
                <span className="text-xs text-ink-3">·</span>
                <span className="text-xs font-semibold text-accent">{ev.wellId}</span>
                <span className="text-xs text-ink-3">·</span>
                <span className="text-xs tabular-nums text-ink-2 font-medium">{ev.depth} m MD</span>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    ev.severity === "Critical"
                      ? "critical"
                      : ev.severity === "High"
                      ? "high"
                      : "moderate"
                  }
                >
                  {ev.severity}
                </Badge>
                <span className="rounded-[4px] border border-line bg-surface-muted px-2 py-0.5 text-xs text-ink-3 tabular-nums">
                  {relevance}% relevance
                </span>
              </div>
            </div>

            <div className="mt-3 text-xs leading-relaxed text-ink">{ev.description}</div>

            {ev.response && (
              <div className="mt-2 text-xs text-ink-2">
                <span className="font-medium text-ink">Mitigation: </span>
                {ev.response} {ev.outcome && `— Outcome: ${ev.outcome}`}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 text-xs text-ink-3">
              <div className="flex items-center gap-3">
                <span>Formation: <strong className="text-ink font-normal">{ev.formation}</strong></span>
                <span>Date: <strong className="text-ink font-normal tabular-nums">{ev.date}</strong></span>
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  <span>{ev.source} ({ev.sourcePage})</span>
                </span>
              </div>

              <Link
                href={`/wells/${ev.wellId}`}
                className="inline-flex items-center gap-1 font-medium text-accent hover:text-accent-hover"
              >
                <span>Inspect well {ev.wellId}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ))}

        {filteredResults.length === 0 && (
          <div className="rounded-[6px] border border-line bg-surface p-8 text-center text-xs text-ink-3">
            No knowledge records match your query and active filters.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-1">
        <ProvenanceChip
          source="Verified WCR and DDR knowledge extraction"
          recordCount={filteredResults.length}
          simulatedCount={filteredResults.filter((r) => r.event.origin === "simulated").length}
        />
      </div>
    </div>
  );
}
