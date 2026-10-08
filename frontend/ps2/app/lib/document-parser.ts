export type ExtractedField = { label: string; value: string; confidence: "HIGH" | "MEDIUM" | "LOW" };

export type ParsedDocument = {
  id: string;
  name: string;
  kind: "WCR" | "DDR" | "Excel" | "PDF" | "Scan" | "Word" | "Text" | "Other";
  wellId: string;
  date: string;
  sizeBytes: number;
  pages: number;
  rows: number;
  columns: number;
  preview: string;
  cells: string[][];
  fields: ExtractedField[];
  parser: string;
  warnings: string[];
};

const decoder = new TextDecoder("utf-8");

function readAscii(bytes: Uint8Array): string {
  let result = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    result += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return result;
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === "undefined") return null;
  try {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const buffer = await new Response(stream).arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    return null;
  }
}

type ZipEntry = { name: string; method: number; compressedSize: number; uncompressedSize: number; offset: number };

function readZipEntries(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 66_000); index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) return [];

  const entryCount = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) break;
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const offset = view.getUint32(cursor + 42, true);
    const name = readAscii(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    entries.push({ name, method, compressedSize, uncompressedSize, offset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function readZipEntry(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array | null> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(entry.offset, true) !== 0x04034b50) return null;
  const nameLength = view.getUint16(entry.offset + 26, true);
  const extraLength = view.getUint16(entry.offset + 28, true);
  const dataStart = entry.offset + 30 + nameLength + extraLength;
  const raw = bytes.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return raw;
  if (entry.method === 8) return inflateRaw(raw);
  return null;
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&");
}

function columnIndexFromRef(reference: string) {
  const letters = reference.match(/^[A-Z]+/)?.[0] ?? "A";
  let index = 0;
  for (const character of letters) index = index * 26 + (character.charCodeAt(0) - 64);
  return index - 1;
}

function parseDelimited(text: string) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [] as string[][];
  const delimiter = (lines[0].split("\t").length ?? 0) > (lines[0].split(",").length ?? 0) ? "\t" : lines[0].includes(",") ? "," : /\s{2,}/;
  return lines.slice(0, 400).map((line) => line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, "")));
}

function parseXlsxSharedStrings(xml: string) {
  const strings: string[] = [];
  const pattern = /<si>([\s\S]*?)<\/si>/g;
  let match = pattern.exec(xml);
  while (match) {
    const parts = [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((item) => decodeXmlEntities(item[1]));
    strings.push(parts.join(""));
    match = pattern.exec(xml);
  }
  return strings;
}

function parseXlsxSheet(xml: string, shared: string[]) {
  const rows: string[][] = [];
  const rowPattern = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch = rowPattern.exec(xml);
  while (rowMatch) {
    const cells: string[] = [];
    const cellPattern = /<c\s([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch = cellPattern.exec(rowMatch[1]);
    while (cellMatch) {
      const attributes = cellMatch[1] ?? "";
      const body = cellMatch[2] ?? "";
      const reference = attributes.match(/r="([A-Z]+\d+)"/)?.[1];
      const type = attributes.match(/t="([^"]+)"/)?.[1];
      let value = "";
      if (type === "inlineStr") {
        value = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((item) => decodeXmlEntities(item[1])).join("");
      } else {
        const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
        const index = type === "s" ? Number.parseInt(raw, 10) : Number.NaN;
        value = Number.isFinite(index) ? (shared[index] ?? "") : decodeXmlEntities(raw);
      }
      const position = reference ? columnIndexFromRef(reference) : cells.length;
      while (cells.length < position) cells.push("");
      cells[position] = value;
      cellMatch = cellPattern.exec(rowMatch[1]);
    }
    rows.push(cells);
    if (rows.length >= 400) break;
    rowMatch = rowPattern.exec(xml);
  }
  return rows;
}

function parseDocxText(xml: string) {
  return xml
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map((line) => decodeXmlEntities(line).trim())
    .filter((line) => line.length > 0)
    .slice(0, 400);
}

function decodePdfString(raw: string) {
  return raw
    .replace(/\\([nrtbf()\\])/g, (_, code) => (code === "n" ? "\n" : code === "r" ? "\r" : code === "t" ? "\t" : code))
    .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(Number.parseInt(octal, 8)))
    .replace(/\\(.)/g, "$1");
}

async function parsePdfText(bytes: Uint8Array) {
  const raw = readAscii(bytes);
  const pageCount = (raw.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  const chunks: string[] = [];
  const streamPattern = /stream\r?\n/g;
  let match = streamPattern.exec(raw);

  while (match && chunks.length < 3) {
    const start = match.index + match[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    const slice = bytes.subarray(start, end);
    let text = "";
    if (slice.length > 0) {
      const inflated = slice.length > 2 && slice[0] === 0x78 ? await inflateRaw(slice) : null;
      const source = inflated ? readAscii(inflated) : "";
      if (source) {
        const operators = [...source.matchAll(/\[((?:[^\]\\]|\\.)*)\]\s*TJ|\(((?:[^()\\]|\\.)*)\)\s*Tj/g)];
        for (const operator of operators) {
          if (operator[1] !== undefined) {
            const parts = [...operator[1].matchAll(/\(((?:[^()\\]|\\.)*)\)/g)].map((item) => decodePdfString(item[1]));
            text += `${parts.join("")} `;
          } else if (operator[2] !== undefined) {
            text += `${decodePdfString(operator[2])} `;
          }
        }
      }
    }
    if (text.trim()) chunks.push(text.replace(/\s+/g, " ").trim());
    streamPattern.lastIndex = end + 9;
    match = streamPattern.exec(raw);
  }

  return { pages: pageCount, text: chunks.join("\n").slice(0, 6000) };
}

function extractFields(text: string, fileName: string, parsedRows: string[][]) {
  const fields: ExtractedField[] = [];
  const push = (label: string, value: string | undefined, confidence: ExtractedField["confidence"]) => {
    if (value && !fields.some((field) => field.label === label)) fields.push({ label, value, confidence });
  };

  push("Well ID", fileName.match(/(WX-\d+)/i)?.[1]?.toUpperCase() ?? text.match(/\b(WX-\d+)\b/i)?.[1]?.toUpperCase(), "HIGH");
  push("Document date", text.match(/\b(20\d{2}[-/]\d{2}[-/]\d{2})\b/)?.[1]?.replace(/\//g, "-") ?? fileName.match(/(20\d{2})[_-](\d{2})[_-](\d{2})/)?.slice(1).join("-"), "HIGH");
  push("Max depth", text.match(/(\d[\d,]{2,})\s*(?:m|MD|meters)/)?.[0] ?? parsedRows.flat().find((cell) => /^\d{3,4}(\.\d)?$/.test(cell)) ?? undefined, "MEDIUM");
  push("Mud weight", text.match(/\b(1\.[0-4]\d)\s*(?:g\/cm3|g\/cm³|sg|ppg)/i)?.[0], "MEDIUM");
  push("ROP", text.match(/\b(\d{1,2}(?:\.\d)?)\s*m\/h(?:r)?/i)?.[0], "LOW");
  push("WOB", text.match(/\b(\d{1,2}(?:\.\d)?)\s*(?:t|tonne|k-lb)\b/i)?.[0], "LOW");
  return fields;
}

function inferKind(name: string, mime: string): ParsedDocument["kind"] {
  const lower = name.toLowerCase();
  if (lower.includes("wcr")) return "WCR";
  if (lower.includes("ddr")) return "DDR";
  if (/\.xlsx?$/.test(lower) || lower.includes("excel") || mime.includes("sheet")) return "Excel";
  if (/\.docx?$/.test(lower) || mime.includes("wordprocessing")) return "Word";
  if (/\.pdf$/.test(lower) || mime === "application/pdf") return "PDF";
  if (/\.(tif|tiff|png|jpe?g)$/.test(lower) || mime.startsWith("image/")) return "Scan";
  if (/\.(csv|tsv|txt|md)$/.test(lower) || mime.startsWith("text/")) return "Text";
  return "Other";
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function parseDocumentFile(file: File): Promise<ParsedDocument> {
  const warnings: string[] = [];
  const kind = inferKind(file.name, file.type);
  const bytes = new Uint8Array(await file.arrayBuffer());
  let cells: string[][] = [];
  let preview = "";
  let pages = 1;
  let parser = "metadata only";

  try {
    if (kind === "Excel" || /\.xlsx$/i.test(file.name)) {
      const entries = readZipEntries(bytes);
      const sharedEntry = entries.find((entry) => entry.name === "xl/sharedStrings.xml");
      const sheetEntry = entries.find((entry) => entry.name === "xl/worksheets/sheet1.xml") ?? entries.find((entry) => entry.name.startsWith("xl/worksheets/"));
      if (sharedEntry && sheetEntry) {
        const sharedBuffer = await readZipEntry(bytes, sharedEntry);
        const sheetBuffer = await readZipEntry(bytes, sheetEntry);
        if (sharedBuffer && sheetBuffer) {
          cells = parseXlsxSheet(decoder.decode(sheetBuffer), parseXlsxSharedStrings(decoder.decode(sharedBuffer)));
          parser = "XLSX (zip + sharedStrings + sheet1)";
        }
      }
      if (cells.length === 0) {
        cells = parseDelimited(decoder.decode(bytes));
        parser = "delimited fallback";
        warnings.push("Workbook structure not recognised — fell back to text parsing.");
      }
    } else if (kind === "Word" || /\.docx$/i.test(file.name)) {
      const entries = readZipEntries(bytes);
      const documentEntry = entries.find((entry) => entry.name === "word/document.xml");
      const buffer = documentEntry ? await readZipEntry(bytes, documentEntry) : null;
      if (buffer) {
        const lines = parseDocxText(decoder.decode(buffer));
        cells = lines.map((line) => [line]);
        parser = "DOCX (zip + word/document.xml)";
      } else {
        warnings.push("Word package could not be opened.");
      }
    } else if (kind === "PDF") {
      const result = await parsePdfText(bytes);
      preview = result.text;
      pages = Math.max(1, result.pages);
      cells = result.text ? result.text.split(/(?<=\.)\s+/).slice(0, 200).map((sentence) => [sentence]) : [];
      parser = result.text ? "PDF content streams (FlateDecode + text operators)" : "PDF structure scan";
      if (!result.text) warnings.push("No extractable text layer — this PDF may be a scan and would need OCR.");
    } else if (kind === "Text") {
      cells = parseDelimited(decoder.decode(bytes));
      parser = /\.(csv|tsv)$/i.test(file.name) ? "CSV/TSV parse" : "plain text parse";
    } else {
      warnings.push("Binary or image format — metadata captured, text extraction requires OCR.");
    }
  } catch (error) {
    warnings.push(`Parser error: ${error instanceof Error ? error.message : "unknown"}`);
  }

  if (kind === "Scan") pages = pages || 1;
  const flat = cells.flat().join(" ");
  if (!preview) preview = cells.slice(0, 8).map((row) => row.join(" · ")).join("\n").slice(0, 1200);
  const fields = extractFields(flat || preview, file.name, cells);
  const columns = cells.reduce((widest, row) => Math.max(widest, row.length), 0);

  return {
    id: `UP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: file.name,
    kind,
    wellId: fields.find((field) => field.label === "Well ID")?.value ?? "Unassigned",
    date: fields.find((field) => field.label === "Document date")?.value ?? new Date().toISOString().slice(0, 10),
    sizeBytes: file.size,
    pages: kind === "Text" || kind === "Excel" ? Math.max(1, cells.length) : pages,
    rows: cells.length,
    columns,
    preview: preview.slice(0, 1500),
    cells: cells.slice(0, 40),
    fields,
    parser: `${parser} · ${formatSize(file.size)}`,
    warnings,
  };
}

export function parsedToDocumentItem(parsed: ParsedDocument) {
  return {
    name: parsed.name,
    kind: parsed.kind === "Word" || parsed.kind === "Text" || parsed.kind === "Other" ? ("PDF" as const) : (parsed.kind as "WCR" | "DDR" | "Excel" | "PDF" | "Scan"),
    wellId: parsed.wellId,
    date: parsed.date,
    status: parsed.warnings.length === 0 ? ("Validated" as const) : ("Pending" as const),
    pages: parsed.pages,
  };
}
