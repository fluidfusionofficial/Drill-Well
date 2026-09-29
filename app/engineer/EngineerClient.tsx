"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { engineerNotes as initialNotes, EngineerNote, wells } from "@/lib/nwis-data";
import { useNwisWorkspace } from "@/components/nwis-workspace-context";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { ProvenanceChip } from "@/components/ui/ProvenanceChip";

export function EngineerClient() {
  const { selectedWell, currentDepth } = useNwisWorkspace();
  const [notes, setNotes] = useState<EngineerNote[]>([...initialNotes]);
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // New note form state
  const [newTitle, setNewTitle] = useState("");
  const [newWellId, setNewWellId] = useState(selectedWell.id);
  const [newDepth, setNewDepth] = useState(Math.round(currentDepth));
  const [newSummary, setNewSummary] = useState("");

  const filteredNotes = notes.filter(
    (n) => filterStatus === "All" || n.status === filterStatus,
  );

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newSummary.trim()) return;

    const newNote: EngineerNote = {
      id: `NOTE-${Date.now().toString().slice(-4)}`,
      title: newTitle.trim(),
      wellId: newWellId,
      depth: newDepth,
      date: new Date().toISOString().slice(0, 10),
      status: "Draft",
      summary: newSummary.trim(),
    };

    setNotes([newNote, ...notes]);
    setNewTitle("");
    setNewSummary("");
    setIsDrawerOpen(false);
  };

  const getStatusBadge = (status: EngineerNote["status"]) => {
    switch (status) {
      case "Validated":
        return <Badge variant="ok">Validated</Badge>;
      case "Pending Review":
        return <Badge variant="moderate">Pending review</Badge>;
      case "Draft":
        return <Badge variant="neutral">Draft</Badge>;
      case "Rejected":
        return <Badge variant="critical">Rejected</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-line bg-surface p-4 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ink-3 font-medium">Filter by status:</span>
          {(["All", "Validated", "Pending Review", "Draft", "Rejected"] as const).map(
            (status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(status)}
                className={`rounded-[4px] px-2.5 py-1 text-xs font-medium border transition ${
                  filterStatus === status
                    ? "bg-primary border-accent text-white"
                    : "bg-surface border-line text-ink-2 hover:bg-surface-muted"
                }`}
              >
                {status}
              </button>
            ),
          )}
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setNewWellId(selectedWell.id);
            setNewDepth(Math.round(currentDepth));
            setIsDrawerOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add observation note
        </Button>
      </div>

      {/* Notes List */}
      <div className="space-y-3">
        {filteredNotes.map((note) => (
          <div
            key={note.id}
            className="rounded-[6px] border border-line bg-surface p-4 text-ink hover:border-line-strong transition"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ink">{note.title}</span>
                <span className="text-xs text-ink-3">·</span>
                <span className="text-xs font-semibold text-accent">{note.wellId}</span>
                <span className="text-xs text-ink-3">·</span>
                <span className="text-xs tabular-nums text-ink-2 font-medium">
                  {note.depth} m MD
                </span>
              </div>

              <div className="flex items-center gap-2">
                {getStatusBadge(note.status)}
                <span className="text-xs tabular-nums text-ink-3">{note.date}</span>
              </div>
            </div>

            <div className="mt-2.5 text-xs leading-relaxed text-ink-2">{note.summary}</div>

            <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-xs text-ink-3">
              <span>Author: Operations geologist / drilling engineer</span>
              <span className="text-xs text-ink-3">Reference: {note.id}</span>
            </div>
          </div>
        ))}

        {filteredNotes.length === 0 && (
          <div className="rounded-[6px] border border-line bg-surface p-8 text-center text-xs text-ink-3">
            No engineer notes match the selected status filter.
          </div>
        )}
      </div>

      {/* Drawer for creating a note */}
      <Drawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Add engineering observation note"
        description="Record field observations, lessons learned, and validation reviews tied to well depth context."
      >
        <form onSubmit={handleCreateNote} className="space-y-4 text-xs">
          <div>
            <label htmlFor="note-title" className="block font-medium text-ink mb-1">
              Observation title
            </label>
            <input
              id="note-title"
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Tight hole experienced when back-reaming at 512 m"
              className="w-full rounded-[4px] border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="note-well" className="block font-medium text-ink mb-1">
                Well reference
              </label>
              <select
                id="note-well"
                value={newWellId}
                onChange={(e) => setNewWellId(e.target.value)}
                className="w-full rounded-[4px] border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-accent"
              >
                {wells.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.id} ({w.location})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="note-depth" className="block font-medium text-ink mb-1">
                Depth (m MD)
              </label>
              <input
                id="note-depth"
                type="number"
                required
                value={newDepth}
                onChange={(e) => setNewDepth(Number(e.target.value))}
                className="w-full rounded-[4px] border border-line bg-surface px-2.5 py-1.5 text-xs text-ink tabular-nums focus:border-accent"
              >
              </input>
            </div>
          </div>

          <div>
            <label htmlFor="note-summary" className="block font-medium text-ink mb-1">
              Detailed observation & evidence notes
            </label>
            <textarea
              id="note-summary"
              required
              rows={4}
              value={newSummary}
              onChange={(e) => setNewSummary(e.target.value)}
              placeholder="Document observed cutting returns, torque fluctuations, mud weight changes, or recommendations for offset wells..."
              className="w-full rounded-[4px] border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
            <Button variant="secondary" size="sm" type="button" onClick={() => setIsDrawerOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save note
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Footer */}
      <div className="pt-1">
        <ProvenanceChip
          source="Institutional engineering annotations register"
          recordCount={notes.length}
          simulatedCount={0}
        />
      </div>
    </div>
  );
}
