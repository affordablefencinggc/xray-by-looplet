import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { priceBookLibrarySchema, pricedWorksheetTotals, resolvePricedLine, type PriceBookLibrary } from "./priceBooks.ts";
import { quoteRecordSchema, quoteRate, quoteTaxLabel, type QuoteDraft } from "./quoteRecord.ts";
export type { QuoteDraft } from "./quoteRecord.ts";

export type QuoteDraftDetails = {
  from: string;
  customer: string;
  siteAddress: string;
  reference: string;
  validDays: number;
  notes: string;
};
export type QuoteDraftLine = QuoteDraft["lines"][number];

const decimalTimes = (amount: string, percent: number, decimals: number) => {
  // amount has `decimals` places; percent up to 6 places. Half-up to `decimals`.
  const [w, f = ""] = amount.split("."), minor = BigInt(w + f.padEnd(decimals, "0"));
  const pScaled = BigInt(Math.round(percent * 1_000_000)), raw = minor * pScaled, divisor = 100_000_000n;
  const rounded = (raw + divisor / 2n) / divisor;
  const text = rounded.toString().padStart(decimals + 1, "0");
  return decimals ? `${text.slice(0, -decimals)}.${text.slice(-decimals)}` : text;
};
const addDecimal = (a: string, b: string, decimals: number) => {
  const minor = (v: string) => { const [w, f = ""] = v.split("."); return BigInt(w + f.padEnd(decimals, "0")); };
  const text = (minor(a) + minor(b)).toString().padStart(decimals + 1, "0");
  return decimals ? `${text.slice(0, -decimals)}.${text.slice(-decimals)}` : text;
};

/**
 * Builds the reviewable draft from the saved worksheet only. Refuses while material-linked lines
 * are stale, so a draft can never show prices from an out-of-date register as current.
 */
export function buildQuoteDraft(library: PriceBookLibrary, details: QuoteDraftDetails, register: { commitRevision: number; current: boolean } | null, now = new Date()): QuoteDraft {
  if (!library.worksheet.length) throw Error("Add priced lines before preparing a quote.");
  const linked = library.worksheet.filter(line => line.bom);
  if (linked.length && (!register || !register.current || linked.some(line => line.bom!.commitRevision !== register.commitRevision)))
    throw Error("The materials changed after these prices. Rebuild the materials so the linked lines update, then prepare the quote.");
  const trimmed = { ...details, from: details.from.trim(), customer: details.customer.trim(), siteAddress: details.siteAddress.trim(), reference: details.reference.trim(), notes: details.notes.trim() };
  if (!trimmed.from || !trimmed.customer || !trimmed.reference) throw Error("Enter your business name, the customer and a quote reference.");
  if (!Number.isInteger(trimmed.validDays) || trimmed.validDays < 1 || trimmed.validDays > 365) throw Error("Validity must be 1 to 365 days.");
  const lines = library.worksheet.map(line => {
    const r = resolvePricedLine(library, line);
    return { description: r.row.description, stockCode: r.row.stockCode, quantity: line.quantity, unit: r.row.unit, rate: quoteRate(r.row.rate), amount: r.amount, currency: r.revision.metadata.currency,
      source: line.bom ? `material register ${line.bom.commitRevision} (${line.bom.key})` : "entered", taxLabel: quoteTaxLabel(r.revision.metadata.taxBasis, r.revision.metadata.taxPercent) };
  });
  const totals = pricedWorksheetTotals(library).map(total => {
    const taxAmount = total.taxBasis === "exclusive" && total.taxPercent !== null ? decimalTimes(total.amount, total.taxPercent, total.decimals) : null;
    return { currency: total.currency, amount: total.amount, taxAmount, totalWithTax: taxAmount ? addDecimal(total.amount, taxAmount, total.decimals) : null,
      taxLabel: quoteTaxLabel(total.taxBasis, total.taxPercent) };
  });
  const books = [...new Set(library.worksheet.map(line => { const r = resolvePricedLine(library, line); return `${r.book.name} revision ${line.bookRevision} · ${r.revision.metadata.supplier} · effective ${r.revision.metadata.effectiveDate} · ${r.revision.source.fileName} SHA-256 ${r.revision.source.sha256.slice(0, 16)}…`; }))];
  const provenance = [...books, ...(linked.length ? [`Quantities for ${linked.length} line(s) from material register ${register!.commitRevision}; other quantities entered by the estimator.`] : ["All quantities entered by the estimator."])];
  const basis = [...new Map(library.worksheet.map(line => {
    const { book, revision } = resolvePricedLine(library, line);
    return [`${book.id}:${revision.revision}`, { id: book.id, name: book.name, revision: revision.revision, supplier: revision.metadata.supplier,
      effectiveDate: revision.metadata.effectiveDate, sourceReference: revision.metadata.sourceReference, fileName: revision.source.fileName, sha256: revision.source.sha256 }] as const;
  })).values()];
  return quoteRecordSchema.parse({ ...trimmed, preparedAt: now.toISOString(), lines, totals, provenance,
    pricingBasis: { libraryRevision: library.revision, materialRegisterRevision: linked.length ? register!.commitRevision : null, books: basis } });
}

/** Snapshot the current worksheet; subsequent rate, quantity and detail changes affect new drafts only. */
export function issueQuote(library: PriceBookLibrary, details: QuoteDraftDetails, register: { commitRevision: number; current: boolean } | null,
  now = new Date(), makeId = () => crypto.randomUUID()): PriceBookLibrary {
  const draft = buildQuoteDraft(library, details, register, now);
  if (library.issuedQuotes?.some(q => q.reference.toLowerCase() === draft.reference.toLowerCase()))
    throw Error("That reference is already issued. Enter a new quote reference for a revision.");
  return priceBookLibrarySchema.parse({ ...library, revision: library.revision + 1,
    issuedQuotes: [...(library.issuedQuotes ?? []), { ...draft, issue: { id: makeId(), issuedAt: now.toISOString() } }] });
}

const PAGE = { width: 595.28, height: 841.89, margin: 48 };
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = text.replace(/\s+/g, " ").split(" "), out: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width || !line) line = next; else { out.push(line); line = word; }
  }
  if (line) out.push(line);
  return out;
}
/** WinAnsi-safe text for the standard fonts. */
const safe = (text: string) => text.replace(/[‐-―]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/×/g, "x").replace(/…/g, "...").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");

export async function quoteDraftPdf(draft: QuoteDraft): Promise<Uint8Array> {
  draft = quoteRecordSchema.parse(draft);
  const issued = !!draft.issue, title = issued ? "Issued quote" : "Draft quote";
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${title} ${draft.reference}`); pdf.setAuthor(draft.from); pdf.setSubject(issued ? "Issued quote - frozen estimator record" : "Draft quote for review - not sent"); pdf.setCreator("X-Ray by Looplet");
  const regular = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage = pdf.addPage([PAGE.width, PAGE.height]), y = PAGE.height - PAGE.margin;
  const width = PAGE.width - PAGE.margin * 2, grey = rgb(0.35, 0.35, 0.35);
  const newPage = () => { page = pdf.addPage([PAGE.width, PAGE.height]); y = PAGE.height - PAGE.margin; };
  const ensure = (needed: number) => { if (y - needed < PAGE.margin + 30) newPage(); };
  const text = (value: string, x: number, size = 10, font = regular, color = rgb(0, 0, 0)) => page.drawText(safe(value), { x, y, size, font, color });
  const para = (value: string, size = 10, font = regular, color = rgb(0, 0, 0)) => { for (const line of wrap(safe(value), font, size, width)) { ensure(size + 4); text(line, PAGE.margin, size, font, color); y -= size + 4; } };

  text(issued ? "ISSUED QUOTE" : "DRAFT QUOTE", PAGE.margin, 20, bold); text(issued ? "Frozen issue record" : "For review - not sent to the customer", PAGE.margin + 175, 10, regular, rgb(0.7, 0.1, 0.1)); y -= 28;
  para(draft.from, 12, bold); y -= 6;
  for (const [label, value] of [["Customer", draft.customer], ["Site", draft.siteAddress || "Not recorded"], ["Reference", draft.reference],
    ["Prepared", draft.preparedAt.slice(0, 10)], ["Valid for", `${draft.validDays} days from the prepared date`]] as const) {
    ensure(14); text(`${label}:`, PAGE.margin, 10, bold); for (const [i, line] of wrap(safe(value), regular, 10, width - 80).entries()) { if (i) { y -= 14; ensure(14); } text(line, PAGE.margin + 80, 10); } y -= 14;
  }
  if (draft.issue) { para(`Issued: ${draft.issue.issuedAt}`); para(`Issue ID: ${draft.issue.id}`, 8); }
  y -= 10;
  const cols = [{ x: PAGE.margin, w: 250, label: "Description" }, { x: PAGE.margin + 255, w: 50, label: "Qty" }, { x: PAGE.margin + 310, w: 35, label: "Unit" },
    { x: PAGE.margin + 350, w: 65, label: "Rate" }, { x: PAGE.margin + 420, w: 79, label: "Amount" }];
  const header = () => { ensure(22); for (const c of cols) text(c.label, c.x, 9, bold); y -= 6; page.drawLine({ start: { x: PAGE.margin, y }, end: { x: PAGE.margin + width, y }, thickness: 0.7, color: grey }); y -= 14; };
  header();
  for (const line of draft.lines) {
    const desc = wrap(safe(line.stockCode ? `${line.description} (${line.stockCode})` : line.description), regular, 9, cols[0].w);
    if (y - desc.length * 12 < PAGE.margin + 30) { newPage(); header(); }
    text(desc[0], cols[0].x, 9); text(line.quantity, cols[1].x, 9); text(line.unit, cols[2].x, 9); text(quoteRate(line.rate), cols[3].x, 9); text(`${line.currency} ${line.amount}`, cols[4].x, 9);
    for (const extra of desc.slice(1)) { y -= 12; text(extra, cols[0].x, 9); }
    y -= 12; text(line.source, cols[0].x, 7, regular, grey); y -= 13;
  }
  y -= 4; ensure(20); page.drawLine({ start: { x: PAGE.margin, y: y + 8 }, end: { x: PAGE.margin + width, y: y + 8 }, thickness: 0.7, color: grey });
  for (const total of draft.totals) {
    ensure(48); text(`Subtotal (${total.taxLabel})`, cols[3].x - 130, 10, bold); text(`${total.currency} ${total.amount}`, cols[4].x, 10, bold); y -= 14;
    if (total.taxAmount && total.totalWithTax) { text("Tax", cols[3].x - 130, 10); text(`${total.currency} ${total.taxAmount}`, cols[4].x, 10); y -= 14; text("Total", cols[3].x - 130, 11, bold); text(`${total.currency} ${total.totalWithTax}`, cols[4].x, 11, bold); y -= 16; }
  }
  y -= 8;
  if (draft.notes) { para("Notes", 10, bold); para(draft.notes, 9); y -= 6; }
  para(issued ? "Basis of this issued quote" : "Basis of this draft", 10, bold);
  para(`Price library revision: ${draft.pricingBasis.libraryRevision}`, 8, regular, grey);
  for (const line of draft.provenance) para(`- ${line}`, 8, regular, grey);
  para("- No waste, delivery, labour, margin or site conditions are added unless listed above. Quantities come from drawing takeoff and require site verification. This quote is not an engineering or compliance approval.", 8, regular, grey);
  const pages = pdf.getPages();
  pages.forEach((p, i) => p.drawText(safe(`${title} ${draft.reference} - page ${i + 1} of ${pages.length}`), { x: PAGE.margin, y: 24, size: 8, font: regular, color: grey }));
  return pdf.save();
}
