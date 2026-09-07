# Next professional delivery wave: daily work, pricing research and handoff

Research date: 2026-09-07. Branch: `feat/architect-cad-engine`. This is an implementation audit and proposed acceptance scope, not a delivered-feature checklist. The existing register contains 364 requirements across 26 categories and 68 industry profiles. None of those product rows becomes complete because this document exists. Concurrent sheet, price-book and restore work must be assessed against its own final diff and executed proof.

The strongest next sequence is: recover a complete editing workspace; manage sheets without losing references; apply a named and revisioned price book; research selected supplier products; prepare a controlled staff package; then add authenticated delivery and receipt. These are dependencies shared by many industries. A generic roof model, a backup download, or an industry preset cannot establish engineering readiness.

## Ranked gaps and observable exits

| Priority | Existing rows | Concrete next slice | Acceptance before checking the product row |
|---|---|---|---|
| 1 | B-09, B-10, B-11, Z-07 | Apply a verified backup to the editing workspace | Fresh isolated profile opens the restored original PDF, annotation, architecture, takeoff and commercial records. Corrupt asset or interrupted application preserves the old confirmed workspace. Compare original hashes and semantic state after restart. |
| 2 | B-01, B-03, B-04 | Project identity and switching | Two projects with the same display name have different IDs. A renamed Redburn project no longer inherits an unrelated sample job title. Switching and restart retain the selected project's sources, rates and design. |
| 3 | D-02, D-04, D-05, D-06 | Rename, remove, restore and order sheets | Remove a sheet with annotations, calibration and takeoff references; inspect impact before applying. Undo/restore recovers the same sheet identity and dependencies. Original source bytes stay unchanged. |
| 4 | E-01, E-02, E-03, E-06 | Named price-book lifecycle | Import, map, name and version a book; preview matches; apply only selected rows; preserve manual overrides; remove application and undo. Old estimate retains its exact rate revision. CSV-only support must be labelled separately from XLSX workbook support. |
| 5 | E-04, E-05, P-04, P-05 | Comparable commercial quantities | Distinguish price per pack, sheet, metre, square metre and tonne. Require pack factor, currency, tax basis and product variant. Unknown conversions cannot produce an amount. Changing tax basis cannot silently double tax. |
| 6 | P-01, P-02, P-09, P-10 | Bounded supplier search | A click starts one capped search; real links, query, country, timestamp and provider usage appear. Key missing, cancellation, 401, 402, 429 and timeout produce truthful recoverable states. No search starts during render or project open. |
| 7 | P-03, P-06, P-07, P-08 | Source-backed price proposal | Scrape only selected URLs. Show supplier, SKU, size/grade/finish, raw price text, price basis, availability and evidence. Quote-only remains unknown. Reject leaves rates untouched; accepted proposal becomes a revisioned price-book entry. |
| 8 | V-03, V-04, I-14 | Selective portable handoff | Package manifest enumerates exact documents/revisions and included commercial fields. Recipient opens it on a fresh profile. Excluded rates are absent from bytes, not merely hidden by CSS; loss report lists any deliberately omitted context. |
| 9 | A-01, A-03, A-04, A-07, V-05, V-06, V-07 | Authenticated staff delivery | Named recipient sees only authorized package. Duplicate submission creates one transmittal; sent status requires a durable transport receipt. Receipt, download and recipient acknowledgement are separate events. Revocation blocks future authorized fetches. |
| 10 | D-09, D-10, V-02, V-12 | Controlled revised issue | Issue revision A, revise one sheet, compare, then issue B with explicit purpose/status. A remains retrievable and visibly superseded. Work in progress cannot acquire approved status through export alone. |
| 11 | F-01, F-08, F-14, V-11 | Offline field round trip | Isolated second device/profile downloads a field package, goes offline, adds a photo/redline, restarts, reconnects and reviews a deliberately conflicting edit. Both originals remain recoverable. |
| 12 | Q-08, Q-09, Q-10, Z-14 | Discipline-specific release gates | Each claimed discipline runs a sourced known-answer fixture, source-to-result trace and full working-day scenario. Supported calculation scope and professional review remain explicit. |

These are implementation priorities inferred from the repository and benchmarks, not a ranking by market share.

## Firecrawl: verified contract and proposed integration

Official v2 search uses `POST https://api.firecrawl.dev/v2/search`. The documented REST response groups web hits under `data.web` and may include job `id`, `warning` and `creditsUsed`. Restrict the first adapter to `sources: ["web"]`, a small result `limit`, `country`, `location` and one domain filter. `includeDomains` and `excludeDomains` cannot be combined. Use the endpoint schema rather than copying older SDK examples with a flat result array. [Search endpoint](https://docs.firecrawl.dev/api-reference/endpoint/search), [search guide](https://docs.firecrawl.dev/features/search).

The current guide prices ordinary search at two credits per started ten results, with basic scraping at one per web page, PDF parsing per page and JSON extraction extra. Proposed first operation: five links, then at most three user-selected basic HTML scrapes; the nominal documented estimate is five credits before optional features or retries. Display an estimate separately from reported usage; do not present this as a provider-enforced maximum. No automatic PDF parsing or JSON extraction in that slice. [Search cost guide](https://docs.firecrawl.dev/features/search).

Scrape uses `POST https://api.firecrawl.dev/v2/scrape`. Set explicit `formats: ["markdown"]`, `parsers: []`, `maxAge: 0`, `timeout`, `storeInCache: false`, and retain TLS verification. The documented default cache age is 48 hours; a pricing refresh should request fresh retrieval and record what actually returned. Current live documentation describes `basic`, `enhanced` and `auto` proxy modes without an enhanced credit surcharge; older indexed examples mention a different stealth charge. Do not hardcode the older figure. Scraping is evidence collection, not a guarantee of the supplier's final delivered price. [Scrape endpoint](https://docs.firecrawl.dev/api-reference/endpoint/scrape).

Bearer authentication is documented for API-key use. Current docs also describe limited keyless access; do not build a commercial shared quota promise around it. Team credits are available from `GET https://api.firecrawl.dev/v2/team/credit-usage`. Keep team-wide balance separate from this project's local accounting because other clients can consume the same account. [Credit usage endpoint](https://docs.firecrawl.dev/api-reference/endpoint/credit-usage), [rate limits](https://docs.firecrawl.dev/rate-limits).

Provider rate and concurrency limits are plan/team dependent; 429 can represent either. X-Ray should serialize its first pricing operation and bound its own queue. Reserve a persistent local/durable-web budget before sending, reconcile actual returned usage and never release a reservation merely because the client timed out. An aborted HTTP request does not prove the provider cancelled billing. A retry after an uncertain outcome needs explicit user initiation and a new recorded attempt. [Rate limits](https://docs.firecrawl.dev/rate-limits).

### Proposed contract (new product work, not implemented by this audit)

| Object | Minimum fields and invariants |
|---|---|
| `PricingResearchRequest` | Schema version, request ID, project ID/revision, explicit query, country, location, supplier-domain allowlist, maximum results, selected material IDs and agreed operation budget. Do not send full plans, contacts or confidential project details when product terms suffice. |
| `PricingResearchRun` | Request snapshot, start/end timestamps, provider job ID if returned, attempt state, reserved/actual credits, redacted error code, cancellation state and ordered results. Missing provider usage stays unknown. |
| `SupplierCandidate` | Original and final source URL, supplier, title, retrieval time, content digest, bounded evidence excerpt, raw product/price text, SKU and variants, currency, amount-or-null, unit/pack, tax/freight basis, stock/lead time-or-unknown. |
| `RateProposal` | Candidate ID/digest, target material, explicit conversion factors, source price and normalized rate, existing rate revision, reviewer decision and accepted revision. Rejecting a proposal cannot mutate authoritative rates. |

Implementation boundary:

1. Shared strict Zod DTOs in a dedicated pricing-research module. Keep page content as untrusted data; never treat it as instructions or render supplier HTML unsanitized. Reject invalid schemas and overlarge responses before saving proposals.
2. Desktop adapter through dedicated Tauri commands and Rust HTTPS, with fixed Firecrawl endpoint origin and bounded request body/time/response. Keep the key in native process memory or an explicitly designed OS credential-store flow. Never `VITE_` variables, browser storage, backups or diagnostics. Native configuration status exposes only availability and limits.
3. Web adapter through a server-only module and authenticated, project-scoped route/server function. Operator-controlled enabling plus durable budget reservations are required for a shared paid key. Existing same-origin checking is useful CSRF protection but does not establish user identity or tenant authorization.
4. Search obtains candidate links only. Selected scrape validates public HTTP(S) URLs, rejects credentials, loopback/private hosts and unexpected ports, and restricts the destination to the selected supplier set. Do not accept arbitrary client Firecrawl options such as custom request headers, actions or TLS bypass.
5. Import reviewed candidates through the price-book module's explicit mutation API; do not write directly into architect material costs or BOM state. Record source and previous revision so unapply/undo can be precise.
6. Keep provider failure, unsupported price, uncertain product match, stale project and rejected proposal distinct. Cancellation cancels local work and discards late responses; it must not claim to refund external work.

Reusable code inspected:

- `src/lib/materialAi.server.ts` demonstrates fixed upstream HTTPS, request/response size caps, bounded time and injected fetch for tests. Its process-local daily counter is insufficient for durable web-wide pricing budgets.
- `src/routes/api.material-ai.ts` shows dynamic server-only imports and bounded request reading; do not copy it as the authentication design for shared paid pricing.
- `src-tauri/src/material_ai.rs` and `src/studio/architect/cadTransport.ts` demonstrate native dispatch, status and cancellation boundaries. Keep pricing state distinct from drawing AI state.
- `src/studio/construction/projectMaterials.ts` already carries evidence, physical identity and reviewed material state. Map proposed supplier evidence into a new versioned research contract without repurposing source-plan evidence fields.
- `src/studio/projectBackup.ts` and `projectBackupStorage.ts` provide schema validation, content hashes and explicit storage allowlisting. New research/price-book stores need an explicit backup migration and retention decision.

## Staff handoff: standalone architecture

The existing `src/studio/crmBridge.ts` intentionally returns unavailable. Keep that contract and leave Looplet CRM untouched. Standalone staff handoff should have its own versioned package and transport boundaries.

Oracle Aconex documents transmittals that distribute documents into recipient registers and keep an audit trail; its current instructions also describe processing states for large transmissions. This supports a manifest-bound, durable operation with intermediate states, rather than equating a click or email draft with completed delivery. [Aconex transmittal concept](https://help.aconex.com/mail/what-is-the-difference-between-a-document%2C-a-transmittal%2C-and-a-/), [transmit documents](https://help.aconex.com/documents/transmit-your-document/).

Bluebeam distinguishes managed document storage in Studio Projects from live review in Sessions, with participant permissions. X-Ray needs these separate deliverables too: sharing a fixed package, collaborating on markups and editing a live project have different conflict and access rules. [Bluebeam Studio FAQs](https://support.bluebeam.com/studio/resources/studio-faqs.html), [Sessions permissions](https://support.bluebeam.com/studio/how-to/studio-sessions-guide-for-revu.html).

Proposed portable layer: a new `xray.staff-package/v1` envelope references a sanitized snapshot, exact asset hashes, document and issue revisions, purpose, preparer, content selections and a compatibility/loss report. Reuse backup validation for complete snapshots, but do not strip arbitrary fields from an existing backup and still label it complete. A selective package needs its own validator that can represent intentionally omitted commercial modules and associated dependencies. Downloaded package bytes cannot be remotely revoked; explain revocation only for future managed access.

Proposed managed layer: project memberships, immutable package records, recipient grants, transmittals, outbox jobs and receipt events in an authenticated service. Scope every query by verified actor and project membership. Store blobs under service-generated keys; validate manifest hashes on ingest and download. Use uniqueness on `(projectId, actorId, idempotencyKey)` so retry returns the existing transmittal. Blob upload finishes before the immutable package commits; background delivery reads a committed outbox. Provider acceptance, recipient download and explicit acknowledgement each receive distinct timestamps and identifiers.

First handoff UI should offer: prepare package → inspect content/omissions → download. Managed sending becomes available only with configured identity, transport and durable receipt. Real external messages need the user's explicit sending authorization; developing and testing with local/inert fixtures does not need a message sent to staff.

## A–Z depth audit: one concrete follow-on gate in every category

All rows below remain open/unassessed. They sharpen the existing scope rather than introducing unverified checkmarks.

| Category and existing rows | Next missing-depth acceptance scenario |
|---|---|
| A: A-05, A-07 | Remove an estimator's access while their tab is open; subsequent API and export requests cannot disclose restricted rates. |
| B: B-03, B-12 | Duplicate a project then edit both in two windows; identities diverge and stale writes are blocked without losing either version. |
| C: C-05, C-12 | Millimetre detail referenced into metre site coordinates retains measured dimensions, text scale and exported placement. |
| D: D-09, D-12 | Supersede a drawing; linked callouts resolve the intended revision and old issued references remain inspectable. |
| E: E-05, E-07 | Compare one supplier's pack price with another's metre price; show conversion, tax/freight and unmatched variants before selecting. |
| F: F-06, F-14 | Offline inspection includes a failed hold point, timestamped photo and later conflicting supervisor decision with review. |
| G: G-01, G-09 | Import two surveys in declared coordinate systems; show control residuals and refuse a transform with missing datum. |
| H: H-01, H-07 | Close a valve in a known network fixture; revised connectivity and pressure calculation results bind to that network revision. |
| I: I-03, I-14 | Round-trip an IFC fixture with known properties; quantify retained, changed and unsupported geometry/property fields. |
| J: J-05, J-09 | Approve a scope change and trace resulting budget and programme changes without overwriting the original baseline. |
| K: K-11, K-14 | Upgrade a shared assembly template; existing project instances change only through reviewed migration. |
| L: L-02, L-08 | Grade an accessible path with crossings; source elevations, slopes and drainage are checked against selected criteria. |
| M: M-07, M-14 | Release two product configurations with shared parts; an engineering change affects only the selected effectivity/configuration. |
| N: N-03, N-10 | Change cable route length; bound electrical/fibre schedule outputs become recalculated or explicitly stale. |
| O: O-02, O-08 | Scan an installed asset identifier offline and retrieve its exact warranty/O&M revision and open maintenance history. |
| P: P-06, P-07 | A quoted-only product, expired quote and supplier page without a currency all remain unpriced pending review. |
| Q: Q-08, Q-10 | Independently calculate a known engineering case; attach solver version, tolerance, assumptions and identified checker. |
| R: R-03, R-05 | Section a federated model and select an element; source page/region and hidden discipline remain consistent across saved views. |
| S: S-03, S-12 | Staged bridge/tank fixture records stage-dependent loads and restraints; invalid disconnected members stop analysis. |
| T: T-08, T-09 | Revised drawing reuses some objects and removes others; duplicate detection and delta quantities reconcile the prior takeoff. |
| U: U-05, U-07 | Keyboard-only workflow at 200% DPI and a short laptop window reaches dialogs and all bottom controls without hidden actions. |
| V: V-04, V-06 | Prepare a package without commercial data; inspect actual bytes and recipient permissions, then prove idempotent receipt handling. |
| W: W-06, W-07 | Compare two assemblies using versioned environmental factors and service-life assumptions; show missing factors and sensitivity. |
| X: X-10, X-11 | Malicious supplier text asks the AI to reveal a secret; output remains inert evidence and no tool/network action is triggered. |
| Y: Y-03, Y-05 | Rail cant/turnout changes and utility isolation are verified with discipline-specific models, not generic line geometry. |
| Z: Z-07, Z-14 | A fresh installed profile completes receive→design→review→price→handoff→offline field→reopen with artifact-bound proof. |

## Industry coverage is broad, but these specialist branches need expansion

The 68 profiles already name many sectors. The omissions are chiefly deliverable depth and independently checked scenarios. Do not add another profile merely to inflate a count.

| Existing profile / mapped rows | Explicit sub-scenarios to add | Benchmark and implication |
|---|---|---|
| Rail/transit: Y-03, G-03, N-01 | Survey regression; turnout and cant rules; station/platform clearances; overhead-line interfaces; signalling asset references | [OpenRail Designer](https://www.bentley.com/en/products/openrail-designer/) describes rail-specific components and integrated documentation. A generic corridor row does not cover these independent checks. |
| Water/utilities: Y-05, H-01, G-12 | Terminal-aware connectivity; valve isolation; upstream/downstream trace; topology errors; selected network state | [Esri subnetwork trace](https://doc.esri.com/en/arcgis-pro/latest/help/data/utility-network/trace-a-subnetwork.html) requires enabled topology, controllers and a starting basis. GIS display alone is not network analysis. |
| Manufacturing/automotive/aerospace: M-07, M-14, V-01 | Engineering versus manufacturing BOM; configuration effectivity; serial/lot trace; change disposition; released baseline reproduction | [Teamcenter BOM](https://www.siemens.com/en-us/products/teamcenter/solutions/bom-bill-of-materials-management/) links multidomain BOMs, configurations and change management. Flat quantity export covers only a small subset. |
| Medical/precision and critical controls: J-02, Q-08, M-13 | Requirement→design→verification links; test protocol revision; deviations; approval provenance | [Polarion Requirements](https://www.siemens.com/en-gb/products/polarion/requirements/) documents versioned requirements and verification artifacts. This is a traceability benchmark, not evidence that X-Ray meets any regulatory certification. |
| Shipbuilding/marine: Y-04, M-02, S-12 | Hull hydrostatics; loading conditions; intact/damage stability; tank states; longitudinal strength; fabrication package | [Bentley MAXSURF product sheet](https://www.bentley.com/wp-content/uploads/PLB-MAXSURF-LTR-EN-LR.pdf) describes dedicated stability and motion analysis. Building-model solids cannot stand in for naval calculations. |
| Bridges and structures: S-03, S-12, S-13 | Construction stages; prestress/time effects; bearings; moving loads; reinforcement and analytical/physical-model consistency | [OpenBridge workflow checklist](https://www.bentley.com/wp-content/uploads/fs-openbridge-checklist-ltr-en-lr.pdf) distinguishes physical modeling, analysis and detailing. Each needs its own fixture and declared range. |
| Quantity surveyors and contractors: E-07, E-11, T-09 | Bid comparison; measurement changes; alternatives; rate database revision; historical estimate reconstruction | [RIB CostX](https://www.rib-software.com/en/rib-costx) provides revision and cost-workbook benchmarks. Supplier search is only an evidence input to that commercial workflow. |
| Designers, consultants and document controllers: D-09, V-09, V-12 | Controlled issue versus live review; superseded sheets; review closure; guest access; confidential tender distribution | [Aconex latest-document transmission](https://help.aconex.com/documents/transmit-updated-documents-to-people-who-have-old-versions-using/) and [Bluebeam Studio](https://support.bluebeam.com/studio/resources/studio-faqs.html) illustrate different distribution/review responsibilities. |

Potential new acceptance branches to investigate next: tunnels and underground works; dams/reservoirs; hydrographic surveying and dredging; industrial automation/functional-safety evidence; pharmaceutical validation and cleanroom change control; district energy; mining ventilation; acoustics/vibration; vertical transportation; food-processing hygiene; temporary lifting/rigging; forensic chain of custody. Some belong beneath existing profiles. Their inclusion here is a discovery backlog, not a researched claim that the catalogue covers their full practice.

## Proof protocol for the next slices

Keep one explicit fixture and scenario per declared workflow, use isolated QA profiles, and preserve originals. Run focused contract tests first; batch interactive steps through the existing agent-browser runner using readiness assertions. Capture only meaningful checkpoints, inspect the screenshots and retain logs. Build sequentially on Dans1 at the established bounded priority, then repeat the declared workflow against built output and the installed app. A checklist row needs its actual diff, fixture/source hashes, build identity and inspected or executed evidence. Research docs and mocked provider tests never count as a live Firecrawl or real staff-delivery proof.
