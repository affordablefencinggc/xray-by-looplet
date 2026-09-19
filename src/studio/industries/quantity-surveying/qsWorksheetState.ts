import { z } from "zod";
import {
  QS_CURRENCIES, QS_RATE_BOOK_FORMAT, canonicalQsJson, compareText, createQsRateBook, freeze, parseQsCostSnapshot,
  qsFxRateSchema, qsRateBookSchema, type QsCostSnapshot,
} from "./qsRateBook.ts";

const identifier = z.string().trim().min(1).max(240);
const snapshotSchema = z.unknown().transform((value, context): QsCostSnapshot => {
  try { return parseQsCostSnapshot(value); }
  catch (error) {
    context.addIssue({ code: "custom", message: error instanceof Error ? error.message : "Invalid saved cost revision." });
    return z.NEVER;
  }
});

/** Persisted editing choices plus append-only cost snapshots. Supplier records
 * remain in PriceBookLibrary; definitions only pin their exact source identity. */
export const qsWorksheetStateSchema = z.object({
  format: z.literal("xray.qs-worksheet-state/v1"),
  projectId: identifier,
  currency: z.enum(QS_CURRENCIES),
  preparedBy: z.string().max(240),
  rateBook: qsRateBookSchema,
  /** Current explicit FX selections. Older selections remain inside snapshots. */
  fxRates: z.array(qsFxRateSchema).max(100).default([]),
  assignments: z.array(z.object({
    itemKey: identifier,
    rateId: identifier.nullable(),
    rateRevision: z.number().int().positive().nullable(),
    optionId: identifier.nullable(),
  }).strict()).max(10000),
  options: z.array(z.object({ id: identifier, label: z.string().max(240) }).strict()).max(100),
  activeOptionIds: z.array(identifier).max(100),
  snapshots: z.array(snapshotSchema).max(50),
}).strict().superRefine((state, context) => {
  const issue = (message: string) => context.addIssue({ code: "custom", message });
  if (state.rateBook.projectId !== state.projectId) issue("Contractor rates belong to another project.");
  if (new Set(state.fxRates.map(rate => `${rate.fromCurrency}:${rate.toCurrency}`)).size !== state.fxRates.length) issue("Select only one reviewed exchange rate for each currency pair.");
  if (new Set(state.assignments.map(row => row.itemKey)).size !== state.assignments.length) issue("Duplicate worksheet item assignment.");
  if (new Set(state.options.map(option => option.id)).size !== state.options.length) issue("Duplicate cost option identity.");
  if (new Set(state.activeOptionIds).size !== state.activeOptionIds.length) issue("Duplicate accepted option identity.");
  const options = new Set(state.options.map(option => option.id));
  if (state.activeOptionIds.some(id => !options.has(id))) issue("An accepted option no longer exists.");
  for (const row of state.assignments) {
    if ((row.rateId === null) !== (row.rateRevision === null)) issue("A supplier definition pin needs both identity and revision.");
    if (row.rateId !== null && !state.rateBook.rates.some(rate => rate.id === row.rateId && rate.revision === row.rateRevision)) issue("A worksheet rate revision is missing.");
    if (row.optionId !== null && !options.has(row.optionId)) issue("A worksheet option no longer exists.");
  }
  for (const [index, snapshot] of state.snapshots.entries()) {
    if (snapshot.input.projectId !== state.projectId) issue("A saved cost revision belongs to another project.");
    if (snapshot.input.revision !== index + 1) issue("Saved cost revisions must be consecutive and preserved.");
    if (index > 0 && snapshot.input.createdAt < state.snapshots[index - 1].input.createdAt) issue("A cost revision cannot predate its predecessor.");
  }
  // A removed live choice can remain in historical snapshots. Reusing its exact
  // identity/revision with different source bytes, however, rewrites history.
  const rates = new Map<string, string>(), fx = new Map<string, string>(), suppliers = new Map<string, string>();
  const record = (seen: Map<string, string>, id: string, value: unknown, label: string) => {
    const bytes = canonicalQsJson(value), previous = seen.get(id);
    if (previous !== undefined && previous !== bytes) issue(`${label} revision history cannot be rewritten.`);
    else seen.set(id, bytes);
  };
  for (const snapshot of state.snapshots) {
    for (const rate of snapshot.input.rateBook.rates) record(rates, `${rate.id}:${rate.revision}`, rate, "Contractor rate");
    for (const rate of snapshot.input.fxRates) record(fx, `${rate.id}:${rate.revision}`, rate, "Exchange rate");
    for (const book of snapshot.input.priceBooks.books) for (const revision of book.revisions)
      record(suppliers, `${book.id}:${revision.revision}`, revision, "Supplier source");
  }
  for (const rate of state.rateBook.rates) record(rates, `${rate.id}:${rate.revision}`, rate, "Contractor rate");
  for (const rate of state.fxRates) record(fx, `${rate.id}:${rate.revision}`, rate, "Exchange rate");
});
export type QsWorksheetState = z.infer<typeof qsWorksheetStateSchema>;
export type QsWorksheetAssignment = QsWorksheetState["assignments"][number];

export function createEmptyQsWorksheetState(projectId: string): QsWorksheetState {
  return qsWorksheetStateSchema.parse({
    format: "xray.qs-worksheet-state/v1", projectId, currency: "AUD", preparedBy: "",
    rateBook: createQsRateBook({ format: QS_RATE_BOOK_FORMAT, projectId, revision: 0, rates: [] }),
    fxRates: [], assignments: [], options: [], activeOptionIds: [], snapshots: [],
  });
}

/** The only UI operation that appends a historical cost revision. Existing
 * entries are reparsed and copied without replacement, deletion or mutation. */
export function appendQsWorksheetSnapshot(state: QsWorksheetState, rawSnapshot: unknown): QsWorksheetState {
  const current = qsWorksheetStateSchema.parse(state);
  const snapshot = parseQsCostSnapshot(rawSnapshot);
  if (snapshot.input.projectId !== current.projectId) throw Error("Cost revision belongs to another project.");
  if (snapshot.input.revision !== current.snapshots.length + 1) throw Error("Save the next cost revision; historical snapshots cannot be replaced.");
  const config = (value: { currency: string; rateBook: QsWorksheetState["rateBook"]; options: QsWorksheetState["options"]; activeOptionIds: string[]; fxRates: QsWorksheetState["fxRates"] }, actor: string) => ({
    currency: value.currency, actor: actor.trim(), rateBook: createQsRateBook(value.rateBook),
    options: value.options.map(option => ({ id: option.id, label: option.label.trim() })).sort((a, b) => compareText(a.id, b.id)),
    activeOptionIds: [...value.activeOptionIds].sort(compareText),
    fxRates: [...value.fxRates].sort((a, b) => compareText(a.id, b.id) || a.revision - b.revision),
  });
  if (canonicalQsJson(config(current, current.preparedBy)) !== canonicalQsJson(config(snapshot.input, snapshot.input.createdBy)))
    throw Error("Cost snapshot does not match the current preparer, currency, rate definitions, options or exchange-rate choices. Recalculate before saving.");
  return freeze(qsWorksheetStateSchema.parse({ ...current, snapshots: [...current.snapshots, snapshot] }));
}
