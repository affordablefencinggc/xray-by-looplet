import { z } from "zod";
import {
  estimateSearchCredits,
  publicHttpsUrlIssue,
  pricingResearchFailureSchema,
  pricingResearchRequestSchema,
  pricingResearchResultSchema,
  type PricingResearchFailure,
  type PricingResearchFailureCode,
  type PricingResearchResult,
  type SupplierCandidate,
} from "../studio/pricing/pricingResearch.ts";

/** Fixed upstream. The client never chooses the endpoint, headers or provider options. */
export const FIRECRAWL_SEARCH_URL = "https://api.firecrawl.dev/v2/search";
const PROVIDER_TIMEOUT_MS = 30000;
const REQUEST_TIMEOUT_MS = 35000;
const MAX_RESPONSE_BYTES = 1024 * 1024;

type Environment = Record<string, string | undefined>;

export function pricingResearchStatus(env: Environment = process.env) {
  const configured = Boolean(env.FIRECRAWL_API_KEY);
  const enabled = env.XRAY_PRICING_RESEARCH_WEB_ENABLED === "true";
  return {
    provider: "Firecrawl",
    configured,
    available: configured && enabled,
    message: !configured
      ? "Supplier research provider not configured. Set FIRECRAWL_API_KEY and XRAY_PRICING_RESEARCH_WEB_ENABLED=true on the server to enable bounded searches."
      : !enabled
        ? "Supplier research is configured but web access is disabled by the operator."
        : "Firecrawl configured. A bounded search (web sources only, at most 5 links) is sent only when you start it.",
  };
}

/** Same-origin rule shared with the material AI route: CSRF protection only, not user identity. */
export function allowPricingResearchRequest(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

/** Typed failure the route converts to JSON. Messages are static and never carry the key or provider bodies. */
export class PricingResearchError extends Error {
  readonly failure: PricingResearchFailure;
  constructor(failure: PricingResearchFailure) {
    super(failure.message);
    this.name = "PricingResearchError";
    this.failure = failure;
  }
}

export function failureHttpStatus(code: PricingResearchFailureCode): number {
  switch (code) {
    case "invalid-request": return 400;
    case "busy": return 409;
    case "too-large": return 502;
    case "not-configured":
    case "disabled": return 503;
    default: return 502;
  }
}

const FAILURE_TEXT: Record<Exclude<PricingResearchFailureCode, "not-configured" | "disabled" | "invalid-request">, [string, boolean]> = {
  unauthorized: ["The supplier research provider rejected the server credential (HTTP 401). No search ran.", false],
  "payment-required": ["The supplier research provider reports no remaining credit (HTTP 402). No search ran.", false],
  "rate-limited": ["The supplier research provider is rate limiting this account (HTTP 429). Existing data is unchanged; try again later.", true],
  timeout: ["The supplier research request timed out before the provider answered. Provider billing for the attempt is unknown.", true],
  cancelled: ["Search cancelled. Any late provider response is discarded; provider billing for the attempt is unknown.", true],
  "invalid-response": ["The supplier research provider returned data that does not match the documented search response. No links were kept.", false],
  "too-large": ["The supplier research response exceeded the 1 MiB safety limit and was discarded.", false],
  "upstream-error": ["The supplier research provider failed to answer the search. No links were kept.", true],
  busy: ["A supplier search is already running on this server. Wait for it to finish before starting another.", true],
};

let running = false;

function fail(requestId: string, code: PricingResearchFailureCode, startedAt: string, message?: string, retryable?: boolean): PricingResearchError {
  const text = code in FAILURE_TEXT ? FAILURE_TEXT[code as keyof typeof FAILURE_TEXT] : null;
  return new PricingResearchError(pricingResearchFailureSchema.parse({
    requestId, code,
    message: (message ?? text?.[0] ?? "Supplier research failed.").slice(0, 600),
    retryable: retryable ?? text?.[1] ?? false,
    startedAt, finishedAt: new Date().toISOString(),
  }));
}

/**
 * Documented Firecrawl v2 REST search response. Unknown extra fields are tolerated; the shape is not:
 * `success` and `data` are required so an empty object, an error body or a bare `{ success: true }`
 * cannot be presented as a search that found nothing.
 */
const firecrawlSearchResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    web: z.array(z.object({ url: z.string(), title: z.string().nullish(), description: z.string().nullish() }).loose()).optional(),
  }).loose().optional(),
  id: z.string().optional(),
  warning: z.string().nullish(),
  creditsUsed: z.number().nullish(),
}).loose();

function neverSettlesGuard(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}

async function readBounded(response: Response, signal: AbortSignal): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw new RangeError("too-large");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new SyntaxError("empty");
  const decoder = new TextDecoder();
  let bytes = 0, text = "";
  while (true) {
    const chunk = await Promise.race([reader.read(), neverSettlesGuard(signal)]);
    if (chunk.done) break;
    bytes += chunk.value.length;
    if (bytes > MAX_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new RangeError("too-large");
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text + decoder.decode();
}

export async function searchSupplierProducts(
  rawJson: string,
  options: { env?: Environment; fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<PricingResearchResult> {
  const startedAt = new Date().toISOString();
  const env = options.env ?? process.env;
  let requestId = "";
  let parsedJson: unknown;
  try { parsedJson = JSON.parse(rawJson); } catch { throw fail(requestId, "invalid-request", startedAt, "Supplier research request is not valid JSON."); }
  if (parsedJson && typeof parsedJson === "object" && typeof (parsedJson as { requestId?: unknown }).requestId === "string")
    requestId = String((parsedJson as { requestId: string }).requestId).slice(0, 100);
  const parsed = pricingResearchRequestSchema.safeParse(parsedJson);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw fail(requestId, "invalid-request", startedAt, `Supplier research request rejected: ${issue ? `${issue.path.join(".") || "request"}: ${issue.message}` : "invalid shape"}.`);
  }
  const request = parsed.data;
  requestId = request.requestId;
  const status = pricingResearchStatus(env);
  if (!status.configured) throw fail(requestId, "not-configured", startedAt, status.message);
  if (!status.available) throw fail(requestId, "disabled", startedAt, status.message);
  if (options.signal?.aborted) throw fail(requestId, "cancelled", startedAt);
  if (running) throw fail(requestId, "busy", startedAt);
  running = true;
  try {
    const timeout = AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    const classifyAbort = () => options.signal?.aborted ? "cancelled" : "timeout";
    const body: Record<string, unknown> = {
      query: request.query, sources: ["web"], limit: request.limit, country: request.country,
      ...(request.location ? { location: request.location } : {}),
      ...(request.includeDomains?.length ? { includeDomains: request.includeDomains } : {}),
      ...(request.excludeDomains?.length ? { excludeDomains: request.excludeDomains } : {}),
      timeout: PROVIDER_TIMEOUT_MS,
    };
    let response: Response;
    try {
      response = await Promise.race([
        (options.fetcher ?? fetch)(FIRECRAWL_SEARCH_URL, {
          method: "POST", redirect: "error", signal,
          headers: { Authorization: `Bearer ${env.FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        neverSettlesGuard(signal),
      ]);
    } catch {
      if (signal.aborted) throw fail(requestId, classifyAbort(), startedAt);
      throw fail(requestId, "upstream-error", startedAt);
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      const code: PricingResearchFailureCode =
        response.status === 401 ? "unauthorized" : response.status === 402 ? "payment-required" : response.status === 429 ? "rate-limited" : "upstream-error";
      if (code === "upstream-error" && response.status < 500)
        throw fail(requestId, code, startedAt, `The supplier research provider rejected the search (HTTP ${response.status}). No links were kept.`, false);
      throw fail(requestId, code, startedAt, code === "upstream-error" ? `The supplier research provider failed to answer the search (HTTP ${response.status}). No links were kept.` : undefined);
    }
    let text: string;
    try { text = await readBounded(response, signal); } catch (error) {
      if (signal.aborted) throw fail(requestId, classifyAbort(), startedAt);
      throw fail(requestId, error instanceof RangeError ? "too-large" : "invalid-response", startedAt);
    }
    let payload: z.infer<typeof firecrawlSearchResponseSchema>;
    try { payload = firecrawlSearchResponseSchema.parse(JSON.parse(text)); } catch { throw fail(requestId, "invalid-response", startedAt); }
    if (payload.success === false) throw fail(requestId, "upstream-error", startedAt, "The supplier research provider reported an unsuccessful search. No links were kept.", false);
    // A successful answer must carry the documented data object; a bare { success: true } is not an empty search.
    if (!payload.data) throw fail(requestId, "invalid-response", startedAt);
    const candidates: SupplierCandidate[] = [];
    const seen = new Set<string>();
    let dropped = 0, duplicates = 0;
    for (const hit of payload.data.web ?? []) {
      if (candidates.length >= request.limit) break;
      if (publicHttpsUrlIssue(hit.url) !== null || hit.url.length > 2048) { dropped++; continue; }
      if (seen.has(hit.url)) { duplicates++; continue; }
      seen.add(hit.url);
      const title = hit.title?.trim().slice(0, 300), description = hit.description?.trim().slice(0, 1000);
      candidates.push({ url: hit.url, ...(title ? { title } : {}), ...(description ? { description } : {}) });
    }
    const warnings = [
      dropped ? `${dropped} result link${dropped === 1 ? " was" : "s were"} dropped because ${dropped === 1 ? "it is" : "they are"} not public HTTPS URLs.` : "",
      duplicates ? `${duplicates} duplicate link${duplicates === 1 ? " was" : "s were"} collapsed.` : "",
      payload.warning?.trim() ? `Provider warning: ${payload.warning.trim()}` : "",
    ].filter(Boolean).join(" ").slice(0, 1000);
    const finishedAt = new Date().toISOString();
    const result = pricingResearchResultSchema.safeParse({
      requestId, query: request.query, country: request.country,
      ...(request.location ? { location: request.location } : {}),
      ...(request.includeDomains?.length ? { includeDomains: request.includeDomains } : {}),
      startedAt, finishedAt, provider: "firecrawl", endpoint: "search", candidates,
      creditsUsed: typeof payload.creditsUsed === "number" && payload.creditsUsed >= 0 ? payload.creditsUsed : null,
      nominalCreditEstimate: estimateSearchCredits(request.limit),
      ...(payload.id ? { providerJobId: payload.id.slice(0, 200) } : {}),
      ...(warnings ? { warning: warnings } : {}),
    });
    if (!result.success) throw fail(requestId, "invalid-response", startedAt);
    return result.data;
  } finally {
    running = false;
  }
}
