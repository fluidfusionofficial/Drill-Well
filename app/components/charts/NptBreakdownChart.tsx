"use client";

import React, { useState, useMemo } from "react";
import { scaleLinear, scaleBand } from "d3-scale";
import { offsetNptBreakdown } from "@/lib/fixtures/extended-dataset";
import { useChartSize } from "./useChartSize";
import { ProvenanceChip } from "@/components/ui/ProvenanceChip";
import { Button } from "@/components/ui/Button";
import { DataTable, Column } from "@/components/ui/DataTable";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Eye, Table as TableIcon } from "lucide-react";
import { HAZARD_CONFIG } from "@/lib/taxonomy";

export function NptBreakdownChart({ className = "" }: { className?: string }) {
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [breakdownMode, setBreakdownMode] = useState<"well" | "formation" | "phase">("well");

  const { ref: chartRef, width, height } = useChartSize(400, 360);

  // Raw data aggregated by well
  const wellData = useMemo(() => {
    return Object.entries(offsetNptBreakdown).map(([wellId, categories]) => {
      const totalHours = categories.reduce((sum, c) => sum + c.hours, 0);
      return {
        id: wellId,
        label: wellId,
        totalHours,
        categories,
      };
    }).sort((a, b) => b.totalHours - a.totalHours);
  }, []);

  // Aggregated by formation
  const formationData = useMemo(() => {
    return [
      {
        id: "Upper Carbonate",
        label: "Upper Carbonate",
        totalHours: 210,
        categories: [
          { category: "Mud loss", hours: 140, color: HAZARD_CONFIG["Mud loss"].color },
          { category: "Held-up / stuck pipe", hours: 55, color: HAZARD_CONFIG["Held-up / stuck pipe"].color },
          { category: "Torque and tight hole", hours: 15, color: HAZARD_CONFIG["Torque and tight hole"].color },
        ],
      },
      {
        id: "Nagaur Formation",
        label: "Nagaur Formation",
        totalHours: 95,
        categories: [
          { category: "Mud loss", hours: 45, color: HAZARD_CONFIG["Mud loss"].color },
          { category: "Kick / influx", hours: 30, color: HAZARD_CONFIG["Kick / influx"].color },
          { category: "Torque and tight hole", hours: 20, color: HAZARD_CONFIG["Torque and tight hole"].color },
        ],
      },
      {
        id: "Bap + Badhaura",
        label: "Bap + Badhaura",
        totalHours: 35,
        categories: [
          { category: "Cementing / casing", hours: 25, color: HAZARD_CONFIG["Cementing / casing"].color },
          { category: "Other NPT", hours: 10, color: HAZARD_CONFIG["Other NPT"].color },
        ],
      },
    ];
  }, []);

  // Aggregated by drilling phase
  const phaseData = useMemo(() => {
    return [
      {
        id: "Intermediate (12-1/4)",
        label: "Intermediate (12-1/4)",
        totalHours: 185,
        categories: [
          { category: "Mud loss", hours: 125, color: HAZARD_CONFIG["Mud loss"].color },
          { category: "Held-up / stuck pipe", hours: 45, color: HAZARD_CONFIG["Held-up / stuck pipe"].color },
          { category: "Other NPT", hours: 15, color: HAZARD_CONFIG["Other NPT"].color },
        ],
      },
      {
        id: "Production (8-1/2)",
        label: "Production (8-1/2)",
        totalHours: 115,
        categories: [
          { category: "Kick / influx", hours: 45, color: HAZARD_CONFIG["Kick / influx"].color },
          { category: "Torque and tight hole", hours: 40, color: HAZARD_CONFIG["Torque and tight hole"].color },
          { category: "Mud loss", hours: 30, color: HAZARD_CONFIG["Mud loss"].color },
        ],
      },
      {
        id: "Surface (17-1/2)",
        label: "Surface (17-1/2)",
        totalHours: 40,
        categories: [
          { category: "Cementing / casing", hours: 25, color: HAZARD_CONFIG["Cementing / casing"].color },
          { category: "Other NPT", hours: 15, color: HAZARD_CONFIG["Other NPT"].color },
        ],
      },
    ];
  }, []);

  const activeDataset =
    breakdownMode === "formation"
      ? formationData
      : breakdownMode === "phase"
      ? phaseData
      : wellData;

  const maxHours = Math.max(...activeDataset.map((d) => d.totalHours), 100);

  const margin = { top: 15, right: 30, bottom: 25, left: 85 };
  const innerWidth = Math.max(80, width - margin.left - margin.right);
  const innerHeight = Math.max(80, height - margin.top - margin.bottom);

  const yScale = useMemo(() => {
    return scaleBand()
      .domain(activeDataset.map((d) => d.id))
      .range([0, innerHeight])
      .padding(0.28);
  }, [activeDataset, innerHeight]);

  const xScale = useMemo(() => {
    return scaleLinear().domain([0, maxHours * 1.1]).range([0, innerWidth]);
  }, [maxHours, innerWidth]);

  // Table view data
  const tableData = useMemo(() => {
    return activeDataset.map((d) => {
      const catMap: Record<string, number> = {};
      for (const c of d.categories) {
        catMap[c.category] = c.hours;
      }
      return {
        label: d.label,
        total: d.totalHours,
        mudLoss: catMap["Mud loss"] ?? 0,
        stuckPipe: catMap["Held-up / stuck pipe"] ?? 0,
        kick: catMap["Kick / influx"] ?? 0,
        torque: catMap["Torque / tight hole"] ?? 0,
        other: (catMap["Other NPT"] ?? 0) + (catMap["Cementing / casing"] ?? 0),
      };
    });
  }, [activeDataset]);

  const tableColumns: Column<{
    label: string;
    total: number;
    mudLoss: number;
    stuckPipe: number;
    kick: number;
    torque: number;
    other: number;
  }>[] = [
    { key: "label", header: breakdownMode === "well" ? "Well" : "Category", width: "120px" },
    { key: "total", header: "Total hrs", width: "90px", align: "right" },
    { key: "mudLoss", header: "Mud loss", width: "90px", align: "right" },
    { key: "stuckPipe", header: "Stuck pipe", width: "90px", align: "right" },
    { key: "kick", header: "Kick", width: "80px", align: "right" },
    { key: "torque", header: "Torque", width: "80px", align: "right" },
  ];

  return (
    <div className={`rounded-[6px] border border-line bg-surface flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-line px-4 py-2.5 gap-2">
        <div>
          <h3 className="text-base font-semibold text-ink leading-tight">
            NPT by category
          </h3>
          <p className="text-xs text-ink-3">
            NPT 18% of well time; offset median 12%
          </p>
        </div>

        <div className="flex items-center gap-2">
          <SegmentedControl
            options={[
              { value: "well", label: "Well" },
              { value: "formation", label: "Formation" },
              { value: "phase", label: "Phase" },
            ]}
            value={breakdownMode}
            onChange={(val) => setBreakdownMode(val as "well" | "formation" | "phase")}
            size="sm"
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode(viewMode === "chart" ? "table" : "chart")}
            icon={viewMode === "chart" ? <TableIcon className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          >
            {viewMode === "chart" ? "Table" : "Chart"}
          </Button>
        </div>
      </div>

      {/* Body */}
      {viewMode === "table" ? (
        <div className="p-4">
          <DataTable
            columns={tableColumns}
            data={tableData}
            keyExtractor={(r) => r.label}
            maxHeight="320px"
          />
        </div>
      ) : (
        <div className="p-3">
          <div ref={chartRef} className="w-full h-[320px]">
            <svg
              width={width}
              height={height}
              className="w-full h-full block font-sans"
              role="img"
              aria-label="Non-productive time stacked horizontal bar chart"
            >
              <g transform={`translate(${margin.left}, ${margin.top})`}>
                {/* Horizontal grid lines */}
                {[0, 20, 40, 60, 80, 100, 120].map((hVal) => {
                  if (hVal > maxHours * 1.1) return null;
                  const x = xScale(hVal);
                  return (
                    <g key={hVal}>
                      <line
                        x1={x}
                        y1={0}
                        x2={x}
                        y2={innerHeight}
                        stroke="#E1E5EA"
                        strokeWidth="0.8"
                      />
                      <text
                        x={x}
                        y={innerHeight + 16}
                        textAnchor="middle"
                        fill="#667085"
                        fontSize="11"
                        className="tabular-nums"
                      >
                        {hVal}h
                      </text>
                    </g>
                  );
                })}

                {/* Stacked bars */}
                {activeDataset.map((row) => {
                  const y = yScale(row.id) ?? 0;
                  const barH = yScale.bandwidth();
                  let currentX = 0;

                  return (
                    <g key={row.id}>
                      {/* Row label */}
                      <text
                        x={-10}
                        y={y + barH / 2 + 4}
                        textAnchor="end"
                        fill="#16202C"
                        fontSize="11"
                        fontWeight="500"
                      >
                        {row.label}
                      </text>

                      {/* Segments */}
                      {row.categories.map((cat) => {
                        const segW = xScale(cat.hours);
                        const startX = currentX;
                        currentX += segW;

                        return (
                          <rect
                            key={cat.category}
                            x={startX}
                            y={y}
                            width={Math.max(1, segW)}
                            height={barH}
                            fill={cat.color}
                            rx={1}
                          >
                            <title>{`${row.label} - ${cat.category}: ${cat.hours} hrs`}</title>
                          </rect>
                        );
                      })}

                      {/* Total label */}
                      <text
                        x={currentX + 6}
                        y={y + barH / 2 + 4}
                        fill="#4A5565"
                        fontSize="11"
                        fontWeight="600"
                        className="tabular-nums"
                      >
                        {row.totalHours}h
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-line px-4 py-2 bg-surface-muted/30">
        <ProvenanceChip
          source="DDR daily morning summaries"
          recordCount={activeDataset.length * 4}
          simulatedCount={activeDataset.length * 3}
        />
        <div className="text-xs text-ink-3">
          Historical offset average NPT rate
        </div>
      </div>
    </div>
  );
}
