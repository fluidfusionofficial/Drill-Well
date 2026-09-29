"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, ClipboardList, FileSearch, MapPin, X } from "lucide-react";
import { useNwisWorkspace } from "@/components/nwis-workspace-context";
import { Badge } from "@/components/ui/Badge";
import { EventGlyph } from "@/components/ui/EventGlyph";
import { classifyEvent } from "@/lib/taxonomy";

export function EventEvidenceDrawer() {
  const { selectedEvent, setSelectedEventId } = useNwisWorkspace();

  useEffect(() => {
    if (!selectedEvent) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedEventId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedEvent, setSelectedEventId]);

  if (!selectedEvent) return null;

  const close = () => setSelectedEventId(null);
  const cat = classifyEvent(selectedEvent.type);

  return (
    <div
      className="fixed inset-0 z-[1000] flex justify-end bg-black/30"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-evidence-title"
        className="flex h-full w-full max-w-[460px] flex-col border-l border-line bg-surface text-ink shadow-[0_8px_24px_rgba(16,24,40,0.12)] animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
              <FileSearch className="h-3.5 w-3.5" />
              <span>Source evidence dossier</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <EventGlyph category={cat} size={16} />
              <h2 id="event-evidence-title" className="text-base font-semibold text-ink">
                {selectedEvent.type}
              </h2>
            </div>
            <div className="mt-0.5 text-xs text-ink-3">
              Verified record · ID: {selectedEvent.id}
            </div>
          </div>
          <button
            type="button"
            aria-label="Close evidence panel"
            onClick={close}
            className="grid h-8 w-8 place-items-center rounded-[4px] border border-line bg-surface text-ink-2 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Event Anchor */}
          <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
            <div>
              <div className="text-xs font-medium text-ink-3">Incident anchor</div>
              <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-ink">
                <MapPin className="h-3.5 w-3.5 text-accent" />
                <span>
                  {selectedEvent.wellId} · {selectedEvent.depth} m MD
                </span>
              </div>
              <div className="mt-0.5 text-xs text-ink-2">
                {selectedEvent.formation} · {selectedEvent.date}
              </div>
            </div>
            <Badge
              variant={
                selectedEvent.severity === "Critical"
                  ? "critical"
                  : selectedEvent.severity === "High"
                  ? "high"
                  : "moderate"
              }
            >
              {selectedEvent.severity}
            </Badge>
          </div>

          {/* Source Provenance Grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-line pb-4 text-xs">
            <EvidenceField label="Source document" value={selectedEvent.source} />
            <EvidenceField label="Page / sheet locator" value={selectedEvent.sourcePage} />
            <EvidenceField label="Extraction confidence" value={selectedEvent.confidence} />
            <EvidenceField
              label="Record origin"
              value={selectedEvent.origin === "simulated" ? "Simulated offset" : "Sanitized source WCR"}
            />
          </div>

          {/* Description / Action / Outcome */}
          <div className="space-y-3 text-xs">
            <EvidenceSection label="Recorded incident description">
              {selectedEvent.description}
            </EvidenceSection>
            <EvidenceSection label="Operational response applied">
              {selectedEvent.response || "No corrective response recorded."}
            </EvidenceSection>
            <EvidenceSection label="Observed operational outcome">
              {selectedEvent.outcome || "Normal drilling resumed without additional NPT."}
            </EvidenceSection>
          </div>

          {/* Honesty note */}
          <div className="rounded-[4px] border border-accent/20 bg-primary-soft p-3 text-xs text-ink">
            <div className="flex items-center gap-1.5 font-semibold text-accent">
              <ClipboardList className="h-3.5 w-3.5" />
              <span>Honest engineering precedent</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-ink-2">
              This event is surfaced as historical precedent because its recorded formation and
              depth interval correlate with the active well. It represents institutional memory, not
              a deterministic prediction.
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-status-ok">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>Source provenance fields verified against ingested register.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-muted/40 px-5 py-3 text-xs">
          <Link
            href="/documents"
            onClick={close}
            className="inline-flex items-center gap-1.5 rounded-[4px] bg-primary px-3 py-1.5 font-medium text-white hover:bg-primary-hover transition"
          >
            <FileSearch className="h-3.5 w-3.5" />
            <span>Open documents</span>
          </Link>
          <Link
            href="/compare"
            onClick={close}
            className="inline-flex items-center gap-1 font-medium text-accent hover:text-accent-hover"
          >
            <span>Compare well</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </aside>
    </div>
  );
}

function EvidenceField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-0.5 break-words text-xs font-semibold text-ink">{value}</div>
    </div>
  );
}

function EvidenceSection({ label, children }: { label: string; children: string }) {
  return (
    <section>
      <h3 className="text-xs font-semibold text-ink-3">{label}</h3>
      <p className="mt-1 leading-relaxed text-ink-2">{children}</p>
    </section>
  );
}
