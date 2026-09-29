import React from "react";

interface PanelProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
  noPadding?: boolean;
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  footer,
  className = "",
  bodyClassName = "",
  headerClassName = "",
  noPadding = false,
}: PanelProps) {
  const hasHeader = title || subtitle || actions;

  return (
    <section
      className={`rounded-[6px] border border-line bg-surface flex flex-col ${className}`}
    >
      {hasHeader && (
        <header
          className={`flex items-start justify-between gap-3 border-b border-line px-4 py-3 ${headerClassName}`}
        >
          <div className="min-w-0 flex-1">
            {typeof title === "string" ? (
              <h2 className="text-base font-semibold text-ink leading-tight truncate">
                {title}
              </h2>
            ) : (
              title
            )}
            {subtitle && (
              <div className="mt-0.5 text-xs text-ink-3 leading-normal">
                {subtitle}
              </div>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 items-center gap-2">
              {actions}
            </div>
          )}
        </header>
      )}

      <div className={`flex-1 ${noPadding ? "" : "p-4"} ${bodyClassName}`}>
        {children}
      </div>

      {footer && (
        <footer className="border-t border-line px-4 py-2.5 bg-surface-muted/50 rounded-b-[5px]">
          {footer}
        </footer>
      )}
    </section>
  );
}
