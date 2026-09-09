# SC-04 P-01 / P-02 / P-09 / P-10 — bounded, credential-gated Firecrawl v2 supplier search contract

Date 2026-09-08 · branch `feat/architect-cad-engine` · HEAD `39a50dc` (uncommitted working tree, shared with other agents) · slice prefix `az3-pricing-research-`.

## Repair round (verifier finding: vacuous storage-equality assertion)

Independent verifiers refuted round 1's Scenario A: its before/after comparison of `xray:price-books:*` localStorage ran over **zero** keys (`price-book keys=0` in the round-1 runner log), so "existing price books are unchanged" was never demonstrated against an existing record. Round-1 artefacts are preserved under `history-round1/` (scenario, report, runner log, both desktop screenshots) and the runner reports under `proof/growth/runner/2026-09-08T12-4*` are untouched.

What changed (proof only; no source file changed in the repair round):

- `seed-price-book.fixture.json` — one schema-valid price book library (1 book "Seeded QA price book", supplier "Seeded Timber Supplies", AUD, tax excluded 10 %, effective 2026-09-01, 1 CSV revision with 2 rows: `MGP10-90x45-4800` @ 21.85 and `MGP10-70x35-4800` @ 12.4 per length, empty worksheet). `__JOB_ID__` / `__BOOK_ID__` are substituted at seed time.
- `validate-seed-fixture.ts` — parses the fixture with the real `parsePriceBookLibrary` / `priceBookLibrarySchema` from `src/studio/pricing/priceBooks.ts` before it is ever written into a browser profile: `node --experimental-strip-types proof/growth/2026-09-08-az3-pricing-research/validate-seed-fixture.ts` → `{"key":"xray:price-books:v1:qa-job","books":1,"rows":2,"bytes":1516}`.
- `build-scenario-a.mjs` — regenerates `scenario-a-desktop.json` with that fixture embedded verbatim (same bytes as validated). Scenario A now: hydrate → read the hydrated project id from `xray:fencing-job:v2` → write the fixture to `xray:price-books:v1:<jobId>` (verified read-back; logs whether a previous record existed) → `reload` → hydrate → assert the record survived → instrument `fetch` → Cost → assert the app *loaded* the seed (no `.price-books > p.price-notice[role=alert]` load error, tab label starts with `Library (1)`, `.price-book-card h3` = "Seeded QA price book") → snapshot raw key/value pairs and **fail if the snapshot has fewer than 1 entry** → screenshot library → screenshot research section → fill query → click → wait for `not-configured` / 503 → assert raw snapshot byte-identical, parsed record still has the seeded name, 2 rows and rate 21.85, tab labels and the card's text identical, one sent GET + exactly one POST → screenshot failure → re-read the key and screenshot the library card again → `errors`.

Result: `node scripts/fast-cdp-test.mjs az3-pricing-research-repair-desktop proof/growth/2026-09-08-az3-pricing-research/scenario-a-desktop.json` → exit 0, 22 commands, 3.40 s, scenario sha256 `36b0330fc21c0569cc92896b4966f35abca52d39d0f8b91e6dd3f9781fb7a49c`, report `proof/growth/runner/2026-09-08T13-05-57-406Z-az3-pricing-research-repair-desktop.json` (+ `.log`, `.scenario.json`; copies in `scenario-a-desktop.report.json` / `scenario-a-desktop.runner.log`). Key lines from the runner log:

```text
"seeded xray:price-books:v1:job-40edd9f4-a0b2-4540-b170-881be4fc366b (1095 chars, books=1, rows=2); previous record: none"
"after reload: project job-40edd9f4-… has price book record xray:price-books:v1:job-40edd9f4-… (1095 chars); fetch instrumented before Cost pane; log=[]"
"… state=idle; price-book keys=1 (xray:price-books:v1:job-40edd9f4-…, 1095 chars, books=1, rows=2); tabs=Library (1)|Import price sheet|Priced worksheet (0); card=Seeded QA price book"
"failure rendered (not-configured, HTTP 503); price-book keys=1 before and 1 after, raw bytes identical (1298 chars snapshot), seeded book name/rows/rate intact, library tabs and card text identical; fetches=[GET (aborted by StrictMode dev double-mount cleanup), GET (sent), POST (sent)] …"
"post-failure: xray:price-books:v1:job-40edd9f4-… still holds 1095 chars, revision 1, 1 book(s), worksheet 0; card heading Seeded QA price book; research state failure"
```

So the retention assertion now runs over **1 stored price book record (1095 chars, 1 book, 2 rows)**, not an empty set. Session `az3-pricing-research-repair-desktop` was closed afterwards (`Browser closed`, exit 0). Scenario B (tablet) was not refuted and was not re-run; its round-1 evidence stands. Tests (25/25) and `tsc --noEmit` (exit 0) were re-run after the repair and `tests.log` / `typecheck.log` / `code.diff` regenerated; the source diff is unchanged from round 1.

Scope: a user-initiated, server-only, bounded Firecrawl v2 `search` adapter with truthful UI states. Search returns candidate links only. No scrape, extraction, proposal or rate application (P-03..P-08 remain open). No project cost, price book or worksheet value can change through this slice; nothing is persisted to storage.

## Files

New (full content in `code.diff` as `--no-index` diffs):

- `src/studio/pricing/pricingResearch.ts` — browser-safe Zod contract: `PRICING_RESEARCH_VERSION = "xray.pricing-research/v1"`, request/candidate/result/failure schemas, `publicHttpsUrlIssue` / `isPublicHttpsUrl` validator, `isSupplierHostname`, `estimateSearchCredits(limit) = 2 × ceil(limit/10)` (nominal, documented estimate), `summarisePricingResearch(result)`.
- `src/studio/pricing/pricingResearch.test.ts` — 6 tests (schema bounds, include/exclude XOR, 22 URL validator cases, credit estimate, result/failure schemas, display summary).
- `src/lib/pricingResearch.server.ts` — `pricingResearchStatus(env)`, `allowPricingResearchRequest(request)` (same rule as `allowMaterialAiRequest`, copied not imported), `searchSupplierProducts(rawJson, { env, fetcher, signal, timeoutMs })`, `PricingResearchError`, `failureHttpStatus(code)`, `FIRECRAWL_SEARCH_URL = "https://api.firecrawl.dev/v2/search"`.
- `src/lib/pricingResearch.server.test.ts` — 13 tests with an injected fetcher (see Tests).
- `src/routes/api.pricing-research.ts` — GET status (`Cache-Control: no-store`); POST same-origin + `application/json` only, 64 KiB body cap, `{ result }` 200 / `{ failure }` 400 · 403 · 409 · 413 · 415 · 502 · 503, always `no-store`.
- `src/studio/pricing/PricingResearchPanel.tsx` + `pricingResearch.css` — `<section aria-label="Supplier product research">`.

Modified:

- `src/studio/pricing/PriceBookPanel.tsx` — mount only: one import line and `<PricingResearchPanel projectId={jobId} />` as the last child of the `.price-books` section (tracked diff at the top of `code.diff`).
- `src/routeTree.gen.ts` — **not hand-edited.** The running dev server's TanStack Router generator appended the `/api/pricing-research` route when the route file appeared. That file is on the do-not-touch list; its generator output is recorded separately in `routeTree.gen.generated.diff`. The `floor-lab` hunks in that diff were already present from another agent before this slice started; only the `pricing-research` hunks come from this slice.

## Contract implemented (from `planning/professional-coverage/next-wave-audit.md`)

- Fixed upstream `POST https://api.firecrawl.dev/v2/search`, headers `Authorization: Bearer <FIRECRAWL_API_KEY>` and `Content-Type: application/json`, `redirect: "error"`.
- Body exactly `{ query, sources: ["web"], limit (1–5), country (ISO alpha-2, default AU), location?, includeDomains? | excludeDomains? (≤3 hostnames, never both), timeout: 30000 }`. The request schema is `.strict()`, so client-supplied headers, actions, proxy or TLS options are rejected as `invalid-request`.
- Request signal combined with a 35 s timeout via `AbortSignal.any`; the fetch is additionally raced against the signal so a provider that never settles cannot hold the single-flight slot.
- Response capped at 1 MiB by `content-length` and by streamed byte count (`too-large`).
- Status mapping: 401 → `unauthorized`, 402 → `payment-required`, 429 → `rate-limited` (retryable), 5xx → `upstream-error` (retryable), other non-2xx → `upstream-error` (not retryable), abort by caller → `cancelled`, timer → `timeout`, non-JSON / non-documented shape (including the older flat `data: []` SDK shape) → `invalid-response`, `success: false` → `upstream-error`.
- Documented v2 shape `{ success, data: { web: [{ url, title, description }] }, id?, warning?, creditsUsed? }` parsed with optional fields tolerated; `creditsUsed` stays `null` when absent (never inferred).
- Candidates failing the public-HTTPS validator are dropped and counted in `warning`; never more than `limit` are returned.
- Single in-flight search per server process (`busy`, HTTP 409). No automatic retry anywhere (server or panel).
- Failure messages are static strings; provider bodies and the key are never echoed. The only dynamic message text is the Zod issue path/message for `invalid-request` and an HTTP status number.
- `pricingResearchStatus` exposes `{ provider, configured, available, message }` only. `available` requires `XRAY_PRICING_RESEARCH_WEB_ENABLED === "true"` in addition to the key.
- One enum extension over the brief: `invalid-request` was added to the failure code enum so that 400/403/413/415 route responses use the same `{ failure }` shape as every other failure (documented here rather than hidden).

## Commands and results

```text
$ node --experimental-strip-types --test src/studio/pricing/pricingResearch.test.ts src/lib/pricingResearch.server.test.ts src/lib/materialAi.server.test.ts
ℹ tests 25 · pass 25 · fail 0 · exit 0          (tests.log; 6 shared + 13 server + 6 material AI regression)

$ node node_modules/typescript/bin/tsc --noEmit
exit 0                                           (typecheck.log)

$ git diff --check -- src/studio/pricing/PriceBookPanel.tsx
exit 0; trailing-whitespace grep over the seven new files found nothing
```

Server tests cover: status never exposes the key; not-configured and disabled refuse with zero fetch calls; invalid JSON / schema / combined domain filters → `invalid-request` with zero fetch calls; success against the documented shape (exact URL, POST, Bearer header, `sources: ["web"]`, candidates capped at limit 3 of 7 hits with the `http://` and `10.0.0.1` hits dropped and counted, `creditsUsed` 2 and provider warning passed through, key absent from the result JSON); missing optional provider fields → `creditsUsed: null`, `location` and `excludeDomains` pass through; 401/402/429/500/503/418 mapping and retryability; timeout with a never-settling fetcher and `timeoutMs: 20`, slot released afterwards; abort via signal → `cancelled` with one fetch call, already-aborted signal reaches no provider; oversized `content-length` and oversized stream → `too-large`; malformed JSON, `web: "not-an-array"`, legacy flat array and empty body → `invalid-response`; busy while one search is in flight then released; network `TypeError` containing the key → `upstream-error` whose message contains neither the key nor the provider text; same-origin rule.

### Live route on the shared dev server (`curl.log`)

```text
GET  /api/pricing-research                       → 200, cache-control: no-store
     {"provider":"Firecrawl","configured":false,"available":false,"message":"Supplier research provider not configured. Set FIRECRAWL_API_KEY and XRAY_PRICING_RESEARCH_WEB_ENABLED=true on the server to enable bounded searches."}
POST same-origin, valid JSON body                → 503 {"failure":{"code":"not-configured","retryable":false,...}}
POST Origin: https://other.invalid               → 403 {"failure":{"code":"invalid-request","message":"Cross-site supplier research requests are not allowed."}}
POST same-origin, limit 50                       → 400 {"failure":{"code":"invalid-request","message":"Supplier research request rejected: limit: Too big: expected number to be <=5."}}
```

### Fast CDP proof (dev server http://127.0.0.1:8080, reused, not restarted)

Scenario A desktop 1280×800 — `scenario-a-desktop.json` (generated by `build-scenario-a.mjs`; repair round), session `az3-pricing-research-repair-desktop`:

```text
$ node --experimental-strip-types proof/growth/2026-09-08-az3-pricing-research/validate-seed-fixture.ts
{"key":"xray:price-books:v1:qa-job","books":1,"rows":2,"bytes":1516}
$ node proof/growth/2026-09-08-az3-pricing-research/build-scenario-a.mjs
wrote scenario-a-desktop.json with 22 steps; fixture 1040 chars
$ node scripts/fast-cdp-test.mjs az3-pricing-research-repair-desktop proof/growth/2026-09-08-az3-pricing-research/scenario-a-desktop.json
exit 0 · 22 commands · 3.40 s · sha256 36b0330fc21c0569cc92896b4966f35abca52d39d0f8b91e6dd3f9781fb7a49c
report proof/growth/runner/2026-09-08T13-05-57-406Z-az3-pricing-research-repair-desktop.json (+ .log, .scenario.json); copy in scenario-a-desktop.report.json / .runner.log
```

Steps proven: hydration → seed one schema-valid price book record at `xray:price-books:v1:job-40edd9f4-a0b2-4540-b170-881be4fc366b` (1095 chars, 1 book, 2 rows; no previous record existed) → `reload` → hydration → record still present → `window.fetch` instrumented before the Cost pane opens (research section does not exist yet) → Cost → section reaches `data-research-status="not-configured"` → fetch log shows one *sent* `GET /api/pricing-research` and **no POST** (a second GET exists but was aborted by cleanup: TanStack Start's default client entry wraps the app in `<StrictMode>`, whose dev-only double mount runs the effect twice; the first probe is aborted by the effect cleanup and recorded as such) → Search button disabled with an empty query → the price book panel loaded the seed without a load error: tabs `Library (1)|Import price sheet|Priced worksheet (0)`, card heading "Seeded QA price book" → raw `localStorage` `xray:price-books:*` snapshot captured with **1 key** (assertion fails below 1), parsed record has 1 book / 2 rows → screenshot library card → screenshot research section → fill "90x45 MGP10 treated pine" → button enabled → click → `[data-failure-code="not-configured"][data-failure-http="503"]` rendered with `role="alert"` → price-book snapshot byte-identical (1 key before, 1 key after, 1298-char snapshot), seeded name / 2 rows / rate 21.85 intact, tab labels and card text identical, fetch log = sent GET + exactly one sent POST, text contains "HTTP 503", "FIRECRAWL_API_KEY" and "Existing price books are unchanged", `Try again` enabled, no `a[target=_blank]` rendered → screenshot failure → key re-read (1095 chars, revision 1, 1 book, worksheet 0) → screenshot library card after failure → `errors` (zero uncaught errors).

Round-1 Scenario A (session `az3-pricing-research-desktop`, report `2026-09-08T12-48-43-955Z`, 15 commands, `price-book keys=0`) is superseded; it is kept in `history-round1/` and under `proof/growth/runner/` as history only.

Scenario B tablet 1024×768 — `scenario-b-tablet.json`, session `az3-pricing-research-tablet`:

```text
$ node scripts/fast-cdp-test.mjs az3-pricing-research-tablet proof/growth/2026-09-08-az3-pricing-research/scenario-b-tablet.json
exit 0 · 13 commands · 1.02 s · sha256 7a5ba0d8f28ddb2119d1c9fe04bd4aa6faf3683e56839821e44994b914a9c5f7
report proof/growth/runner/2026-09-08T12-48-52-515Z-az3-pricing-research-tablet.json (+ .log, .scenario.json); copy in scenario-b-tablet.report.json / .runner.log
```

Steps proven: every button in the section ≥ 44 px (`Search supplier products=44px`, then `Search supplier products=44px, Try again=44px` in the failure state); no horizontal overflow on `documentElement`, `body`, `.cost-workspace`, `.price-books` or the section (`scrollWidth=1024`); no input/select/button extends past the viewport; failure state `not-configured HTTP 503`; `errors` zero.

Earlier attempts (all recorded under `proof/growth/runner/`, none deleted): `12-46-24` desktop failed because Vite's module loads exhaust the resource-timing buffer (0 entries) — replaced by a `window.fetch` wrapper that also records the method; `12-47-10` desktop failed on two GETs — diagnosed as the StrictMode dev double mount and the assertion now distinguishes aborted from sent requests; `12-47-54` tablet failed on `Identifier 'section' has already been declared` because top-level `const` in an eval persists in the page's global lexical scope — eval bodies now use `var`.

Both sessions closed with `agent-browser --session <name> close`.

## Screenshots (each opened and inspected with the Read tool)

- `screenshots/growth/2026-09-08-az3-pricing-research/desktop-seeded-library.png` — 1280×800, Cost pane, repair round, before the search. The Library tab shows the seeded card "Seeded QA price book" with "Seeded Timber Supplies · AUD · tax excluded · effective 2026-09-01", the source-reference line naming this fixture file, a "Price book revision" select reading "Revision 1 · 2026-09-01", "Export revision CSV" and "Archive price book" buttons, and collapsed "Rename price book" / "Browse 2 rates and source details" disclosures. Directly below it the "Supplier product research" heading, the not-configured status notice and the empty Product query input are visible. Errors 0.
- `screenshots/growth/2026-09-08-az3-pricing-research/desktop-not-configured.png` — 1280×800, repair round, research section scrolled to the top. Heading "Supplier product research" with the evidence-only sentence, a boxed status notice "Firecrawl: Supplier research provider not configured. Set FIRECRAWL_API_KEY and XRAY_PRICING_RESEARCH_WEB_ENABLED=true on the server to enable bounded searches.", empty Product query input (placeholder "90x45 MGP10 treated pine"), Country select "Australia (AU)", Max results "5", empty Supplier domain input (placeholder www.bunnings.com.au), the nominal-cost line ("Nominal cost 2 provider credits for up to 5 web links (documented estimate, not a provider maximum). Reported usage is shown with each result."), and a greyed, disabled "Search supplier products" button. Errors 0.
- `screenshots/growth/2026-09-08-az3-pricing-research/desktop-not-configured-failure.png` — same viewport after the click. Query shows "90x45 MGP10 treated pine", the search button is enabled (dark), and a failure box reads "Provider not configured (not-configured, HTTP 503)", the server message, "Request bd2e6bad-0a30-4dac-ab00-804481d60257 · finished 9/8/2026, 11:06:00 PM (2026-09-08T13:06:00.513Z) · Retrying will not help until the cause is fixed. Existing price books are unchanged." and a "Try again" button. No links rendered. Errors 0.
- `screenshots/growth/2026-09-08-az3-pricing-research/desktop-seeded-library-after-failure.png` — 1280×800 after the failed search, scrolled back to the library. The same "Seeded QA price book" card (Seeded Timber Supplies · AUD · tax excluded · effective 2026-09-01, Revision 1 · 2026-09-01, "Browse 2 rates and source details") is still rendered, and below it the research section shows the not-configured notice with the query "90x45 MGP10 treated pine" still in the input. Errors 0.
- Round-1 desktop screenshots (empty library, `price-book keys=0`) are kept as `history-round1/desktop-not-configured.round1.png` and `history-round1/desktop-not-configured-failure.round1.png`; they are history, not proof.
- `screenshots/growth/2026-09-08-az3-pricing-research/tablet-not-configured.png` — 1024×768. Same section in the centre column beside the Project pricing rail; all fields and the disabled search button fit the column, nothing is clipped horizontally. Errors 0.
- `screenshots/growth/2026-09-08-az3-pricing-research/tablet-not-configured-failure.png` — 1024×768 after the click: enabled search button, failure box "Provider not configured (not-configured, HTTP 503)" with request 700007ae-…, finished 2026-09-08T12:48:53.329Z, and the "Try again" button. Errors 0.

Note visible in every screenshot: the floating "Live assistant" pill (another agent's active work) overlaps the bottom-left sidebar; it is outside this slice and does not overlap the research section.

## Register rows

- P-01 User-initiated Firecrawl search — implemented and proven for the honest-failure branch only (not-configured 503 through the UI, mocked provider success/failure branches in tests). A live search with real links is **not** proven: no credential is configured. Recommend `partial`.
- P-02 Supplier and regional filters — country select, one include-only supplier domain, limit; results display query, country, timestamp, nominal estimate and reported credits (tests + `summarisePricingResearch`). Result rendering is proven only through unit tests and code, not a live result. Recommend `partial`.
- P-09 Provider budgets and credentials — key is server-only (`process.env`), status JSON never contains it, tests assert the key is absent from every thrown failure and result; request/response/time/limit caps and single-flight enforced. No durable budget reservation. Recommend `partial`.
- P-10 Search cancellation and retry — Cancel aborts the client request and the server maps abort → `cancelled` and discards late responses; rate limit → `rate-limited` failure with existing data untouched (Scenario A repair round: a seeded price book record — 1 key, 1095 chars, 1 book, 2 rows — is byte-identical before and after the failed search and the library still renders it; 429 mapping in tests, not exercised through the UI). Retry requires a fresh click; nothing retries automatically. Recommend `partial`.

## Limitations (explicit)

1. No live Firecrawl request was made; no credential is configured on this machine or the dev server. Mocked `fetch` proves control and error paths only. This is not a live-provider proof and must not be recorded as one.
2. The native Tauri app has no transport for `/api/pricing-research`; the panel's status probe failure path renders "Supplier research service unavailable in this build." That path is implemented but was not exercised in a native build here.
3. No durable budget reservation or reconciliation; the single-flight guard is process-local, as in `materialAi.server.ts`.
4. No scrape, structured extraction, proposals or rate application (P-03..P-08).
5. Same-origin checking is CSRF protection only; it does not establish user identity or tenant authorization (audit boundary 3).
6. `src/routeTree.gen.ts` was changed by the dev server's router generator as a consequence of adding the route file; it was not hand-edited.
7. Phone viewports are out of scope and were not tested.
8. The retained-data proof (P-10) uses a fixture record written to `localStorage` by the scenario and validated against the real schema, not a record produced through the Import price sheet UI; the failure exercised through the UI is `not-configured` (503), while the `rate-limited` (429) path is proven only by the injected-fetch unit test.

## Coordinator follow-up (2026-09-08 23:31) — re-verification major finding closed

Re-verification after the repair round refuted one claim: the provider response schema marked `success` and `data` optional and the object `.loose()`, so `{}`, `{ error: "quota" }` or a bare `{ success: true }` parsed as a successful search with zero links (an untruthful "No public supplier links were returned" state). Fixed by the coordinator in `src/lib/pricingResearch.server.ts`: `success` is now required, `success: false` still maps to `upstream-error`, and a successful answer without the documented `data` object is `invalid-response`. Two minor findings were closed at the same time: duplicate provider URLs collapse to one candidate (counted in `warning`) so the panel never renders duplicate keys, and the include-only supplier domain is echoed in the result (`includeDomains` on the result schema, `supplier` in the display summary, "supplier filter …" in the panel) so a rendered result names its supplier filter (P-02 wording).

Not changed (documented deviations, accepted): `country` is validated as a two-letter code, not against the ISO-3166 list; the route's 413/415 statuses and the `invalid-request` code extend the brief; README scenario hashes refer to the runner's compact saved copy, not the pretty-printed proof-dir file.

Executed:

- `node --experimental-strip-types --test src/studio/pricing/pricingResearch.test.ts src/lib/pricingResearch.server.test.ts src/lib/materialAi.server.test.ts` → first run 27 tests, 25 pass, 2 fail (a `{ success:false }` case now hit the stricter schema before the upstream-error mapping, and the summary deep-equal lacked the new `supplier` field); after making `data` optional-but-required-on-success and updating the expected summary → tests 27, pass 27, fail 0 (`tests-root-followup.log`). New assertions: `{}`, `{ error }`, `{ success:true }` and `{ data:{web:[]} }` each → `invalid-response` after exactly one fetch; `{ success:true, data:{} }` remains a genuine empty search; duplicate links collapse with a warning; the supplier filter is echoed or absent.
- `node node_modules/typescript/bin/tsc --noEmit` → exit 0 (`typecheck-root-followup.log`).
- `node scripts/fast-cdp-test.mjs az3-root-pricing scenario-a-desktop-v2.json` (seeded price book, not-configured failure path, screenshots renamed `v2-desktop-*.png`) → exit 0, 22 commands, 1.83 s (`proof/growth/runner/2026-09-08T13-29-54-962Z-az3-root-pricing.json`); session closed. The result view change cannot be rendered without a live provider and is covered by the unit tests only.
