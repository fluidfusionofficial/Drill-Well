type MetricCardProps = {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "warning" | "positive" | "critical";
};

const tones = {
  default: "border-line bg-surface text-ink",
  warning: "border-status-high/30 bg-status-high-soft text-ink",
  positive: "border-status-ok/30 bg-status-ok-soft text-ink",
  critical: "border-status-critical/30 bg-status-critical-soft text-ink",
};

export function MetricCard({ label, value, hint, tone = "default" }: MetricCardProps) {
  return (
    <div className={`rounded-[6px] border p-4 ${tones[tone]}`}>
      <div className="text-xs font-semibold text-ink-3">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-ink">{value}</div>
      <div className="mt-1 text-xs text-ink-3">{hint}</div>
    </div>
  );
}
