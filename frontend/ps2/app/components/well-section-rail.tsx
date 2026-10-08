"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNwisWorkspace } from "@/components/nwis-workspace-context";
import { sectionGroups, sectionHref, wellSections, dataStateTone, getSection, nextSection, previousSection } from "@/lib/engineering/sections";

/** Derive the active section slug from the current URL. */
export function useActiveSectionSlug(wellId: string) {
  const pathname = usePathname() ?? "";
  const prefix = `/wells/${wellId}`;
  if (pathname === prefix || pathname === `${prefix}/`) return "";
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length + 1).split("/")[0];
  return "";
}

/**
 * The guided review rail. Sections are listed in fixed engineering order and
 * grouped, so the engineer always knows where they are and what comes next.
 */
export function WellSectionRail({ wellId, activeSlug }: { wellId: string; activeSlug: string }) {
  const { currentDepth } = useNwisWorkspace();
  const active = getSection(activeSlug);
  const next = nextSection(activeSlug);
  const previous = previousSection(activeSlug);

  return (
    <div className="flex h-full flex-col overflow-hidden border-r border-white/[0.07] bg-[#101a20]">
      <div className="shrink-0 border-b border-white/[0.07] px-4 py-3">
        <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-teal-400/80">Engineering review</div>
        <div className="mt-0.5 text-sm font-semibold text-slate-100">
          Section {active.order} of {wellSections.length}
        </div>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-teal-500/70" style={{ width: `${(active.order / wellSections.length) * 100}%` }} />
        </div>
        <div className="mt-2 text-[10px] leading-4 text-slate-400">
          <span className="text-slate-200">{active.label}</span> — {active.purpose}
        </div>
        <div className="mt-1 text-[10px] leading-4 text-teal-300/80">Decision: {active.decision}</div>
        <div className="mt-1 text-[10px] text-slate-500">Depth cursor {Math.round(currentDepth)} m MD</div>
      </div>

      <nav aria-label="Well intelligence sections" className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {sectionGroups.map((group) => {
          const items = wellSections.filter((section) => section.group === group.id);
          if (items.length === 0) return null;
          return (
            <div key={group.id} className="mb-4">
              <div className="px-2 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">{group.label}</div>
              <ul className="space-y-0.5">
                {items.map((section) => {
                  const isActive = section.slug === activeSlug;
                  const tone = dataStateTone[section.dataState];
                  const Icon = section.icon;
                  return (
                    <li key={section.slug || "identity"}>
                      <Link
                        href={sectionHref(wellId, section.slug)}
                        aria-current={isActive ? "page" : undefined}
                        className={`group flex items-center gap-2 rounded-md px-2 py-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                          isActive ? "bg-teal-500/15 text-white ring-1 ring-inset ring-teal-500/40" : "text-slate-300 hover:bg-white/[0.06]"
                        }`}
                      >
                        <span className={`w-4 shrink-0 text-right text-[9px] tabular-nums ${isActive ? "text-teal-300" : "text-slate-600"}`}>{section.order}</span>
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{section.label}</span>
                        <span className={`shrink-0 rounded border px-1 text-[8px] font-bold uppercase leading-tight ${tone.className}`} title={section.dataNote}>
                          {section.dataState === "source-backed" ? "SRC" : section.dataState === "partial" ? "PART" : "NONE"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 space-y-1 border-t border-white/[0.07] px-2 py-2">
        {previous && (
          <Link href={sectionHref(wellId, previous.slug)} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-slate-300 transition hover:bg-white/[0.06]">
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="truncate">{previous.order}. {previous.label}</span>
          </Link>
        )}
        {next && (
          <Link href={sectionHref(wellId, next.slug)} className="flex items-center gap-1.5 rounded-md bg-teal-500/10 px-2 py-1.5 text-[11px] font-medium text-teal-200 transition hover:bg-teal-500/20">
            <span className="min-w-0 flex-1 truncate text-right">
              {next.order}. {next.label}
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          </Link>
        )}
      </div>
    </div>
  );
}
