import React, { useEffect } from "react";
import { X } from "lucide-react";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  description,
  children,
  footer,
  width = "w-[480px]",
}: DrawerProps) {
  const effectiveSubtitle = subtitle ?? description;
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/20 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer surface */}
      <div className="fixed inset-y-0 right-0 flex max-w-full">
        <div
          className={`${width} max-w-full bg-surface border-l border-line rounded-l-[8px] shadow-[0_8px_24px_rgba(16,24,40,.12)] flex flex-col justify-between`}
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-line px-5 py-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-ink leading-tight">
                {title}
              </h3>
              {effectiveSubtitle && (
                <p className="mt-1 text-xs text-ink-3 leading-normal">
                  {effectiveSubtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ml-3 rounded-[4px] p-1 text-ink-3 hover:bg-surface-muted hover:text-ink cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Close drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 text-sm text-ink">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="border-t border-line bg-surface-muted/50 px-5 py-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
