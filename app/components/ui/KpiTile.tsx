import React from "react";

interface KpiTileProps {
  label: string;
  value: React.ReactNode;
  subtext?: React.ReactNode;
  badge?: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}

export function KpiTile({
  label,
  value,
  subtext,
  badge,
  onClick,
  selected = false,
  className = "",
}: KpiTileProps) {
  const isClickable = Boolean(onClick);

  return (
    <div
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`rounded-[6px] border bg-surface p-3.5 flex flex-col justify-between transition-colors ${
        selected
          ? "border-accent ring-1 ring-accent bg-primary-soft/30"
          : "border-line hover:border-line-strong"
      } ${
        isClickable
          ? "cursor-pointer hover:bg-surface-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          : ""
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-normal text-ink-3 leading-tight">
          {label}
        </span>
        {badge && <span className="shrink-0">{badge}</span>}
      </div>

      <div className="my-1.5">
        <div className="text-[28px] font-semibold text-ink leading-tight tabular-nums tracking-normal">
          {value}
        </div>
      </div>

      {subtext && (
        <div className="text-xs text-ink-2 leading-tight">
          {subtext}
        </div>
      )}
    </div>
  );
}
