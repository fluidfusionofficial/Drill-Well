"use client";

import React, { useState, useMemo } from "react";
import { useNwisWorkspace } from "@/components/nwis-workspace-context";
import { findSimilarWells } from "@/lib/engineering/similarity";
import { getAllWells, getAllEvents } from "@/lib/fixtures/extended-dataset";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { ProvenanceChip } from "@/components/ui/ProvenanceChip";

interface OffsetWellsTableProps {
  selectedWellId?: string | null;
  onSelectWell?: (wellId: string) => void;
  className?: string;
}

export function OffsetWellsTable({
  selectedWellId,
  onSelectWell,
  className = "",
}: OffsetWellsTableProps) {
  const { selectedWell, radiusKm } = useNwisWorkspace();
  const [sortCol, setSortCol] = useState<string>("similarity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const allWells = useMemo(() => getAllWells(), []);
  const allEvents = useMemo(() => getAllEvents(), []);

  // Compute similarity scores using engineering/similarity.ts
  const similarScores = useMemo(() => {
    try {
      const results = findSimilarWells(selectedWell);
      const scoreMap = new Map<string, number>();
      for (const r of results) {
        scoreMap.set(r.wellId, Math.round(r.score * 100));
      }
      return scoreMap;
    } catch {
      return new Map<string, number>();
    }
  }, [selectedWell]);

  // Wells in radius
  const tableData = useMemo(() => {
    return allWells
      .filter((w) => w.id !== selectedWell.id && (w.distanceFromWx11Km ?? 0) <= radiusKm)
      .map((w) => {
        const eventsCount = allEvents.filter((e) => e.wellId === w.id).length;
        const formationMatch =
          w.formation.toLowerCase() === selectedWell.formation.toLowerCase()
            ? "Exact"
            : w.formation.toLowerCase().includes(selectedWell.formation.toLowerCase()) ||
              selectedWell.formation.toLowerCase().includes(w.formation.toLowerCase())
            ? "Partial"
            : "Adjacent";

        const similarity = similarScores.get(w.id) ?? Math.max(50, 95 - Math.round(w.distanceFromWx11Km * 2));

        return {
          id: w.id,
          well: w,
          status: w.status,
          distance: w.distanceFromWx11Km,
          formationMatch,
          targetDepth: w.targetDepth,
          eventsCount,
          similarity,
        };
      });
  }, [allWells, selectedWell, radiusKm, allEvents, similarScores]);

  // Sorted data
  const sortedData = useMemo(() => {
    return [...tableData].sort((a, b) => {
      const valA = (a as Record<string, unknown>)[sortCol];
      const valB = (b as Record<string, unknown>)[sortCol];

      if (typeof valA === "string" && typeof valB === "string") {
        return sortDir === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      if (typeof valA === "number" && typeof valB === "number") {
        return sortDir === "asc" ? valA - valB : valB - valA;
      }
      return 0;
    });
  }, [tableData, sortCol, sortDir]);

  const handleSort = (key: string) => {
    if (sortCol === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(key);
      setSortDir("desc");
    }
  };

  const columns: Column<(typeof tableData)[0]>[] = [
    {
      key: "id",
      header: "Well",
      width: "95px",
      sortable: true,
      render: (r) => (
        <span className="font-semibold text-ink inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-status-ok shrink-0" />
          <span>{r.id}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "115px",
      sortable: true,
      render: (r) => (
        <Badge
          variant={
            r.status === "Producing"
              ? "ok"
              : r.status === "Suspended"
              ? "moderate"
              : "neutral"
          }
        >
          {r.status}
        </Badge>
      ),
    },
    {
      key: "distance",
      header: "Distance",
      width: "85px",
      align: "right",
      sortable: true,
      render: (r) => <span>{r.distance} km</span>,
    },
    {
      key: "formationMatch",
      header: "Formation match",
      width: "120px",
      sortable: true,
      render: (r) => (
        <span
          className={`rounded-[3px] px-1.5 py-0.5 text-xs font-medium ${
            r.formationMatch === "Exact"
              ? "bg-status-ok-soft text-status-ok"
              : "bg-surface-muted text-ink-3"
          }`}
        >
          {r.formationMatch}
        </span>
      ),
    },
    {
      key: "targetDepth",
      header: "TD (m)",
      width: "85px",
      align: "right",
      sortable: true,
      render: (r) => <span>{r.targetDepth}</span>,
    },
    {
      key: "eventsCount",
      header: "Events",
      width: "70px",
      align: "right",
      sortable: true,
      render: (r) => (
        <span className="font-medium text-ink tabular-nums">{r.eventsCount}</span>
      ),
    },
    {
      key: "similarity",
      header: "Similarity",
      width: "85px",
      align: "right",
      sortable: true,
      render: (r) => (
        <span className="font-semibold text-accent tabular-nums">
          {r.similarity}%
        </span>
      ),
    },
  ];

  return (
    <div className={`rounded-[6px] border border-line bg-surface flex flex-col justify-between ${className}`}>
      {/* Header */}
      <div className="border-b border-line px-4 py-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-ink leading-tight">
            Offset wells in radius
          </h3>
          <p className="text-xs text-ink-3 mt-0.5">
            {sortedData.length} offset wells within {radiusKm} km of {selectedWell.id}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="p-3 flex-1 overflow-auto">
        <DataTable
          columns={columns}
          data={sortedData}
          keyExtractor={(r) => r.id}
          selectedKey={selectedWellId}
          onSelectRow={onSelectWell ? (r) => onSelectWell(r.id) : undefined}
          sortColumn={sortCol}
          sortDirection={sortDir}
          onSort={handleSort}
          maxHeight="510px"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-line px-4 py-2 bg-surface-muted/30 rounded-b-[5px]">
        <ProvenanceChip
          source="Spatial well index & formation picks"
          recordCount={sortedData.length}
          simulatedCount={sortedData.filter((r) => r.well.origin === "simulated").length}
        />
        <div className="text-xs text-ink-3">
          Select row to highlight in correlation view
        </div>
      </div>
    </div>
  );
}
