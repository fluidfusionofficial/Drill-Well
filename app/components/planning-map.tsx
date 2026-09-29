"use client";

import { useMemo, useRef } from "react";
import type { Well } from "@/lib/nwis-data";
import type { LatLng, OffsetClearance } from "@/lib/well-planning";
import { distanceKm, projectPoint } from "@/lib/well-planning";

const VIEW_KM = 3.2;

export function PlanningMap({
  site,
  pathEnd,
  offsets,
  clearances,
  radiusM,
  onSiteChange,
  onPick,
  suggestions,
}: {
  site: LatLng;
  pathEnd: LatLng;
  offsets: Well[];
  clearances: OffsetClearance[];
  radiusM: number;
  onSiteChange: (site: LatLng) => void;
  onPick: (site: LatLng) => void;
  suggestions: LatLng[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const size = 460;

  const project = (point: LatLng) => {
    const east = (point.lng - site.lng) * 111.32 * Math.cos((site.lat * Math.PI) / 180);
    const north = (point.lat - site.lat) * 110.574;
    return {
      x: size / 2 + (east / VIEW_KM) * (size / 2),
      y: size / 2 - (north / VIEW_KM) * (size / 2),
    };
  };

  const clearanceColor = (clearance: OffsetClearance) =>
    clearance.marginM < 0 ? "#C62828" : clearance.marginM < 100 ? "#D9560B" : "#1D4ED8";

  const rings = useMemo(() => [0.5, 1, 1.5, 2, 2.5, 3], []);

  return (
    <div className="rounded-[6px] border border-line bg-surface p-3 text-ink">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-ink">Plan view · Surface pad placement</h3>
        <span className="text-xs text-ink-3 tabular-nums">{VIEW_KM.toFixed(1)} km span</span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${size} ${size}`}
        className="w-full touch-none rounded-[4px] border border-line bg-surface-muted/20"
        onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const scale = size / bounds.width;
          const x = (event.clientX - bounds.left) * scale;
          const y = (event.clientY - bounds.top) * scale;
          const east = ((x - size / 2) / (size / 2)) * VIEW_KM;
          const north = -((y - size / 2) / (size / 2)) * VIEW_KM;
          const point = projectPoint(site, east, north);
          onPick(point);
        }}
      >
        <defs>
          <pattern id="plan-grid" width="26" height="26" patternUnits="userSpaceOnUse">
            <path d="M26 0 H0 V26" fill="none" stroke="#E1E5EA" strokeWidth="0.7" />
          </pattern>
          <radialGradient id="pad-glow">
            <stop offset="0%" stopColor="#1D4ED8" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width={size} height={size} fill="url(#plan-grid)" />

        {rings.map((ringKm) => {
          const radius = (ringKm / VIEW_KM) * (size / 2);
          return (
            <g key={ringKm}>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#C8CED6"
                strokeWidth="0.8"
                strokeDasharray="3 4"
              />
              <text x={size / 2 + 3} y={size / 2 - radius - 2} fontSize="9" fill="#667085">
                {ringKm} km
              </text>
            </g>
          );
        })}

        {/* Suggested alternative sites */}
        {suggestions.map((suggestion, index) => {
          const position = project(suggestion);
          return (
            <g
              key={index}
              onClick={(event) => {
                event.stopPropagation();
                onPick(suggestion);
              }}
              className="cursor-pointer"
            >
              <circle
                cx={position.x}
                cy={position.y}
                r="6"
                fill="none"
                stroke="#2E7D32"
                strokeWidth="1.2"
                strokeDasharray="2 2"
              />
              <text
                x={position.x}
                y={position.y - 8}
                fontSize="9"
                fill="#2E7D32"
                textAnchor="middle"
                fontWeight="600"
              >
                {index + 1}
              </text>
            </g>
          );
        })}

        {/* Offset wells */}
        {offsets.map((well) => {
          const position = project(well.coordinates);
          const clearance = clearances.find((item) => item.well.id === well.id);
          const color = clearance ? clearanceColor(clearance) : "#4A5565";
          return (
            <g key={well.id}>
              <line
                x1={position.x}
                y1={position.y}
                x2={position.x}
                y2={position.y + 22}
                stroke={color}
                strokeWidth="1"
              />
              <rect
                x={position.x - 3}
                y={position.y - 3}
                width="6"
                height="6"
                fill={color}
                transform={`rotate(45 ${position.x} ${position.y})`}
              />
              <text
                x={position.x + 6}
                y={position.y + 3}
                fontSize="10"
                fontWeight="600"
                fill="#16202C"
              >
                {well.id}
              </text>
              {clearance && (
                <text x={position.x + 6} y={position.y + 14} fontSize="9" fill="#4A5565">
                  {(clearance.horizontalAtTargetM / 1000).toFixed(2)} km
                </text>
              )}
            </g>
          );
        })}

        {/* Proposed target point and tie line */}
        {(() => {
          const end = project(pathEnd);
          return (
            <g>
              <line
                x1={size / 2}
                y1={size / 2}
                x2={end.x}
                y2={end.y}
                stroke="#1D4ED8"
                strokeWidth="1.4"
                strokeDasharray="4 3"
              />
              <circle
                cx={end.x}
                cy={end.y}
                r={(radiusM / 1000 / VIEW_KM) * (size / 2)}
                fill="url(#pad-glow)"
              />
              <circle
                cx={end.x}
                cy={end.y}
                r={(radiusM / 1000 / VIEW_KM) * (size / 2)}
                fill="none"
                stroke="#1D4ED8"
                strokeWidth="1.2"
              />
              <circle cx={end.x} cy={end.y} r="2.5" fill="#1D4ED8" />
            </g>
          );
        })()}

        {/* Proposed pad — draggable */}
        <g
          className="cursor-grab"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
            if (!bounds) return;
            const scale = size / bounds.width;
            const x = (event.clientX - bounds.left) * scale;
            const y = (event.clientY - bounds.top) * scale;
            const east = ((x - size / 2) / (size / 2)) * VIEW_KM;
            const north = -((y - size / 2) / (size / 2)) * VIEW_KM;
            onSiteChange(projectPoint(site, east, north));
          }}
        >
          <circle cx={size / 2} cy={size / 2} r="26" fill="url(#pad-glow)" />
          <rect x={size / 2 - 5} y={size / 2 - 5} width="10" height="10" fill="#1D4ED8" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r="9"
            fill="none"
            stroke="#1D4ED8"
            strokeWidth="1.4"
          />
          <text
            x={size / 2}
            y={size / 2 + 22}
            fontSize="9"
            fontWeight="700"
            fill="#1D4ED8"
            textAnchor="middle"
          >
            Proposed
          </text>
        </g>

        {/* North arrow + scale bar */}
        <g transform={`translate(${size - 34}, 26)`}>
          <path d="M0 14 L5 0 L10 14 L5 11 Z" fill="#16202C" />
          <text x="5" y="24" fontSize="9" fontWeight="700" fill="#16202C" textAnchor="middle">
            N
          </text>
        </g>
        <g transform={`translate(16, ${size - 18})`}>
          <line
            x1="0"
            y1="0"
            x2={(1 / VIEW_KM) * (size / 2)}
            y2="0"
            stroke="#16202C"
            strokeWidth="1.6"
          />
          <text x="0" y="-4" fontSize="9" fill="#16202C">
            1 km
          </text>
        </g>
      </svg>

      <p className="mt-2 text-xs leading-normal text-ink-3">
        Click anywhere to place the pad, drag the center marker to fine-tune, or pick a numbered
        alternative.
        {(() => {
          const nearest = clearances[0];
          return nearest
            ? ` Nearest offset ${nearest.well.id} is at ${distanceKm(
                site,
                nearest.well.coordinates,
              ).toFixed(2)} km surface distance.`
            : "";
        })()}
      </p>
    </div>
  );
}
