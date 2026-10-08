"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  ChevronDown,
  CircleDot,
  Compass,
  FileText,
  Gauge,
  Hammer,
  Layers3,
  Map,
  Menu,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Workflow,
  X,
} from "lucide-react";
import { useNwisWorkspace } from "@/components/nwis-workspace-context";
import { EventEvidenceDrawer } from "@/components/event-evidence-drawer";
import { wells } from "@/lib/nwis-data";
import { evaluateHistoricalContext } from "@/lib/engineering/alerts";
import { Popover } from "@/components/ui/Popover";
import { Badge } from "@/components/ui/Badge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isDynamicWell?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navigationGroups: NavGroup[] = [
  {
    label: "Monitor",
    items: [
      { href: "/dashboard", label: "Command center", icon: Gauge },
      { href: "/alerts", label: "Alerts and risk", icon: Bell },
    ],
  },
  {
    label: "Analyse",
    items: [
      { href: "/map", label: "Nearby wells", icon: Map },
      { href: "/compare", label: "Offset comparison", icon: Workflow },
      { href: "/similar-wells", label: "Similar wells", icon: CircleDot },
      { href: "/subsurface", label: "3D subsurface", icon: Layers3 },
      { href: "/wells", label: "Wells", icon: Compass, isDynamicWell: true },
    ],
  },
  {
    label: "Knowledge",
    items: [
      { href: "/search", label: "Search", icon: Search },
      { href: "/documents", label: "Documents", icon: FileText },
      { href: "/evidence", label: "Evidence graph", icon: Network },
      { href: "/engineer", label: "Engineer notes", icon: BookOpen },
    ],
  },
  {
    label: "Plan",
    items: [{ href: "/planning", label: "Plan new well", icon: Hammer }],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    selectedWell,
    setSelectedWellId,
    currentDepth,
    setCurrentDepth,
    radiusKm,
    setRadiusKm,
    lookAheadM,
    setLookAheadM,
    plannedWells,
  } = useNwisWorkspace();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [wellFilterQuery, setWellFilterQuery] = useState("");
  const [customRadiusOpen, setCustomRadiusOpen] = useState(false);
  const [customRadiusInput, setCustomRadiusInput] = useState(String(radiusKm));

  // Auto-collapse sidebar on smaller displays (< 1280px)
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 1280) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const allAvailableWells = useMemo(() => {
    return [...plannedWells, ...wells];
  }, [plannedWells]);

  const filteredWells = useMemo(() => {
    if (!wellFilterQuery) return allAvailableWells;
    const q = wellFilterQuery.toLowerCase();
    return allAvailableWells.filter(
      (w) =>
        w.id.toLowerCase().includes(q) ||
        w.rig.toLowerCase().includes(q) ||
        w.formation.toLowerCase().includes(q),
    );
  }, [allAvailableWells, wellFilterQuery]);

  // Compute active alerts for current active well and depth
  const activeAlerts = useMemo(() => {
    try {
      return evaluateHistoricalContext(selectedWell, currentDepth, {
        approachWindowM: lookAheadM,
        contextRadiusKm: radiusKm,
        requireFormationMatch: false,
      });
    } catch {
      return [];
    }
  }, [selectedWell, currentDepth, radiusKm, lookAheadM]);

  // Derive breadcrumb from current pathname
  let breadcrumb = { group: "Monitor", page: "Command center" };
  for (const group of navigationGroups) {
    for (const item of group.items) {
      if (
        pathname === item.href ||
        (item.isDynamicWell && pathname.startsWith("/wells")) ||
        (item.href !== "/dashboard" && pathname.startsWith(item.href))
      ) {
        breadcrumb = { group: group.label, page: item.label };
        break;
      }
    }
  }

  const radiusOptions = [
    { value: 5, label: "5 km" },
    { value: 10, label: "10 km" },
    { value: 25, label: "25 km" },
    { value: 50, label: "50 km" },
  ];

  const lookAheadOptions = [
    { value: 50, label: "50 m" },
    { value: 100, label: "100 m" },
    { value: 200, label: "200 m" },
  ];

  const sidebarContent = (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-line bg-surface transition-all duration-150 z-30 ${
        isCollapsed ? "w-[56px]" : "w-[240px]"
      }`}
    >
      {/* Brand Header */}
      <div className="flex h-14 items-center justify-between border-b border-line px-3.5">
        <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] bg-primary text-xs font-semibold text-white">
            N
          </div>
          {!isCollapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-sm text-ink leading-none">
                Drill Well
              </span>
              <span className="rounded-[4px] border border-line bg-surface-muted px-1.5 py-0.5 text-xs text-ink-3">
                Demo data
              </span>
            </div>
          )}
        </Link>
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex items-center justify-center rounded-[4px] p-1 text-ink-3 hover:bg-surface-muted hover:text-ink cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4 w-4 stroke-[1.75]" />
          ) : (
            <PanelLeftClose className="h-4 w-4 stroke-[1.75]" />
          )}
        </button>
      </div>

      {/* Navigation Groups */}
      <nav
        aria-label="Main navigation"
        className="flex-1 overflow-y-auto px-2 py-3 space-y-4"
      >
        {navigationGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            {!isCollapsed && (
              <div className="px-2.5 text-xs font-medium text-ink-3 mb-1">
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const target = item.isDynamicWell
                ? `/wells/${selectedWell.id}`
                : item.href;
              const isActive =
                pathname === target ||
                (item.isDynamicWell && pathname.startsWith("/wells")) ||
                (target !== "/dashboard" && pathname.startsWith(target));
              const Icon = item.icon;

              return (
                <Link
                  key={item.label}
                  href={target}
                  title={isCollapsed ? item.label : undefined}
                  className={`group flex h-9 items-center gap-2.5 rounded-[4px] px-2.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary-soft text-accent border-l-2 border-accent font-semibold"
                      : "text-ink-2 hover:bg-surface-muted hover:text-ink border-l-2 border-transparent"
                  } ${isCollapsed ? "justify-center px-0" : ""}`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 stroke-[1.75] ${
                      isActive ? "text-accent" : "text-ink-3 group-hover:text-ink"
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Sidebar Footer */}
      <div className="border-t border-line p-3">
        {!isCollapsed ? (
          <div className="text-xs text-ink-3 leading-normal">
            Demonstration data. Not connected to eRTMAC.
          </div>
        ) : (
          <div
            title="Demonstration data. Not connected to eRTMAC."
            className="flex justify-center"
          >
            <span className="h-2 w-2 rounded-full bg-status-moderate" />
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">{sidebarContent}</div>

        {/* Mobile Drawer Navigation */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true">
            <div
              className="fixed inset-0 bg-ink/20"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative w-64 bg-surface shadow-xl flex flex-col">
              <div className="flex h-14 items-center justify-between border-b border-line px-4">
                <span className="font-semibold text-sm text-ink">Drill Well Menu</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 text-ink-3 hover:text-ink"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2" onClick={() => setMobileMenuOpen(false)}>
                {sidebarContent}
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top Bar (56px, White) */}
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-surface px-4 gap-4">
            {/* Left: Mobile trigger & Breadcrumb */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="flex md:hidden p-1.5 text-ink-2 hover:bg-surface-muted rounded-[4px]"
                aria-label="Open navigation menu"
              >
                <Menu className="h-4 w-4" />
              </button>

              <div className="hidden sm:flex items-center gap-1.5 text-xs text-ink-3 min-w-0 truncate">
                <span>Drill Well</span>
                <span className="text-line-strong">/</span>
                <span>{breadcrumb.group}</span>
                <span className="text-line-strong">/</span>
                <span className="font-medium text-ink truncate">{breadcrumb.page}</span>
              </div>
            </div>

            {/* Center / Controls: Well Selector, Radius, Look-ahead */}
            <div className="flex items-center gap-3">
              {/* Well Selector Combobox */}
              <Popover
                trigger={
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-2 rounded-[6px] border border-line bg-surface px-2.5 text-xs text-ink hover:bg-surface-muted cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    aria-label="Select active well"
                  >
                    <span className="h-2 w-2 rounded-full bg-status-ok shrink-0" />
                    <span className="font-semibold">{selectedWell.id}</span>
                    <span className="hidden lg:inline text-ink-3">({selectedWell.rig})</span>
                    <span className="hidden xl:inline tabular-nums text-ink-2">
                      {currentDepth} m MD
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-ink-3 ml-0.5" />
                  </button>
                }
                content={
                  <div className="w-64 space-y-2">
                    <div className="text-xs font-medium text-ink-3">Select well</div>
                    <input
                      type="text"
                      placeholder="Type to filter..."
                      value={wellFilterQuery}
                      onChange={(e) => setWellFilterQuery(e.target.value)}
                      className="w-full h-7 rounded-[4px] border border-line px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                    />
                    <div className="max-h-48 overflow-y-auto divide-y divide-line/60">
                      {filteredWells.map((w) => {
                        const isSelected = w.id === selectedWell.id;
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => {
                              setSelectedWellId(w.id);
                              setCurrentDepth(w.currentDepth);
                            }}
                            className={`w-full flex items-center justify-between p-2 text-xs text-left transition-colors cursor-pointer rounded-[4px] ${
                              isSelected
                                ? "bg-primary-soft text-accent font-semibold"
                                : "hover:bg-surface-muted text-ink"
                            }`}
                          >
                            <div>
                              <div className="font-semibold">{w.id}</div>
                              <div className="text-xs text-ink-3">
                                {w.rig} · {w.location}
                              </div>
                            </div>
                            <div className="text-right tabular-nums text-xs text-ink-2">
                              {w.currentDepth} m
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                }
              />

              {/* Search Radius Segmented Control */}
              <div className="hidden lg:flex items-center gap-1.5">
                <span className="text-xs text-ink-3">Radius:</span>
                <SegmentedControl
                  options={radiusOptions}
                  value={radiusOptions.some((o) => o.value === radiusKm) ? radiusKm : 0}
                  onChange={(val) => {
                    if (val > 0) setRadiusKm(val);
                  }}
                  size="sm"
                />
                {/* Custom radius toggle */}
                <Popover
                  open={customRadiusOpen}
                  onOpenChange={setCustomRadiusOpen}
                  trigger={
                    <button
                      type="button"
                      className={`h-7 px-2 text-xs rounded-[4px] border transition-colors cursor-pointer ${
                        !radiusOptions.some((o) => o.value === radiusKm)
                          ? "border-accent bg-primary-soft text-accent font-semibold"
                          : "border-line text-ink-3 hover:text-ink hover:bg-surface-muted"
                      }`}
                    >
                      Custom {radiusOptions.some((o) => o.value === radiusKm) ? "" : `(${radiusKm} km)`}
                    </button>
                  }
                  content={
                    <div className="w-48 space-y-2">
                      <div className="text-xs font-medium text-ink-3">Search radius (1-100 km)</div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={customRadiusInput}
                          onChange={(e) => setCustomRadiusInput(e.target.value)}
                          className="h-7 w-20 rounded-[4px] border border-line px-2 text-xs tabular-nums"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const parsed = parseInt(customRadiusInput, 10);
                            if (parsed >= 1 && parsed <= 100) {
                              setRadiusKm(parsed);
                              setCustomRadiusOpen(false);
                            }
                          }}
                          className="h-7 px-2.5 rounded-[4px] bg-primary text-white text-xs font-medium cursor-pointer"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  }
                />
              </div>

              {/* Look-ahead Segmented Control */}
              <div className="hidden xl:flex items-center gap-1.5">
                <span className="text-xs text-ink-3">Ahead:</span>
                <SegmentedControl
                  options={lookAheadOptions}
                  value={lookAheadM}
                  onChange={(val) => setLookAheadM(val)}
                  size="sm"
                />
              </div>
            </div>

            {/* Right: Alerts Bell & User Chip */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Alerts Bell Popover */}
              <Popover
                align="right"
                trigger={
                  <button
                    type="button"
                    aria-label={`Alerts (${activeAlerts.length})`}
                    className="relative flex h-8 w-8 items-center justify-center rounded-[6px] border border-line text-ink-2 hover:bg-surface-muted hover:text-ink cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <Bell className="h-4 w-4 stroke-[1.75]" />
                    {activeAlerts.length > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-status-critical px-1 text-xs font-semibold text-white">
                        {activeAlerts.length}
                      </span>
                    )}
                  </button>
                }
                content={
                  <div className="w-80 space-y-3">
                    <div className="flex items-center justify-between border-b border-line pb-2">
                      <span className="text-xs font-semibold text-ink">
                        Active alerts ({activeAlerts.length})
                      </span>
                      <Link
                        href="/alerts"
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        View all
                      </Link>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {activeAlerts.length === 0 ? (
                        <div className="py-4 text-center text-xs text-ink-3">
                          No alerts within the look-ahead window.
                        </div>
                      ) : (
                        activeAlerts.map((alert) => (
                          <div
                            key={alert.id}
                            className="rounded-[4px] border border-line bg-surface-muted/40 p-2 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <Badge
                                variant={
                                  alert.severity === "Critical"
                                    ? "critical"
                                    : alert.severity === "High"
                                    ? "high"
                                    : "moderate"
                                }
                              >
                                {alert.severity}
                              </Badge>
                              <span className="tabular-nums text-xs text-ink-3">
                                {alert.events[0]?.depth} m
                              </span>
                            </div>
                            <div className="font-medium text-ink leading-snug">
                              {alert.headline}
                            </div>
                            <div className="text-xs text-ink-3 truncate">
                              {alert.events[0]?.formation ?? alert.activeFormation}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                }
              />

              {/* User Chip */}
              <div className="flex items-center gap-2 rounded-[6px] border border-line bg-surface px-2.5 py-1">
                <span className="h-2 w-2 rounded-full bg-status-ok shrink-0" />
                <span className="text-xs font-medium text-ink">
                  Drilling engineer
                </span>
              </div>
            </div>
          </header>

          {/* Main Body */}
          <main className="min-w-0 flex-1 p-6 max-w-[1680px] w-full mx-auto">
            {children}
          </main>
        </div>
      </div>

      {/* Global Event Evidence Drawer */}
      <EventEvidenceDrawer />
    </div>
  );
}
