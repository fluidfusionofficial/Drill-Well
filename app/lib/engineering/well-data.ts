/**
 * Well-specific data provider.
 *
 * The single most important rule in NWIS: records belong to a well.
 * A view of WX-11 must never silently display WX-07 formations or events.
 * Where a well has no source-backed record, the provider returns an explicit
 * unavailability marker instead of borrowing another well's data.
 */
import { formationIntervals, mudRecords, wellEvents, wells } from "../nwis-data.ts";
import type { EventRecord, Well } from "../nwis-data.ts";
import type { Provenance } from "./provenance.ts";
import { unavailableProvenance } from "./provenance.ts";
import type { DepthReferenceType } from "./depth.ts";

/** Which wells have source-backed formation picks in the supplied sanitized set. */
export const FORMATION_PICK_OWNER: Record<string, string> = { "WX-07": "WX-07" };

export type FormationPick = {
  name: string;
  top: number;
  bottom: number;
  thickness: number;
  lithology: string;
  /** Provenosed tops are never overwritten by actual picks — both are kept. */
  prognosedTop: number | null;
  sampleTop: number | null;
  wirelineTop: number | null;
  source: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  depthReference: DepthReferenceType;
  provenance: Provenance;
};

export type WellDocument = {
  id: string;
  wellId: string;
  name: string;
  kind: string;
  date: string;
  status: "Validated" | "Prototype" | "Pending";
  pages: number;
  tables: number | null;
  dataRows: number | null;
  sheets: { count: number; first: string; last: string } | null;
  availability: "available" | "not_supplied";
  note: string | null;
};

export type DataAvailability = { available: boolean; reason: string | null };

/* ------------------------------------------------------------------ */
/* Source document register                                            */
/* ------------------------------------------------------------------ */

/**
 * Reference document metadata as reported by the supplied sanitized set.
 * Page/table/row counts are the source document's own figures.
 */
export const sourceDocuments: WellDocument[] = [
  {
    id: "DOC-WX07-WCR",
    wellId: "WX-07",
    name: "WX-07 Final Well Report",
    kind: "WCR",
    date: "2025-08-12",
    status: "Validated",
    pages: 115,
    tables: 21,
    dataRows: 1116,
    sheets: null,
    availability: "available",
    note: "Complete drilling parameter table contains 1116 rows.",
  },
  {
    id: "DOC-WX07-DDR",
    wellId: "WX-07",
    name: "WX-07 daily drilling workbook",
    kind: "DDR",
    date: "2025-08-11",
    status: "Validated",
    pages: 44,
    tables: null,
    dataRows: null,
    sheets: { count: 44, first: "08.07.2025", last: "20.08.2025" },
    availability: "not_supplied",
    note: "Metadata known; workbook file not present in this repository, so sheet-level regression tests cannot run here.",
  },
  {
    id: "DOC-WX11-DDR",
    wellId: "WX-11",
    name: "WX-11 daily drilling workbook",
    kind: "DDR",
    date: "2025-11-11",
    status: "Prototype",
    pages: 40,
    tables: null,
    dataRows: null,
    sheets: { count: 40, first: "03.10.2025", last: "11.11.2025" },
    availability: "not_supplied",
    note: "Metadata known; workbook file not present in this repository.",
  },
  {
    id: "DOC-WX11-POLICY",
    wellId: "WX-11",
    name: "WX-11 policy (duplicate content)",
    kind: "PDF",
    date: "2025-10-18",
    status: "Pending",
    pages: 1,
    tables: null,
    dataRows: null,
    sheets: null,
    availability: "not_supplied",
    note: "Content-identical to an earlier policy PDF; must be de-duplicated by SHA-256 at ingestion.",
  },
  {
    id: "DOC-WX19-SCAN",
    wellId: "WX-19",
    name: "WX-19 scanned record",
    kind: "Scan",
    date: "2025-06-29",
    status: "Pending",
    pages: 4,
    tables: null,
    dataRows: null,
    sheets: null,
    availability: "not_supplied",
    note: "Scanned TIFF; requires OCR before extraction.",
  },
];

/* ------------------------------------------------------------------ */
/* Formations                                                          */
/* ------------------------------------------------------------------ */

/**
 * Planned vs actual formation tops.
 * The sanitized set supplies one pick per unit with a stated source class;
 * no second source class is invented where the source does not provide one.
 */
export function getFormationPicks(wellId: string): FormationPick[] {
  const owner = FORMATION_PICK_OWNER[wellId];
  if (!owner) {
    return [];
  }
  return formationIntervals.map((interval) => {
    const sampleOnly = interval.source === "Sample";
    const wirelineOnly = interval.source === "Wireline";
    return {
      name: interval.name,
      top: interval.top,
      bottom: interval.bottom,
      thickness: interval.thickness,
      lithology: interval.lithology,
      prognosedTop: interval.source === "Prognosed" ? interval.top : null,
      sampleTop: sampleOnly ? interval.top : null,
      wirelineTop: wirelineOnly ? interval.top : null,
      source: interval.source,
      confidence: interval.confidence as "HIGH" | "MEDIUM" | "LOW",
      depthReference: "MD" as DepthReferenceType,
      provenance: {
        sourceDocumentId: "DOC-WX07-WCR",
        sourceDocumentName: "WX-07 Final Well Report",
        sourcePageOrSheet: null,
        sourceTable: "Formation tops",
        sourceCell: null,
        sourceDate: "2025-08-12",
        extractionMethod: "table_extract" as const,
        extractionConfidence: interval.confidence as "HIGH" | "MEDIUM" | "LOW",
        citation: `WX-07 Final Well Report · Formation tops · ${interval.name}`,
      },
    };
  });
}

export function getFormationAvailability(wellId: string): DataAvailability {
  if (FORMATION_PICK_OWNER[wellId]) return { available: true, reason: null };
  return {
    available: false,
    reason: `No source-backed formation picks supplied for ${wellId}. WX-07 reference picks are shown on offset views only and are never attributed to this well.`,
  };
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

export function getEvents(wellId: string): EventRecord[] {
  return wellEvents.filter((event) => event.wellId === wellId).sort((a, b) => a.depth - b.depth);
}

/** Offset wells that have recorded events, for correlation views. */
export function getOffsetEventWells(excludeWellId: string): Well[] {
  return wells.filter((well) => well.id !== excludeWellId && getEvents(well.id).length > 0);
}

/* ------------------------------------------------------------------ */
/* Mud                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Mud records in the sanitized set belong to WX-07. They are only returned for
 * WX-07. Other wells get an explicit unavailability reason.
 */
export function getMudRecords(wellId: string) {
  if (wellId !== "WX-07") {
    return {
      available: false as const,
      reason: `No mud record source supplied for ${wellId}.`,
      records: [],
    };
  }
  return {
    available: true as const,
    reason: null as string | null,
    records: mudRecords.map((record) => ({
      ...record,
      depthReference: "MD" as DepthReferenceType,
      provenance: {
        sourceDocumentId: "DOC-WX07-WCR",
        sourceDocumentName: "WX-07 Final Well Report",
        sourcePageOrSheet: null,
        sourceTable: "Mud properties",
        sourceCell: null,
        sourceDate: record.date,
        extractionMethod: "table_extract" as const,
        extractionConfidence: "HIGH" as const,
        citation: `WX-07 Final Well Report · Mud properties · ${record.date}`,
      },
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Per-depth engineering tracks                                        */
/* ------------------------------------------------------------------ */

export function getDrillingParameterAvailability(wellId: string): DataAvailability {
  if (wellId === "WX-07") {
    return {
      available: false,
      reason: "WX-07 drilling parameters exist in the source WCR (1116 rows across 21 tables) but the source file is not present in this repository, so no parameter interval can be shown without fabricating data.",
    };
  }
  return { available: false, reason: `No drilling parameter source supplied for ${wellId}.` };
}

export function getBitRunAvailability(wellId: string): DataAvailability {
  return { available: false, reason: `No bit-run schedule source supplied for ${wellId}.` };
}

export function getConstructionAvailability(wellId: string): DataAvailability {
  return { available: false, reason: `No casing/cement source data supplied for ${wellId}.` };
}

export function getDocuments(wellId: string): WellDocument[] {
  return sourceDocuments.filter((document) => document.wellId === wellId);
}

/* ------------------------------------------------------------------ */
/* Coordinate integrity                                                */
/* ------------------------------------------------------------------ */

/**
 * Fixture coordinates are sanitized/derived, not surveyed. They must never be
 * presented as authoritative positions.
 */
export type CoordinateBasis = "fixture_derived" | "surveyed";

export function coordinateBasis(): CoordinateBasis {
  return "fixture_derived";
}

export const COORDINATE_DISCLAIMER = "Fixture/demo coordinates — not a surveyed position. Confirm against the authoritative GIS source before operational use.";

export function getProvenanceFallback(): Provenance {
  return unavailableProvenance;
}
