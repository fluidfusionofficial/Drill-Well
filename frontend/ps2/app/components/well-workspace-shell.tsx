"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/layout-shell";
import { WellSectionRail, useActiveSectionSlug } from "@/components/well-section-rail";
import { dataStateTone, getSection } from "@/lib/engineering/sections";

/**
 * Every well section renders through this shell, so the ordered rail, the
 * section purpose and the data-availability state are identical across the
 * whole review sequence.
 */
export function WellWorkspaceShell({ wellId, children }: { wellId: string; children: ReactNode }) {
  const activeSlug = useActiveSectionSlug(wellId);
  const section = getSection(activeSlug);
  const tone = dataStateTone[section.dataState];

  return (
    <AppShell>
      <div className="flex min-h-[calc(100vh-92px)] gap-4">
        <aside className="hidden w-[248px] shrink-0 lg:block">
          <div className="sticky top-0 overflow-hidden rounded-xl border border-white/[0.07] bg-[#101a20]" style={{ maxHeight: "calc(100vh-108px)" }}>
            <WellSectionRail wellId={wellId} activeSlug={activeSlug} />
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-3">
          <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Section {section.order} · {wellId}
                </div>
                <h1 className="mt-0.5 text-xl font-semibold text-slate-900">{section.label}</h1>
                <p className="mt-1 max-w-3xl text-sm text-slate-600">{section.purpose}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${tone.className}`}>{tone.label}</span>
                <span className="max-w-[240px] text-right text-[10px] leading-4 text-slate-500">{section.dataNote}</span>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-900">
              <span className="font-semibold">Decision this screen supports:</span> {section.decision}
            </div>
          </header>

          <div className="lg:hidden">
            <WellSectionRail wellId={wellId} activeSlug={activeSlug} />
          </div>

          {children}
        </div>
      </div>
    </AppShell>
  );
}

/** Consistent empty/unavailable panel for sections with no source data. */
export function SourceUnavailable({ title, reason, icon: Icon }: { title: string; reason: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
      {Icon && <Icon className="mx-auto h-7 w-7 text-slate-400" />}
      <h2 className="mt-3 text-sm font-semibold text-slate-800">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-xl text-xs leading-5 text-slate-500">{reason}</p>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">Source data unavailable — nothing is fabricated to fill this gap</p>
    </section>
  );
}
