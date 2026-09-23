import { zipSync, strToU8 } from "fflate";
import type { QuoteDraft } from "./quotePdf.ts";

/** Stable, documented shape for other apps and automations (import scripts, Zapier/Make, custom CRMs). */
export const QUOTE_HANDOVER_SCHEMA = "xray.quote-handover/v1" as const;

export type HandoverFile = { name: string; mime: string; bytes: Uint8Array };

const slug = (text: string) => text.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "quote";
export const handoverBaseName = (draft: QuoteDraft) => `${slug(draft.reference)}-draft-quote`;

export function quoteHandoverJson(draft: QuoteDraft): string {
  return JSON.stringify({
    schema: QUOTE_HANDOVER_SCHEMA,
    status: "draft-not-sent",
    reference: draft.reference, preparedAt: draft.preparedAt, validDays: draft.validDays,
    from: draft.from, customer: draft.customer, siteAddress: draft.siteAddress, notes: draft.notes,
    lines: draft.lines.map(line => ({ description: line.description, stockCode: line.stockCode || null, quantity: line.quantity, unit: line.unit,
      unitRate: line.rate, amount: line.amount, currency: line.currency, quantitySource: line.source })),
    totals: draft.totals.map(total => ({ currency: total.currency, subtotal: total.amount, taxBasis: total.taxLabel, tax: total.taxAmount, total: total.totalWithTax })),
    provenance: draft.provenance,
  }, null, 2) + "\n";
}

/**
 * One row per line with the fields most quoting and accounting imports ask for. Column names are
 * plain so they can be mapped in the receiving app; no account codes or tax types are guessed.
 */
export function quoteLinesCsv(draft: QuoteDraft): string {
  const cell = (value: unknown) => { let text = value === null || value === undefined ? "" : String(value); if (/^[\s]*[=+@'-]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; };
  const expiry = new Date(Date.parse(draft.preparedAt) + draft.validDays * 86_400_000).toISOString().slice(0, 10);
  const rows = draft.lines.map(line => [draft.customer, draft.reference, draft.preparedAt.slice(0, 10), expiry, line.stockCode, line.description, line.quantity, line.unit, line.rate, line.amount, line.currency,
    draft.totals.find(total => total.currency === line.currency)?.taxLabel ?? "", line.source, draft.siteAddress]);
  return "﻿" + [["ContactName", "Reference", "Date", "ExpiryDate", "ItemCode", "Description", "Quantity", "Unit", "UnitAmount", "LineAmount", "Currency", "Tax", "QuantitySource", "SiteAddress"], ...rows]
    .map(row => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function quoteHandoverFiles(draft: QuoteDraft, pdf: Uint8Array): HandoverFile[] {
  const base = handoverBaseName(draft);
  return [
    { name: `${base}.pdf`, mime: "application/pdf", bytes: pdf },
    { name: `${base}-lines.csv`, mime: "text/csv", bytes: strToU8(quoteLinesCsv(draft)) },
    { name: `${base}.json`, mime: "application/json", bytes: strToU8(quoteHandoverJson(draft)) },
  ];
}

export function quoteHandoverZip(draft: QuoteDraft, files: HandoverFile[]): HandoverFile {
  const entries = Object.fromEntries(files.map(file => [file.name, file.bytes]));
  return { name: `${handoverBaseName(draft)}-handover.zip`, mime: "application/zip", bytes: zipSync(entries, { level: 6, mtime: new Date(draft.preparedAt) }) };
}

/** Opens the user's mail app with the quote summary; the PDF is attached by the user from where it was saved. */
export function quoteEmailLink(draft: QuoteDraft, savedLocation: string | null): string {
  const total = draft.totals.map(t => `${t.currency} ${t.totalWithTax ?? t.amount}${t.totalWithTax ? "" : ` (${t.taxLabel})`}`).join(", ");
  const body = [`Hi ${draft.customer},`, "", `Please find attached our quote ${draft.reference} for ${draft.siteAddress || "the site"}.`, `Total: ${total}. Valid for ${draft.validDays} days.`, "",
    savedLocation ? `(Attach: ${savedLocation})` : `(Attach the PDF ${handoverBaseName(draft)}.pdf before sending.)`, "", draft.from].join("\n");
  return `mailto:?subject=${encodeURIComponent(`Quote ${draft.reference} - ${draft.from}`)}&body=${encodeURIComponent(body)}`;
}
