import React from "react";

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  count?: number;
  disabled?: boolean;
}

interface TabsProps<T extends string = string> {
  tabs: readonly TabItem<T>[] | TabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  className?: string;
}

export function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className = "",
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      className={`flex items-center gap-4 border-b border-line ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={`relative inline-flex items-center gap-1.5 pb-2.5 pt-1 text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              isActive
                ? "text-accent font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary"
                : "text-ink-2 hover:text-ink"
            } ${tab.disabled ? "pointer-events-none opacity-40" : ""}`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`tabular-nums text-xs px-1.5 py-0.2 rounded-[4px] ${
                  isActive
                    ? "bg-primary-soft text-accent font-medium"
                    : "bg-surface-muted text-ink-3"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
