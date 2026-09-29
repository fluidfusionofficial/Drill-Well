"use client";

import React, { useState, useMemo } from "react";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { useNwisWorkspace } from "@/components/nwis-workspace-context";
import {
  getDailyDepthSeries,
  getWx11TimeDepth,
  getAllWells,
} from "@/lib/fixtures/extended-dataset";
import { useChartSize } from "./useChartSize";
import { ProvenanceChip } from "@/components/ui/ProvenanceChip";
import { Button } from "@/components/ui/Button";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Eye, Table as TableIcon } from "lucide-react";

export function TimeDepthChart({ className = "" }: { className?: string }) {
  const { selectedWell, radiusKm } = useNwisWorkspace();
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [hoveredWellId, setHoveredWellId] = useState<string | null>(null);

  const { ref: chartRef, width, height } = useChartSize(600, 360);

  // Offset wells in radius
  const offsetWells = useMemo(() => {
    const all = getAllWells();
    return all.filter((w) => w.id !== selectedWell.id && w.distanceFromWx11Km <= radiusKm).slice(0, 6);
  }, [selectedWell.id, radiusKm]);

  // WX-11 progression & plan
  const { actual: wx11Actual, planned: wx11Planned } = useMemo(() => getWx11TimeDepth(), []);

  // Offset depth series
  const offsetSeries = useMemo(() => {
    return offsetWells.map((w) => ({
      well: w,
      data: getDailyDepthSeries(w.id),
    }));
  }, [offsetWells]);

  // Scales
  const margin = { top: 25, right: 25, bottom: 35, left: 55 };
  const innerWidth = Math.max(100, width - margin.left - margin.right);
  const innerHeight = Math.max(100, height - margin.top - margin.bottom);

  const xScale = useMemo(() => {
    return scaleLinear().domain([0, 32]).range([0, innerWidth]);
  }, [innerWidth]);

  // Inverted depth: 0 at top, 1300 at bottom
  const yScale = useMemo(() => {
    return scaleLinear().domain([0, 1300]).range([0, innerHeight]);
  }, [innerHeight]);

  // D3 line generators
  const lineGenerator = useMemo(() => {
    return line<{ day: number; depth: number }>()
      .x((d) => xScale(d.day))
      .y((d) => yScale(d.depth));
  }, [xScale, yScale]);

  // Table view data
  const tableData: { wellId: string; day: number; depth: number; activity: string }[] = useMemo(() => {
    const rows = wx11Actual.map((d) => ({
      wellId: "WX-11 (Active)",
      day: d.day,
      depth: d.depth,
      activity: d.activity,
    }));
    for (const s of offsetSeries) {
      for (const d of s.data.slice(0, 10)) {
        rows.push({
          wellId: s.well.id,
          day: d.day,
          depth: d.depth,
          activity: d.activity,
        });
      }
    }
    return rows;
  }, [wx11Actual, offsetSeries]);

  const tableColumns: Column<{ wellId: string; day: number; depth: number; activity: string }>[] = [
    { key: "wellId", header: "Well ID", width: "120px" },
    { key: "day", header: "Days from spud", width: "110px", align: "right" },
    { key: "depth", header: "Depth (m MD)", width: "110px", align: "right" },
    { key: "activity", header: "Operational activity" },
  ];

  return (
    <div className={`rounded-[6px] border border-line bg-surface flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <div>
          <h3 className="text-base font-semibold text-ink leading-tight">
            Time-depth progression
          </h3>
          <p className="text-xs text-ink-3">
            Drilling pace, casing shoes, and NPT intervals vs offset wells
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setViewMode(viewMode === "chart" ? "table" : "chart")}
          icon={viewMode === "chart" ? <TableIcon className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        >
          {viewMode === "chart" ? "View as table" : "View chart"}
        </Button>
      </div>

      {/* Body */}
      {viewMode === "table" ? (
        <div className="p-4">
          <DataTable
            columns={tableColumns}
            data={tableData}
            keyExtractor={(r, idx) => `${r.wellId}-${r.day}-${idx}`}
            maxHeight="320px"
          />
        </div>
      ) : (
        <div className="p-3">
          {/* Chart Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2 mb-2 px-1">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-primary" />
              <span>{selectedWell.id} actual (to {wx11Actual[wx11Actual.length - 1]?.depth}m)</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-primary border-b border-dashed border-accent" />
              <span>Planned trajectory</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-line-strong" />
              <span>Offset wells</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-3 rounded-[2px] bg-status-high" />
              <span>NPT interval</span>
            </span>
          </div>

          <div ref={chartRef} className="w-full h-[320px]">
            <svg
              width={width}
              height={height}
              className="w-full h-full block font-sans"
              role="img"
              aria-label="Time vs depth progression curves"
            >
              <g transform={`translate(${margin.left}, ${margin.top})`}>
                {/* Axes and Grid Lines */}
                {/* Horizontal depth grid */}
                {[0, 250, 500, 750, 1000, 1250].map((d) => (
                  <g key={d}>
                    <line
                      x1={0}
                      y1={yScale(d)}
                      x2={innerWidth}
                      y2={yScale(d)}
                      stroke="#E1E5EA"
                      strokeWidth="0.8"
                    />
                    <text
                      x={-10}
                      y={yScale(d) + 4}
                      textAnchor="end"
                      fill="#667085"
                      fontSize="11"
                      className="tabular-nums"
                    >
                      {d}m
                    </text>
                  </g>
                ))}

                {/* Vertical day grid */}
                {[0, 5, 10, 15, 20, 25, 30].map((day) => (
                  <g key={day}>
                    <line
                      x1={xScale(day)}
                      y1={0}
                      x2={xScale(day)}
                      y2={innerHeight}
                      stroke="#E1E5EA"
                      strokeWidth="0.8"
                    />
                    <text
                      x={xScale(day)}
                      y={innerHeight + 18}
                      textAnchor="middle"
                      fill="#667085"
                      fontSize="11"
                      className="tabular-nums"
                    >
                      Day {day}
                    </text>
                  </g>
                ))}

                {/* Offset Well Curves */}
                {offsetSeries.map(({ well, data }) => {
                  const isHovered = hoveredWellId === well.id;
                  const pathStr = lineGenerator(data) ?? "";

                  return (
                    <g
                      key={well.id}
                      onMouseEnter={() => setHoveredWellId(well.id)}
                      onMouseLeave={() => setHoveredWellId(null)}
                      className="cursor-pointer"
                    >
                      <path
                        d={pathStr}
                        fill="none"
                        stroke={isHovered ? "#16202C" : "#C8CED6"}
                        strokeWidth={isHovered ? 2 : 1}
                        opacity={hoveredWellId && !isHovered ? 0.3 : 0.85}
                      />

                      {/* NPT segments overlay */}
                      {data.map((pt, idx) => {
                        if (!pt.isNpt || idx === 0) return null;
                        const prev = data[idx - 1];
                        return (
                          <line
                            key={`npt-${well.id}-${pt.day}`}
                            x1={xScale(prev.day)}
                            y1={yScale(prev.depth)}
                            x2={xScale(pt.day)}
                            y2={yScale(pt.depth)}
                            stroke="#D55E00"
                            strokeWidth={3}
                            strokeLinecap="round"
                          />
                        );
                      })}
                    </g>
                  );
                })}

                {/* Planned Curve (dashed accent) */}
                <path
                  d={lineGenerator(wx11Planned) ?? ""}
                  fill="none"
                  stroke="#1D4ED8"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />

                {/* Current Well Actual Curve (solid accent) */}
                <path
                  d={lineGenerator(wx11Actual) ?? ""}
                  fill="none"
                  stroke="#1D4ED8"
                  strokeWidth="2.5"
                />

                {/* Active bit position marker */}
                {(() => {
                  const lastPt = wx11Actual[wx11Actual.length - 1];
                  if (!lastPt) return null;
                  const x = xScale(lastPt.day);
                  const y = yScale(lastPt.depth);

                  return (
                    <g transform={`translate(${x}, ${y})`}>
                      <circle cx={0} cy={0} r={5} fill="#1D4ED8" />
                      <circle cx={0} cy={0} r={8} fill="none" stroke="#1D4ED8" strokeWidth={1.5} opacity={0.6} />
                      <text
                        x={10}
                        y={4}
                        fill="#1D4ED8"
                        fontSize="11"
                        fontWeight="600"
                        className="tabular-nums"
                      >
                        {lastPt.depth}m (Bit)
                      </text>
                    </g>
                  );
                })()}

                {/* Casing shoe markers at 341m */}
                <g transform={`translate(${xScale(5)}, ${yScale(341)})`}>
                  <polygon points="0,0 6,8 -6,8" fill="#9A6B00" />
                  <text x={8} y={7} fill="#9A6B00" fontSize="10">
                    13-3/8 Shoe (341m)
                  </text>
                </g>
              </g>
            </svg>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-line px-4 py-2 bg-surface-muted/30">
        <ProvenanceChip
          source="DDR daily drill logs & prog reports"
          recordCount={wx11Actual.length + offsetSeries.length * 15}
          simulatedCount={offsetSeries.length * 15}
        />
        <div className="text-xs text-ink-3">
          Hover offset curves to trace historical drilling pace
        </div>
      </div>
    </div>
  );
}
