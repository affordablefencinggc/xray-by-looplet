import { z } from "zod";

const decimal = z.string().regex(/^\d+(?:\.\d+)?$/);
export const quoteRecordSchema = z.object({
  from: z.string().trim().min(1).max(200), customer: z.string().trim().min(1).max(200),
  siteAddress: z.string().max(300), reference: z.string().trim().min(1).max(60),
  validDays: z.number().int().min(1).max(365), notes: z.string().max(2000), preparedAt: z.string().datetime(),
  lines: z.array(z.object({ description: z.string(), stockCode: z.string(), quantity: decimal, unit: z.string(),
    rate: decimal, amount: decimal, currency: z.string(), source: z.string(), taxLabel: z.string().optional() }).strict()).min(1).max(5000),
  totals: z.array(z.object({ currency: z.string(), taxLabel: z.string(), amount: decimal,
    taxAmount: decimal.nullable(), totalWithTax: decimal.nullable() }).strict()).min(1),
  provenance: z.array(z.string()),
  pricingBasis: z.object({ libraryRevision: z.number().int().nonnegative(), materialRegisterRevision: z.number().int().positive().nullable(),
    books: z.array(z.object({ id: z.string().uuid(), name: z.string(), revision: z.number().int().positive(), supplier: z.string(),
      effectiveDate: z.string(), sourceReference: z.string(), fileName: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict()).min(1),
  }).strict(),
  issue: z.object({ id: z.string().uuid(), issuedAt: z.string().datetime() }).strict().optional(),
}).strict();
export type QuoteDraft = z.infer<typeof quoteRecordSchema>;
export const issuedQuoteSchema = quoteRecordSchema.required({ issue: true }).refine(
  quote => Date.parse(quote.issue.issuedAt) >= Date.parse(quote.preparedAt), "An issue cannot predate its quote.",
);
export type IssuedQuote = z.infer<typeof issuedQuoteSchema>;

/** Pad, never round, a supplier rate. Rates may carry up to six decimal places. */
export function quoteRate(value: string | number): string {
  const [whole, fraction = ""] = String(value).split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}

export function quoteTaxLabel(basis: "inclusive" | "exclusive" | "unspecified", percent: number | null): string {
  return basis === "inclusive" ? `tax included${percent !== null ? ` (${percent}%)` : ""}`
    : basis === "exclusive" ? (percent !== null ? `plus tax ${percent}%` : "tax not included") : "tax basis not stated";
}
