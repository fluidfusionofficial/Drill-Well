import React from "react";

export type BadgeVariant =
  | "critical"
  | "high"
  | "moderate"
  | "ok"
  | "neutral"
  | "accent";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}

export function Badge({
  children,
  variant = "neutral",
  dot = false,
  className = "",
}: BadgeProps) {
  const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
    critical: {
      container: "bg-status-critical-soft text-status-critical border border-status-critical/20",
      dot: "bg-status-critical",
    },
    high: {
      container: "bg-status-high-soft text-status-high border border-status-high/20",
      dot: "bg-status-high",
    },
    moderate: {
      container: "bg-status-moderate-soft text-status-moderate border border-status-moderate/20",
      dot: "bg-status-moderate",
    },
    ok: {
      container: "bg-status-ok-soft text-status-ok border border-status-ok/20",
      dot: "bg-status-ok",
    },
    neutral: {
      container: "bg-surface-muted text-ink-2 border border-line",
      dot: "bg-ink-3",
    },
    accent: {
      container: "bg-primary-soft text-accent border border-accent/20",
      dot: "bg-primary",
    },
  };

  const style = variantStyles[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[4px] px-2 py-0.5 text-xs font-medium tabular-nums ${style.container} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${style.dot}`} aria-hidden="true" />}
      <span>{children}</span>
    </span>
  );
}
