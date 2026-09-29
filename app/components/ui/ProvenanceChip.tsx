import React from "react";
import { Info } from "lucide-react";

interface ProvenanceChipProps {
  source: string;
  recordCount?: number;
  simulatedCount?: number;
  className?: string;
  notes?: string;
}

export function ProvenanceChip({
  source,
  recordCount,
  simulatedCount = 0,
  className = "",
  notes,
}: ProvenanceChipProps) {
  const hasSimulated = simulatedCount > 0;

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3 tabular-nums ${className}`}
    >
      <span className="inline-flex items-center gap-1 font-medium text-ink-2">
        <Info className="h-3.5 w-3.5 text-ink-3 shrink-0" />
        <span>Source: {source}</span>
      </span>

      {recordCount !== undefined && (
        <>
          <span aria-hidden="true" className="text-line-strong">/</span>
          <span>{recordCount} record{recordCount === 1 ? "" : "s"}</span>
        </>
      )}

      {hasSimulated && (
        <>
          <span aria-hidden="true" className="text-line-strong">/</span>
          <span className="rounded-[4px] border border-status-moderate/30 bg-status-moderate-soft px-1.5 py-0.2 text-status-moderate font-medium">
            {simulatedCount} simulated
          </span>
        </>
      )}

      {notes && (
        <>
          <span aria-hidden="true" className="text-line-strong">/</span>
          <span>{notes}</span>
        </>
      )}
    </div>
  );
}
