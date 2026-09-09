import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FIRECRAWL_SEARCH_URL,
  PricingResearchError,
  allowPricingResearchRequest,
  failureHttpStatus,
  pricingResearchStatus,
  searchSupplierProducts,
} from "./pricingResearch.server.ts";

const KEY = "fc-unit-test-credential-not-live-0123456789";
const env = { FIRECRAWL_API_KEY: KEY, XRAY_PRICING_RESEARCH_WEB_ENABLED: "true" };
const request = { query: "90x45 MGP10 treated pine", country: "AU", limit: 3, projectId: "QA", requestId: "req-1", includeDomains: ["www.bunnings.com.au"] };
const raw = JSON.stringify(request);
const web = [
  { url: "https://www.bunnings.com.au/1", title: "Pine 1", description: "Treated pine 90x45" },
  { url: "http://www.bunnings.com.au/insecure", title: "Insecure" },
  { url: "https://10.0.0.1/private", title: "Private" },
  { url: "https://www.bunnings.com.au/2", title: "Pine 2", description: null },
  { url: "https://www.bunnings.com.au/3", title: "Pine 3" },
  { url: "https://www.bunnings.com.au/4", title: "Pine 4" },
  { url: "https://www.bunnings.com.au/5", title: "Pine 5" },
];
const documented = (extra: Record<string, unknown> = {}) =>
  Response.json({ success: true, data: { web }, id: "job-123", warning: "provider note", creditsUsed: 2, ...extra });

async function failure(promise: Promise<unknown>) {
  try { await promise; } catch (error) {
    assert.ok(error instanceof PricingResearchError, `expected PricingResearchError, got ${String(error)}`);
    assert.equal(JSON.stringify(error.failure).includes(KEY), false, "failure must not leak the key");
    assert.equal(error.message.includes(KEY), false, "message must not leak the key");
    return error.failure;
  }
  assert.fail("expected the search to fail");
}

test("status never exposes the key and requires explicit operator enable", () => {
  assert.deepEqual(pricingResearchStatus({}), {
    provider: "Firecrawl", configured: false, available: false,
    message: "Supplier research provider not configured. Set FIRECRAWL_API_KEY and XRAY_PRICING_RESEARCH_WEB_ENABLED=true on the server to enable bounded searches.",
  });
  assert.equal(pricingResearchStatus({ FIRECRAWL_API_KEY: KEY }).configured, true);
  assert.equal(pricingResearchStatus({ FIRECRAWL_API_KEY: KEY }).available, false);
  assert.match(pricingResearchStatus({ FIRECRAWL_API_KEY: KEY }).message, /disabled by the operator/);
  assert.equal(pricingResearchStatus(env).available, true);
  assert.equal(JSON.stringify(pricingResearchStatus(env)).includes(KEY), false);
  assert.equal(pricingResearchStatus({ ...env, XRAY_PRICING_RESEARCH_WEB_ENABLED: "yes" }).available, false);
});

test("not-configured and disabled refuse before any network request", async () => {
  let called = 0;
  const fetcher: typeof fetch = async () => { called++; return documented(); };
  const missing = await failure(searchSupplierProducts(raw, { env: {}, fetcher }));
  assert.equal(missing.code, "not-configured");
  assert.equal(missing.retryable, false);
  assert.equal(failureHttpStatus(missing.code), 503);
  const disabled = await failure(searchSupplierProducts(raw, { env: { FIRECRAWL_API_KEY: KEY }, fetcher }));
  assert.equal(disabled.code, "disabled");
  assert.equal(failureHttpStatus(disabled.code), 503);
  assert.equal(called, 0);
});

test("invalid JSON and schema violations are invalid-request failures without a network call", async () => {
  let called = 0;
  const fetcher: typeof fetch = async () => { called++; return documented(); };
  assert.equal((await failure(searchSupplierProducts("{not json", { env, fetcher }))).code, "invalid-request");
  const bad = await failure(searchSupplierProducts(JSON.stringify({ ...request, limit: 50 }), { env, fetcher }));
  assert.equal(bad.code, "invalid-request");
  assert.equal(failureHttpStatus(bad.code), 400);
  const both = await failure(searchSupplierProducts(JSON.stringify({ ...request, excludeDomains: ["www.example.com"] }), { env, fetcher }));
  assert.match(both.message, /cannot be combined/);
  assert.equal(called, 0);
});

test("success posts the documented body to the fixed endpoint and maps the documented response", async () => {
  let seenUrl = "", seenInit: RequestInit | undefined;
  const result = await searchSupplierProducts(raw, {
    env,
    fetcher: async (url, init) => { seenUrl = String(url); seenInit = init; return documented(); },
  });
  assert.equal(seenUrl, FIRECRAWL_SEARCH_URL);
  assert.equal(seenUrl, "https://api.firecrawl.dev/v2/search");
  assert.equal(seenInit?.method, "POST");
  assert.equal(seenInit?.redirect, "error");
  const headers = new Headers(seenInit?.headers);
  assert.equal(headers.get("authorization"), `Bearer ${KEY}`);
  assert.equal(headers.get("content-type"), "application/json");
  assert.deepEqual(JSON.parse(String(seenInit?.body)), {
    query: request.query, sources: ["web"], limit: 3, country: "AU", includeDomains: ["www.bunnings.com.au"], timeout: 30000,
  });
  assert.equal(result.provider, "firecrawl");
  assert.equal(result.endpoint, "search");
  assert.equal(result.requestId, "req-1");
  assert.equal(result.query, request.query);
  assert.equal(result.country, "AU");
  assert.equal(result.candidates.length, 3, "capped at the requested limit");
  assert.deepEqual(result.candidates.map((c) => c.url), ["https://www.bunnings.com.au/1", "https://www.bunnings.com.au/2", "https://www.bunnings.com.au/3"]);
  assert.deepEqual(result.candidates[0], { url: "https://www.bunnings.com.au/1", title: "Pine 1", description: "Treated pine 90x45" });
  assert.equal(result.candidates[1].description, undefined);
  assert.equal(result.creditsUsed, 2);
  assert.equal(result.nominalCreditEstimate, 2);
  assert.equal(result.providerJobId, "job-123");
  assert.match(result.warning ?? "", /provider note/);
  assert.match(result.warning ?? "", /2 result links? were dropped/);
  assert.ok(Date.parse(result.startedAt) <= Date.parse(result.finishedAt));
  assert.equal(JSON.stringify(result).includes(KEY), false);
});

test("missing optional provider fields stay unknown and location/exclude filters pass through", async () => {
  let body: Record<string, unknown> = {};
  const result = await searchSupplierProducts(
    JSON.stringify({ ...request, includeDomains: undefined, excludeDomains: ["www.example.com"], location: "Brisbane, Queensland" }),
    { env, fetcher: async (_, init) => { body = JSON.parse(String(init?.body)); return Response.json({ success: true, data: { web: [web[0]] } }); } },
  );
  assert.deepEqual(body, { query: request.query, sources: ["web"], limit: 3, country: "AU", location: "Brisbane, Queensland", excludeDomains: ["www.example.com"], timeout: 30000 });
  assert.equal(result.creditsUsed, null);
  assert.equal(result.providerJobId, undefined);
  assert.equal(result.warning, undefined);
  assert.equal(result.location, "Brisbane, Queensland");
  assert.equal(result.candidates.length, 1);
  const empty = await searchSupplierProducts(raw, { env, fetcher: async () => Response.json({ success: true, data: {} }) });
  assert.equal(empty.candidates.length, 0);
});

test("provider HTTP statuses map to typed failures with the documented retryability", async () => {
  const cases: Array<[number, string, boolean, number]> = [
    [401, "unauthorized", false, 502],
    [402, "payment-required", false, 502],
    [429, "rate-limited", true, 502],
    [500, "upstream-error", true, 502],
    [503, "upstream-error", true, 502],
    [418, "upstream-error", false, 502],
  ];
  for (const [status, code, retryable, http] of cases) {
    const f = await failure(searchSupplierProducts(raw, {
      env, fetcher: async () => new Response(`private provider details ${KEY}`, { status }),
    }));
    assert.equal(f.code, code, `HTTP ${status}`);
    assert.equal(f.retryable, retryable, `HTTP ${status}`);
    assert.equal(failureHttpStatus(f.code), http);
    assert.equal(f.message.includes("private provider details"), false, "response body must not be echoed");
  }
  const unsuccessful = await failure(searchSupplierProducts(raw, { env, fetcher: async () => Response.json({ success: false, error: "nope" }) }));
  assert.equal(unsuccessful.code, "upstream-error");
});

test("timeout fires for a fetcher that never settles and releases the single-flight slot", async () => {
  const f = await failure(searchSupplierProducts(raw, { env, timeoutMs: 20, fetcher: () => new Promise(() => {}) }));
  assert.equal(f.code, "timeout");
  assert.equal(f.retryable, true);
  const ok = await searchSupplierProducts(raw, { env, fetcher: async () => documented() });
  assert.equal(ok.candidates.length, 3);
});

test("abort via the request signal reports cancelled and never retries", async () => {
  const controller = new AbortController();
  let calls = 0;
  const pending = searchSupplierProducts(raw, {
    env, signal: controller.signal,
    fetcher: async (_, init) => { calls++; return new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))); },
  });
  controller.abort();
  const f = await failure(pending);
  assert.equal(f.code, "cancelled");
  assert.equal(f.retryable, true);
  assert.equal(calls, 1);
  const already = await failure(searchSupplierProducts(raw, { env, signal: AbortSignal.abort(), fetcher: async () => { calls++; return documented(); } }));
  assert.equal(already.code, "cancelled");
  assert.equal(calls, 1, "an already-aborted request never reaches the provider");
});

test("oversized responses are refused by content-length and by streamed size", async () => {
  const declared = await failure(searchSupplierProducts(raw, {
    env, fetcher: async () => new Response("{}", { status: 200, headers: { "content-length": String(1024 * 1024 + 1) } }),
  }));
  assert.equal(declared.code, "too-large");
  const chunk = new Uint8Array(256 * 1024).fill(32);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { for (let i = 0; i < 5; i++) controller.enqueue(chunk); controller.close(); },
  });
  const streamed = await failure(searchSupplierProducts(raw, { env, fetcher: async () => new Response(stream, { status: 200 }) }));
  assert.equal(streamed.code, "too-large");
  assert.equal(streamed.retryable, false);
});

test("malformed JSON and undocumented shapes are invalid-response failures", async () => {
  const malformed = await failure(searchSupplierProducts(raw, { env, fetcher: async () => new Response("<html>not json</html>", { status: 200 }) }));
  assert.equal(malformed.code, "invalid-response");
  assert.equal(malformed.message.includes("<html>"), false);
  const shape = await failure(searchSupplierProducts(raw, { env, fetcher: async () => Response.json({ success: true, data: { web: "not-an-array" } }) }));
  assert.equal(shape.code, "invalid-response");
  const legacy = await failure(searchSupplierProducts(raw, { env, fetcher: async () => Response.json({ success: true, data: [{ url: "https://www.bunnings.com.au/1" }] }) }));
  assert.equal(legacy.code, "invalid-response", "older flat-array SDK shape is not the documented v2 REST shape");
  const missingBody = await failure(searchSupplierProducts(raw, { env, fetcher: async () => new Response(null, { status: 200 }) }));
  assert.equal(missingBody.code, "invalid-response");
  // Bodies that carry neither the documented `success` nor `data` fields are not "a search that found nothing".
  for (const body of [{}, { error: "quota" }, { success: true }, { data: { web: [] } }]) {
    let calls = 0;
    const undocumented = await failure(searchSupplierProducts(raw, { env, fetcher: async () => { calls++; return Response.json(body); } }));
    assert.equal(undocumented.code, "invalid-response", `undocumented body ${JSON.stringify(body)} must not become an empty success`);
    assert.equal(calls, 1);
  }
  const emptySearch = await searchSupplierProducts(raw, { env, fetcher: async () => Response.json({ success: true, data: {} }) });
  assert.deepEqual(emptySearch.candidates, [], "the documented shape with no web hits is a genuine empty search");
});

test("duplicate provider links collapse to one candidate and the supplier filter is echoed in the result", async () => {
  const twice = [
    { url: "https://www.bunnings.com.au/1", title: "Pine 1" },
    { url: "https://www.bunnings.com.au/1", title: "Pine 1 again" },
    { url: "https://www.bunnings.com.au/2", title: "Pine 2" },
  ];
  const result = await searchSupplierProducts(raw, { env, fetcher: async () => Response.json({ success: true, data: { web: twice } }) });
  assert.deepEqual(result.candidates.map((c) => c.url), ["https://www.bunnings.com.au/1", "https://www.bunnings.com.au/2"]);
  assert.match(result.warning ?? "", /1 duplicate link was collapsed/);
  assert.deepEqual(result.includeDomains, ["www.bunnings.com.au"], "the include-only supplier domain is echoed for display");
  const open = await searchSupplierProducts(JSON.stringify({ ...request, includeDomains: undefined }), { env, fetcher: async () => Response.json({ success: true, data: { web: twice.slice(2) } }) });
  assert.equal(open.includeDomains, undefined, "no supplier filter means no echoed domain");
});

test("a second search while one is in flight is refused as busy and the slot is released afterwards", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let started!: () => void;
  const ready = new Promise<void>((r) => (started = r));
  const first = searchSupplierProducts(raw, { env, fetcher: async () => { started(); await gate; return documented(); } });
  await ready;
  let calls = 0;
  const busy = await failure(searchSupplierProducts(raw, { env, fetcher: async () => { calls++; return documented(); } }));
  assert.equal(busy.code, "busy");
  assert.equal(busy.retryable, true);
  assert.equal(failureHttpStatus(busy.code), 409);
  assert.equal(calls, 0);
  release();
  assert.equal((await first).candidates.length, 3);
  assert.equal((await searchSupplierProducts(raw, { env, fetcher: async () => documented() })).candidates.length, 3);
});

test("network failures are upstream errors whose messages never include the key or provider internals", async () => {
  const f = await failure(searchSupplierProducts(raw, { env, fetcher: async () => { throw new TypeError(`fetch failed ${KEY}`); } }));
  assert.equal(f.code, "upstream-error");
  assert.equal(f.retryable, true);
  assert.equal(f.message.includes("fetch failed"), false);
});

test("cross-site browser requests are rejected and same-origin requests allowed", () => {
  const url = "https://app.invalid/api/pricing-research";
  assert.equal(allowPricingResearchRequest(new Request(url, { headers: { origin: "https://other.invalid" } })), false);
  assert.equal(allowPricingResearchRequest(new Request(url, { headers: { "sec-fetch-site": "cross-site", origin: "https://app.invalid" } })), false);
  assert.equal(allowPricingResearchRequest(new Request(url, { headers: { origin: "https://app.invalid", "sec-fetch-site": "same-origin" } })), true);
  assert.equal(allowPricingResearchRequest(new Request(url, { headers: { "sec-fetch-site": "none" } })), true);
  assert.equal(allowPricingResearchRequest(new Request(url)), true);
});
