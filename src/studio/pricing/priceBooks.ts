import { z } from "zod";

export const PRICE_CSV_LIMIT = 2 * 1024 * 1024;
export const PRICE_LIBRARY_LIMIT = 4 * 1024 * 1024;
const shortText = z.string().trim().min(1).max(200);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const parsed = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === v;
}, "Use a valid effective date.");
export const priceMetadataSchema = z.object({
  supplier: shortText,
  currency: z.string().regex(/^[A-Z]{3}$/, "Enter a three-letter currency code."),
  amountDecimals: z.number().int().min(0).max(4),
  taxBasis: z.enum(["exclusive", "inclusive", "unspecified"]),
  taxPercent: z.number().finite().min(0).max(100).nullable(),
  effectiveDate: date,
  sourceReference: z.string().trim().min(1).max(2000),
}).strict().refine(v => v.taxBasis !== "unspecified" || v.taxPercent === null, "Unknown tax basis cannot have an assumed tax percentage.");
export type PriceMetadata = z.infer<typeof priceMetadataSchema>;
export const priceRowSchema = z.object({
  sourceLine: z.number().int().positive(),
  stockCode: z.string().trim().max(100), description: z.string().trim().min(1).max(300),
  unit: z.string().trim().min(1).max(40), rate: z.number().finite().nonnegative().max(1e9).refine(v => Number(v.toFixed(6)) === v, "Rate supports up to six decimal places."),
}).strict();
export type PriceRow = z.infer<typeof priceRowSchema>;
const column = z.number().int().min(0).max(39);
export const priceMappingSchema = z.object({ stockCode: column.nullable(), description: column, unit: column, rate: column }).strict()
  .refine(v => { const columns = Object.values(v).filter(n => n !== null); return new Set(columns).size === columns.length; }, "Map each field to a different column.");
export type PriceMapping = z.infer<typeof priceMappingSchema>;
export const priceImportSchema = z.object({
  metadata: priceMetadataSchema,
  source: z.object({ fileName: z.string().min(1).max(255), sha256: z.string().regex(/^[a-f0-9]{64}$/),
    sizeBytes: z.number().int().positive().max(PRICE_CSV_LIMIT), delimiter: z.enum([",", ";", "\t"]).optional(),
    kind: z.enum(["csv", "xlsx"]).optional(), worksheet: z.string().min(1).max(200).optional(), headerRow: z.number().int().min(1).max(100).optional(),
    headers: z.array(z.string().max(300)).min(1).max(40), mapping: priceMappingSchema }).strict().superRefine((source, ctx) => {
      if (source.kind === "xlsx") {
        if (!source.worksheet || source.headerRow === undefined || source.delimiter !== undefined) ctx.addIssue({ code: "custom", message: "Workbook provenance needs a worksheet and header row, with no CSV separator." });
      } else if (!source.delimiter || source.worksheet !== undefined) ctx.addIssue({ code: "custom", message: "CSV provenance needs a separator and no workbook sheet." });
    }),
  rows: z.array(priceRowSchema).min(1).max(5000),
}).strict().superRefine((v, ctx) => {
  for (const index of Object.values(v.source.mapping)) if (index !== null && index >= v.source.headers.length)
    ctx.addIssue({ code: "custom", message: "Mapped column is outside the source header." });
  const lines = new Set<number>(), codes = new Set<string>();
  for (const row of v.rows) {
    if (lines.has(row.sourceLine)) ctx.addIssue({ code: "custom", message: "Duplicate source line." });
    lines.add(row.sourceLine);
    const code = row.stockCode.toLocaleLowerCase();
    if (code && codes.has(code)) ctx.addIssue({ code: "custom", message: `Duplicate stock code: ${row.stockCode}. Distinguish supplier variants before importing.` });
    if (code) codes.add(code);
  }
});
export type PriceImport = z.infer<typeof priceImportSchema>;
const revisionSchema = z.object({ ...priceImportSchema.shape, revision: z.number().int().positive(), importedAt: z.string().datetime() }).strict()
  .superRefine((v, ctx) => { const parsed = priceImportSchema.safeParse({ metadata: v.metadata, source: v.source, rows: v.rows });
    if (!parsed.success) for (const issue of parsed.error.issues) ctx.addIssue({ code: "custom", message: issue.message }); });
const bomKey = z.string().trim().min(1).max(500);
const decimalFactor = z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,6})?$/, "Use a decimal factor with up to six decimal places.").refine(v => Number(v) > 0 && Number(v) <= 1e6, "Factor must be greater than zero.");
/** Maps one material-register item (item code, or group key when uncoded) to a saved rate. */
export const bomMappingSchema = z.object({ key: bomKey, bookId: z.string().uuid(), bookRevision: z.number().int().positive(), sourceLine: z.number().int().positive(),
  factor: decimalFactor, rounding: z.enum(["exact", "up"]) }).strict();
export type BomMapping = z.infer<typeof bomMappingSchema>;
/** A worksheet line whose quantity is derived from a committed material-register line. */
const bomLinkSchema = z.object({ key: bomKey, commitRevision: z.number().int().positive(), bomQuantity: z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/), unit: z.string().min(1).max(20),
  factor: decimalFactor, rounding: z.enum(["exact", "up"]) }).strict();
export const priceBookLibrarySchema = z.object({
  schema: z.literal("xray.price-books/v1"), jobId: z.string().min(1).max(200), revision: z.number().int().nonnegative(),
  books: z.array(z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(120), archived: z.boolean(),
    revisions: z.array(revisionSchema).min(1).max(50) }).strict()).max(100),
  worksheet: z.array(z.object({ id: z.string().uuid(), bookId: z.string().uuid(), bookRevision: z.number().int().positive(),
    sourceLine: z.number().int().positive(), quantity: z.string().regex(/^\d{1,10}(?:\.\d{1,6})?$/).refine(v => Number(v) <= 1e9),
    addedAt: z.string().datetime(), bom: bomLinkSchema.optional() }).strict()).max(5000),
  bomMappings: z.array(bomMappingSchema).max(500).optional(),
}).strict().superRefine((v, ctx) => {
  if (new Set(v.books.map(b => b.id)).size !== v.books.length) ctx.addIssue({ code: "custom", message: "Duplicate price book identity." });
  for (const book of v.books) if (book.revisions.some((r, i) => r.revision !== i + 1))
    ctx.addIssue({ code: "custom", message: "Price book revisions must be consecutive and preserved." });
  if (v.books.reduce((n, b) => n + b.revisions.reduce((s, r) => s + r.rows.length, 0), 0) > 25000)
    ctx.addIssue({ code: "custom", message: "This project library supports up to 25,000 rate records across all revisions." });
  if (new Set(v.worksheet.map(line => line.id)).size !== v.worksheet.length) ctx.addIssue({ code: "custom", message: "Duplicate priced line identity." });
  for (const line of v.worksheet) if (!v.books.find(b => b.id === line.bookId)?.revisions.find(r => r.revision === line.bookRevision)?.rows.some(row => row.sourceLine === line.sourceLine))
    ctx.addIssue({ code: "custom", message: "A priced line references a missing source rate." });
  const rateExists = (bookId: string, bookRevision: number, sourceLine: number) => v.books.find(b => b.id === bookId)?.revisions.find(r => r.revision === bookRevision)?.rows.some(row => row.sourceLine === sourceLine);
  const mappings = v.bomMappings ?? [];
  if (new Set(mappings.map(m => m.key)).size !== mappings.length) ctx.addIssue({ code: "custom", message: "Each material register item can be mapped to one rate." });
  for (const m of mappings) if (!rateExists(m.bookId, m.bookRevision, m.sourceLine)) ctx.addIssue({ code: "custom", message: `Material mapping ${m.key} references a missing source rate.` });
  const linked = v.worksheet.filter(line => line.bom).map(line => line.bom!.key);
  if (new Set(linked).size !== linked.length) ctx.addIssue({ code: "custom", message: "A material register item can price only one worksheet line." });
});
export type PriceBookLibrary = z.infer<typeof priceBookLibrarySchema>;
export type PriceBook = PriceBookLibrary["books"][number];
export function priceBookKey(jobId: string) { return `xray:price-books:v1:${encodeURIComponent(jobId)}`; }
export function emptyPriceBookLibrary(jobId: string): PriceBookLibrary { return priceBookLibrarySchema.parse({ schema: "xray.price-books/v1", jobId, revision: 0, books: [], worksheet: [] }); }
export function parsePriceBookLibrary(raw: string, jobId: string): PriceBookLibrary {
  if (new TextEncoder().encode(raw).length > PRICE_LIBRARY_LIMIT) throw Error("Price book library exceeds 4 MB.");
  const value = priceBookLibrarySchema.parse(JSON.parse(raw));
  if (value.jobId !== jobId) throw Error("Price books belong to another project.");
  return value;
}
export function appendPriceBookRevision(library: PriceBookLibrary, incoming: PriceImport, name: string, bookId: string | null, makeId = () => crypto.randomUUID(), now = new Date().toISOString()): PriceBookLibrary {
  const current = priceBookLibrarySchema.parse(library), value = priceImportSchema.parse(incoming);
  const existing = current.books.find(b => b.id === bookId);
  if (bookId && !existing) throw Error("Price book no longer exists. Reload the library.");
  if (existing?.archived) throw Error("Restore the archived price book before adding a revision.");
  const revision = { ...value, revision: (existing?.revisions.length ?? 0) + 1, importedAt: now };
  const book = existing ? { ...existing, revisions: [...existing.revisions, revision] } : { id: makeId(), name, archived: false, revisions: [revision] };
  return priceBookLibrarySchema.parse({ ...current, revision: current.revision + 1,
    books: existing ? current.books.map(b => b.id === existing.id ? book : b) : [...current.books, book] });
}
export function editPriceBook(library: PriceBookLibrary, id: string, changes: { name?: string; archived?: boolean }): PriceBookLibrary {
  const current = priceBookLibrarySchema.parse(library);
  if (!current.books.some(b => b.id === id)) throw Error("Price book no longer exists.");
  return priceBookLibrarySchema.parse({ ...current, revision: current.revision + 1, books: current.books.map(b => b.id === id ? { ...b, ...changes } : b) });
}
export type PriceBookSession = { value: PriceBookLibrary; raw: string | null; blocked: boolean; error: string | null };
type StoragePort = Pick<Storage, "getItem" | "setItem">;
export function readPriceBooks(storage: StoragePort, jobId: string): PriceBookSession {
  let raw: string | null = null;
  try { raw = storage.getItem(priceBookKey(jobId)); return { value: raw === null ? emptyPriceBookLibrary(jobId) : parsePriceBookLibrary(raw, jobId), raw, blocked: false, error: null }; }
  catch { return { value: emptyPriceBookLibrary(jobId), raw, blocked: true, error: "Saved price books could not be read. They are preserved; saving is blocked. Reload after recovery." }; }
}
export function readBrowserPriceBooks(jobId: string): PriceBookSession {
  try { return readPriceBooks(localStorage, jobId); }
  catch { return { value: emptyPriceBookLibrary(jobId), raw: null, blocked: true, error: "Price book storage is unavailable. Saving is blocked; existing data has not been changed." }; }
}
// Called inside the browser's cross-window Web Lock by savePriceBooks.
export function persistPriceBooks(storage: StoragePort, session: PriceBookSession, value: PriceBookLibrary): PriceBookSession {
  if (session.blocked) throw Error(session.error ?? "Price book saving is blocked.");
  const raw = JSON.stringify(value), parsed = parsePriceBookLibrary(raw, session.value.jobId);
  if (parsed.revision !== session.value.revision + 1) throw Error("Price book revision changed. Reload before saving.");
  for (const original of session.value.books) {
    const next = parsed.books.find(b => b.id === original.id);
    if (!next || JSON.stringify(next.revisions.slice(0, original.revisions.length)) !== JSON.stringify(original.revisions))
      throw Error("Saved source revisions cannot be removed or overwritten. Add a new revision instead.");
  }
  if (storage.getItem(priceBookKey(parsed.jobId)) !== session.raw) throw Error("Price books changed in another window. Reload before saving; this import has not been applied.");
  storage.setItem(priceBookKey(parsed.jobId), raw);
  return { value: parsed, raw, blocked: false, error: null };
}
export async function savePriceBooks(session: PriceBookSession, value: PriceBookLibrary): Promise<PriceBookSession> {
  if (!navigator.locks) throw Error("Safe price book saving is unavailable in this browser. Use the desktop app or a secure browser connection.");
  return navigator.locks.request(priceBookKey(value.jobId), () => persistPriceBooks(localStorage, session, value));
}
export function priceBookError(error: unknown) { return error instanceof z.ZodError ? error.issues.map(i => i.message).join(" ") : error instanceof Error ? error.message : String(error); }

export type CsvTable = { headers: string[]; headerLine?: number; records: { cells: string[]; line: number; cellErrors?: Record<number, string>; numericValues?: Record<number, string> }[] };
export function parsePriceCsv(input: string, delimiter: "," | ";" | "\t" = ",", headerRow?: number): CsvTable {
  if (new TextEncoder().encode(input).length > PRICE_CSV_LIMIT) throw Error("Import a CSV up to 2 MB.");
  const text = input.replace(/^\uFEFF/, "");
  let cells: string[] = [], cell = "", quoted = false, closed = false, line = 1, startLine = 1;
  const records: CsvTable["records"] = [];
  const endCell = () => { if (cell.length > 4000) throw Error(`Line ${startLine}: a field exceeds 4,000 characters.`); cells.push(cell); cell = ""; closed = false; if (cells.length > 40) throw Error("CSV supports up to 40 columns."); };
  const endRow = () => { endCell(); if (cells.some(c => c.trim())) records.push({ cells, line: startLine }); cells = []; if (records.length > 5001) throw Error("Import up to 5,000 rates."); };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } }
      else { cell += c; if (c === "\n" || (c === "\r" && text[i + 1] !== "\n")) line++; }
    } else if (c === delimiter) endCell();
    else if (c === "\r" || c === "\n") { if (c === "\r" && text[i + 1] === "\n") i++; endRow(); line++; startLine = line; }
    else if (closed) throw Error(`Line ${line}: unexpected text after a closing quote.`);
    else if (c === '"') { if (cell) throw Error(`Line ${line}: quote the entire field.`); quoted = true; }
    else cell += c;
  }
  if (quoted) throw Error(`Line ${startLine}: unclosed quoted field.`);
  if (cell || cells.length || closed) endRow();
  if (headerRow !== undefined && (!Number.isInteger(headerRow) || headerRow < 1 || headerRow > 100)) throw Error("Choose a header row from 1 to 100.");
  const headerIndex = headerRow === undefined ? 0 : records.findIndex(record => record.line === headerRow);
  if (headerIndex < 0) throw Error("Selected CSV header row is empty or inside a multiline field. Choose the line where the headings begin.");
  records.splice(0, headerIndex);
  const header = records.shift();
  if (!header || !records.length) throw Error("CSV needs a header and at least one rate.");
  if (header.cells.some(c => c.length > 300)) throw Error("Column headings must be at most 300 characters.");
  return { headers: header.cells, records, headerLine: header.line };
}
export function suggestPriceMapping(headers: string[]): PriceMapping {
  const normalized = headers.map(h => h.trim().toLowerCase());
  const find = (aliases: string[], fallback: number) => { const index = normalized.findIndex(h => aliases.includes(h)); return index < 0 ? fallback : index; };
  const code = find(["sku", "stock code", "code", "product code"], -1);
  return { stockCode: code < 0 ? null : code, description: find(["description", "item", "product", "name"], 0),
    unit: find(["unit", "uom", "units"], Math.min(1, headers.length - 1)), rate: find(["rate", "price", "unit price", "unit rate"], Math.min(2, headers.length - 1)) };
}
export function previewPriceRows(table: CsvTable, mapping: PriceMapping): { rows: PriceRow[]; errors: string[] } {
  const checked = priceMappingSchema.safeParse(mapping);
  if (!checked.success) return { rows: [], errors: checked.error.issues.map(i => i.message) };
  if (Object.values(mapping).some(i => i !== null && i >= table.headers.length)) return { rows: [], errors: ["Choose an existing source column for every required field."] };
  const rows: PriceRow[] = [], errors: string[] = [], codes = new Set<string>();
  for (const record of table.records) {
    try {
      if (record.cells.length !== table.headers.length) throw Error("Column count does not match the header.");
      const mappedError = Object.values(mapping).filter((n): n is number => n !== null).map(n => record.cellErrors?.[n]).find(Boolean);
      if (mappedError) throw Error(mappedError);
      const rate = (record.numericValues?.[mapping.rate] ?? record.cells[mapping.rate]).trim();
      if (!/^(?:\d+(?:\.\d{1,6})?|\.\d{1,6})$/.test(rate)) throw Error("Rate needs a non-negative decimal (up to 6 decimal places), with no currency symbol or thousands separators.");
      const row = priceRowSchema.parse({ sourceLine: record.line, stockCode: mapping.stockCode === null ? "" : record.cells[mapping.stockCode],
        description: record.cells[mapping.description], unit: record.cells[mapping.unit], rate: Number(rate) });
      const code = row.stockCode.toLocaleLowerCase();
      if (code && codes.has(code)) throw Error(`Duplicate stock code ${row.stockCode}; distinguish variants before importing.`);
      if (code) codes.add(code);
      rows.push(row);
    } catch (error) { if (errors.length < 30) errors.push(`Line ${record.line}: ${priceBookError(error)}`); }
  }
  return { rows, errors };
}
export const priceCsvTemplate = () => "Stock code,Description,Unit,Rate\r\n";
// Decimal arithmetic, including half-up rounding, never uses binary floating point multiplication.
export function priceLineAmount(rate: number, quantity: string, decimals: number): string {
  priceRowSchema.shape.rate.parse(rate);
  if (!/^\d{1,10}(?:\.\d{1,6})?$/.test(quantity) || Number(quantity) > 1e9) throw Error("Enter a quantity from 0 to 1,000,000,000 with up to 6 decimal places.");
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 4) throw Error("Choose an amount precision from 0 to 4 decimal places.");
  const scaled = (value: string) => { const [whole, fraction = ""] = value.split("."); return BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, "0")); };
  const product = scaled(rate.toFixed(6)) * scaled(quantity);
  const divisor = 10n ** BigInt(12 - decimals), rounded = (product + divisor / 2n) / divisor;
  if (!decimals) return rounded.toString();
  const digits = rounded.toString().padStart(decimals + 1, "0"); return `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`;
}
export function addPricedLine(library: PriceBookLibrary, bookId: string, bookRevision: number, sourceLine: number, quantity: string, makeId = () => crypto.randomUUID(), now = new Date().toISOString()): PriceBookLibrary {
  const current = priceBookLibrarySchema.parse(library), book = current.books.find(b => b.id === bookId), revision = book?.revisions.find(r => r.revision === bookRevision), row = revision?.rows.find(r => r.sourceLine === sourceLine);
  if (!book || book.archived || !revision || !row) throw Error("Choose an active saved source rate.");
  priceLineAmount(row.rate, quantity, revision.metadata.amountDecimals);
  return priceBookLibrarySchema.parse({ ...current, revision: current.revision + 1,
    worksheet: [...current.worksheet, { id: makeId(), bookId, bookRevision, sourceLine, quantity, addedAt: now }] });
}
export function removePricedLine(library: PriceBookLibrary, id: string): PriceBookLibrary {
  if (!library.worksheet.some(line => line.id === id)) throw Error("Priced line no longer exists.");
  return priceBookLibrarySchema.parse({ ...library, revision: library.revision + 1, worksheet: library.worksheet.filter(line => line.id !== id) });
}
export function resolvePricedLine(library: PriceBookLibrary, line: PriceBookLibrary["worksheet"][number]) {
  const book = library.books.find(b => b.id === line.bookId), revision = book?.revisions.find(r => r.revision === line.bookRevision), row = revision?.rows.find(r => r.sourceLine === line.sourceLine);
  if (!book || !revision || !row) throw Error("The priced line's source rate could not be found.");
  return { book, revision, row, outdated: book.revisions.length > line.bookRevision, amount: priceLineAmount(row.rate, line.quantity, revision.metadata.amountDecimals) };
}
export function pricedWorksheetTotals(library: PriceBookLibrary) {
  const groups = new Map<string, { currency: string; taxBasis: PriceMetadata["taxBasis"]; taxPercent: number | null; decimals: number; count: number; minor: bigint }>();
  for (const line of library.worksheet) {
    const resolved = resolvePricedLine(library, line), m = resolved.revision.metadata;
    const key = JSON.stringify([m.currency, m.taxBasis, m.taxPercent, m.amountDecimals]);
    const group = groups.get(key) ?? { currency: m.currency, taxBasis: m.taxBasis, taxPercent: m.taxPercent, decimals: m.amountDecimals, count: 0, minor: 0n };
    group.minor += BigInt(resolved.amount.replace(".", "")); group.count++; groups.set(key, group);
  }
  return [...groups.values()].map(({ minor, ...group }) => {
    const digits = minor.toString().padStart(group.decimals + 1, "0");
    return { ...group, amount: group.decimals ? `${digits.slice(0, -group.decimals)}.${digits.slice(-group.decimals)}` : digits };
  });
}
export function pricedWorksheetCsv(library: PriceBookLibrary) {
  const cell = (value: unknown) => { let text = value === null ? "" : String(value); if (/^[\s]*[=+@'-]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; };
  return "\uFEFF" + [["Description", "Stock code", "Quantity", "Unit", "Unit rate", "Line amount", "Currency", "Tax basis", "Tax percent", "Amount decimals", "Supplier", "Effective date", "Book", "Revision", "Newer revision available", "Source reference", "Source file", "Source SHA-256", "Source line", "Project", "Added at", "Source worksheet", "Header row", "Quantity source"],
    ...library.worksheet.map(line => { const r = resolvePricedLine(library, line), m = r.revision.metadata;
      return [r.row.description, r.row.stockCode, line.quantity, r.row.unit, r.row.rate, r.amount, m.currency, m.taxBasis, m.taxPercent, m.amountDecimals, m.supplier, m.effectiveDate,
        r.book.name, line.bookRevision, r.outdated ? "yes" : "no", m.sourceReference, r.revision.source.fileName, r.revision.source.sha256, line.sourceLine, library.jobId, line.addedAt, r.revision.source.worksheet ?? "", r.revision.source.headerRow ?? "",
        line.bom ? `material register ${line.bom.commitRevision}: ${line.bom.key} ${line.bom.bomQuantity} ${line.bom.unit} x ${line.bom.factor}${line.bom.rounding === "up" ? " rounded up" : ""}` : "entered"]; })].map(row => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
export function priceRevisionCsv(book: PriceBook, revisionNumber: number) {
  const r = book.revisions.find(v => v.revision === revisionNumber);
  if (!r) throw Error("Price book revision not found.");
  const cell = (v: unknown) => { let text = v === null ? "" : String(v); if (/^[\s]*[=+@'-]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; };
  return "\uFEFF" + [["Stock code", "Description", "Unit", "Rate", "Currency", "Tax basis", "Tax percent", "Supplier", "Effective date", "Source reference", "Source file", "Source SHA-256", "Source line", "Book", "Revision", "Imported at", "Source worksheet", "Header row"],
    ...r.rows.map(row => [row.stockCode, row.description, row.unit, row.rate, r.metadata.currency, r.metadata.taxBasis, r.metadata.taxPercent, r.metadata.supplier,
      r.metadata.effectiveDate, r.metadata.sourceReference, r.source.fileName, r.source.sha256, row.sourceLine, book.name, r.revision, r.importedAt, r.source.worksheet ?? "", r.source.headerRow ?? ""])].map(row => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
