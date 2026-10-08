"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { currentWell, wells, wellEvents } from "@/lib/nwis-data";
import type { DocumentItem, Well } from "@/lib/nwis-data";
import type { EventRecord } from "@/lib/nwis-data";

export type UploadedDocument = DocumentItem & {
  id: string;
  size: string;
  rows: number;
  columns: number;
  parser: string;
  preview: string;
  cells: string[][];
  fields: { label: string; value: string; confidence: string }[];
  warnings: string[];
  uploadedAt: string;
};

type NwisWorkspaceValue = {
  selectedWell: Well;
  setSelectedWellId: Dispatch<SetStateAction<string>>;
  currentDepth: number;
  setCurrentDepth: Dispatch<SetStateAction<number>>;
  radiusKm: number;
  setRadiusKm: Dispatch<SetStateAction<number>>;
  lookAheadM: number;
  setLookAheadM: Dispatch<SetStateAction<number>>;
  selectedEvent?: EventRecord;
  setSelectedEventId: Dispatch<SetStateAction<string | null>>;
  ingestedDocuments: UploadedDocument[];
  ingestDocuments: (documents: UploadedDocument[]) => void;
  clearIngestedDocuments: () => void;
  plannedWells: Well[];
  ingestPlannedWell: (well: Well) => void;
};

const NwisWorkspaceContext = createContext<NwisWorkspaceValue | null>(null);

export function NwisWorkspaceProvider({ children }: { children: ReactNode }) {
  const [selectedWellId, setSelectedWellId] = useState(currentWell.id);
  const [currentDepth, setCurrentDepth] = useState(currentWell.currentDepth);
  const [radiusKm, setRadiusKm] = useState(10);
  const [lookAheadM, setLookAheadM] = useState(100);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [ingestedDocuments, setIngestedDocuments] = useState<UploadedDocument[]>([]);
  const [plannedWells, setPlannedWells] = useState<Well[]>([]);

  const selectedWell = useMemo(
    () =>
      plannedWells.find((well) => well.id === selectedWellId) ??
      wells.find((well) => well.id === selectedWellId) ??
      currentWell,
    [plannedWells, selectedWellId],
  );

  const selectedEvent = useMemo(
    () => wellEvents.find((event) => event.id === selectedEventId),
    [selectedEventId],
  );

  const ingestDocuments = useCallback((next: UploadedDocument[]) => {
    setIngestedDocuments((previous) => [...next, ...previous]);
  }, []);

  const clearIngestedDocuments = useCallback(() => setIngestedDocuments([]), []);

  const ingestPlannedWell = useCallback((well: Well) => {
    setPlannedWells((previous) =>
      previous.some((item) => item.id === well.id)
        ? previous.map((item) => (item.id === well.id ? well : item))
        : [...previous, well],
    );
    setSelectedWellId(well.id);
    setCurrentDepth(well.currentDepth);
  }, []);

  const value = useMemo(
    () => ({
      selectedWell,
      setSelectedWellId,
      currentDepth,
      setCurrentDepth,
      radiusKm,
      setRadiusKm,
      lookAheadM,
      setLookAheadM,
      selectedEvent,
      setSelectedEventId,
      ingestedDocuments,
      ingestDocuments,
      clearIngestedDocuments,
      plannedWells,
      ingestPlannedWell,
    }),
    [
      selectedWell,
      currentDepth,
      radiusKm,
      lookAheadM,
      selectedEvent,
      ingestedDocuments,
      plannedWells,
      ingestDocuments,
      clearIngestedDocuments,
      ingestPlannedWell,
    ],
  );

  return <NwisWorkspaceContext.Provider value={value}>{children}</NwisWorkspaceContext.Provider>;
}

export function useNwisWorkspace() {
  const context = useContext(NwisWorkspaceContext);
  if (!context) throw new Error("useNwisWorkspace must be used inside NwisWorkspaceProvider");
  return context;
}
