/**
 * Every derived engineering record must be traceable back to where it came from.
 * Nothing in NWIS is presented without a source.
 */

export type ExtractionMethod = "digital_text" | "table_extract" | "ocr" | "manual_entry" | "derived" | "simulated" | "rule_based" | "model_output";

export type SourceDocument = {
  documentId: string;
  name: string;
  kind: string;
  wellId: string;
  sha256?: string;
  date: string;
  /** Number of pages reported by the source document, not an estimate. */
  pages: number;
  tables?: number;
  dataRows?: number;
  sheets?: { count: number; first: string; last: string } | null;
  availability: "available" | "not_supplied" | "unavailable";
};

export type Provenance = {
  sourceDocumentId: string | null;
  sourceDocumentName: string | null;
  sourcePageOrSheet: string | null;
  sourceTable: string | null;
  sourceCell: string | null;
  sourceDate: string | null;
  extractionMethod: ExtractionMethod;
  extractionConfidence: "HIGH" | "MEDIUM" | "LOW";
  /** Human-readable citation, e.g. "WX-07 Final Well Report · Mud Loss Data · Page 21". */
  citation?: string;
};

export const simulatedProvenance: Provenance = {
  sourceDocumentId: null,
  sourceDocumentName: null,
  sourcePageOrSheet: null,
  sourceTable: null,
  sourceCell: null,
  sourceDate: null,
  extractionMethod: "simulated",
  extractionConfidence: "LOW",
  citation: "Simulation / demo — not a source record",
};

export const ruleProvenance = (citation: string): Provenance => ({
  sourceDocumentId: null,
  sourceDocumentName: null,
  sourcePageOrSheet: null,
  sourceTable: null,
  sourceCell: null,
  sourceDate: null,
  extractionMethod: "rule_based",
  extractionConfidence: "MEDIUM",
  citation,
});

export const unavailableProvenance: Provenance = {
  sourceDocumentId: null,
  sourceDocumentName: null,
  sourcePageOrSheet: null,
  sourceTable: null,
  sourceCell: null,
  sourceDate: null,
  extractionMethod: "derived",
  extractionConfidence: "LOW",
  citation: "Source data unavailable",
};

/** Attach provenance to any record without losing its own fields. */
export function withProvenance<T extends object>(record: T, provenance: Provenance): T & { provenance: Provenance } {
  return { ...record, provenance };
}

export function isSourceBacked(provenance: Provenance) {
  return provenance.extractionMethod === "digital_text" || provenance.extractionMethod === "table_extract" || provenance.extractionMethod === "ocr";
}
