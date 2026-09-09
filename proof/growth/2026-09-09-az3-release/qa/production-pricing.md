# production-pricing — bounded supplier research (P-01/P-02/P-09/P-10)

- Platform: production browser against the candidate preview `http://127.0.0.1:8096/` (hash-verified web artifacts of run `5dfc922f097f`, served by `scripts/preview-built.mjs` with the server's `.env.local` loaded). The in-app status strip in every screenshot reads `Build 5dfc922f097f`.
- Runner: `node scripts/fast-cdp-test.mjs <session> <scenario.json>` from the repo root (Git Bash).
- Session: `az3rel-prod-pricing-1` (one session for all three scenarios, opened by the warm-up, closed at the end).
- Result: **PASS** — 3/3 scenarios exit 0, each on the first attempt. No harness edits. No product failures.

## Preflight

```
$ curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8096/
200

$ curl -s -i http://127.0.0.1:8096/api/pricing-research
HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json
{"provider":"Firecrawl","configured":false,"available":false,"message":"Supplier research provider not configured. Set FIRECRAWL_API_KEY and XRAY_PRICING_RESEARCH_WEB_ENABLED=true on the server to enable bounded searches."}
```

The GET is the status probe (HTTP 200, `configured:false`). The 503 belongs to a search POST; confirmed with a well-formed request (a POST without `projectId`/`requestId` is rejected 400 `invalid-request` by schema validation first):

```
$ curl -s -i -X POST -H 'content-type: application/json' \
    -d '{"projectId":"qa-curl","requestId":"qa-curl-1","query":"90x45 MGP10 treated pine"}' \
    http://127.0.0.1:8096/api/pricing-research
HTTP/1.1 503 Service Unavailable
{"failure":{"schema":"xray.pricing-research/v1","requestId":"qa-curl-1","code":"not-configured","message":"Supplier research provider not configured. Set FIRECRAWL_API_KEY and XRAY_PRICING_RESEARCH_WEB_ENABLED=true on the server to enable bounded searches.","retryable":false,"startedAt":"2026-09-08T15:09:54.480Z","finishedAt":"2026-09-08T15:09:54.480Z"}}
```

No secrets appear in either response. Expected state (`FIRECRAWL_API_KEY` not configured -> `not-configured`, HTTP 503) is confirmed at the API level before any browser run.

## Scenario 1 — warm-up

- File: `proof/growth/2026-09-09-az3-release/scenarios/prod-warm.json`
- Command: `node scripts/fast-cdp-test.mjs az3rel-prod-pricing-1 proof/growth/2026-09-09-az3-release/scenarios/prod-warm.json`
- Exit code 0, attempt 1 of 1, 6 commands, 1.33 s (no 10060 timeout on the fresh session).
- Runner report: `proof/growth/runner/2026-09-08T15-09-58-992Z-az3rel-prod-pricing-1.json`
- Log: `proof/growth/runner/2026-09-08T15-09-58-992Z-az3rel-prod-pricing-1.log`
- Scenario copy: `proof/growth/runner/2026-09-08T15-09-58-992Z-az3rel-prod-pricing-1.scenario.json` (sha256 `6ffbc326b4eb2dfbe423c1ce0a1a761a6e77aaebde3a78720cb6a5bac1a39ee0`)
- Key eval outputs: `{hydration:"ready", ready:"complete", title:"X-Ray by Looplet", url:"http://127.0.0.1:8096/"}`; panes = Overview, Sheets, Measure, Sketch, Components, Model, Render, Review, Cost, Proof. `console` and `errors` both empty.
- Screenshots: none (scenario takes none).
- Harness edits: none.

## Scenario 2 — desktop 1280x800 (P-01 status probe, P-02 no auto-search, P-09 failure surface, P-10 price book retention)

- File: `proof/growth/2026-09-09-az3-release/scenarios/prod-pricing-a-desktop.json`
- Command: `node scripts/fast-cdp-test.mjs az3rel-prod-pricing-1 proof/growth/2026-09-09-az3-release/scenarios/prod-pricing-a-desktop.json`
- Exit code 0, attempt 1 of 1, 22 commands, 1.08 s.
- Runner report: `proof/growth/runner/2026-09-08T15-10-05-152Z-az3rel-prod-pricing-1.json`
- Log: `proof/growth/runner/2026-09-08T15-10-05-152Z-az3rel-prod-pricing-1.log`
- Scenario copy: `proof/growth/runner/2026-09-08T15-10-05-152Z-az3rel-prod-pricing-1.scenario.json` (sha256 `98d24e9260f2838cb71c057331af5fe8ee5800b6ac1d7f4cafcc1df54bea78d2`)
- Key eval outputs (verbatim from the log):
  1. `seeded xray:price-books:v1:job-27d0368e-1c73-4875-8c1c-ad88a4ee4c9a (1095 chars, books=1, rows=2); previous record: none`
  2. `after reload: project job-27d0368e-... has price book record xray:price-books:v1:job-27d0368e-... (1095 chars); fetch instrumented before Cost pane; log=[]` (research section confirmed absent before the Cost pane opens)
  3. `pricing-research fetches=["GET /api/pricing-research (sent)"]; state=idle; price-book keys=1 (..., 1095 chars, books=1, rows=2); tabs=Library (1)|Import price sheet|Priced worksheet (0); card=Seeded QA price book` — exactly one status GET, no POST, Search button disabled on empty query, status text names `not configured` and `FIRECRAWL_API_KEY`, no price-book load alert.
  4. `search enabled for query: 90x45 MGP10 treated pine`
  5. `failure rendered (not-configured, HTTP 503); price-book keys=1 before and 1 after, raw bytes identical (1298 chars snapshot), seeded book name/rows/rate intact, library tabs and card text identical; fetches=["GET /api/pricing-research (sent)","POST /api/pricing-research (sent)"]; text=Provider not configured (not-configured, HTTP 503)Supplier research provider not configured. Set FIRECRAWL_API_KEY and XRAY_PRICING_RESEARCH_WEB_ENABLED=true on` — failure is `role=alert`, contains `HTTP 503`, `FIRECRAWL_API_KEY`, `Existing price books are unchanged`, `Try again` enabled, no `a[target=_blank]` links.
  6. `post-failure: xray:price-books:v1:job-27d0368e-... still holds 1095 chars, revision 1, 1 book(s), worksheet 0; card heading Seeded QA price book; research state failure`
  7. `errors`: empty.
- Screenshots produced and inspected (all 1280x800, Cost pane active, status strip `Logs 10 · Console 0 · Errors 0 · Status · Build 5dfc922f097f`):
  - `screenshots/growth/2026-09-09-az3-release/prod-pricing-v2-desktop-seeded-library.png` — the seeded card "Seeded QA price book / Seeded Timber Supplies · AUD · tax excluded · effective 2026-09-01" with revision select, Export revision CSV and Archive buttons and "Browse 2 rates and source details"; below it the "Supplier product research" heading with the Firecrawl not-configured notice and an empty "Product query" placeholder.
  - `screenshots/growth/2026-09-09-az3-release/prod-pricing-v2-desktop-not-configured.png` — the research section scrolled to top: not-configured notice, empty query field, Country "Australia (AU)", Max results "5", supplier domain placeholder, cost note, and the greyed (disabled) "Search supplier products" button.
  - `screenshots/growth/2026-09-09-az3-release/prod-pricing-v2-desktop-not-configured-failure.png` — query filled "90x45 MGP10 treated pine", enabled Search button, and the failure panel "Provider not configured (not-configured, HTTP 503)" with the FIRECRAWL_API_KEY message, request id fccc02b1-... finished 2026-09-08T15:10:05.965Z, "Retrying will not help until the cause is fixed. Existing price books are unchanged." and a "Try again" button; no result links.
  - `screenshots/growth/2026-09-09-az3-release/prod-pricing-v2-desktop-seeded-library-after-failure.png` — scrolled back to the seeded card, unchanged (same heading, supplier line, revision select, Export/Archive, "Browse 2 rates"), with the research section beneath still showing the filled query.
- Harness edits: none.

## Scenario 3 — tablet 1024x768 (touch targets and overflow)

- File: `proof/growth/2026-09-09-az3-release/scenarios/prod-pricing-b-tablet.json`
- Command: `node scripts/fast-cdp-test.mjs az3rel-prod-pricing-1 proof/growth/2026-09-09-az3-release/scenarios/prod-pricing-b-tablet.json`
- Exit code 0, attempt 1 of 1, 13 commands, 0.60 s.
- Runner report: `proof/growth/runner/2026-09-08T15-10-20-844Z-az3rel-prod-pricing-1.json`
- Log: `proof/growth/runner/2026-09-08T15-10-20-844Z-az3rel-prod-pricing-1.log`
- Scenario copy: `proof/growth/runner/2026-09-08T15-10-20-844Z-az3rel-prod-pricing-1.scenario.json` (sha256 `6a8983042bbcb63d2c3b560f96d0aed3c78bf1109445fddb2a7f4056adf0c606`)
- Key eval outputs (verbatim):
  1. `tablet 1024x768; buttons Search supplier products=44px; no horizontal overflow (doc scrollWidth=1024)`
  2. `failure state on tablet: not-configured HTTP 503; buttons Search supplier products=44px, Try again=44px`
  3. `errors`: empty.
- Screenshots produced and inspected (both 1024x768, Cost pane active, left model/sheet sidebar collapsed to a chevron at this width, status strip `Logs 10 · Console 0 · Errors 0 · Status · Build 5dfc922f097f`):
  - `screenshots/growth/2026-09-09-az3-release/prod-pricing-tablet-not-configured.png` — "Supplier product research" section at the top of the middle column with the Firecrawl not-configured notice, empty query, Country/Max results selects side by side, supplier domain field, and the disabled grey "Search supplier products" button; nothing runs off the right edge.
  - `screenshots/growth/2026-09-09-az3-release/prod-pricing-tablet-not-configured-failure.png` — query "90x45 MGP10 treated pine", enabled Search button, and the failure panel "Provider not configured (not-configured, HTTP 503)" with request id 0fd02c55-... finished 2026-09-08T15:10:21.280Z, "Existing price books are unchanged." and a "Try again" button; no links, no horizontal scroll.
- Harness edits: none.

## Session close

```
$ .temp/npm/_npx/8e62322f9a68a26a/node_modules/agent-browser/bin/agent-browser-win32-x64.exe --session az3rel-prod-pricing-1 close
✓ Browser closed
CLOSE_EXIT=0
```

## Limitations

- The API-level 503 was confirmed with a hand-built POST (`projectId`, `requestId`, `query`); the endpoint validates shape before provider configuration, so a bare `{"query":...}` POST returns 400 `invalid-request`, not 503. The browser scenarios exercise the real client request and observed 503 in both viewports.
- The tablet scenario ran in the same session immediately after the desktop scenario, so the browser profile still held the seeded price book record from scenario 2. The tablet scenario asserts only the research section's status, button heights and overflow and does not depend on the library state; the seeded book sits above the research section but is scrolled out of both tablet screenshots.
- The seeded record `xray:price-books:v1:job-27d0368e-1c73-4875-8c1c-ad88a4ee4c9a` was written into the QA session's browser storage by the scenario itself and was not cleaned up (the scenario has no cleanup step and I did not add one). It lives only in the `az3rel-prod-pricing-1` agent-browser session profile, not in the user's installed app or the user preview on 8095.
- The `Live assistant` pill overlaps the right-hand column in every screenshot; it never covers the research section or the seeded card and no assertion targets it.
- Runs are fast (0.6-1.3 s) because the preview serves prebuilt assets and the Cost pane renders synchronously; every `wait --fn` returned `true` and every eval string is present in the logs, so the speed is not a skipped-step artefact.
- The first attempt to write this report via a bash heredoc failed on shell quoting (no file was created); it was rewritten with the file-write tool. No other files were touched.
