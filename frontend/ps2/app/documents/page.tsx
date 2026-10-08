"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  FileType2,
  Loader2,
  Scan,
  Table2,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout-shell";
import { PageHeader } from "@/components/page-header";
import { useNwisWorkspace } from "@/components/nwis-workspace-context";
import { documents } from "@/lib/nwis-data";
import { parseDocumentFile } from "@/lib/document-parser";
import type { ParsedDocument } from "@/lib/document-parser";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProvenanceChip } from "@/components/ui/ProvenanceChip";

const ACCEPT = ".pdf,.xlsx,.xls,.csv,.tsv,.docx,.txt,.md,.tif,.tiff,.png,.jpg,.jpeg";

const kindIcon = (kind: ParsedDocument["kind"]) => {
  if (kind === "Excel") return FileSpreadsheet;
  if (kind === "Word" || kind === "Text") return FileType2;
  if (kind === "Scan") return Scan;
  return FileText;
};

export default function DocumentsPage() {
  const { ingestedDocuments, ingestDocuments, clearIngestedDocuments } = useNwisWorkspace();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ name: string; index: number; total: number } | null>(
    null,
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      setError(null);
      setBusy(true);
      const files = Array.from(fileList);
      const parsed: ParsedDocument[] = [];

      for (const [index, file] of files.entries()) {
        setProgress({ name: file.name, index: index + 1, total: files.length });
        try {
          parsed.push(await parseDocumentFile(file));
        } catch (parseError) {
          setError(
            `${file.name}: ${
              parseError instanceof Error ? parseError.message : "could not be read"
            }`,
          );
        }
      }

      if (parsed.length > 0) {
        ingestDocuments(
          parsed.map((item) => ({
            id: item.id,
            name: item.name,
            kind:
              item.kind === "Word" || item.kind === "Text" || item.kind === "Other"
                ? "PDF"
                : (item.kind as "WCR" | "DDR" | "Excel" | "PDF" | "Scan"),
            wellId: item.wellId,
            date: item.date,
            status: item.warnings.length === 0 ? "Validated" : "Pending",
            pages: item.pages,
            size: item.parser.split("·").pop()?.trim() ?? "",
            rows: item.rows,
            columns: item.columns,
            parser: item.parser,
            preview: item.preview,
            cells: item.cells,
            fields: item.fields,
            warnings: item.warnings,
            uploadedAt: new Date().toISOString(),
          })),
        );
        setOpenId(parsed[0].id);
      }

      setProgress(null);
      setBusy(false);
    },
    [ingestDocuments],
  );

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          title="Document intelligence center"
          description="In-browser parsing and structured field extraction from well completion reports (WCR) and daily drilling records (DDR)."
        />

        {/* Upload Zone */}
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void handleFiles(event.dataTransfer.files);
          }}
          className={`rounded-[6px] border-2 border-dashed p-5 transition ${
            isDragging
              ? "border-accent bg-primary-soft/40"
              : "border-line-strong bg-surface hover:border-line"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-[4px] bg-primary-soft text-accent shrink-0">
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <UploadCloud className="h-5 w-5" />
                )}
              </span>
              <div>
                <div className="text-sm font-semibold text-ink">Upload operational documents</div>
                <div className="mt-0.5 text-xs text-ink-3">
                  Drag and drop files or browse · PDF · Excel · Word · CSV · TXT · client-side
                  browser parse
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPT}
                className="sr-only"
                onChange={(event) => {
                  void handleFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              <Button
                variant="primary"
                size="sm"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <UploadCloud className="h-4 w-4 mr-1" />
                )}
                Choose files
              </Button>
              {ingestedDocuments.length > 0 && (
                <Button variant="secondary" size="sm" onClick={clearIngestedDocuments}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Clear session
                </Button>
              )}
            </div>
          </div>

          {progress && (
            <div className="mt-3 flex items-center gap-3 rounded-[4px] border border-accent/30 bg-primary-soft px-3 py-2 text-xs text-ink">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />
              <span className="min-w-0 flex-1 truncate">
                Parsing {progress.name} ({progress.index}/{progress.total})
              </span>
              <span className="h-1.5 w-28 overflow-hidden rounded-full bg-primary/20">
                <span
                  className="block h-full rounded-full bg-primary transition-all"
                  style={{ width: `${(progress.index / progress.total) * 100}%` }}
                />
              </span>
            </div>
          )}

          {error && (
            <p className="mt-3 flex items-center gap-2 rounded-[4px] border border-status-critical/30 bg-status-critical-soft px-3 py-2 text-xs text-status-critical">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <p className="mt-3 text-xs leading-normal text-ink-3">
            Pipeline: Read bytes → parse document structure → extract table rows & fields (well,
            date, depth, mud weight, hazards) → confidence scoring → workspace register.
          </p>
        </div>

        {/* Ingested this session */}
        {ingestedDocuments.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink">
              <CheckCircle2 className="h-4 w-4 text-status-ok" />
              <span>Ingested documents ({ingestedDocuments.length})</span>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {ingestedDocuments.map((doc) => {
                const isOpen = openId === doc.id;
                return (
                  <div
                    key={doc.id}
                    className="rounded-[6px] border border-line bg-surface p-3.5 text-ink"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-ink">{doc.name}</div>
                        <div className="mt-0.5 text-xs text-ink-3">
                          {doc.kind} · {doc.wellId} · {doc.date}
                        </div>
                      </div>
                      <Badge variant={doc.status === "Validated" ? "ok" : "moderate"}>
                        {doc.status}
                      </Badge>
                    </div>

                    <dl className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                      {[
                        ["Size", doc.size],
                        ["Rows", String(doc.rows)],
                        ["Cols", String(doc.columns)],
                        ["Pages", String(doc.pages)],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-[4px] bg-surface-muted px-1.5 py-1">
                          <dt className="text-xs text-ink-3">{label}</dt>
                          <dd className="text-xs font-semibold tabular-nums text-ink">{value}</dd>
                        </div>
                      ))}
                    </dl>

                    <p className="mt-2 truncate text-xs text-ink-3" title={doc.parser}>
                      Parser: {doc.parser}
                    </p>

                    {doc.warnings.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {doc.warnings.map((warning) => (
                          <li
                            key={warning}
                            className="flex items-start gap-1.5 text-xs text-status-high"
                          >
                            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                            <span>{warning}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {doc.fields.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {doc.fields.map((field) => (
                          <span
                            key={field.label}
                            className="inline-flex items-center gap-1 rounded-[3px] border border-line bg-surface-muted px-1.5 py-0.5 text-xs"
                          >
                            <span className="text-ink-3">{field.label}:</span>
                            <span className="font-semibold text-ink">{field.value}</span>
                            <Badge
                              variant={
                                field.confidence === "HIGH"
                                  ? "ok"
                                  : field.confidence === "MEDIUM"
                                  ? "moderate"
                                  : "neutral"
                              }
                            >
                              {field.confidence}
                            </Badge>
                          </span>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : doc.id)}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover"
                    >
                      {isOpen ? <X className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
                      {isOpen ? "Hide extracted data" : "Inspect extracted data"}
                    </button>

                    {isOpen && (
                      <div className="mt-2 max-h-64 overflow-auto rounded-[4px] border border-line bg-surface-muted p-2 text-xs">
                        {doc.cells.length > 1 ? (
                          <table className="w-full border-collapse text-left text-xs">
                            <tbody>
                              {doc.cells.slice(0, 40).map((row, rowIndex) => (
                                <tr
                                  key={rowIndex}
                                  className={
                                    rowIndex === 0
                                      ? "bg-line/40 font-semibold"
                                      : "border-t border-line"
                                  }
                                >
                                  {row.slice(0, 8).map((cell, cellIndex) => (
                                    <td
                                      key={cellIndex}
                                      className="max-w-[140px] truncate px-1.5 py-1 align-top text-ink"
                                      title={cell}
                                    >
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-ink">
                            {doc.preview || "No text layer extracted."}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Reference Corpus */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <div>
              <h2 className="text-xs font-semibold text-ink">Reference document register</h2>
              <p className="text-xs text-ink-3">
                Verified Oil India well completion reports and daily drilling workbooks
              </p>
            </div>
            <ProvenanceChip
              source="Oil India master register"
              recordCount={documents.length}
              simulatedCount={0}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {documents.map((doc) => {
              const Icon = kindIcon(doc.kind as ParsedDocument["kind"]);
              return (
                <div
                  key={doc.name}
                  className="rounded-[6px] border border-line bg-surface p-3.5 text-ink hover:border-line-strong transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Icon className="h-4 w-4 text-accent" />
                      <Badge variant={doc.status === "Validated" ? "ok" : "moderate"}>
                        {doc.status}
                      </Badge>
                    </div>
                    <div className="text-xs font-semibold text-ink leading-snug">{doc.name}</div>
                    <div className="mt-1 text-xs text-ink-3">
                      {doc.kind} · Well {doc.wellId}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-xs text-ink-3">
                    <span>{doc.pages} pages</span>
                    <span className="tabular-nums">{doc.date}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
