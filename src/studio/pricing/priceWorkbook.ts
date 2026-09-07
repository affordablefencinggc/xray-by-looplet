import { Unzip, UnzipInflate, zipSync } from "fflate";
import * as XLSX from "xlsx";
import { PRICE_CSV_LIMIT, type CsvTable } from "./priceBooks.ts";
import type { PriceWorkbook } from "./priceWorkbookTable.ts";

export const WORKBOOK_EXPANDED_LIMIT = 20 * 1024 * 1024;
const MAX_ROWS = 5100, MAX_COLUMNS = 40, MAX_SHEETS = 50;

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index; for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(bytes: Uint8Array) { let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
function workbookDirectory(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  if (end < 0) throw Error("Workbook ZIP directory is missing or truncated.");
  const count = view.getUint16(end + 10, true), size = view.getUint32(end + 12, true), offset = view.getUint32(end + 16, true);
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || view.getUint16(end + 8, true) !== count || !count || count > 2000 || offset + size !== end)
    throw Error("Split, ZIP64 or oversized workbook archives are not supported.");
  const records = new Map<string, { size: number; crc: number }>(); let at = offset, declaredSize = 0;
  for (let i = 0; i < count; i++) {
    if (at + 46 > end || view.getUint32(at, true) !== 0x02014b50) throw Error("Workbook ZIP directory is invalid.");
    const flags = view.getUint16(at + 8, true), method = view.getUint16(at + 10, true), compressed = view.getUint32(at + 20, true), uncompressed = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true), extraLength = view.getUint16(at + 30, true), commentLength = view.getUint16(at + 32, true);
    if (flags & 1 || ![0, 8].includes(method) || compressed === 0xffffffff || uncompressed === 0xffffffff || at + 46 + nameLength + extraLength + commentLength > end)
      throw Error("Encrypted or unsupported workbook compression cannot be imported.");
    const name = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(at + 46, at + 46 + nameLength));
    if (records.has(name)) throw Error("Workbook ZIP directory contains duplicate file names.");
    declaredSize += uncompressed;
    if (declaredSize > WORKBOOK_EXPANDED_LIMIT) throw Error("Workbook expands beyond the 20 MB reading limit. Export only the supplier sheet you need.");
    records.set(name, { size: uncompressed, crc: view.getUint32(at + 16, true) });
    at += 46 + nameLength + extraLength + commentLength;
  }
  if (at !== end) throw Error("Workbook ZIP directory length is inconsistent.");
  return records;
}

/** Inspect actual streamed output, not attacker-supplied ZIP size declarations. */
export function boundedWorkbookArchive(bytes: Uint8Array): Uint8Array {
  if (!bytes.length || bytes.length > PRICE_CSV_LIMIT) throw Error("Choose a non-empty XLSX file up to 2 MB.");
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 3 || bytes[3] !== 4) throw Error("This is not an XLSX workbook. Save legacy XLS or encrypted workbooks as an unencrypted .xlsx file.");
  const directory = workbookDirectory(bytes);
  const files: Record<string, Uint8Array> = Object.create(null);
  let expanded = 0, entries = 0, finished = 0, failure: Error | null = null;
  const names = new Set<string>();
  const unzip = new Unzip(file => {
    entries++;
    if (entries > 2000 || names.has(file.name) || file.name.includes("..") || file.name.startsWith("/") || file.name.includes("\\")) throw Error("Workbook archive contains unsupported or duplicate entries.");
    names.add(file.name);
    const expected = directory.get(file.name);
    if (!expected) throw Error("Workbook ZIP contents do not match its directory.");
    if (/vbaProject\.bin$|^xl\/macrosheets\//i.test(file.name)) throw Error("Macro-enabled workbooks are not supported. Export a values-only .xlsx workbook.");
    const chunks: Uint8Array[] = []; let length = 0;
    file.ondata = (error, chunk, final) => {
      if (error) { failure = error; throw error; }
      expanded += chunk.length; length += chunk.length;
      if (expanded > WORKBOOK_EXPANDED_LIMIT) { file.terminate(); throw Error("Workbook expands beyond the 20 MB reading limit. Export only the supplier sheet you need."); }
      chunks.push(chunk);
      if (final) {
        const content = new Uint8Array(length); let offset = 0;
        for (const part of chunks) { content.set(part, offset); offset += part.length; }
        if (length !== expected.size || crc32(content) !== expected.crc) throw Error("Workbook ZIP entry failed its size or checksum check.");
        files[file.name] = content; finished++;
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  // Small input chunks also bound the amount any one inflate callback can emit.
  for (let offset = 0; offset < bytes.length; offset += 1024) unzip.push(bytes.subarray(offset, Math.min(bytes.length, offset + 1024)), offset + 1024 >= bytes.length);
  if (failure) throw failure;
  if (finished !== entries || entries !== directory.size || !files["[Content_Types].xml"] || !files["xl/workbook.xml"]) throw Error("Workbook archive is incomplete or missing its worksheet catalogue.");
  // Parse only the verified bounded payload; the parser never receives unchecked compressed input.
  return zipSync(files, { level: 0 });
}

export function readPriceWorkbook(bytes: Uint8Array): PriceWorkbook {
  const safeBytes = boundedWorkbookArchive(bytes);
  const workbook = XLSX.read(safeBytes, { type: "array", cellFormula: true, cellHTML: false, cellNF: true,
    cellDates: false, sheetStubs: true, sheetRows: MAX_ROWS + 1, bookVBA: false, WTF: true });
  if (!workbook.SheetNames.length || workbook.SheetNames.length > MAX_SHEETS) throw Error("Choose a workbook with 1 to 50 worksheets.");
  const sheets = workbook.SheetNames.map(name => {
    const sheet = workbook.Sheets[name], rows = new Map<number, CsvTable["records"][number]>();
    let columns = 0, issue: string | undefined, formulaCells = 0;
    const fullRange = sheet["!fullref"] ?? sheet["!ref"];
    if (fullRange) {
      const range = XLSX.utils.decode_range(fullRange);
      if (range.e.r >= MAX_ROWS || range.e.c >= MAX_COLUMNS) issue = "This worksheet exceeds 5,100 rows or 40 columns. Export a smaller supplier table.";
    }
    if (!issue) {
      for (const [address, cell] of Object.entries(sheet)) {
        if (address.startsWith("!")) continue;
        const location = XLSX.utils.decode_cell(address), sourceLine = location.r + 1;
        if (sourceLine > MAX_ROWS || location.c >= MAX_COLUMNS) { issue = "This worksheet exceeds 5,100 rows or 40 columns."; break; }
        const record = rows.get(sourceLine) ?? { line: sourceLine, cells: [], cellErrors: {}, numericValues: {} };
        const value = cell as XLSX.CellObject;
        let text = "", error = "";
        if (value.f !== undefined || value.F !== undefined) { formulaCells++; error = `Cell ${address} contains a formula. Replace it with a reviewed constant value before importing this column.`; }
        else if (value.t === "e") error = `Cell ${address} contains a spreadsheet error.`;
        else if (value.t === "b") error = `Cell ${address} contains a boolean, not a price-sheet value.`;
        else if (value.t === "d" || (value.t === "n" && value.z && XLSX.SSF.is_date(value.z))) error = `Cell ${address} is a date. Map a text or numeric column instead.`;
        else if (value.v !== undefined && value.v !== null) {
          text = value.t === "n" ? value.w ?? String(value.v) : String(value.v);
          if (value.t === "n") record.numericValues![location.c] = String(value.v);
        }
        if (text.length > 4000) error = `Cell ${address} exceeds 4,000 characters.`;
        record.cells[location.c] = error ? "" : text;
        if (error) record.cellErrors![location.c] = error;
        rows.set(sourceLine, record); columns = Math.max(columns, location.c + 1);
      }
      for (const range of sheet["!merges"] ?? []) {
        // No inherited/repeated merged value is invented, including the top-left anchor.
        for (let r = range.s.r; r <= Math.min(range.e.r, MAX_ROWS - 1); r++) for (let c = range.s.c; c <= Math.min(range.e.c, MAX_COLUMNS - 1); c++) {
          const record = rows.get(r + 1); if (record) record.cellErrors![c] = `Cell ${XLSX.utils.encode_cell({ r, c })} is merged. Unmerge mapped data cells before importing.`;
        }
      }
    }
    return { name, issue, formulaCells, rows: issue ? [] : [...rows.values()].sort((a, b) => a.line - b.line).map(row => ({ ...row, cells: Array.from({ length: columns }, (_, index) => row.cells[index] ?? "") })) };
  });
  return { sheets };
}
