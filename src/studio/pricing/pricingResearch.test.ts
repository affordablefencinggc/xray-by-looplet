import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PRICING_RESEARCH_VERSION,
  estimateSearchCredits,
  isPublicHttpsUrl,
  publicHttpsUrlIssue,
  pricingResearchFailureSchema,
  pricingResearchRequestSchema,
  pricingResearchResultSchema,
  summarisePricingResearch,
  supplierCandidateSchema,
} from "./pricingResearch.ts";

const base = { query: "90x45 MGP10 treated pine", projectId: "QA", requestId: "req-1" };

test("request schema applies defaults, trims and bounds every field", () => {
  const parsed = pricingResearchRequestSchema.parse({ ...base, query: "  90x45 MGP10  " });
  assert.equal(parsed.schema, PRICING_RESEARCH_VERSION);
  assert.equal(parsed.query, "90x45 MGP10");
  assert.equal(parsed.country, "AU");
  assert.equal(parsed.limit, 5);
  assert.equal(parsed.location, undefined);
  assert.equal(pricingResearchRequestSchema.parse({ ...base, country: "nz" }).country, "NZ");
  assert.equal(pricingResearchRequestSchema.parse({ ...base, includeDomains: [" WWW.Bunnings.com.au "] }).includeDomains?.[0], "www.bunnings.com.au");
  assert.throws(() => pricingResearchRequestSchema.parse({ ...base, query: "   " }));
  assert.throws(() => pricingResearchRequestSchema.parse({ ...base, query: "x".repeat(201) }));
  assert.throws(() => pricingResearchRequestSchema.parse({ ...base, country: "AUS" }));
  assert.throws(() => pricingResearchRequestSchema.parse({ ...base, location: "x".repeat(121) }));
  assert.throws(() => pricingResearchRequestSchema.parse({ ...base, limit: 0 }));
  assert.throws(() => pricingResearchRequestSchema.parse({ ...base, limit: 6 }));
  assert.throws(() => pricingResearchRequestSchema.parse({ ...base, limit: 2.5 }));
  assert.throws(() => pricingResearchRequestSchema.parse({ ...base, includeDomains: ["a.com", "b.com", "c.com", "d.com"] }));
  assert.throws(() => pricingResearchRequestSchema.parse({ ...base, includeDomains: ["localhost"] }));
  assert.throws(() => pricingResearchRequestSchema.parse({ ...base, includeDomains: ["10.0.0.1"] }));
  assert.throws(() => pricingResearchRequestSchema.parse({ ...base, projectId: "" }));
  assert.throws(() => pricingResearchRequestSchema.parse({ ...base, requestId: "" }));
  assert.throws(() => pricingResearchRequestSchema.parse({ ...base, headers: { "X-Evil": "1" } }), /unrecognized|Unrecognized/i);
});

test("include and exclude domain filters are mutually exclusive", () => {
  assert.doesNotThrow(() => pricingResearchRequestSchema.parse({ ...base, includeDomains: ["www.bunnings.com.au"] }));
  assert.doesNotThrow(() => pricingResearchRequestSchema.parse({ ...base, excludeDomains: ["www.example.com"] }));
  assert.doesNotThrow(() => pricingResearchRequestSchema.parse({ ...base, includeDomains: [], excludeDomains: ["www.example.com"] }));
  assert.throws(
    () => pricingResearchRequestSchema.parse({ ...base, includeDomains: ["www.bunnings.com.au"], excludeDomains: ["www.example.com"] }),
    /cannot be combined/,
  );
});

test("public HTTPS validator rejects unsafe hosts, schemes, credentials and ports", () => {
  assert.equal(isPublicHttpsUrl("https://www.bunnings.com.au/product"), true);
  assert.equal(isPublicHttpsUrl("https://www.bunnings.com.au:443/product?x=1#frag"), true);
  for (const [url, reason] of [
    ["http://www.bunnings.com.au/product", /https/],
    ["https://user:pw@www.bunnings.com.au/product", /credentials/],
    ["https://user@www.bunnings.com.au/product", /credentials/],
    ["https://127.0.0.1/product", /loopback/],
    ["https://10.0.0.1/product", /private/],
    ["https://172.20.1.1/product", /private/],
    ["https://192.168.1.1/product", /private/],
    ["https://169.254.1.1/product", /link-local/],
    ["https://[::1]/product", /loopback/],
    ["https://[fe80::1]/product", /link-local/],
    ["https://[fd00::1]/product", /private/],
    ["https://[::ffff:10.0.0.1]/product", /private/],
    ["https://[2001:db8::1]/product", /IP-literal/],
    ["https://8.8.8.8/product", /IP-literal/],
    ["https://localhost/product", /hostname/],
    ["https://intranet/product", /hostname/],
    ["https://box.localhost/product", /hostname/],
    ["https://host:8443/product", /port/],
    ["https://www.bunnings.com.au:8443/product", /port/],
    ["ftp://www.bunnings.com.au/product", /https/],
    ["javascript:alert(1)", /https/],
    ["not a url", /valid URL/],
  ] as const) {
    const issue = publicHttpsUrlIssue(url);
    assert.notEqual(issue, null, url);
    assert.match(issue ?? "", reason, url);
    assert.equal(isPublicHttpsUrl(url), false, url);
  }
  assert.doesNotThrow(() => supplierCandidateSchema.parse({ url: "https://www.bunnings.com.au/product", title: "t", description: "d" }));
  assert.throws(() => supplierCandidateSchema.parse({ url: "http://www.bunnings.com.au/product" }));
  assert.throws(() => supplierCandidateSchema.parse({ url: "https://www.bunnings.com.au/product", title: "t".repeat(301) }));
  assert.throws(() => supplierCandidateSchema.parse({ url: "https://www.bunnings.com.au/product", description: "d".repeat(1001) }));
});

test("credit estimate is two per started ten results and refuses nonsense limits", () => {
  for (const limit of [1, 2, 3, 4, 5]) assert.equal(estimateSearchCredits(limit), 2);
  assert.equal(estimateSearchCredits(10), 2);
  assert.equal(estimateSearchCredits(11), 4);
  assert.throws(() => estimateSearchCredits(0), RangeError);
  assert.throws(() => estimateSearchCredits(1.5), RangeError);
  assert.throws(() => estimateSearchCredits(101), RangeError);
});

test("result and failure schemas bound candidates and enumerate failure codes", () => {
  const timestamps = { startedAt: "2026-09-08T01:02:03.000Z", finishedAt: "2026-09-08T01:02:05.000Z" };
  const candidate = { url: "https://www.bunnings.com.au/product" };
  const result = pricingResearchResultSchema.parse({
    requestId: "req-1", query: "pine", country: "AU", provider: "firecrawl", endpoint: "search",
    candidates: [candidate], creditsUsed: null, nominalCreditEstimate: 2, ...timestamps,
  });
  assert.equal(result.schema, PRICING_RESEARCH_VERSION);
  assert.equal(result.creditsUsed, null);
  assert.throws(() => pricingResearchResultSchema.parse({ ...result, candidates: Array(6).fill(candidate) }));
  assert.throws(() => pricingResearchResultSchema.parse({ ...result, provider: "other" }));
  assert.throws(() => pricingResearchResultSchema.parse({ ...result, startedAt: "yesterday" }));
  const failure = pricingResearchFailureSchema.parse({ requestId: "req-1", code: "rate-limited", message: "Slow down.", retryable: true, ...timestamps });
  assert.equal(failure.code, "rate-limited");
  assert.throws(() => pricingResearchFailureSchema.parse({ ...failure, code: "mystery" }));
  assert.throws(() => pricingResearchFailureSchema.parse({ ...failure, message: "" }));
});

test("display summary reports query, country, timestamp, count and reported credits", () => {
  const timestamps = { startedAt: "2026-09-08T01:02:03.000Z", finishedAt: "2026-09-08T01:02:05.000Z" };
  const result = pricingResearchResultSchema.parse({
    requestId: "req-1", query: "pine", country: "NZ", location: "Auckland", provider: "firecrawl", endpoint: "search",
    candidates: [{ url: "https://www.bunnings.co.nz/a" }, { url: "https://www.bunnings.co.nz/b" }],
    creditsUsed: null, nominalCreditEstimate: 2, ...timestamps,
  });
  const summary = summarisePricingResearch(result);
  assert.deepEqual(summary, {
    query: "pine", country: "NZ", location: "Auckland", supplier: null, timestamp: "2026-09-08T01:02:05.000Z", count: 2,
    creditsReported: "not reported", nominalCreditEstimate: 2,
    headline: '2 source links for "pine" · NZ · Auckland · 2026-09-08T01:02:05.000Z',
  });
  const single = summarisePricingResearch({ ...result, location: undefined, candidates: result.candidates.slice(0, 1), creditsUsed: 2 });
  assert.equal(single.creditsReported, "2");
  assert.equal(single.location, null);
  assert.equal(single.headline, '1 source link for "pine" · NZ · 2026-09-08T01:02:05.000Z');
});

test("display summary names the supplier filter when the result carries include-only domains", () => {
  const base = {
    requestId: "req-9", query: "treated pine", country: "AU", startedAt: "2026-09-08T13:00:00.000Z", finishedAt: "2026-09-08T13:00:02.000Z",
    provider: "firecrawl" as const, endpoint: "search" as const, candidates: [], creditsUsed: null, nominalCreditEstimate: 2,
  };
  const filtered = pricingResearchResultSchema.parse({ ...base, includeDomains: ["www.bunnings.com.au"] });
  assert.equal(summarisePricingResearch(filtered).supplier, "www.bunnings.com.au");
  assert.match(summarisePricingResearch(filtered).headline, /www\.bunnings\.com\.au/);
  assert.equal(summarisePricingResearch(pricingResearchResultSchema.parse(base)).supplier, null);
  assert.throws(() => pricingResearchResultSchema.parse({ ...base, includeDomains: ["127.0.0.1"] }), "an IP literal is not a supplier hostname");
});
