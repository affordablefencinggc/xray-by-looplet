import { z } from "zod";
import { ALTITUDE_SHA, persistTakeoff, takeoffKey, takeoffSchema, type SourceTakeoff, type TakeoffSession } from "./altitudeTakeoff.ts";
import { materialErrorMessage, materialLineSchema, materialLinesSchema, type MaterialLine } from "./materialRegister.ts";

export const TRANSFER_LIMIT_BYTES = 5 * 1024 * 1024;
export const BACKUP_LIMIT_BYTES = 25 * 1024 * 1024;
export const CSV_HEADERS = ["Stock code", "Description", "Stock quantity", "Unit", "Units per package", "Package length m", "Package width m", "Package height m", "Specified kg", "Weight basis", "Source reference"];
export const materialCsvTemplate = () => CSV_HEADERS.join(",") + "\r\n";
const allowedHeaders = [...CSV_HEADERS, "Package count", "Capacity of counted packages", "Storage m3", "Calculated weight kg", "Revision", "Project", "Drawing SHA-256", "Text encoding"].map(h => h.toLowerCase());
function sizeCheck(text: string, limit = TRANSFER_LIMIT_BYTES) {
  if (new TextEncoder().encode(text).length > limit) throw Error(`File exceeds the ${limit / 1024 / 1024} MB import limit.`);
}
// Comma-separated UTF-8, including escaped quotes and multiline quoted cells.
export function parseCsv(text: string): string[][] {
  sizeCheck(text); text = text.replace(/^\uFEFF/, "");
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false, closed = false;
  const endCell = () => { row.push(cell); cell = ""; closed = false; if (row.length > 40) throw Error("CSV has too many columns."); };
  const endRow = () => { endCell(); if (row.some(v => v.trim() !== "")) rows.push(row); row = []; if (rows.length > 5001) throw Error("Import at most 5,000 material lines."); };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } }
      else cell += c;
    } else if (c === ",") endCell();
    else if (c === "\r" || c === "\n") { if (c === "\r" && text[i + 1] === "\n") i++; endRow(); }
    else if (closed) throw Error("Unexpected text after a closing CSV quote.");
    else if (c === '"') { if (cell !== "") throw Error("Quotes must enclose the entire CSV field."); quoted = true; }
    else cell += c;
  }
  if (quoted) throw Error("CSV has an unclosed quoted field.");
  if (cell !== "" || row.length || closed) endRow();
  return rows;
}
export function parseMaterialCsv(text: string, makeId: () => string = () => crypto.randomUUID()): MaterialLine[] {
  const [head, ...rows] = parseCsv(text);
  if (!head || !rows.length) throw Error("CSV needs a header and at least one material line.");
  const headers = head.map(h => h.trim().toLowerCase());
  if (new Set(headers).size !== headers.length) throw Error("CSV contains duplicate column headings.");
  for (const header of headers) if (!allowedHeaders.includes(header)) throw Error(`Unknown CSV column: ${header}. Use the template headings.`);
  for (const required of ["stock code", "description", "unit", "source reference"]) if (!headers.includes(required)) throw Error(`Missing CSV column: ${required}.`);
  const errors: string[] = [], lines: MaterialLine[] = [];
  rows.forEach((cells, index) => {
    try {
      if (cells.length !== headers.length) throw Error("Column count does not match the header.");
      const get = (name: string) => cells[headers.indexOf(name)] ?? "";
      const encoding = get("text encoding");
      if (encoding && encoding !== "xray-apostrophe/v1") throw Error("Unsupported CSV text encoding.");
      const string = (name: string) => { const v = get(name); return encoding && v.startsWith("'") && /^[\s]*[=+@'-]/.test(v.slice(1)) ? v.slice(1) : v; };
      const numeric = (name: string) => {
        const v = get(name).trim(); if (!v) return null;
        if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(v)) throw Error(`${name} must be a decimal number, without units or thousands separators.`);
        const n = Number(v); if (!Number.isFinite(n)) throw Error(`${name} must be finite.`); return n;
      };
      if (get("drawing sha-256").trim() && get("drawing sha-256").trim() !== ALTITUDE_SHA) throw Error("This CSV references another drawing.");
      const unit = string("unit").trim().toLowerCase().replace("²", "2").replace("³", "3");
      lines.push(materialLineSchema.parse({ id: makeId(), stockCode: string("stock code"), description: string("description"),
        quantity: numeric("stock quantity"), unit, unitsPerPackage: numeric("units per package"), lengthM: numeric("package length m"),
        widthM: numeric("package width m"), heightM: numeric("package height m"), specifiedWeightKg: numeric("specified kg"),
        weightBasis: string("weight basis").trim().toLowerCase() || "unit", reference: string("source reference"), revision: 1 }));
    } catch (error) { if (errors.length < 20) errors.push(`Record ${index + 1}: ${materialErrorMessage(error)}`); }
  });
  if (errors.length) throw Error(errors.join("\n"));
  return materialLinesSchema.parse(lines);
}
const comparable = (line: MaterialLine) => { const { id: _id, revision: _revision, ...fields } = line; return JSON.stringify(fields); };
export type TransferChange = { code: string; action: "Add" | "Update" | "Keep" | "Remove"; before: MaterialLine | null; after: MaterialLine | null };
export type TransferPreview = { kind: "csv" | "backup"; value: SourceTakeoff; base: string; raw: string | null; changes: TransferChange[]; fromProject: string };
export function previewMaterialImport(session: TakeoffSession, incoming: MaterialLine[], updateMatches: boolean): TransferPreview {
  if (session.blocked) throw Error("Recover the saved inventory before importing CSV.");
  const parsed = materialLinesSchema.parse(incoming), values = [...session.value.materials], changes: TransferChange[] = [];
  for (const line of parsed) {
    const index = values.findIndex(v => v.stockCode.toLowerCase() === line.stockCode.toLowerCase()), old = values[index];
    if (old && !updateMatches) throw Error(`Stock code ${line.stockCode} already exists. Enable updates to preview replacing its fields.`);
    const changed = old && comparable(old) !== comparable(line);
    const next = old ? changed ? { ...line, id: old.id, revision: old.revision + 1 } : old : line;
    if (old) values[index] = next; else values.push(next);
    changes.push({ code: line.stockCode, action: old ? changed ? "Update" : "Keep" : "Add", before: old ?? null, after: next });
  }
  return { kind: "csv", value: takeoffSchema.parse({ ...session.value, revision: session.value.revision + 1, materials: values }),
    base: JSON.stringify(session.value), raw: session.raw, changes, fromProject: session.value.projectId };
}
const backupSchema = z.object({ schema: z.literal("xray.source-takeoff-backup/v1"), exportedAt: z.string().datetime(), inventory: takeoffSchema }).strict();
export function takeoffBackup(value: SourceTakeoff): string {
  return JSON.stringify(backupSchema.parse({ schema: "xray.source-takeoff-backup/v1", exportedAt: new Date().toISOString(), inventory: value }), null, 2);
}
export function parseTakeoffBackup(text: string): SourceTakeoff {
  sizeCheck(text, BACKUP_LIMIT_BYTES); const data: unknown = JSON.parse(text.replace(/^\uFEFF/, ""));
  if (data && typeof data === "object" && "schema" in data && data.schema === "xray.source-takeoff-backup/v1") return backupSchema.parse(data).inventory;
  // Previous Export count files include explanatory/derived fields; only saved inputs are restored.
  if (data && typeof data === "object" && "schema" in data && ["xray.source-takeoff/v1", "xray.source-takeoff/v2"].includes(String(data.schema))) {
    const { status: _status, sourceDocument: _sourceDocument, groups: _groups, stock: _stock, ...value } = data as Record<string, unknown>;
    return takeoffSchema.parse(value);
  }
  throw Error("Unsupported backup format or version.");
}
export function previewBackupRestore(session: TakeoffSession, backup: SourceTakeoff): TransferPreview {
  const parsed = takeoffSchema.parse(backup), current = session.value;
  const materials = parsed.materials.map(line => ({ ...line, revision: Math.max(line.revision, current.materials.find(m => m.id === line.id)?.revision ?? 0) + 1 }));
  const value = takeoffSchema.parse({ ...parsed, projectId: current.projectId, revision: Math.max(current.revision, parsed.revision) + 1, materials,
    rows: parsed.rows.map(row => ({ ...row, review: "pending", revision: Math.max(row.revision, current.rows.find(r => r.id === row.id)!.revision) + 1 })) });
  const changes: TransferChange[] = materials.map(line => {
    const old = current.materials.find(m => m.id === line.id); return { code: line.stockCode, action: old ? "Update" : "Add", before: old ?? null, after: line };
  });
  for (const old of current.materials) if (!materials.some(m => m.id === old.id)) changes.push({ code: old.stockCode, action: "Remove", before: old, after: null });
  return { kind: "backup", value, base: JSON.stringify(current), raw: session.raw, changes, fromProject: parsed.projectId };
}
type StoragePort = Pick<Storage, "getItem" | "setItem">;
export function applyTakeoffTransfer(storage: StoragePort, session: TakeoffSession, preview: TransferPreview, archiveId: string): TakeoffSession & { archiveKey?: string } {
  try {
    if (preview.base !== JSON.stringify(session.value) || preview.raw !== session.raw) throw Error("Inventory changed since preview. Cancel and select the file again.");
    const next = takeoffSchema.parse(preview.value);
    if (next.projectId !== session.value.projectId) throw Error("Project identity changed.");
    if (preview.kind === "csv") return persistTakeoff(storage, session, next);
    const key = takeoffKey(next.projectId), original = storage.getItem(key);
    if (original !== preview.raw) throw Error("Saved inventory changed since preview. Retry restore before applying this backup.");
    let archiveKey: string | undefined;
    if (original !== null) {
      archiveKey = `${key}:recovery:${archiveId}`;
      if (!archiveId || storage.getItem(archiveKey) !== null) throw Error("Recovery archive already exists. Select the backup again.");
      storage.setItem(archiveKey, original);
      if (storage.getItem(archiveKey) !== original) throw Error("Previous snapshot could not be preserved. Restore cancelled.");
    }
    const raw = JSON.stringify(next); storage.setItem(key, raw);
    return { value: next, raw, blocked: false, error: null, archiveKey };
  } catch (error) { return { ...session, error: `Import was not applied: ${materialErrorMessage(error)}` }; }
}
