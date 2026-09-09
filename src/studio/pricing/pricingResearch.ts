import { z } from "zod";

/**
 * Shared, browser-safe contract for bounded supplier product research.
 * Search collects candidate source links only; nothing here changes a rate.
 */
export const PRICING_RESEARCH_VERSION = "xray.pricing-research/v1";
export const PRICING_RESEARCH_MAX_RESULTS = 5;
export const PRICING_RESEARCH_MAX_DOMAINS = 3;

const HOSTNAME_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** A registrable supplier hostname: lower-case DNS labels, at least one dot, no IP literal. */
export function isSupplierHostname(value: string): boolean {
  if (value.length < 3 || value.length > 253 || IPV4.test(value) || value.includes(":")) return false;
  const labels = value.split(".");
  if (labels.length < 2 || labels.at(-1) === "localhost" || labels.at(-1) === "local") return false;
  return labels.every((label) => HOSTNAME_LABEL.test(label));
}

function ipv4Issue(host: string): string | null {
  const match = IPV4.exec(host);
  if (!match) return null;
  const [a, b] = match.slice(1).map(Number);
  if (match.slice(1).some((part) => Number(part) > 255)) return "malformed IPv4 address";
  if (a === 127) return "loopback IPv4 address";
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return "private IPv4 address";
  if (a === 169 && b === 254) return "link-local IPv4 address";
  if (a === 0 || (a === 100 && b >= 64 && b <= 127) || a >= 224) return "reserved IPv4 address";
  return "IP-literal host";
}

function ipv6Issue(host: string): string | null {
  if (!host.startsWith("[") || !host.endsWith("]")) return null;
  const address = host.slice(1, -1).toLowerCase();
  if (address === "::1") return "loopback IPv6 address";
  if (address === "::") return "unspecified IPv6 address";
  if (/^fe[89ab]/.test(address)) return "link-local IPv6 address";
  if (/^f[cd]/.test(address)) return "private IPv6 address";
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(address);
  if (mapped) return ipv4Issue(mapped[1]) ?? "IP-literal host";
  // The URL parser serialises IPv4-mapped addresses in hex (::ffff:a00:1); map them back before classifying.
  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(address);
  if (mappedHex) {
    const [high, low] = [parseInt(mappedHex[1], 16), parseInt(mappedHex[2], 16)];
    return ipv4Issue(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`) ?? "IP-literal host";
  }
  return "IP-literal host";
}

/** Returns null when the URL is a public HTTPS supplier page, otherwise the reason it is refused. */
export function publicHttpsUrlIssue(value: string): string | null {
  let url: URL;
  try { url = new URL(value); } catch { return "not a valid URL"; }
  if (url.protocol !== "https:") return "only https URLs are accepted";
  if (url.username || url.password) return "embedded credentials are not accepted";
  if (url.port) return "only the default HTTPS port is accepted";
  const host = url.hostname;
  const issue = ipv6Issue(host) ?? ipv4Issue(host);
  if (issue) return issue;
  if (!isSupplierHostname(host)) return "not a public supplier hostname";
  return null;
}

export const isPublicHttpsUrl = (value: string) => publicHttpsUrlIssue(value) === null;

const supplierHostnameSchema = z.string().trim().toLowerCase().max(253)
  .refine(isSupplierHostname, "Enter a public supplier hostname such as www.bunnings.com.au");

export const pricingResearchRequestSchema = z.object({
  schema: z.literal(PRICING_RESEARCH_VERSION).default(PRICING_RESEARCH_VERSION),
  query: z.string().trim().min(1, "Enter a search query.").max(200, "Query must be 200 characters or fewer."),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Country must be an ISO-3166 alpha-2 code.").default("AU"),
  location: z.string().trim().max(120).optional(),
  includeDomains: z.array(supplierHostnameSchema).max(PRICING_RESEARCH_MAX_DOMAINS).optional(),
  excludeDomains: z.array(supplierHostnameSchema).max(PRICING_RESEARCH_MAX_DOMAINS).optional(),
  limit: z.number().int().min(1).max(PRICING_RESEARCH_MAX_RESULTS).default(PRICING_RESEARCH_MAX_RESULTS),
  projectId: z.string().trim().min(1).max(200),
  requestId: z.string().trim().min(1).max(100),
}).strict().refine((r) => !(r.includeDomains?.length && r.excludeDomains?.length), {
  message: "includeDomains and excludeDomains cannot be combined.",
  path: ["excludeDomains"],
});
export type PricingResearchRequest = z.infer<typeof pricingResearchRequestSchema>;
export type PricingResearchRequestInput = z.input<typeof pricingResearchRequestSchema>;

export const supplierCandidateSchema = z.object({
  url: z.string().max(2048).refine(isPublicHttpsUrl, "Candidate URL must be a public HTTPS address."),
  title: z.string().max(300).optional(),
  description: z.string().max(1000).optional(),
}).strict();
export type SupplierCandidate = z.infer<typeof supplierCandidateSchema>;

const isoTimestamp = z.string().datetime({ offset: true });

export const pricingResearchResultSchema = z.object({
  schema: z.literal(PRICING_RESEARCH_VERSION).default(PRICING_RESEARCH_VERSION),
  requestId: z.string().min(1).max(100),
  query: z.string().min(1).max(200),
  country: z.string().regex(/^[A-Z]{2}$/),
  location: z.string().max(120).optional(),
  /** The include-only supplier domains the search was restricted to, echoed so a result names its supplier filter. */
  includeDomains: z.array(supplierHostnameSchema).max(PRICING_RESEARCH_MAX_DOMAINS).optional(),
  startedAt: isoTimestamp,
  finishedAt: isoTimestamp,
  provider: z.literal("firecrawl"),
  endpoint: z.literal("search"),
  candidates: z.array(supplierCandidateSchema).max(PRICING_RESEARCH_MAX_RESULTS),
  /** null means the provider did not report usage; it is never inferred. */
  creditsUsed: z.number().nonnegative().nullable(),
  nominalCreditEstimate: z.number().nonnegative(),
  providerJobId: z.string().max(200).optional(),
  warning: z.string().max(1000).optional(),
}).strict();
export type PricingResearchResult = z.infer<typeof pricingResearchResultSchema>;

export const PRICING_RESEARCH_FAILURE_CODES = [
  "not-configured", "disabled", "unauthorized", "payment-required", "rate-limited", "timeout",
  "cancelled", "invalid-response", "too-large", "upstream-error", "busy", "invalid-request",
] as const;
export const pricingResearchFailureSchema = z.object({
  schema: z.literal(PRICING_RESEARCH_VERSION).default(PRICING_RESEARCH_VERSION),
  requestId: z.string().max(100),
  code: z.enum(PRICING_RESEARCH_FAILURE_CODES),
  message: z.string().min(1).max(600),
  retryable: z.boolean(),
  startedAt: isoTimestamp,
  finishedAt: isoTimestamp,
}).strict();
export type PricingResearchFailure = z.infer<typeof pricingResearchFailureSchema>;
export type PricingResearchFailureCode = PricingResearchFailure["code"];

/**
 * Nominal search cost from the public Firecrawl guide: two credits per started ten results.
 * This is a documented estimate for display, not a provider-enforced maximum.
 */
export function estimateSearchCredits(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw RangeError("Result limit must be an integer from 1 to 100.");
  return 2 * Math.ceil(limit / 10);
}

export type PricingResearchSummary = {
  query: string; country: string; location: string | null; supplier: string | null; timestamp: string; count: number;
  creditsReported: string; nominalCreditEstimate: number; headline: string;
};
/** Pure display summary: what was searched, where, for which supplier filter, when and how many links came back. */
export function summarisePricingResearch(result: PricingResearchResult): PricingResearchSummary {
  const count = result.candidates.length;
  const creditsReported = result.creditsUsed === null ? "not reported" : `${result.creditsUsed}`;
  const supplier = result.includeDomains?.length ? result.includeDomains.join(", ") : null;
  return {
    query: result.query, country: result.country, location: result.location ?? null, supplier, timestamp: result.finishedAt, count,
    creditsReported, nominalCreditEstimate: result.nominalCreditEstimate,
    headline: `${count} source link${count === 1 ? "" : "s"} for "${result.query}" · ${result.country}${result.location ? ` · ${result.location}` : ""}${supplier ? ` · ${supplier}` : ""} · ${result.finishedAt}`,
  };
}
