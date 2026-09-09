# Firecrawl implementation-readiness audit — 2026-09-08

Read-only source inspection and official documentation review. No provider call, credential-value inspection, or application change. P-01/P-03/P-08/P-09 remain open.

## Existing foundation

- No Firecrawl transport, settings or supplier-candidate schema exists under application source.
- `src-tauri/src/material_ai.rs` and `src/studio/materialAiTransport.ts` demonstrate dedicated native commands, session-memory credentials, cancellation and redacted status. `AiMaterialReviewPanel.tsx` clears its transient password input. There is no OS keychain/Stronghold dependency: this is session-only handling, not secure credential persistence across restarts.
- `src/lib/materialAi.server.ts` demonstrates fixed upstream HTTPS, response limits, timeout and injected fetch. Its process-local daily counter resets on restart and is not a durable shared budget. `src/routes/api.material-ai.ts` checks origin but does not establish authenticated identity. Auth helpers exist separately; a shared paid pricing route must not copy this authorization model.
- `src/studio/pricing/priceBooks.ts` provides immutable revisions, Web Locks, stale-write rejection, explicit worksheet insertion and preserved corruption. Its strict source schema accepts CSV/XLSX provenance; numeric rates cannot represent unknown supplier prices. Do not fabricate file provenance to import research.
- Project backups use an explicit record allowlist. Any persistent research store requires a declared backup/migration decision; provider secrets and budget journals must not enter project exports.

## Proposed bounded contract (not implemented)

1. `src/studio/pricing/pricingResearch.ts` and `.test.ts`: strict requests/runs/candidates/review decisions. Five search links maximum; one explicitly selected page extraction per action. Include query, country, supplier domains, request identity, original/final URL, retrieval time, content digest, bounded excerpt, SKU/variant and nullable amount/currency/unit/pack/tax/freight/availability fields. Unknown prices stay null. Review binds candidate digest and target price-library revision.
2. `src-tauri/src/pricing_research.rs` plus `src/studio/pricing/pricingResearchTransport.ts`: native-first fixed endpoints, session configure/status/disconnect, one active operation, bounded request/response/time, cancellation and redacted errors. Root registers commands after contract agreement. Never reuse the Gemini credential implicitly.
3. `PricingResearchPanel.tsx` and CSS: search → select source → extract → inspect/edit → accept/reject. Search and extraction never change costs. No provider action runs on mount or retry automatically.
4. Add versioned research provenance to the price-book contract before reviewed application. Reuse existing immutable revisions and safe mutation APIs. Reject stale project/library identity and retain previous rates on any error. Decide candidate persistence/backup inclusion explicitly.
5. Keep shared paid web access unavailable until verified user identity, project authorization and durable shared budget reservations exist. Local native reservations also need restart-safe storage if advertised as a daily cap. Reserve before transmission; timeout/cancellation retains uncertain usage rather than claiming refunded charges.

## Current primary API documentation

- [v2 Search API](https://docs.firecrawl.dev/api-reference/endpoint/search): bearer authorization, POST `https://api.firecrawl.dev/v2/search`, query/result/domain/country limits, result links, provider request identity, warnings and `creditsUsed`.
- [Search costs](https://docs.firecrawl.dev/features/search): standard search costs 2 credits per 10 results, rounded up. Optional basic scrape adds 1 credit per webpage and JSON mode adds 4 additional credits per webpage. Five results plus one selected JSON extraction therefore has a documented baseline of 7 credits; enabled extras and provider policy can change actual usage. Display reservation/estimate separately from actual returned usage, which may be unknown.
- [v2 Scrape API](https://docs.firecrawl.dev/api-reference/endpoint/scrape): POST `https://api.firecrawl.dev/v2/scrape`. Default `maxAge` is 172800000 ms (48 hours); use `maxAge: 0` for explicitly fresh pricing. Set `parsers: []` for this webpage-only slice. Do not allow arbitrary actions, headers, TLS bypass, profiles or client-supplied provider options. Validate public supplier URLs and returned final URLs; treat excerpts as untrusted text. Do not claim extraction is an authoritative quote.
- [Rate limits](https://docs.firecrawl.dev/rate-limits): provider limits depend on plan/team. Serialize the first implementation, retain existing data on 429, require an explicit new attempt after uncertain outcomes.

## Required evidence boundaries

Mock tests: malformed/oversized response; 401/402/429; timeout/cancel/late completion; secrets absent from status/errors; durable budget reservation/restart/uncertain usage; forbidden URL/options; unknown price; variant mismatch; rejected/stale review never changing costs; corrupted storage and failed write preserving prior values. Native and web adapters must share fixtures and semantic validation.

Later live gate: one authorized public-product search and selected extraction with actual configured credentials; inspect source/price basis, retain provider usage and response digest, review explicitly and prove reload. No live paid call is authorized by this audit itself. Mock success cannot close live P-01/P-03 acceptance. P-08 additionally requires tested authoritative-rate integration; P-09 requires demonstrated credential and budget boundaries.
