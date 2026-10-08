import React from "react";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
  count?: number;
  disabled?: boolean;
}

interface SegmentedControlProps<T extends string | number> {
  options: readonly SegmentedOption<T>[] | SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  size = "sm",
  className = "",
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-0.5 rounded-[6px] border border-line bg-surface-muted p-0.5 ${className}`}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        const sizeClasses =
          size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-xs";

        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={`inline-flex items-center gap-1.5 rounded-[4px] font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${sizeClasses} ${
              isSelected
                ? "bg-surface text-ink border border-line shadow-xs font-semibold"
                : "text-ink-2 hover:bg-surface/60 hover:text-ink border border-transparent"
            } ${option.disabled ? "pointer-events-none opacity-40" : ""}`}
          >
            <span>{option.label}</span>
            {option.count !== undefined && (
              <span
                className={`tabular-nums text-xs px-1 rounded-[3px] ${
                  isSelected ? "bg-primary-soft text-accent" : "bg-line text-ink-3"
                }`}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
