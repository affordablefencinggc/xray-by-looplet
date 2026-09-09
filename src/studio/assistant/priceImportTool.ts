import { z } from "zod";
import { PRICE_CSV_LIMIT, appendPriceBookRevision, parsePriceCsv, persistPriceBooks, previewPriceRows, priceBookError, priceBookKey, priceImportSchema,
  priceMappingSchema, priceMetadataSchema, readPriceBooks, savePriceBooks, suggestPriceMapping, type PriceBookLibrary, type PriceBookSession, type PriceImport, type PriceMapping } from "../pricing/priceBooks.ts";

const id = z.string().min(1).max(100);
const delimiterSchema = z.enum([",", ";", "\t"]);
/** Same fields the Cost pane import form collects; every value must come from the user, never from sample or assumed text. */
const metadataInputSchema = z.object({
  supplier: z.string().trim().min(1).max(200),
  currency: z.preprocess(value => typeof value === "string" ? value.trim().toUpperCase() : value, z.string().regex(/^[A-Z]{3}$/, "Enter a three-letter currency code.")),
  amountDecimals: z.number().int().min(0).max(4).optional(),
  taxBasis: z.enum(["exclusive", "inclusive", "unspecified"]),
  taxPercent: z.number().finite().min(0).max(100).nullable().optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use an effective date in YYYY-MM-DD form."),
  sourceReference: z.string().trim().min(1).max(2000),
}).strict();
export const ASSISTANT_PRICE_SOURCE_PREFIX = "Live assistant paste · ";
export const DEFAULT_PASTE_FILE_NAME = "assistant-paste.csv";
export const priceImportInputSchema = z.object({
  expectedJobId: id,
  /** Library revision from read_price_books; a retry after an ambiguous outcome fails instead of creating a duplicate revision. */
  expectedLibraryRevision: z.number().int().nonnegative(),
  /** Existing price book to receive a new revision (resolved by id, never by name). */
  bookId: z.string().uuid().optional(),
  /** Name for a new price book. */
  bookName: z.string().trim().min(1).max(120).optional(),
  csvText: z.string().min(1).max(PRICE_CSV_LIMIT),
  fileName: z.string().min(1).max(255).optional(),
  delimiter: delimiterSchema.optional(),
  headerRow: z.number().int().min(1).max(100).optional(),
  mapping: priceMappingSchema.optional(),
  metadata: metadataInputSchema,
}).strict().refine(value => (value.bookId === undefined) !== (value.bookName === undefined), "Give bookName for a new price book or bookId for a new revision of an existing book, not both.");
export type PriceImportInput = z.infer<typeof priceImportInputSchema>;

export type PriceImportDeps = {
  /** Persists `next` against `session` with the library's fail-closed checks (browser: savePriceBooks inside the cross-window Web Lock). */
  save(session: PriceBookSession, next: PriceBookLibrary): Promise<PriceBookSession> | PriceBookSession;
  /** Lowercase hex SHA-256 of the exact bytes that were size-counted. Defaults to crypto.subtle. */
  digest?(bytes: Uint8Array): Promise<string> | string;
  /** Re-reads the stored string after saving; when given, it must equal what was saved. */
  readback?(storageKey: string): string | null;
  makeId?(): ReturnType<typeof crypto.randomUUID>;
  now?(): string;
};
export type PriceImportReceipt = {
  jobId: string; storageKey: string; bookId: string; bookName: string; created: boolean; revision: number; rows: number; importedAt: string; libraryRevision: number;
  sha256: string; sizeBytes: number; fileName: string; delimiter: "," | ";" | "\t"; headerRow: number | null; headers: string[]; mapping: PriceMapping; metadata: PriceImport["metadata"];
  saved: true; readbackVerified: true; scope: string;
};

export const PRICE_BOOKS_CHANGED = "xray:price-books-changed";
/** The Cost pane's PriceBookPanel re-reads the library only on mount, on a project change and from its "Reload library" button; it has no storage or custom-event listener yet. */
export const PRICE_BOOK_REFRESH_NOTE = "If the Cost pane is open, press \"Reload library\" there (or reopen the pane) to see this revision; the panel re-reads the library when it opens and refuses to overwrite it while stale.";

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) throw Error("SHA-256 hashing is unavailable in this session, so the import cannot be recorded.");
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Notify a mounted price book view that the library changed. Returns false when there is no window; the panel does not currently subscribe, so the receipt also asks the user to reload. */
export function notifyPriceBooksChanged(storageKey: string, target: Pick<Window, "dispatchEvent"> | undefined = typeof window === "undefined" ? undefined : window): boolean {
  if (!target || typeof CustomEvent === "undefined") return false;
  target.dispatchEvent(new CustomEvent(PRICE_BOOKS_CHANGED, { detail: { key: storageKey } }));
  return true;
}

function flatten<T>(step: string, run: () => T): T { try { return run(); } catch (error) { throw Error(`${step}: ${priceBookError(error)}`); } }

/**
 * Import one CSV as a new price book or a new revision, exactly as the Cost pane does: parse, preview, refuse the whole import on any row error,
 * hash the bytes, build the PriceImport, append the revision and save through `deps.save`. Nothing is written unless every row and the metadata validate.
 */
export async function importPriceBook(session: PriceBookSession, input: unknown, deps: PriceImportDeps): Promise<PriceImportReceipt> {
  const args = flatten("Price import input", () => priceImportInputSchema.parse(input));
  if (session.blocked) throw Error(session.error ?? "Price book saving is blocked.");
  if (session.value.jobId !== args.expectedJobId) throw Error("Price books belong to another project.");
  if (session.value.revision !== args.expectedLibraryRevision) throw Error("The price book library changed. Read the price books again before importing.");
  const fileName = args.fileName ?? DEFAULT_PASTE_FILE_NAME, delimiter = args.delimiter ?? (/\.tsv$/i.test(fileName) ? "\t" : ",");
  const bytes = new TextEncoder().encode(args.csvText);
  if (!bytes.length || bytes.length > PRICE_CSV_LIMIT) throw Error("Import a non-empty CSV up to 2 MB.");
  const sha256 = await (deps.digest ?? sha256Hex)(bytes), sizeBytes = bytes.length;
  const table = flatten("CSV", () => parsePriceCsv(args.csvText, delimiter, args.headerRow));
  const mapping = args.mapping ?? suggestPriceMapping(table.headers);
  const preview = previewPriceRows(table, mapping);
  if (preview.errors.length) throw Error(`Import blocked until these lines are corrected (${preview.errors.length}${preview.errors.length >= 30 ? "+" : ""} issue${preview.errors.length === 1 ? "" : "s"}; first ${Math.min(10, preview.errors.length)} shown): ${preview.errors.slice(0, 10).join(" | ")} No rates have been saved.`);
  if (!preview.rows.length) throw Error("CSV needs at least one rate. No rates have been saved.");
  // Provenance stays distinguishable from a Cost-pane file import: the source reference is prefixed and the hash is of the pasted UTF-8 text.
  const sourceReference = `${ASSISTANT_PRICE_SOURCE_PREFIX}${args.metadata.sourceReference}`.slice(0, 2000);
  const metadata = flatten("Price metadata", () => priceMetadataSchema.parse({ ...args.metadata, sourceReference, amountDecimals: args.metadata.amountDecimals ?? 2, taxPercent: args.metadata.taxPercent ?? null }));
  const incoming = flatten("Price import", () => priceImportSchema.parse({ metadata,
    source: { fileName, sha256, sizeBytes, kind: "csv", delimiter, ...(table.headerLine === undefined ? {} : { headerRow: table.headerLine }), headers: table.headers, mapping }, rows: preview.rows }));
  const existing = args.bookId ? session.value.books.find(book => book.id === args.bookId) : undefined;
  if (args.bookId && !existing) throw Error("Price book no longer exists. Read the price books again.");
  if (existing?.archived) throw Error("Restore the archived price book before adding a revision.");
  const next = flatten("Price book", () => appendPriceBookRevision(session.value, incoming, args.bookName ?? "", args.bookId ?? null, deps.makeId ?? (() => crypto.randomUUID()), (deps.now ?? (() => new Date().toISOString()))()));
  const target = existing ? next.books.find(book => book.id === existing.id) : next.books.find(book => !session.value.books.some(original => original.id === book.id));
  if (!target) throw Error("The new price book revision could not be located before saving.");
  const saved = await deps.save(session, next);
  const storageKey = priceBookKey(args.expectedJobId), expected = JSON.stringify(next);
  const savedBook = saved.value.books.find(book => book.id === target.id), savedRevision = savedBook?.revisions.find(revision => revision.revision === target.revisions.length);
  if (saved.blocked || saved.value.jobId !== args.expectedJobId || saved.value.revision !== session.value.revision + 1 || saved.raw !== expected || !savedBook || !savedRevision || savedRevision.rows.length !== incoming.rows.length || savedRevision.source.sha256 !== sha256)
    throw Error("The saved price book library did not read back as written. Read the price books again before retrying.");
  if (deps.readback && deps.readback(storageKey) !== saved.raw) throw Error("Stored price books do not match the save receipt. Read the price books again before retrying.");
  return {
    jobId: args.expectedJobId, storageKey, bookId: savedBook.id, bookName: savedBook.name, created: !existing, revision: savedRevision.revision, rows: savedRevision.rows.length, importedAt: savedRevision.importedAt, libraryRevision: saved.value.revision,
    sha256, sizeBytes, fileName, delimiter, headerRow: table.headerLine ?? null, headers: table.headers, mapping, metadata,
    saved: true, readbackVerified: true,
    scope: `Rates imported from text supplied through the Live assistant (source reference prefixed "${ASSISTANT_PRICE_SOURCE_PREFIX.trim()}"; sha256 is of the UTF-8 text, not of a file on disk); no quantities, quotes or currency conversion. Earlier revisions and priced worksheet lines are unchanged. ${PRICE_BOOK_REFRESH_NOTE}`,
  };
}

/** Node/test path: read the session from the given storage immediately before appending and persist without the browser Web Lock. */
export function importPriceBookFromStorage(storage: Pick<Storage, "getItem" | "setItem">, input: unknown, deps: Partial<PriceImportDeps> = {}): Promise<PriceImportReceipt> {
  const jobId = z.object({ expectedJobId: id }).passthrough().parse(input).expectedJobId;
  const session = readPriceBooks(storage, jobId);
  return importPriceBook(session, input, { ...deps, save: deps.save ?? ((current, next) => persistPriceBooks(storage, current, next)), readback: deps.readback ?? (key => storage.getItem(key)) });
}

/** Browser path for the assistant tool: savePriceBooks holds the cross-window Web Lock, and readback comes from localStorage. */
export function browserPriceImportDeps(): PriceImportDeps {
  return { save: savePriceBooks, readback: key => localStorage.getItem(key), digest: sha256Hex };
}
