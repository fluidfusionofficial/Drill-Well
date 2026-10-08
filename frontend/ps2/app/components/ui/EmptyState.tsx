import React from "react";
import { FolderOpen } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-[6px] border border-dashed border-line bg-surface-muted/30 ${className}`}
    >
      <div className="mb-3 text-ink-3">
        {icon ?? <FolderOpen className="h-8 w-8 stroke-[1.5]" />}
      </div>
      <h4 className="text-sm font-semibold text-ink leading-tight mb-1">
        {title}
      </h4>
      <p className="max-w-md text-xs text-ink-2 leading-relaxed mb-4">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
