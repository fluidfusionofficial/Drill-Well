"use client";

import React, { useState, useMemo, useRef, useCallback } from "react";
import { scaleLinear } from "d3-scale";
import { useNwisWorkspace } from "@/components/nwis-workspace-context";
import { formationIntervals } from "@/lib/nwis-data";
import type { EventRecord } from "@/lib/nwis-data";
import { getAllEvents, getAllWells, simulatedMudProfiles } from "@/lib/fixtures/extended-dataset";
import { LithologyDefs, getLithologyFillId } from "./LithologyDefs";
import { useChartSize } from "./useChartSize";
import { classifyEvent, HAZARD_CONFIG, HazardCategory } from "@/lib/taxonomy";
import { ProvenanceChip } from "@/components/ui/ProvenanceChip";
import { Button } from "@/components/ui/Button";
import { DataTable, Column } from "@/components/ui/DataTable";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Eye, Table as TableIcon } from "lucide-react";

interface OffsetCorrelationChartProps {
  highlightedCategory?: HazardCategory | null;
  className?: string;
}

export function OffsetCorrelationChart({
  highlightedCategory,
  className = "",
}: OffsetCorrelationChartProps) {
  const {
    selectedWell,
    currentDepth,
    setCurrentDepth,
    radiusKm,
    lookAheadM,
    setSelectedEventId,
  } = useNwisWorkspace();

  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [alignMode, setAlignMode] = useState<"md" | "formation">("md");
  const [depthMin, setDepthMin] = useState(0);
  const [depthMax, setDepthMax] = useState(1250);
  const [hoveredEvent, setHoveredEvent] = useState<EventRecord | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const { ref: chartRef, width, height } = useChartSize(900, 560);

  // Offset wells in radius
  const wellsInRadius = useMemo(() => {
    const all = getAllWells();
    return all.filter((w) => {
      if (w.id === selectedWell.id) return false;
      return (w.distanceFromWx11Km ?? 0) <= radiusKm;
    }).slice(0, 5); // limit visible lanes to 5 for optimal track density
  }, [selectedWell.id, radiusKm]);

  // Events in radius
  const allEvents = useMemo(() => getAllEvents(), []);
  const visibleEvents = useMemo(() => {
    const wellIds = new Set([selectedWell.id, ...wellsInRadius.map((w) => w.id)]);
    return allEvents.filter((e) => wellIds.has(e.wellId));
  }, [allEvents, selectedWell.id, wellsInRadius]);

  const simulatedCount = useMemo(() => {
    return visibleEvents.filter((e) => e.origin === "simulated").length;
  }, [visibleEvents]);

  // Vertical depth scale (increases downward)
  const depthScale = useMemo(() => {
    return scaleLinear()
      .domain([depthMin, depthMax])
      .range([35, height - 30]);
  }, [depthMin, depthMax, height]);

  // Track layout widths
  const depthAxisWidth = 65;
  const formationTrackWidth = 110;
  const laneWidth = 75;
  const totalOffsetWidth = wellsInRadius.length * laneWidth;
  const densityTrackWidth = 85;
  const mudTrackWidth = Math.max(90, width - (depthAxisWidth + formationTrackWidth + totalOffsetWidth + densityTrackWidth + 40));

  // 25m bins for event density
  const densityBins = useMemo(() => {
    const binSize = 25;
    const numBins = Math.ceil((depthMax - depthMin) / binSize);
    const bins: { top: number; bottom: number; counts: Record<HazardCategory, number> }[] = [];

    for (let i = 0; i < numBins; i++) {
      const top = depthMin + i * binSize;
      const bottom = top + binSize;
      const counts: Record<HazardCategory, number> = {
        "Mud loss": 0,
        "Held-up / stuck pipe": 0,
        "Kick / influx": 0,
        "Torque and tight hole": 0,
        "Cementing / casing": 0,
        "Other NPT": 0,
      };

      for (const ev of visibleEvents) {
        if (ev.depth >= top && ev.depth < bottom) {
          const cat = classifyEvent(ev.type);
          counts[cat]++;
        }
      }

      bins.push({ top, bottom, counts });
    }
    return bins;
  }, [depthMin, depthMax, visibleEvents]);

  // Dragging depth cursor
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const newDepth = Math.round(depthScale.invert(relativeY));
      const clamped = Math.max(0, Math.min(1300, newDepth));
      setCurrentDepth(clamped);
    },
    [isDragging, depthScale, setCurrentDepth],
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Fit to look-ahead view
  const fitToLookAhead = () => {
    const min = Math.max(0, currentDepth - 50);
    const max = Math.min(1300, currentDepth + lookAheadM + 50);
    setDepthMin(min);
    setDepthMax(max);
  };

  const resetDepthRange = () => {
    setDepthMin(0);
    setDepthMax(1250);
  };

  // Table columns for "View as table" mode
  const tableColumns: Column<EventRecord>[] = [
    { key: "wellId", header: "Well", width: "90px" },
    { key: "depth", header: "Depth (m MD)", width: "110px", align: "right" },
    { key: "type", header: "Hazard type", width: "150px" },
    { key: "severity", header: "Severity", width: "100px" },
    { key: "formation", header: "Formation", width: "160px" },
    { key: "description", header: "Event details" },
    { key: "source", header: "Source", width: "120px" },
    { key: "confidence", header: "Confidence", width: "90px" },
  ];

  return (
    <div className={`rounded-[6px] border border-line bg-surface flex flex-col ${className}`}>
      {/* Header controls bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-line px-4 py-2.5 gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-ink leading-tight">
            Offset correlation
          </h2>
          <span className="text-xs text-ink-3">
            Shared vertical inverted depth axis
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Align by toggle */}
          <SegmentedControl
            options={[
              { value: "md", label: "Measured depth" },
              { value: "formation", label: "Formation top" },
            ]}
            value={alignMode}
            onChange={(val) => setAlignMode(val as "md" | "formation")}
            size="sm"
          />

          <Button variant="secondary" size="sm" onClick={fitToLookAhead}>
            Fit to look-ahead
          </Button>

          {(depthMin !== 0 || depthMax !== 1250) && (
            <Button variant="ghost" size="sm" onClick={resetDepthRange}>
              Reset scale
            </Button>
          )}

          {/* Table / Chart toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode(viewMode === "chart" ? "table" : "chart")}
            icon={viewMode === "chart" ? <TableIcon className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          >
            {viewMode === "chart" ? "View as table" : "View chart"}
          </Button>
        </div>
      </div>

      {/* Main chart or table view */}
      {viewMode === "table" ? (
        <div className="p-4">
          <DataTable
            columns={tableColumns}
            data={visibleEvents}
            keyExtractor={(e) => e.id}
            maxHeight="480px"
            onSelectRow={(e) => setSelectedEventId(e.id)}
          />
        </div>
      ) : (
        <div
          ref={containerRef}
          className="relative flex-1 select-none overflow-hidden"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div ref={chartRef} className="w-full h-[560px]">
            <svg
              width={width}
              height={height}
              className="w-full h-full block font-sans"
              role="img"
              aria-label="Multi-track offset correlation chart"
            >
              <LithologyDefs />

              {/* Background canvas */}
              <rect x="0" y="0" width={width} height={height} fill="#FFFFFF" />

              {/* Sticky Track Headers */}
              <g id="track-headers" className="text-xs font-semibold text-ink-3">
                {/* 1. Depth Axis Header */}
                <rect x="0" y="0" width={depthAxisWidth} height="32" fill="#F8F9FB" stroke="#E1E5EA" />
                <text x={depthAxisWidth / 2} y="20" textAnchor="middle" fill="#4A5565" fontSize="11">
                  Depth (m)
                </text>

                {/* 2. Formation Header */}
                <rect x={depthAxisWidth} y="0" width={formationTrackWidth} height="32" fill="#F8F9FB" stroke="#E1E5EA" />
                <text x={depthAxisWidth + formationTrackWidth / 2} y="20" textAnchor="middle" fill="#4A5565" fontSize="11">
                  Formations
                </text>

                {/* 3. Offset Lanes Headers */}
                {wellsInRadius.map((well, idx) => {
                  const x = depthAxisWidth + formationTrackWidth + idx * laneWidth;
                  return (
                    <g key={well.id}>
                      <rect x={x} y="0" width={laneWidth} height="32" fill="#F8F9FB" stroke="#E1E5EA" />
                      <text x={x + laneWidth / 2} y="15" textAnchor="middle" fill="#16202C" fontSize="11" fontWeight="600">
                        {well.id}
                      </text>
                      <text x={x + laneWidth / 2} y="27" textAnchor="middle" fill="#667085" fontSize="10">
                        {well.distanceFromWx11Km} km
                      </text>
                    </g>
                  );
                })}

                {/* 4. Event Density Header */}
                <g>
                  <rect
                    x={depthAxisWidth + formationTrackWidth + totalOffsetWidth}
                    y="0"
                    width={densityTrackWidth}
                    height="32"
                    fill="#F8F9FB"
                    stroke="#E1E5EA"
                  />
                  <text
                    x={depthAxisWidth + formationTrackWidth + totalOffsetWidth + densityTrackWidth / 2}
                    y="20"
                    textAnchor="middle"
                    fill="#4A5565"
                    fontSize="11"
                  >
                    Density (25m)
                  </text>
                </g>

                {/* 5. Mud Weight Header */}
                <g>
                  <rect
                    x={depthAxisWidth + formationTrackWidth + totalOffsetWidth + densityTrackWidth}
                    y="0"
                    width={mudTrackWidth}
                    height="32"
                    fill="#F8F9FB"
                    stroke="#E1E5EA"
                  />
                  <text
                    x={depthAxisWidth + formationTrackWidth + totalOffsetWidth + densityTrackWidth + mudTrackWidth / 2}
                    y="20"
                    textAnchor="middle"
                    fill="#4A5565"
                    fontSize="11"
                  >
                    Mud wt (g/cm³)
                  </text>
                </g>
              </g>

              {/* Formation tops dashed reference lines across all tracks */}
              {formationIntervals.map((fmt) => {
                const yTop = depthScale(fmt.top);
                const yBottom = depthScale(fmt.bottom);
                const blockHeight = Math.max(2, yBottom - yTop);

                return (
                  <g key={fmt.name}>
                    {/* Formation lithology block in Track 2 */}
                    <rect
                      x={depthAxisWidth}
                      y={yTop}
                      width={formationTrackWidth}
                      height={blockHeight}
                      fill={getLithologyFillId(fmt.name)}
                      stroke="#C8CED6"
                      strokeWidth="0.8"
                    />
                    <text
                      x={depthAxisWidth + 6}
                      y={Math.min(yBottom - 4, yTop + 14)}
                      fill="#16202C"
                      fontSize="10"
                      fontWeight="500"
                    >
                      {fmt.name.length > 18 ? fmt.name.slice(0, 16) + "…" : fmt.name}
                    </text>

                    {/* Dashed line extending across lanes */}
                    <line
                      x1={depthAxisWidth + formationTrackWidth}
                      y1={yTop}
                      x2={width}
                      y2={yTop}
                      stroke="#C8CED6"
                      strokeWidth="0.75"
                      strokeDasharray="4 3"
                    />
                  </g>
                );
              })}

              {/* Track 1: Depth Axis ticks and labels */}
              <g id="depth-axis">
                <line x1={depthAxisWidth} y1={32} x2={depthAxisWidth} y2={height} stroke="#C8CED6" strokeWidth="1" />
                {Array.from({ length: Math.ceil((depthMax - depthMin) / 25) + 1 }).map((_, i) => {
                  const d = depthMin + i * 25;
                  if (d > depthMax) return null;
                  const y = depthScale(d);
                  const isMajor = d % 100 === 0;

                  return (
                    <g key={d}>
                      <line
                        x1={isMajor ? depthAxisWidth - 8 : depthAxisWidth - 4}
                        y1={y}
                        x2={depthAxisWidth}
                        y2={y}
                        stroke="#C8CED6"
                        strokeWidth="1"
                      />
                      {isMajor && (
                        <text
                          x={depthAxisWidth - 10}
                          y={y + 4}
                          textAnchor="end"
                          fill="#4A5565"
                          fontSize="11"
                          className="tabular-nums"
                        >
                          {d}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>

              {/* Track 3: Offset Event Lanes */}
              {wellsInRadius.map((well, idx) => {
                const laneX = depthAxisWidth + formationTrackWidth + idx * laneWidth;
                const laneEvents = visibleEvents.filter((e) => e.wellId === well.id);

                return (
                  <g key={well.id}>
                    {/* Lane divider */}
                    <line x1={laneX + laneWidth} y1={32} x2={laneX + laneWidth} y2={height} stroke="#E1E5EA" strokeWidth="1" />

                    {/* Events in lane */}
                    {laneEvents.map((ev) => {
                      const y = depthScale(ev.depth);
                      const cat = classifyEvent(ev.type);
                      const config = HAZARD_CONFIG[cat];
                      const isHighlighted = highlightedCategory ? highlightedCategory === cat : true;

                      // Size mapped to severity
                      const sizeMap = { Critical: 14, High: 12, Medium: 10, Low: 8 };
                      const radius = (sizeMap[ev.severity] ?? 10) / 2;

                      return (
                        <g
                          key={ev.id}
                          transform={`translate(${laneX + laneWidth / 2}, ${y})`}
                          className="cursor-pointer transition-opacity"
                          opacity={isHighlighted ? 1 : 0.25}
                          onClick={() => setSelectedEventId(ev.id)}
                          onMouseEnter={(e) => {
                            setHoveredEvent(ev);
                            const rect = containerRef.current?.getBoundingClientRect();
                            if (rect) {
                              setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                            }
                          }}
                          onMouseLeave={() => setHoveredEvent(null)}
                        >
                          {config.shape === "inverted-triangle" && (
                            <polygon points={`0,${radius} ${-radius},${-radius} ${radius},${-radius}`} fill={config.color} />
                          )}
                          {config.shape === "square" && (
                            <rect x={-radius} y={-radius} width={radius * 2} height={radius * 2} fill={config.color} rx="1" />
                          )}
                          {config.shape === "diamond" && (
                            <polygon points={`0,${-radius} ${radius},0 0,${radius} ${-radius},0`} fill={config.color} />
                          )}
                          {config.shape === "triangle" && (
                            <polygon points={`0,${-radius} ${radius},${radius} ${-radius},${radius}`} fill={config.color} />
                          )}
                          {config.shape === "hexagon" && (
                            <polygon points={`0,${-radius} ${radius},${-radius / 2} ${radius},${radius / 2} 0,${radius} ${-radius},${radius / 2} ${-radius},${-radius / 2}`} fill={config.color} />
                          )}
                          {config.shape === "circle" && (
                            <circle cx="0" cy="0" r={radius} fill={config.color} />
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })}

              {/* Track 4: Event Density (stacked 25m horizontal bars) */}
              <g id="density-track">
                {densityBins.map((bin) => {
                  const y = depthScale(bin.top);
                  const binH = Math.max(1, depthScale(bin.bottom) - y - 1);
                  const startX = depthAxisWidth + formationTrackWidth + totalOffsetWidth + 4;
                  let currentOffset = 0;
                  const maxBinWidth = densityTrackWidth - 8;

                  return (
                    <g key={bin.top}>
                      {Object.entries(bin.counts).map(([catKey, count]) => {
                        if (count === 0) return null;
                        const cat = catKey as HazardCategory;
                        const w = Math.min(count * 6, maxBinWidth - currentOffset);
                        const rectX = startX + currentOffset;
                        currentOffset += w;

                        return (
                          <rect
                            key={cat}
                            x={rectX}
                            y={y}
                            width={w}
                            height={binH}
                            fill={HAZARD_CONFIG[cat].color}
                            opacity={0.85}
                          />
                        );
                      })}
                    </g>
                  );
                })}
              </g>

              {/* Track 5: Mud weight step lines */}
              <g id="mud-track">
                <line
                  x1={depthAxisWidth + formationTrackWidth + totalOffsetWidth + densityTrackWidth}
                  y1={32}
                  x2={depthAxisWidth + formationTrackWidth + totalOffsetWidth + densityTrackWidth}
                  y2={height}
                  stroke="#E1E5EA"
                  strokeWidth="1"
                />

                {/* Mud weight scale grid (1.0 to 1.6 g/cm3) */}
                {Object.entries(simulatedMudProfiles).map(([wellId, points]) => {
                  if (wellId !== selectedWell.id && !wellsInRadius.some((w) => w.id === wellId)) return null;

                  const isCurrent = wellId === selectedWell.id;
                  const trackX = depthAxisWidth + formationTrackWidth + totalOffsetWidth + densityTrackWidth;
                  const mudXScale = scaleLinear().domain([1.0, 1.6]).range([trackX + 6, trackX + mudTrackWidth - 6]);

                  // Build SVG path string for step line
                  let pathData = "";
                  for (let i = 0; i < points.length; i++) {
                    const pt = points[i];
                    const px = mudXScale(pt.mudWeight);
                    const py = depthScale(pt.depth);

                    if (i === 0) {
                      pathData += `M ${px} ${py}`;
                    } else {
                      pathData += ` V ${py} H ${px}`;
                    }
                  }

                  return (
                    <path
                      key={wellId}
                      d={pathData}
                      fill="none"
                      stroke={isCurrent ? "#1D4ED8" : "#9AA0AA"}
                      strokeWidth={isCurrent ? 2 : 1}
                      strokeDasharray={isCurrent ? undefined : "3 2"}
                    />
                  );
                })}
              </g>

              {/* Shaded Look-ahead band below current cursor */}
              {(() => {
                const yCursor = depthScale(currentDepth);
                const yLookAhead = depthScale(currentDepth + lookAheadM);
                const bandHeight = Math.max(0, yLookAhead - yCursor);

                return (
                  <rect
                    x={depthAxisWidth}
                    y={yCursor}
                    width={width - depthAxisWidth}
                    height={bandHeight}
                    fill="#EAF0FE"
                    opacity={0.35}
                    pointerEvents="none"
                  />
                );
              })()}

              {/* Draggable Active Well Depth Cursor */}
              {(() => {
                const yCursor = depthScale(currentDepth);

                return (
                  <g id="cursor-handle" transform={`translate(0, ${yCursor})`}>
                    {/* Line across all tracks */}
                    <line
                      x1={0}
                      y1={0}
                      x2={width}
                      y2={0}
                      stroke="#1D4ED8"
                      strokeWidth="2"
                    />

                    {/* Grab handle badge */}
                    <g
                      className="cursor-ns-resize"
                      onPointerDown={handlePointerDown}
                    >
                      <rect
                        x={depthAxisWidth - 2}
                        y={-11}
                        width={90}
                        height={22}
                        rx="3"
                        fill="#1D4ED8"
                      />
                      <text
                        x={depthAxisWidth + 43}
                        y={4}
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize="11"
                        fontWeight="600"
                        className="tabular-nums"
                      >
                        {selectedWell.id}: {currentDepth}m
                      </text>
                    </g>
                  </g>
                );
              })()}
            </svg>
          </div>

          {/* Hover Tooltip readout */}
          {hoveredEvent && tooltipPos && (
            <div
              className="pointer-events-none absolute z-40 rounded-[6px] border border-line bg-surface p-2.5 shadow-[0_8px_24px_rgba(16,24,40,.12)] text-xs text-ink space-y-1 max-w-xs"
              style={{
                left: Math.min(width - 240, tooltipPos.x + 12),
                top: Math.min(height - 120, tooltipPos.y - 20),
              }}
            >
              <div className="flex items-center justify-between gap-2 border-b border-line pb-1">
                <span className="font-semibold">{hoveredEvent.type}</span>
                <span className="tabular-nums text-ink-3">{hoveredEvent.depth} m MD</span>
              </div>
              <div className="text-ink-2">
                Well: <span className="font-medium text-ink">{hoveredEvent.wellId}</span>
              </div>
              <div className="text-ink-2 truncate">
                Formation: {hoveredEvent.formation}
              </div>
              <div className="text-xs text-ink-3 line-clamp-2">
                {hoveredEvent.description}
              </div>
              <div className="text-xs text-ink-3 pt-1 border-t border-line/60">
                {hoveredEvent.source} {hoveredEvent.sourcePage} · {hoveredEvent.confidence} confidence
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chart Footer Provenance */}
      <div className="flex items-center justify-between border-t border-line px-4 py-2 bg-surface-muted/30">
        <ProvenanceChip
          source="WX-07 WCR p.14, DDRs, offset logs"
          recordCount={visibleEvents.length}
          simulatedCount={simulatedCount}
        />
        <div className="text-xs text-ink-3">
          Drag cursor or scrubber to evaluate context at any depth
        </div>
      </div>
    </div>
  );
}
