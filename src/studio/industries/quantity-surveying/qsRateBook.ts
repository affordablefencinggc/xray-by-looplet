import { z } from "zod";
import { priceBookLibrarySchema, type PriceBookLibrary } from "../../pricing/priceBooks.ts";
import { evaluateItemBinding, qsEntityGeometrySchema, qsItemBindingSchema } from "./qsItemBinding.ts";

/** Contractor definitions pin existing supplier records. This does not create a
 * second supplier library or imply a reviewed/issued commercial quotation. */
export const QS_RATE_BOOK_FORMAT = "xray.qs-rate-book/v1" as const;
export const QS_COST_INPUT_FORMAT = "xray.qs-cost-input/v1" as const;
export const QS_COST_SNAPSHOT_FORMAT = "xray.qs-cost-snapshot/v1" as const;
export const QS_CURRENCIES = ["AUD", "NZD", "USD", "GBP", "EUR"] as const;
export const QS_RATE_UNITS = ["m", "m2", "m3", "ea", "kg", "t", "h", "day", "item"] as const;
export const QS_COST_ROUNDING = "exact-FX-before-extension;ROUND_HALF_UP:component-extension,inclusive-extraction,component-markup,markup-tax;sum-integer-minor-units" as const;
const text = z.string().trim().min(1).max(240);
const timestamp = z.string().datetime({ offset: true }).transform(value => new Date(value).toISOString());
const revision = z.number().int().positive().max(1000000);
const currency = z.enum(QS_CURRENCIES);
const unit = z.enum(QS_RATE_UNITS);
const measuredUnit = z.enum([...QS_RATE_UNITS, "m²", "m³"]);
export function normalizeQsRateUnit(value: string): (typeof QS_RATE_UNITS)[number] | null {
  const parsed = unit.safeParse(value === "m²" ? "m2" : value === "m³" ? "m3" : value);
  return parsed.success ? parsed.data : null;
}
const canonical = (value: string) => value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value;
export const qsDecimalSchema = z.string().max(19).regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/).transform(canonical);
const percent = qsDecimalSchema.refine(value => decimal(value).n <= 1000n * decimal(value).d, "Percentage must not exceed 1000.");
export const qsRatePinSchema = z.object({ bookId: z.string().uuid(), bookRevision: revision, sourceLine: z.number().int().positive().max(1000000) }).strict();
export type QsRatePin = z.infer<typeof qsRatePinSchema>;
export const qsFxRateSchema = z.object({
  id: text, revision, fromCurrency: currency, toCurrency: currency,
  rate: qsDecimalSchema.refine(value => decimal(value).n > 0n, "Exchange rate must be positive."),
  sourceReference: z.string().trim().min(1).max(1000), effectiveAt: timestamp,
  validUntil: timestamp.nullable(), reviewedAt: timestamp, reviewedBy: text,
}).strict().superRefine((value, ctx) => {
  if (value.fromCurrency === value.toCurrency) ctx.addIssue({ code: "custom", message: "Exchange rate requires two different currencies." });
  if (value.validUntil !== null && value.validUntil <= value.effectiveAt) ctx.addIssue({ code: "custom", message: "Exchange validity must end after it starts." });
});
export type QsFxRate = z.infer<typeof qsFxRateSchema>;
export const qsRateRevisionSchema = z.object({
  id: text, revision, description: text, unit,
  material: qsRatePinSchema, labour: qsRatePinSchema.nullable(),
  /** Explicit per-measured-unit labour basis, or a reason for excluding labour. */
  labourAssumption: z.string().trim().min(1).max(1000),
  wastagePercent: percent, markupPercent: percent,
  createdAt: timestamp, createdBy: text,
}).strict();
export type QsRateRevision = z.infer<typeof qsRateRevisionSchema>;
export const qsRateBookSchema = z.object({
  format: z.literal(QS_RATE_BOOK_FORMAT), projectId: text,
  revision: z.number().int().nonnegative().max(1000000),
  rates: z.array(qsRateRevisionSchema).max(10000),
}).strict().superRefine((book, ctx) => {
  const groups = new Map<string, number[]>();
  for (const rate of book.rates) groups.set(rate.id, [...(groups.get(rate.id) ?? []), rate.revision]);
  for (const [id, revisions] of groups) {
    revisions.sort((a, b) => a - b);
    if (revisions.some((value, index) => value !== index + 1)) ctx.addIssue({ code: "custom", message: `Rate ${id} revisions must be consecutive and preserved.` });
  }
  if (book.revision !== book.rates.length) ctx.addIssue({ code: "custom", message: "Rate book revision must match its append-only revision count." });
});
export type QsRateBook = z.infer<typeof qsRateBookSchema>;
export function createQsRateBook(raw: unknown): QsRateBook {
  const book = qsRateBookSchema.parse(raw);
  book.rates.sort((a, b) => compareText(a.id, b.id) || a.revision - b.revision);
  return freeze(book);
}
export function appendQsRateRevision(rawBook: QsRateBook, rawRate: QsRateRevision, expectedRevision: number): QsRateBook {
  const book = createQsRateBook(rawBook), rate = qsRateRevisionSchema.parse(rawRate);
  if (book.revision !== expectedRevision) throw Error("Rate book changed; reload before appending a revision.");
  const previous = book.rates.filter(value => value.id === rate.id);
  if (rate.revision !== previous.length + 1) throw Error("Append the next rate revision; historical supplier pins cannot be replaced.");
  if (previous.length && rate.createdAt < previous[previous.length - 1].createdAt) throw Error("A rate revision cannot predate its predecessor.");
  return createQsRateBook({ ...book, revision: book.revision + 1, rates: [...book.rates, rate] });
}

export const qsCostItemSchema = z.object({
  itemId: text, description: text, quantity: qsDecimalSchema, unit: measuredUnit,
  evidence: z.enum(["unverified", "inferred", "sample"]),
  binding: qsItemBindingSchema.nullable(), entity: qsEntityGeometrySchema.nullable(),
  rateId: text, rateRevision: revision, optionId: text.nullable(),
}).strict();
export const qsCostInputSchema = z.object({
  format: z.literal(QS_COST_INPUT_FORMAT), projectId: text, revision,
  createdAt: timestamp, createdBy: text, currency,
  priceBooks: priceBookLibrarySchema, rateBook: qsRateBookSchema,
  fxRates: z.array(qsFxRateSchema).max(100).default([]),
  items: z.array(qsCostItemSchema).max(10000),
  options: z.array(z.object({ id: text, label: text }).strict()).max(100),
  activeOptionIds: z.array(text).max(100),
}).strict().superRefine((input, ctx) => {
  for (const [name, ids] of [["item", input.items.map(value => value.itemId)], ["option", input.options.map(value => value.id)], ["active option", input.activeOptionIds]] as const)
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: `Duplicate ${name} identity.` });
  const options = new Set(input.options.map(value => value.id));
  if (input.activeOptionIds.some(id => !options.has(id)) || input.items.some(item => item.optionId !== null && !options.has(item.optionId)))
    ctx.addIssue({ code: "custom", message: "Every referenced option must be declared." });
  if (input.priceBooks.jobId !== input.projectId || input.rateBook.projectId !== input.projectId)
    ctx.addIssue({ code: "custom", message: "Supplier library and rate definitions must belong to this project." });
  if (new Set(input.fxRates.map(value => `${value.id}:${value.revision}`)).size !== input.fxRates.length)
    ctx.addIssue({ code: "custom", message: "Duplicate exchange-rate revision." });
});
export type QsCostInput = z.infer<typeof qsCostInputSchema>;
export type QsCostItem = z.infer<typeof qsCostItemSchema>;
export type QsCostBlocker = { itemId: string | null; code: "invalid-input" | "binding" | "missing-rate" | "source" | "unit" | "currency" | "tax" | "future-rate" | "overflow"; message: string };
export type QsRateSource = QsRatePin & {
  bookName: string; supplier: string; stockCode: string; description: string;
  sourceReference: string; sourceSha256: string; effectiveDate: string;
  importedAt: string; sourceWorksheet: string | null; sourceHeaderRow: number | null;
  currency: (typeof QS_CURRENCIES)[number]; normalizedCurrency: (typeof QS_CURRENCIES)[number];
  exchangeRate: QsFxRate | null; unit: QsCostItem["unit"];
  rate: string; taxBasis: "exclusive" | "inclusive"; taxPercent: string;
};
export type QsCostTotals = { materialMinor: number; labourMinor: number; markupMinor: number; netMinor: number; taxMinor: number; totalMinor: number };
export type QsPricedItem = QsCostTotals & {
  itemId: string; description: string; quantity: string; unit: QsCostItem["unit"];
  optionId: string | null; included: boolean; rate: QsRateRevision;
  materialSource: QsRateSource; labourSource: QsRateSource | null;
  adjustedMaterialQuantity: string;
  binding: NonNullable<QsCostItem["binding"]>;
};
export type QsCostSnapshot = {
  format: typeof QS_COST_SNAPSHOT_FORMAT; rounding: typeof QS_COST_ROUNDING;
  input: QsCostInput; items: QsPricedItem[];
  baseTotal: QsCostTotals;
  options: { id: string; label: string; active: boolean; totals: QsCostTotals }[];
  acceptedTotal: QsCostTotals;
};
export type QsCostResult = { ok: true; snapshot: QsCostSnapshot } | { ok: false; blockers: QsCostBlocker[] };

/** No caller-supplied readiness flag is accepted. Current geometry and exact
 * source pins are re-read on each calculation; stale rows withhold all totals. */
export function calculateQsCostPlan(raw: unknown): QsCostResult {
  const parsed = qsCostInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, blockers: parsed.error.issues.map(issue => ({ itemId: null, code: "invalid-input" as const, message: `${issue.path.join(".")}: ${issue.message}` })) };
  const input = normalizeInput(parsed.data);
  const blockers: QsCostBlocker[] = [], items: QsPricedItem[] = [];
  for (const item of input.items) {
    try {
      if (!item.binding || item.binding.itemId !== item.itemId || item.binding.projectId !== input.projectId)
        throw new CostFailure("binding", "Bind this row to its measured entity in the current project before pricing.");
      if (!item.binding.sourceSha256) throw new CostFailure("binding", "Pricing requires a source document identity.");
      if (Date.parse(item.binding.boundAt) > Date.parse(input.createdAt)) throw new CostFailure("binding", "The geometry binding postdates this cost revision.");
      const evidence = evaluateItemBinding(item.binding, item.entity, { ...item, projectId: input.projectId });
      if (!evidence.pricingPermitted) throw new CostFailure("binding", evidence.reasons.join(" "));
      if (item.entity?.entityType !== item.binding.entityType) throw new CostFailure("binding", "The measured entity type changed.");
      const rate = input.rateBook.rates.find(value => value.id === item.rateId && value.revision === item.rateRevision);
      if (!rate) throw new CostFailure("missing-rate", "The pinned contractor rate revision is missing.");
      if (rate.unit !== normalizeQsRateUnit(item.unit)) throw new CostFailure("unit", "Contractor rate and measured quantity units differ; no implicit conversion is permitted.");
      if (rate.createdAt > input.createdAt) throw new CostFailure("future-rate", "The contractor rate revision postdates this cost plan.");
      const materialSource = resolveSource(input.priceBooks, rate.material, item.unit, input.currency, input.createdAt, input.fxRates);
      const labourSource = rate.labour ? resolveSource(input.priceBooks, rate.labour, item.unit, input.currency, input.createdAt, input.fxRates) : null;
      const computed = priceQsComponents(item.quantity, rate, materialSource, labourSource);
      items.push({ itemId: item.itemId, description: item.description, quantity: item.quantity, unit: item.unit,
        optionId: item.optionId, included: item.optionId === null || input.activeOptionIds.includes(item.optionId),
        rate, materialSource, labourSource, binding: item.binding, ...computed });
    } catch (error) {
      blockers.push({ itemId: item.itemId, code: error instanceof CostFailure ? error.code : "overflow", message: error instanceof Error ? error.message : "Calculation failed." });
    }
  }
  if (blockers.length) return { ok: false, blockers };
  try {
    const baseTotal = sumQsTotals(items.filter(item => item.optionId === null));
    const options = input.options.map(option => ({ ...option, active: input.activeOptionIds.includes(option.id), totals: sumQsTotals(items.filter(item => item.optionId === option.id)) }));
    const acceptedTotal = sumQsTotals([baseTotal, ...options.filter(option => option.active).map(option => option.totals)]);
    return { ok: true, snapshot: freeze<QsCostSnapshot>({ format: QS_COST_SNAPSHOT_FORMAT, rounding: QS_COST_ROUNDING, input, items, baseTotal, options, acceptedTotal }) };
  } catch (error) { return { ok: false, blockers: [{ itemId: null, code: "overflow", message: error instanceof Error ? error.message : "Total overflow." }] }; }
}

/** Recompute every persisted field from its frozen inputs. Unknown fields,
 * corrupt totals, altered provenance and unsupported versions are rejected. */
export function parseQsCostSnapshot(raw: unknown): QsCostSnapshot {
  if (!raw || typeof raw !== "object" || !("input" in raw)) throw Error("Cost snapshot has no frozen input.");
  const result = calculateQsCostPlan(raw.input);
  if (!result.ok) throw Error(result.blockers.map(value => value.message).join(" "));
  if (canonicalQsJson(raw) !== canonicalQsJson(result.snapshot)) throw Error("Cost snapshot does not reconcile with its frozen inputs.");
  return result.snapshot;
}

/** Canonical JSON is a serialization, not a claimed cryptographic signature. */
export function canonicalQsJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw Error("Snapshot contains an unsupported JSON value.");
    return encoded;
  }
  if (Array.isArray(value)) return `[${value.map(canonicalQsJson).join(",")}]`;
  return `{${Object.entries(value).sort(([a], [b]) => compareText(a, b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonicalQsJson(entry)}`).join(",")}}`;
}

function resolveSource(library: PriceBookLibrary, pin: QsRatePin, expectedUnit: QsCostItem["unit"], expectedCurrency: QsCostInput["currency"], at: string, fxRates: QsFxRate[]): QsRateSource {
  const book = library.books.find(value => value.id === pin.bookId);
  const source = book?.revisions.find(value => value.revision === pin.bookRevision);
  const row = source?.rows.find(value => value.sourceLine === pin.sourceLine);
  if (!book || book.archived || !source || !row) throw new CostFailure("source", "Choose an existing, active supplier record at the exact pinned revision and source line.");
  const metadata = source.metadata;
  const sourceCurrency = currency.safeParse(metadata.currency);
  if (!sourceCurrency.success) throw new CostFailure("currency", `Supplier currency ${metadata.currency} is not supported by this cost-plan version.`);
  let exchangeRate: QsFxRate | null = null;
  if (sourceCurrency.data !== expectedCurrency) {
    const candidates = fxRates.filter(value => value.fromCurrency === sourceCurrency.data && value.toCurrency === expectedCurrency);
    if (candidates.length !== 1) throw new CostFailure("currency", `Select exactly one reviewed ${sourceCurrency.data} to ${expectedCurrency} exchange rate; missing or ambiguous currency conversion is blocked.`);
    exchangeRate = candidates[0];
    if (exchangeRate.effectiveAt > at || exchangeRate.reviewedAt > at || (exchangeRate.validUntil !== null && at >= exchangeRate.validUntil))
      throw new CostFailure("currency", "The selected exchange rate is future, unreviewed at this revision, or expired.");
  }
  if (metadata.amountDecimals !== 2) throw new CostFailure("currency", "This cost-plan version requires a declared two-decimal currency.");
  if (metadata.taxBasis === "unspecified" || metadata.taxPercent === null) throw new CostFailure("tax", "Supplier tax basis and percentage must both be explicit.");
  if (metadata.effectiveDate > at.slice(0, 10) || Date.parse(source.importedAt) > Date.parse(at)) throw new CostFailure("future-rate", "Supplier rate was not effective and available at this revision's creation time.");
  if (normalizeQsRateUnit(row.unit) === null || normalizeQsRateUnit(row.unit) !== normalizeQsRateUnit(expectedUnit)) throw new CostFailure("unit", `Supplier unit ${row.unit} differs from measured unit ${expectedUnit}; use an explicitly compatible source rate.`);
  // The pre-existing import contract stores up to six decimal places as numbers.
  // Its canonical decimal representation is recovered once at this boundary;
  // monetary multiplication, normalization and rounding below use only BigInt.
  const rate = qsDecimalSchema.parse(row.rate.toFixed(6));
  const parsedTax = qsDecimalSchema.safeParse(String(metadata.taxPercent));
  if (!parsedTax.success) throw new CostFailure("tax", "Supplier tax percentage exceeds the supported exact decimal precision.");
  const taxPercent = parsedTax.data;
  return { ...pin, bookName: book.name, supplier: metadata.supplier, stockCode: row.stockCode, description: row.description,
    sourceReference: metadata.sourceReference, sourceSha256: source.source.sha256,
    effectiveDate: metadata.effectiveDate, importedAt: source.importedAt,
    sourceWorksheet: source.source.worksheet ?? null, sourceHeaderRow: source.source.headerRow ?? null,
    currency: sourceCurrency.data, normalizedCurrency: expectedCurrency, exchangeRate,
    unit: row.unit as QsCostItem["unit"], rate, taxBasis: metadata.taxBasis, taxPercent };
}

type Rational = { n: bigint; d: bigint };
function decimal(value: string): Rational { const [whole, fraction = ""] = value.split("."); return { n: BigInt(whole + fraction), d: 10n ** BigInt(fraction.length) }; }
function multiply(a: Rational, b: Rational): Rational { return { n: a.n * b.n, d: a.d * b.d }; }
function allowance(value: string): Rational { const percentValue = decimal(value); return { n: 100n * percentValue.d + percentValue.n, d: 100n * percentValue.d }; }
function rounded(n: bigint, d: bigint): bigint { if (n < 0n || d <= 0n) throw Error("Invalid monetary calculation."); return (n * 2n + d) / (2n * d); }
function minor(value: bigint): number { if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new CostFailure("overflow", "Amount exceeds the safe integer minor-unit limit."); return Number(value); }
function rationalDecimal(value: Rational): string {
  let n = value.n;
  const d = value.d;
  const whole = n / d; n %= d;
  let fraction = "";
  while (n && fraction.length < 30) { n *= 10n; fraction += (n / d).toString(); n %= d; }
  if (n) throw Error("The physical allowance did not produce an exact bounded decimal.");
  return `${whole}${fraction ? `.${fraction.replace(/0+$/, "")}` : ""}`;
}
function priceComponent(quantity: Rational, source: QsRateSource, markup: string) {
  const sourcedRate = multiply(decimal(source.rate), decimal(source.exchangeRate?.rate ?? "1"));
  const extension = multiply(quantity, sourcedRate), declared = rounded(extension.n * 100n, extension.d);
  const tax = decimal(source.taxPercent);
  const net = source.taxBasis === "inclusive" ? rounded(declared * 100n * tax.d, 100n * tax.d + tax.n) : declared;
  const baseTax = source.taxBasis === "inclusive" ? declared - net : rounded(net * tax.n, tax.d * 100n);
  const markupRate = decimal(markup), markupMinor = rounded(net * markupRate.n, markupRate.d * 100n);
  const markupTax = rounded(markupMinor * tax.n, tax.d * 100n);
  return { net, markup: markupMinor, tax: baseTax + markupTax };
}
/** Exported for exact counterfactual revision attribution; accepts the already
 * resolved immutable supplier sources from a validated snapshot. */
export function priceQsComponents(quantity: string, rate: QsRateRevision, material: QsRateSource, labour: QsRateSource | null): QsCostTotals & { adjustedMaterialQuantity: string } {
  const measured = decimal(qsDecimalSchema.parse(quantity));
  const adjusted = multiply(measured, allowance(rate.wastagePercent));
  const m = priceComponent(adjusted, material, rate.markupPercent);
  const l = labour ? priceComponent(measured, labour, rate.markupPercent) : { net: 0n, markup: 0n, tax: 0n };
  const net = m.net + l.net + m.markup + l.markup, tax = m.tax + l.tax;
  return { materialMinor: minor(m.net), labourMinor: minor(l.net), markupMinor: minor(m.markup + l.markup),
    netMinor: minor(net), taxMinor: minor(tax), totalMinor: minor(net + tax), adjustedMaterialQuantity: rationalDecimal(adjusted) };
}
export function sumQsTotals(values: QsCostTotals[]): QsCostTotals {
  const fields = ["materialMinor", "labourMinor", "markupMinor", "netMinor", "taxMinor", "totalMinor"] as const;
  const result = Object.fromEntries(fields.map(field => [field, minor(values.reduce((sum, value) => sum + BigInt(value[field]), 0n))])) as QsCostTotals;
  if (result.materialMinor + result.labourMinor + result.markupMinor !== result.netMinor || result.netMinor + result.taxMinor !== result.totalMinor) throw Error("Cost totals do not reconcile.");
  return result;
}
function normalizeInput(input: QsCostInput): QsCostInput {
  input.items.sort((a, b) => compareText(a.itemId, b.itemId));
  input.options.sort((a, b) => compareText(a.id, b.id)); input.activeOptionIds.sort(compareText);
  input.fxRates.sort((a, b) => compareText(a.id, b.id) || a.revision - b.revision);
  input.rateBook = createQsRateBook(input.rateBook);
  input.priceBooks.books.sort((a, b) => compareText(a.id, b.id));
  for (const book of input.priceBooks.books) for (const version of book.revisions) version.rows.sort((a, b) => a.sourceLine - b.sourceLine);
  input.priceBooks.worksheet.sort((a, b) => compareText(a.id, b.id));
  return input;
}
export function compareText(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
export function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
class CostFailure extends Error {
  code: QsCostBlocker["code"];
  constructor(code: QsCostBlocker["code"], message: string) { super(message); this.code = code; }
}
