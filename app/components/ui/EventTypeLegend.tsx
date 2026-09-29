import React from "react";
import { HAZARD_CATEGORIES, HAZARD_CONFIG, HazardCategory } from "@/lib/taxonomy";
import { EventGlyph } from "./EventGlyph";

interface EventTypeLegendProps {
  selected?: HazardCategory | null;
  onSelect?: (category: HazardCategory | null) => void;
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export function EventTypeLegend({
  selected,
  onSelect,
  orientation = "horizontal",
  className = "",
}: EventTypeLegendProps) {
  return (
    <div
      className={`flex text-xs ${
        orientation === "horizontal"
          ? "flex-wrap items-center gap-x-4 gap-y-1.5"
          : "flex-col gap-2"
      } ${className}`}
      role="group"
      aria-label="Hazard event categories"
    >
      {HAZARD_CATEGORIES.map((category) => {
        const meta = HAZARD_CONFIG[category];
        const isSelected = selected === category;
        const isClickable = Boolean(onSelect);

        return (
          <button
            key={category}
            type="button"
            disabled={!isClickable}
            onClick={() => {
              if (onSelect) {
                onSelect(isSelected ? null : category);
              }
            }}
            className={`inline-flex items-center gap-1.5 rounded-[4px] px-1.5 py-0.5 transition-colors ${
              isClickable ? "cursor-pointer hover:bg-surface-muted" : "cursor-default"
            } ${
              isSelected
                ? "bg-primary-soft font-medium text-accent ring-1 ring-accent"
                : "text-ink-2"
            }`}
          >
            <EventGlyph type={category} size={13} />
            <span>{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}
