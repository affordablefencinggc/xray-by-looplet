import { z } from "zod";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { Unzip, UnzipInflate, zipSync } from "fflate";
import { deliveryRecordSchema, type DeliveryRecord } from "../deliveryRecord.ts";
import { classifyQuantities } from "./classification.ts";
import { csvCell } from "./report.ts";
import { canonicalQsJson, createQsRateBook, freeze, parseQsCostSnapshot, qsQuantityDecimalSchema, type QsCostSnapshot } from "./qsRateBook.ts";
import { compareQsCostPlans, type QsCostDelta } from "./qsDeltaComparison.ts";
import { qsItemBindingSchema } from "./qsItemBinding.ts";

export const QS_PACKAGE_FORMAT = "xray.qs-cost-plan-package/v1" as const;
export const QS_PACKAGE_MAX_BYTES = 32 * 1024 * 1024;
export const QS_PACKAGE_MAX_ENTRY_BYTES = 16 * 1024 * 1024;
export const QS_PACKAGE_ENTRIES = ["worksheet.json", "cost-plan.json", "previous-cost-plan.json", "transmittal.json", "delivery.json", "cost-plan.pdf", "schedule.csv", "manifest.json"] as const;
const entryNames = new Set<string>(QS_PACKAGE_ENTRIES);
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const text = z.string().trim().min(1).max(240);
const timestamp = z.string().datetime({ offset: true });
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const notes = z.array(z.string().trim().min(1).max(4000)).min(1).max(100);
export const qsTransmittalSchema = z.object({
  title: text, reference: text, revisionLabel: text, preparedBy: text,
  recipient: text, purpose: text, createdAt: timestamp,
}).strict();
export type QsTransmittal = z.infer<typeof qsTransmittalSchema>;

/** The caller supplies the full evolving form schema. This read-only projection
 * establishes the export cross-links without importing that schema cyclically. */
const worksheetProjection = z.object({
  hierarchyId: text, hierarchyRevision: text,
  nodes: z.array(z.object({ key: text, code: text, label: text, parentKey: z.string() }).passthrough()).min(1).max(1000),
  items: z.array(z.object({ key: text, reference: text, quantity: z.string().max(80), unit: text,
    evidence: z.enum(["unverified", "inferred", "sample"]), nodeKey: z.string(), entityBinding: qsItemBindingSchema,
  }).passthrough()).min(1).max(10000),
  binding: z.unknown().optional(),
  pricing: z.object({ projectId: text, currency: text, preparedBy: z.string(), rateBook: z.unknown(),
    fxRates: z.array(z.unknown()).optional(),
    assignments: z.array(z.object({ itemKey: text, rateId: text.nullable(), rateRevision: z.number().int().positive().nullable(), optionId: text.nullable() }).passthrough()),
    options: z.array(z.object({ id: text, label: z.string() }).passthrough()),
    activeOptionIds: z.array(text), snapshots: z.array(z.unknown()).min(1),
  }).passthrough(),
}).passthrough();
type WorksheetProjection = z.infer<typeof worksheetProjection>;
export type QsWorksheetParser<T extends Record<string, unknown>> = (value: unknown) => T;
export type QsPackageContent<T extends Record<string, unknown>> = {
  format: typeof QS_PACKAGE_FORMAT; worksheet: T; current: QsCostSnapshot; previous: QsCostSnapshot | null;
  transmittal: QsTransmittal; basisOfEstimate: string[]; assumptions: string[]; exclusions: string[];
};
export type QsVerifiedPackage<T extends Record<string, unknown>> = QsPackageContent<T> & { delivery: DeliveryRecord };
export type QsPackageInput<T extends Record<string, unknown>> = Omit<QsPackageContent<T>, "format"> & { delivery: Omit<DeliveryRecord, "contentSha256"> };

export async function qsPackageDigest(bytes: Uint8Array | string): Promise<string> {
  const input = typeof bytes === "string" ? encoder.encode(bytes) : Uint8Array.from(bytes);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", input))].map(value => value.toString(16).padStart(2, "0")).join("");
}
const same = (a: unknown, b: unknown) => canonicalQsJson(a) === canonicalQsJson(b);
const unit = (value: string) => value === "m²" ? "m2" : value === "m³" ? "m3" : value;
const sorted = <T,>(values: T[]) => [...values].sort((a, b) => canonicalQsJson(a).localeCompare(canonicalQsJson(b), "en"));

function inspectWorksheet<T extends Record<string, unknown>>(worksheet: T, current: QsCostSnapshot) {
  const form = worksheetProjection.parse(worksheet), state = form.pricing;
  if (state.projectId !== current.input.projectId || state.currency !== current.input.currency)
    throw Error("The worksheet and cost revision belong to different projects or currencies.");
  if (form.items.length !== current.items.length || new Set(form.items.map(item => item.key)).size !== form.items.length)
    throw Error("The cost plan must contain every worksheet item exactly once.");
  if (state.assignments.length !== form.items.length || new Set(state.assignments.map(row => row.itemKey)).size !== state.assignments.length)
    throw Error("Every worksheet item needs exactly one current rate assignment.");
  if (!same(createQsRateBook(state.rateBook), current.input.rateBook) || !same(sorted(state.options), sorted(current.input.options)) ||
      !same([...state.activeOptionIds].sort(), [...current.input.activeOptionIds].sort()) ||
      !same(sorted(state.fxRates ?? []), sorted(current.input.fxRates ?? [])))
    throw Error("Rates, exchange rates or options changed after the saved cost revision; save a new revision before export.");
  if (!same(parseQsCostSnapshot(state.snapshots[state.snapshots.length - 1]), current))
    throw Error("The package must identify the worksheet's latest saved cost revision.");
  const nodeMap = new Map(form.nodes.map(node => [node.key, node]));
  if (nodeMap.size !== form.nodes.length) throw Error("Duplicate worksheet classification key.");
  if (form.nodes.some(node => node.parentKey !== "" && !nodeMap.has(node.parentKey)) || form.items.some(item => item.nodeKey !== "" && !nodeMap.has(item.nodeKey)))
    throw Error("A worksheet classification or parent reference is missing.");
  const report = classifyQuantities({ hierarchyId: form.hierarchyId, hierarchyRevision: form.hierarchyRevision,
    nodes: form.nodes.map(node => ({ id: node.code, label: node.label, parentId: node.parentKey ? nodeMap.get(node.parentKey)!.code : null })),
    items: form.items.map(item => ({ id: item.reference, quantity: item.quantity, unit: item.unit, evidence: item.evidence, source: null })),
    assignments: form.items.filter(item => item.nodeKey !== "").map(item => ({ itemId: item.reference, nodeId: nodeMap.get(item.nodeKey)!.code })),
  });
  for (const item of form.items) {
    const priced = current.items.find(row => row.itemId === item.reference);
    const assignment = state.assignments.find(row => row.itemKey === item.key);
    if (!priced || qsQuantityDecimalSchema.parse(item.quantity) !== priced.quantity || unit(item.unit) !== unit(priced.unit) ||
        !same(item.entityBinding, priced.binding) || item.evidence === "sample" || item.evidence === "inferred")
      throw Error(`Worksheet item ${item.reference} does not match its priced measured evidence.`);
    if (!assignment || assignment.rateId !== priced.rate.id || assignment.rateRevision !== priced.rate.revision || assignment.optionId !== priced.optionId)
      throw Error(`Worksheet rate/option assignment changed for ${item.reference}; save a new revision before export.`);
  }
  return { form, report };
}

function content<T extends Record<string, unknown>>(raw: unknown, parseWorksheet: QsWorksheetParser<T>): QsPackageContent<T> {
  const checked = z.object({ format: z.literal(QS_PACKAGE_FORMAT), worksheet: z.record(z.string(), z.unknown()),
    current: z.unknown(), previous: z.unknown(), transmittal: qsTransmittalSchema,
    basisOfEstimate: notes, assumptions: notes, exclusions: notes,
  }).strict().parse(raw);
  const worksheet = parseWorksheet(structuredClone(checked.worksheet));
  const current = parseQsCostSnapshot(checked.current);
  const previous = checked.previous === null ? null : parseQsCostSnapshot(checked.previous);
  const { form } = inspectWorksheet(worksheet, current);
  if (current.input.revision > 1) {
    if (!previous || previous.input.revision !== current.input.revision - 1 ||
        !same(parseQsCostSnapshot(form.pricing.snapshots[form.pricing.snapshots.length - 2]), previous))
      throw Error("A later cost plan must include its preserved immediately preceding revision for comparison.");
    compareQsCostPlans(previous, current);
  } else if (previous !== null) throw Error("The initial cost revision has no preceding cost plan.");
  if (Date.parse(checked.transmittal.createdAt) < Date.parse(current.input.createdAt)) throw Error("The transmittal cannot predate its cost revision.");
  return { ...checked, worksheet, current, previous };
}
function checkedDelivery<T extends Record<string, unknown>>(value: QsPackageContent<T>, raw: unknown): DeliveryRecord {
  const delivery = deliveryRecordSchema.parse(raw);
  if (delivery.kind !== "quantity-surveying" || delivery.projectId !== value.current.input.projectId || delivery.revision !== value.current.input.revision)
    throw Error("Delivery identity does not match the cost plan project, kind or revision.");
  if (!same(delivery.sourceBinding, value.worksheet.binding ?? null)) throw Error("Delivery source binding does not match the frozen worksheet.");
  if (Date.parse(delivery.createdAt) < Date.parse(value.current.input.createdAt) ||
      (delivery.reviewedAt && Date.parse(delivery.reviewedAt) < Date.parse(delivery.createdAt)) ||
      (delivery.issuedAt && Date.parse(delivery.issuedAt) < Date.parse(delivery.reviewedAt!)))
    throw Error("Delivery timestamps are not in cost revision, creation, review and issue order.");
  if ((delivery.state === "reviewed-estimate" || delivery.state === "issued-deliverable") && !inspectWorksheet(value.worksheet, value.current).report.classificationComplete)
    throw Error("Classify every item before exporting a reviewed or issued cost plan.");
  return delivery;
}

export async function createQsCostPlanPackage<T extends Record<string, unknown>>(input: QsPackageInput<T>, parseWorksheet: QsWorksheetParser<T>): Promise<QsVerifiedPackage<T>> {
  // Snapshot before the first await: editing the live form during hashing cannot
  // relabel or change the file being prepared.
  const captured = structuredClone(input);
  const { delivery: requested, ...rest } = captured;
  const value = content({ ...rest, format: QS_PACKAGE_FORMAT }, parseWorksheet);
  const delivery = checkedDelivery(value, { ...requested, contentSha256: await qsPackageDigest(canonicalQsJson(value)) });
  return freeze({ ...value, delivery });
}
async function validatePackage<T extends Record<string, unknown>>(raw: QsVerifiedPackage<T>, parseWorksheet: QsWorksheetParser<T>): Promise<QsVerifiedPackage<T>> {
  const { delivery: requested, ...rest } = structuredClone(raw);
  const value = content(rest, parseWorksheet), delivery = checkedDelivery(value, requested);
  if (await qsPackageDigest(canonicalQsJson(value)) !== delivery.contentSha256) throw Error("Cost-plan content failed SHA-256 integrity verification.");
  return freeze({ ...value, delivery });
}

export const QS_COST_CSV_COLUMNS = ["Item", "Description", "Classification path", "Quantity", "Unit", "Evidence", "Currency", "Option", "Included in accepted total", "Material", "Labour", "Markup", "Net", "Tax", "Gross", "Contractor rate", "Rate revision", "Material supplier", "Material source reference", "Material source SHA-256", "Material book revision", "Material source line", "Labour source reference", "Wastage percent", "Markup percent", "Entity", "Geometry SHA-256", "Drawing SHA-256", "Calibration", "Material unit rate", "Material currency", "Material tax basis", "Material tax percent", "Material FX record", "Labour unit rate", "Labour currency", "Labour tax basis", "Labour tax percent", "Labour FX record", "Delivery state", "Content SHA-256"] as const;
const money = (minor: number) => `${minor < 0 ? "-" : ""}${Math.floor(Math.abs(minor) / 100)}.${String(Math.abs(minor) % 100).padStart(2, "0")}`;
function paths(form: WorksheetProjection): Map<string, string[]> {
  const nodes = new Map(form.nodes.map(node => [node.key, node]));
  return new Map(form.items.map(item => {
    const path: string[] = []; let key = item.nodeKey;
    while (key) { const node = nodes.get(key)!; path.unshift(`${node.code} ${node.label}`); key = node.parentKey; }
    return [item.reference, path];
  }));
}
function csv<T extends Record<string, unknown>>(value: QsVerifiedPackage<T>): string {
  const form = worksheetProjection.parse(value.worksheet), hierarchy = paths(form);
  const rows = value.current.items.map(item => [item.itemId, item.description, JSON.stringify(hierarchy.get(item.itemId)), item.quantity, item.unit,
    form.items.find(row => row.reference === item.itemId)!.evidence, value.current.input.currency, item.optionId ?? "BASE", String(item.included),
    money(item.materialMinor), money(item.labourMinor), money(item.markupMinor), money(item.netMinor), money(item.taxMinor), money(item.totalMinor),
    item.rate.id, String(item.rate.revision), item.materialSource.supplier, item.materialSource.sourceReference, item.materialSource.sourceSha256,
    String(item.materialSource.bookRevision), String(item.materialSource.sourceLine), item.labourSource?.sourceReference ?? "Excluded: " + item.rate.labourAssumption,
    item.rate.wastagePercent, item.rate.markupPercent, item.binding.entityId, item.binding.entityGeometrySha256, item.binding.sourceSha256 ?? "", item.binding.calibrationId ?? "",
    item.materialSource.rate, item.materialSource.currency, item.materialSource.taxBasis, item.materialSource.taxPercent, canonicalQsJson(item.materialSource.exchangeRate),
    item.labourSource?.rate ?? "", item.labourSource?.currency ?? "", item.labourSource?.taxBasis ?? "", item.labourSource?.taxPercent ?? "", canonicalQsJson(item.labourSource?.exchangeRate ?? null),
    value.delivery.state, value.delivery.contentSha256]);
  return [QS_COST_CSV_COLUMNS, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** Standard-font PDFs encode unsupported glyphs explicitly, never silently drop
 * identifiers. Exact Unicode remains in the sealed JSON and CSV. */
const pdfText = (value: string) => [...value].map(char => char === "\\" ? "\\\\" : char === "\n" ? "\n" : char >= " " && char <= "~" ? char : `\\u{${char.codePointAt(0)!.toString(16)}}`).join("");
function wrap(value: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of pdfText(value).split("\n")) {
    let line = "";
    for (const word of paragraph.match(/\S+/g) ?? []) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) { line = candidate; continue; }
      if (line) { lines.push(line); line = ""; }
      // Prefer word boundaries. Only an individual over-width identifier (for
      // example a long JSON/URL token) needs a lossless character fallback.
      for (const char of word) {
        if (line && font.widthOfTextAtSize(line + char, size) > width) { lines.push(line); line = ""; }
        line += char;
      }
    }
    lines.push(line || " ");
  }
  return lines;
}
async function pdf<T extends Record<string, unknown>>(value: QsVerifiedPackage<T>): Promise<Uint8Array> {
  const doc = await PDFDocument.create(), regular = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const created = new Date(value.transmittal.createdAt);
  doc.setTitle(value.transmittal.title); doc.setAuthor(value.transmittal.preparedBy); doc.setCreator("X-Ray cost plan"); doc.setProducer("X-Ray vector cost plan v1");
  doc.setCreationDate(created); doc.setModificationDate(created);
  const width = 841.89, height = 595.28, margin = 36, usable = width - margin * 2;
  let page: PDFPage, y = 0, section = "", auditContinuation: string | null = null;
  const newPage = (title: string) => {
    if (doc.getPageCount() >= 250) throw Error("Cost plan exceeds the 250-page export limit; split the issue into bounded packages.");
    section = title.replace(/(?: \(continued\))+$/, ""); page = doc.addPage([width, height]);
    page.drawRectangle({ x: 0, y: height - 78, width, height: 78, color: rgb(0.118, 0.161, 0.231) });
    page.drawText("X-RAY  /  COST PLAN", { x: margin, y: height - 25, size: 10, font: bold, color: rgb(0.68, 0.83, 0.94) });
    page.drawText(title, { x: margin, y: height - 51, size: 20, font: bold, color: rgb(1, 1, 1) });
    y = height - 99;
    if (auditContinuation) {
      for (const line of wrap(auditContinuation, bold, 10, usable)) {
        page.drawText(line, { x: margin, y, size: 10, font: bold, color: rgb(0.13, 0.18, 0.25) }); y -= 15;
      }
      y -= 5;
    }
  };
  const paragraph = (value: string, size = 10, strong = false) => {
    const font = strong ? bold : regular;
    for (const line of wrap(value, font, size, usable)) {
      if (y < 52) newPage(section + " (continued)");
      page.drawText(line, { x: margin, y, size, font, color: rgb(0.13, 0.18, 0.25) }); y -= size + 5;
    }
    y -= 5;
  };
  const table = (headers: string[], widths: number[], rows: string[][]) => {
    const header = () => {
      page.drawRectangle({ x: margin, y: y - 22, width: usable, height: 25, color: rgb(0.9, 0.94, 0.97) });
      let x = margin;
      headers.forEach((name, i) => { page.drawText(name, { x: x + 5, y: y - 13, size: 8, font: bold }); x += widths[i]; }); y -= 29;
    };
    if (y < 85) newPage(section + " (continued)");
    header();
    for (const row of rows) {
      const cells = row.map((cell, i) => wrap(cell, regular, 8, widths[i] - 10));
      const count = Math.max(...cells.map(cell => cell.length));
      for (let line = 0; line < count; line++) {
        if (y < 53) { newPage(section + " (continued)"); header(); }
        let x = margin;
        cells.forEach((cell, i) => { if (cell[line]) page.drawText(cell[line], { x: x + 5, y, size: 8, font: regular }); x += widths[i]; });
        y -= 11;
      }
      page.drawLine({ start: { x: margin, y: y + 4 }, end: { x: width - margin, y: y + 4 }, thickness: 0.3, color: rgb(0.78, 0.82, 0.87) }); y -= 9;
    }
    y -= 9;
  };
  const currency = value.current.input.currency, totals = value.current.acceptedTotal;
  newPage("Executive summary");
  paragraph(value.transmittal.title, 17, true);
  paragraph(`${value.transmittal.reference} / ${value.transmittal.revisionLabel} / ${value.delivery.state}`);
  paragraph(`Project: ${value.delivery.projectId} | Prepared by: ${value.transmittal.preparedBy} | Recipient: ${value.transmittal.recipient}`);
  paragraph(`Purpose: ${value.transmittal.purpose} | Transmitted: ${value.transmittal.createdAt}`);
  table(["Scope", "Net " + currency, "Tax " + currency, "Gross " + currency], [409.89, 120, 120, 120], [
    ["Base tender", money(value.current.baseTotal.netMinor), money(value.current.baseTotal.taxMinor), money(value.current.baseTotal.totalMinor)],
    ...value.current.options.map(option => [`${option.label} (${option.active ? "accepted" : "proposed - excluded"})`, money(option.totals.netMinor), money(option.totals.taxMinor), money(option.totals.totalMinor)]),
    ["Accepted total - base plus accepted options only", money(totals.netMinor), money(totals.taxMinor), money(totals.totalMinor)],
  ]);
  paragraph("Integrity seal (SHA-256 of frozen content): " + value.delivery.contentSha256, 8);
  paragraph("The seal verifies file integrity, not author identity or independent professional approval. Frozen evidence is historical; current geometry must be rechecked before new pricing.", 9);
  newPage("Basis of estimate and exclusions");
  for (const [heading, entries] of [["Basis of estimate", value.basisOfEstimate], ["Assumptions", value.assumptions], ["Exclusions", value.exclusions]] as const) {
    paragraph(heading, 13, true); entries.forEach((entry, i) => paragraph(`${i + 1}. ${entry}`));
  }
  paragraph("Rounding: " + value.current.rounding, 8);
  paragraph("Unsupported PDF glyphs are displayed as explicit Unicode escapes. Original text is retained in worksheet.json and schedule.csv.", 8);
  newPage("Elements and trade breakdown");
  const form = worksheetProjection.parse(value.worksheet), hierarchy = paths(form);
  paragraph(`Classification: ${form.hierarchyId} / ${form.hierarchyRevision}. Each item occurs once in the schedule; inclusive element subtotals overlap and must not be added together.`, 9);
  const groups = new Map<string, { count: number; total: bigint }>();
  for (const item of value.current.items) {
    const path = hierarchy.get(item.itemId)!;
    for (let i = 1; i <= Math.max(1, path.length); i++) {
      const key = path.length ? path.slice(0, i).join(" / ") : "Unassigned";
      const group = groups.get(key) ?? { count: 0, total: 0n };
      group.count++; if (item.included) group.total += BigInt(item.totalMinor); groups.set(key, group);
    }
  }
  table(["Element / sub-element - inclusive subtotal", "Items", "Accepted gross " + currency], [579.89, 60, 130],
    [...groups].map(([name, group]) => [name, String(group.count), money(Number(group.total))]));
  table(["Item / classification", "Quantity", "Unit", "Scope", "Net", "Tax", "Gross"], [299.89, 70, 45, 115, 80, 75, 85],
    value.current.items.map(item => [`${item.itemId}: ${item.description}\n${hierarchy.get(item.itemId)!.join(" / ") || "Unassigned"}`, item.quantity, item.unit,
      item.optionId === null ? "Base" : `${item.optionId}: ${item.included ? "accepted" : "excluded"}`, money(item.netMinor), money(item.taxMinor), money(item.totalMinor)]));
  newPage("Cost variance report");
  const delta: QsCostDelta | null = value.previous ? compareQsCostPlans(value.previous, value.current) : null;
  if (!delta) paragraph("Initial revision: no earlier cost plan was supplied. A zero variance is not inferred.");
  else {
    paragraph(`Revision ${delta.previousRevision} to ${delta.currentRevision}. Quantity is valued at the old rate; remaining rate/policy movement and scope membership changes are reported separately.`, 9);
    table(["Item / status", "Quantity delta", "Quantity " + currency, "Rate " + currency, "Scope " + currency, "Total " + currency], [259.89, 110, 100, 100, 100, 100],
      [...delta.rows.map(row => [`${row.itemId} / ${row.status}`, row.quantityDelta ?? "Not comparable", money(row.quantityMinor), money(row.rateMinor), money(row.scopeMinor), money(row.totalMinor)]),
        ["ACCEPTED TOTAL CHANGE", "", money(delta.totals.quantityMinor), money(delta.totals.rateMinor), money(delta.totals.scopeMinor), money(delta.totals.totalMinor)]]);
  }
  newPage("Source and rate audit trail");
  for (const item of value.current.items) {
    const paragraphs: { text: string; size: number; strong: boolean }[] = [
      { text: `${item.itemId} / ${item.description}`, size: 11, strong: true },
      { text: `Entity ${item.binding.entityId}; calibration ${item.binding.calibrationId}; drawing SHA-256 ${item.binding.sourceSha256}; geometry SHA-256 ${item.binding.entityGeometrySha256}`, size: 8, strong: false },
    ];
    for (const [kind, source] of [["Material", item.materialSource], ["Labour", item.labourSource]] as const) {
      paragraphs.push({ text: source ? `${kind}: ${source.supplier}; ${source.sourceReference}; book ${source.bookId} revision ${source.bookRevision} line ${source.sourceLine}; source SHA-256 ${source.sourceSha256}; rate ${source.rate} ${source.currency}/${source.unit}; tax ${source.taxBasis} ${source.taxPercent}%.` : `Labour excluded: ${item.rate.labourAssumption}`, size: 8, strong: false });
      if (source?.exchangeRate) paragraphs.push({ text: `Reviewed FX: ${canonicalQsJson(source.exchangeRate)}`, size: 8, strong: false });
    }
    paragraphs.push({ text: `Contractor rate ${item.rate.id} revision ${item.rate.revision}; wastage ${item.rate.wastagePercent}%; markup ${item.rate.markupPercent}%; labour basis: ${item.rate.labourAssumption}`, size: 8, strong: false });
    const blockHeight = paragraphs.reduce((sum, entry) => sum + wrap(entry.text, entry.strong ? bold : regular, entry.size, usable).length * (entry.size + 5) + 5, 0);
    const headingHeight = wrap(paragraphs[0].text, bold, 11, usable).length * 16 + 5;
    // Keep a bounded item together when it fits a fresh page. An oversized
    // provenance block may span pages, but every continuation repeats identity.
    if ((blockHeight <= height - 99 - 52 && y - blockHeight < 52) || y - headingHeight < 78) newPage(section + " (continued)");
    auditContinuation = `Item ${item.itemId} (continued)`;
    for (const entry of paragraphs) paragraph(entry.text, entry.size, entry.strong);
    auditContinuation = null;
  }
  doc.getPages().forEach((sheet, index) => {
    sheet.drawText(`${value.delivery.state} | Revision ${value.delivery.revision} | ${value.delivery.contentSha256.slice(0, 16)}`, { x: margin, y: 22, font: regular, size: 8, color: rgb(0.35, 0.4, 0.46) });
    sheet.drawText(`${index + 1} / ${doc.getPageCount()}`, { x: width - margin - 40, y: 22, font: regular, size: 8 });
  });
  return doc.save({ useObjectStreams: false, updateFieldAppearances: false });
}

const manifestSchema = z.object({ format: z.literal("xray.qs-package-manifest/v1"), contentSha256: sha256,
  entries: z.array(z.object({ name: z.enum(QS_PACKAGE_ENTRIES), sizeBytes: z.number().int().nonnegative().max(QS_PACKAGE_MAX_ENTRY_BYTES), sha256 }).strict()).length(7),
  sealSha256: sha256,
}).strict();
const jsonBytes = (value: unknown) => encoder.encode(canonicalQsJson(value));
function readJson(bytes: Uint8Array): unknown { const text = decoder.decode(bytes), value: unknown = JSON.parse(text); if (canonicalQsJson(value) !== text) throw Error("Package JSON must be canonical and contain no duplicate keys."); return value; }
async function artifacts<T extends Record<string, unknown>>(value: QsVerifiedPackage<T>) {
  const pdfBytes = await pdf(value), csvText = csv(value);
  const { transmittal, basisOfEstimate, assumptions, exclusions } = value;
  const files: Record<string, Uint8Array> = {
    "worksheet.json": jsonBytes(value.worksheet), "cost-plan.json": jsonBytes(value.current), "previous-cost-plan.json": jsonBytes(value.previous),
    "transmittal.json": jsonBytes({ transmittal, basisOfEstimate, assumptions, exclusions }), "delivery.json": jsonBytes(value.delivery),
    "cost-plan.pdf": pdfBytes, "schedule.csv": encoder.encode(csvText),
  };
  let total = 0;
  const entries = [];
  for (const [name, bytes] of Object.entries(files)) {
    total += bytes.length;
    if (bytes.length > QS_PACKAGE_MAX_ENTRY_BYTES || total > QS_PACKAGE_MAX_BYTES) throw Error("Cost plan exceeds the supported package size.");
    entries.push({ name, sizeBytes: bytes.length, sha256: await qsPackageDigest(bytes) });
  }
  const seal = { format: "xray.qs-package-manifest/v1" as const, contentSha256: value.delivery.contentSha256, entries };
  files["manifest.json"] = jsonBytes({ ...seal, sealSha256: await qsPackageDigest(canonicalQsJson(seal)) });
  return { files, pdf: pdfBytes, csv: csvText };
}
export async function exportQsCostPlanPackage<T extends Record<string, unknown>>(raw: QsVerifiedPackage<T>, parseWorksheet: QsWorksheetParser<T>) {
  const value = await validatePackage(raw, parseWorksheet), result = await artifacts(value);
  const bytes = zipSync(result.files, { level: 0, mtime: new Date("2000-01-01T00:00:00Z") });
  if (bytes.length > QS_PACKAGE_MAX_BYTES) throw Error("Cost plan exceeds the supported package size.");
  return { bytes, pdf: result.pdf, csv: result.csv, contentSha256: value.delivery.contentSha256, packageSha256: await qsPackageDigest(bytes) };
}

/** Validate central and local headers before inflation; no ZIP64, descriptors,
 * encrypted files, extra entries, duplicate paths or unbounded declarations. */
function preflightZip(bytes: Uint8Array): Map<string, number> {
  if (bytes.length > QS_PACKAGE_MAX_BYTES || bytes.length < 22) throw Error("Unsupported cost-plan package size.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), end = bytes.length - 22;
  const u16 = (at: number) => view.getUint16(at, true), u32 = (at: number) => view.getUint32(at, true);
  if (u32(end) !== 0x06054b50 || u16(end + 20) !== 0 || u16(end + 4) !== 0 || u16(end + 6) !== 0 || u16(end + 8) !== 8 || u16(end + 10) !== 8)
    throw Error("The cost-plan ZIP must contain exactly the eight supported files.");
  let offset = u32(end + 16), total = 0; const start = offset;
  if (start + u32(end + 12) !== end) throw Error("Invalid ZIP directory bounds.");
  const entries = new Map<string, number>(), ranges: [number, number][] = [];
  for (let i = 0; i < 8; i++) {
    if (offset + 46 > end || u32(offset) !== 0x02014b50) throw Error("Invalid ZIP directory entry.");
    const flags = u16(offset + 8), method = u16(offset + 10), compressed = u32(offset + 20), size = u32(offset + 24);
    const nameLength = u16(offset + 28), extra = u16(offset + 30), comment = u16(offset + 32), local = u32(offset + 42);
    if (offset + 46 + nameLength + extra + comment > end) throw Error("Invalid ZIP entry bounds.");
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    total += size;
    if (!entryNames.has(name) || entries.has(name) || (flags & ~0x800) !== 0 || ![0, 8].includes(method) || size > QS_PACKAGE_MAX_ENTRY_BYTES || total > QS_PACKAGE_MAX_BYTES)
      throw Error("ZIP contains an unsupported path, duplicate, compression feature or oversized entry.");
    if (local + 30 > start || u32(local) !== 0x04034b50 || u16(local + 6) !== flags || u16(local + 8) !== method ||
        u32(local + 14) !== u32(offset + 16) || u32(local + 18) !== compressed || u32(local + 22) !== size || u16(local + 26) !== nameLength)
      throw Error("ZIP local metadata does not match its directory.");
    const data = local + 30 + nameLength + u16(local + 28), finish = data + compressed;
    if (finish > start || decoder.decode(bytes.subarray(local + 30, local + 30 + nameLength)) !== name) throw Error("ZIP file data is out of bounds.");
    ranges.push([local, finish]); entries.set(name, size); offset += 46 + nameLength + extra + comment;
  }
  if (offset !== end) throw Error("Unexpected ZIP directory data.");
  ranges.sort((a, b) => a[0] - b[0]);
  if (ranges[0][0] !== 0 || ranges.some((range, index) => range[1] !== (ranges[index + 1]?.[0] ?? start))) throw Error("ZIP contains hidden or overlapping file data.");
  return entries;
}
function boundedUnzip(bytes: Uint8Array): Record<string, Uint8Array> {
  const expected = preflightZip(bytes), files: Record<string, Uint8Array> = Object.create(null);
  let total = 0;
  const unzip = new Unzip(file => {
    const chunks: Uint8Array[] = []; let size = 0;
    if (!expected.has(file.name) || files[file.name]) throw Error("Unexpected ZIP stream entry.");
    file.ondata = (error, chunk, final) => {
      if (error) throw error;
      size += chunk.length; total += chunk.length;
      if (size > expected.get(file.name)! || size > QS_PACKAGE_MAX_ENTRY_BYTES || total > QS_PACKAGE_MAX_BYTES) { file.terminate(); throw Error("Inflated package exceeds its declared size limit."); }
      chunks.push(chunk);
      if (final) {
        if (size !== expected.get(file.name)) throw Error("ZIP entry length does not match its declaration.");
        const combined = new Uint8Array(size); let at = 0; for (const part of chunks) { combined.set(part, at); at += part.length; } files[file.name] = combined;
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  for (let at = 0; at < bytes.length; at += 1024) unzip.push(bytes.subarray(at, at + 1024), at + 1024 >= bytes.length);
  if (Object.keys(files).length !== 8) throw Error("The cost-plan package is incomplete.");
  return files;
}
export async function parseQsCostPlanPackage<T extends Record<string, unknown>>(bytes: Uint8Array, parseWorksheet: QsWorksheetParser<T>): Promise<QsVerifiedPackage<T>> {
  const files = boundedUnzip(Uint8Array.from(bytes)), manifest = manifestSchema.parse(readJson(files["manifest.json"]));
  const { sealSha256, ...seal } = manifest;
  if (await qsPackageDigest(canonicalQsJson(seal)) !== sealSha256) throw Error("Package manifest failed SHA-256 integrity verification.");
  if (new Set(manifest.entries.map(entry => entry.name)).size !== 7 || manifest.entries.some(entry => entry.name === "manifest.json")) throw Error("Invalid package manifest membership.");
  for (const entry of manifest.entries) if (files[entry.name]?.length !== entry.sizeBytes || await qsPackageDigest(files[entry.name]) !== entry.sha256)
    throw Error(`Package file ${entry.name} failed SHA-256 integrity verification.`);
  const meta = z.object({ transmittal: qsTransmittalSchema, basisOfEstimate: notes, assumptions: notes, exclusions: notes }).strict().parse(readJson(files["transmittal.json"]));
  const value = await validatePackage({ format: QS_PACKAGE_FORMAT, worksheet: readJson(files["worksheet.json"]) as T,
    current: readJson(files["cost-plan.json"]) as QsCostSnapshot, previous: readJson(files["previous-cost-plan.json"]) as QsCostSnapshot | null,
    delivery: readJson(files["delivery.json"]) as DeliveryRecord, ...meta }, parseWorksheet);
  if (manifest.contentSha256 !== value.delivery.contentSha256) throw Error("Package manifest and delivery content identities differ.");
  // Digests alone cannot establish that the displayed schedule matches its
  // worksheet if an attacker recalculates the whole manifest. Rebuild visible
  // artifacts from validated inputs and compare their exact deterministic bytes.
  if (decoder.decode(files["schedule.csv"]) !== csv(value) || await qsPackageDigest(files["cost-plan.pdf"]) !== await qsPackageDigest(await pdf(value)))
    throw Error("The PDF or CSV does not reconcile with the frozen worksheet.");
  return value;
}
export async function restoreQsCostPlanWorksheet<T extends Record<string, unknown>>(raw: QsVerifiedPackage<T>, currentProjectId: string, parseWorksheet: QsWorksheetParser<T>): Promise<T> {
  const value = await validatePackage(raw, parseWorksheet);
  if (value.delivery.projectId !== currentProjectId) throw Error("This cost plan belongs to another project. The current worksheet was preserved.");
  return parseWorksheet(structuredClone(value.worksheet));
}
