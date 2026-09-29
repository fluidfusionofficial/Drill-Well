"use client";

import React, { useState, useMemo } from "react";
import { formationIntervals } from "@/lib/nwis-data";
import { getAllEvents } from "@/lib/fixtures/extended-dataset";
import { classifyEvent, HAZARD_CATEGORIES, HazardCategory } from "@/lib/taxonomy";
import { useNwisWorkspace } from "@/components/nwis-workspace-context";
import { ProvenanceChip } from "@/components/ui/ProvenanceChip";
import { Button } from "@/components/ui/Button";
import { DataTable, Column } from "@/components/ui/DataTable";
import { ChevronRight, Eye, Table as TableIcon } from "lucide-react";
import { EventGlyph } from "@/components/ui/EventGlyph";

interface HazardMatrixChartProps {
  onCellClick?: (formation: string, category: HazardCategory) => void;
  className?: string;
}

// Single-hue heat matrix ramp
const HEAT_RAMP = [
  "#FFFFFF", // 0
  "#EAF0FE", // 1
  "#C5D5FA", // 2-3
  "#93B0F3", // 4-6
  "#5A82E6", // 7-9 (white text)
  "#1D4ED8", // 10+ (white text)
];

function getHeatStyle(count: number): { bg: string; text: string } {
  if (count === 0) return { bg: "#FFFFFF", text: "#667085" };
  if (count <= 1) return { bg: HEAT_RAMP[1], text: "#16202C" };
  if (count <= 3) return { bg: HEAT_RAMP[2], text: "#16202C" };
  if (count <= 6) return { bg: HEAT_RAMP[3], text: "#16202C" };
  if (count <= 9) return { bg: HEAT_RAMP[4], text: "#FFFFFF" };
  return { bg: HEAT_RAMP[5], text: "#FFFFFF" };
}

export function HazardMatrixChart({
  onCellClick,
  className = "",
}: HazardMatrixChartProps) {
  const { currentDepth } = useNwisWorkspace();
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");

  const allEvents = useMemo(() => getAllEvents(), []);

  // Formations in stratigraphic order
  const formations = useMemo(() => {
    return [...formationIntervals].sort((a, b) => a.top - b.top);
  }, []);

  // Identify current formation at depth
  const currentFormation = useMemo(() => {
    return formations.find((f) => currentDepth >= f.top && currentDepth <= f.bottom);
  }, [formations, currentDepth]);

  // Matrix cell computation
  const matrixData = useMemo(() => {
    return formations.map((fmt) => {
      const isCurrent = currentFormation?.name === fmt.name;
      const isAhead = fmt.top > currentDepth;

      const rowCounts: Record<HazardCategory, number> = {
        "Mud loss": 0,
        "Held-up / stuck pipe": 0,
        "Kick / influx": 0,
        "Torque and tight hole": 0,
        "Cementing / casing": 0,
        "Other NPT": 0,
      };

      for (const ev of allEvents) {
        if (ev.depth >= fmt.top && ev.depth <= fmt.bottom) {
          const cat = classifyEvent(ev.type);
          rowCounts[cat]++;
        }
      }

      const total = Object.values(rowCounts).reduce((a, b) => a + b, 0);

      return {
        formation: fmt,
        isCurrent,
        isAhead,
        counts: rowCounts,
        total,
      };
    });
  }, [formations, currentFormation, currentDepth, allEvents]);

  // Table view columns
  const tableColumns: Column<{
    name: string;
    top: number;
    bottom: number;
    mudLoss: number;
    stuckPipe: number;
    kick: number;
    torque: number;
    cementing: number;
    other: number;
    total: number;
  }>[] = [
    { key: "name", header: "Formation (Stratigraphic)", width: "180px" },
    { key: "top", header: "Top MD", width: "80px", align: "right" },
    { key: "bottom", header: "Base MD", width: "80px", align: "right" },
    { key: "mudLoss", header: "Mud loss", width: "80px", align: "right" },
    { key: "stuckPipe", header: "Stuck pipe", width: "80px", align: "right" },
    { key: "kick", header: "Kick", width: "70px", align: "right" },
    { key: "torque", header: "Torque", width: "70px", align: "right" },
    { key: "total", header: "Total events", width: "90px", align: "right" },
  ];

  const tableData = useMemo(() => {
    return matrixData.map((row) => ({
      name: row.formation.name,
      top: row.formation.top,
      bottom: row.formation.bottom,
      mudLoss: row.counts["Mud loss"],
      stuckPipe: row.counts["Held-up / stuck pipe"],
      kick: row.counts["Kick / influx"],
      torque: row.counts["Torque and tight hole"],
      cementing: row.counts["Cementing / casing"],
      other: row.counts["Other NPT"],
      total: row.total,
    }));
  }, [matrixData]);

  return (
    <div className={`rounded-[6px] border border-line bg-surface flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <div>
          <h3 className="text-base font-semibold text-ink leading-tight">
            Hazard matrix
          </h3>
          <p className="text-xs text-ink-3">
            Stratigraphic formations × historical hazard frequency
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setViewMode(viewMode === "chart" ? "table" : "chart")}
          icon={viewMode === "chart" ? <TableIcon className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        >
          {viewMode === "chart" ? "View as table" : "View matrix"}
        </Button>
      </div>

      {/* Body */}
      {viewMode === "table" ? (
        <div className="p-4">
          <DataTable
            columns={tableColumns}
            data={tableData}
            keyExtractor={(r) => r.name}
            maxHeight="320px"
          />
        </div>
      ) : (
        <div className="overflow-x-auto p-4">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-line">
                <th className="py-2 px-3 text-left font-medium text-ink-3">
                  Formation
                </th>
                {HAZARD_CATEGORIES.map((cat) => (
                  <th key={cat} className="py-2 px-2 text-center font-medium text-ink-3" title={cat}>
                    <div className="flex flex-col items-center gap-1">
                      <EventGlyph type={cat} size={14} />
                      <span className="truncate max-w-[65px]">{cat.split(" ")[0]}</span>
                    </div>
                  </th>
                ))}
                <th className="py-2 px-2 text-right font-medium text-ink-3">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {matrixData.map((row) => {
                const fmt = row.formation;

                return (
                  <tr
                    key={fmt.name}
                    className={`transition-colors ${
                      row.isCurrent
                        ? "bg-primary-soft/40 font-semibold"
                        : "hover:bg-surface-muted"
                    }`}
                  >
                    <td className="py-2 px-3 text-left text-ink">
                      <div className="flex items-center gap-1.5">
                        {row.isAhead && (
                          <span title="Ahead of bit">
                            <ChevronRight className="h-3.5 w-3.5 text-status-high shrink-0" />
                          </span>
                        )}
                        <span className="truncate max-w-[140px] font-medium" title={fmt.name}>
                          {fmt.name}
                        </span>
                        {row.isCurrent && (
                          <span className="rounded-[3px] bg-primary text-white px-1 py-0.2 text-xs font-semibold shrink-0">
                            At bit
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-ink-3 font-normal tabular-nums pl-1">
                        {fmt.top} – {fmt.bottom}m
                      </div>
                    </td>

                    {HAZARD_CATEGORIES.map((cat) => {
                      const count = row.counts[cat];
                      const style = getHeatStyle(count);
                      const isClickable = Boolean(onCellClick) && count > 0;

                      return (
                        <td
                          key={cat}
                          onClick={() => {
                            if (isClickable && onCellClick) {
                              onCellClick(fmt.name, cat);
                            }
                          }}
                          className={`p-1.5 text-center ${isClickable ? "cursor-pointer" : ""}`}
                        >
                          <div
                            style={{ backgroundColor: style.bg, color: style.text }}
                            className={`mx-auto flex h-7 w-11 items-center justify-center rounded-[4px] border border-line/60 tabular-nums font-medium text-xs transition-transform ${
                              isClickable ? "hover:scale-105" : ""
                            }`}
                          >
                            {count > 0 ? count : "—"}
                          </div>
                        </td>
                      );
                    })}

                    <td className="py-2 px-3 text-right tabular-nums font-semibold text-ink">
                      {row.total}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-line px-4 py-2 bg-surface-muted/30">
        <ProvenanceChip
          source="Stratigraphic column & offset incidents"
          recordCount={allEvents.length}
          simulatedCount={allEvents.filter((e) => e.origin === "simulated").length}
        />
        <div className="text-xs text-ink-3">
          Chevron indicates formations ahead of active bit
        </div>
      </div>
    </div>
  );
}
