import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  tabs?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  subtitle,
  actions,
  backHref,
  backLabel = "Back",
  tabs,
  className = "",
}: PageHeaderProps) {
  const desc = description ?? subtitle;
  return (
    <div className={`mb-5 pb-2 ${className}`}>
      {backHref && (
        <div className="mb-2">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-3 hover:text-accent cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[4px] px-1 py-0.5"
          >
            <ArrowLeft className="h-3.5 w-3.5 stroke-[1.75]" />
            <span>{backLabel}</span>
          </Link>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-ink leading-tight">
            {title}
          </h1>
          {desc && (
            <p className="mt-1 text-sm text-ink-2 leading-relaxed max-w-3xl">
              {desc}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex shrink-0 items-center gap-2 mt-2 sm:mt-0">
            {actions}
          </div>
        )}
      </div>

      {tabs && <div className="mt-4">{tabs}</div>}
    </div>
  );
}
