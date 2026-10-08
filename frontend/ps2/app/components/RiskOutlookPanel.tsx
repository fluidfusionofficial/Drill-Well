"use client";

import React, { useMemo } from "react";
import { useNwisWorkspace } from "@/components/nwis-workspace-context";
import { calculateAllHazardRisks, HazardRiskOutlook } from "@/lib/engineering/risk";
import { getAllEvents, getAllWells } from "@/lib/fixtures/extended-dataset";
import { EventGlyph } from "@/components/ui/EventGlyph";
import { Badge } from "@/components/ui/Badge";
import { HazardCategory } from "@/lib/taxonomy";

interface RiskOutlookPanelProps {
  selectedCategory?: HazardCategory | null;
  onSelectCategory?: (category: HazardCategory | null) => void;
  className?: string;
}

export function RiskOutlookPanel({
  selectedCategory,
  onSelectCategory,
  className = "",
}: RiskOutlookPanelProps) {
  const { selectedWell, currentDepth, radiusKm, lookAheadM } = useNwisWorkspace();

  const allEvents = useMemo(() => getAllEvents(), []);
  const allWells = useMemo(() => getAllWells(), []);

  const hazardRisks: HazardRiskOutlook[] = useMemo(() => {
    return calculateAllHazardRisks(allEvents, selectedWell, currentDepth, allWells, {
      radiusKm,
      lookAheadM,
      activeFormation: selectedWell.formation,
    });
  }, [allEvents, selectedWell, currentDepth, allWells, radiusKm, lookAheadM]);

  // Display top 5 standard drilling hazards
  const displayHazards = useMemo(() => {
    return hazardRisks.filter((h) => h.category !== "Other NPT").slice(0, 5);
  }, [hazardRisks]);

  return (
    <div className={`rounded-[6px] border border-line bg-surface flex flex-col justify-between ${className}`}>
      {/* Header */}
      <div className="border-b border-line px-4 py-3">
        <h3 className="text-base font-semibold text-ink leading-tight">
          Risk outlook
        </h3>
        <p className="text-xs text-ink-3 mt-0.5">
          Historical offset precedent within {radiusKm} km · next {lookAheadM} m
        </p>
      </div>

      {/* 5 Hazard Rows */}
      <div className="divide-y divide-line p-2 flex-1 flex flex-col justify-around">
        {displayHazards.map((hazard) => {
          const isSelected = selectedCategory === hazard.category;
          const isClickable = Boolean(onSelectCategory);

          return (
            <div
              key={hazard.category}
              role={isClickable ? "button" : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onClick={() => {
                if (onSelectCategory) {
                  onSelectCategory(isSelected ? null : hazard.category);
                }
              }}
              className={`p-2.5 rounded-[4px] transition-colors ${
                isSelected
                  ? "bg-primary-soft ring-1 ring-accent"
                  : "hover:bg-surface-muted"
              } ${isClickable ? "cursor-pointer" : ""}`}
            >
              {/* Row Top: Glyph + Name + Score + Badge */}
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <EventGlyph type={hazard.category} size={15} />
                  <span className="font-semibold text-xs text-ink truncate">
                    {hazard.category}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold tabular-nums text-ink">
                    {hazard.index} / 100
                  </span>
                  <Badge
                    variant={
                      hazard.band === "High"
                        ? "critical"
                        : hazard.band === "Moderate"
                        ? "moderate"
                        : "ok"
                    }
                  >
                    {hazard.band}
                  </Badge>
                </div>
              </div>

              {/* Progress Bar (0 to 100) */}
              <div className="w-full bg-line rounded-full h-1.5 overflow-hidden mb-1.5">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    hazard.band === "High"
                      ? "bg-status-critical"
                      : hazard.band === "Moderate"
                      ? "bg-status-moderate"
                      : "bg-status-ok"
                  }`}
                  style={{ width: `${Math.max(4, hazard.index)}%` }}
                />
              </div>

              {/* Row Bottom: Nearest ahead & Basis */}
              <div className="flex items-center justify-between text-xs text-ink-3">
                <span className="truncate max-w-[200px]" title={hazard.aheadText}>
                  {hazard.aheadText}
                </span>
                <span className="tabular-nums shrink-0">{hazard.basisText}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mandatory Footnote */}
      <div className="border-t border-line px-4 py-2 bg-surface-muted/30 rounded-b-[5px]">
        <p className="text-xs text-ink-3 leading-normal">
          Historical risk index (rule-based, v0). How often and how close comparable events occurred in offsets. Not a forecast.
        </p>
      </div>
    </div>
  );
}
