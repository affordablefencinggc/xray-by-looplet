# Roofing worker — IND-29

Approved by user: “spin up an agent for each industry to work without collision”.
Branch: feat/architect-cad-engine. Shared-file integration belongs to the root agent.

## SC-01 — Draft plan-to-true roof area (helper tested; integration open)

Requirement: roofing T-1, register T-04. Audit found pitch in architect geometry but no isolated estimator area-development helper.

Exclusive writes: `src/studio/industries/roofing/`, this file, and `proof/growth/2026-09-13-industry-agents/roofing/`.

- [x] Read industry specification and inspect existing roof/pitch paths.
- [x] Implement explicit-input arithmetic with no implicit pitch/product defaults.
- [x] Run analytic and failure-boundary tests: 7 pass, 0 fail; scoped TypeScript check exit 0.
- [x] Hand off integration boundary; leave workflow acceptance open.

This slice does not measure a plan, validate calibration, resolve overlapping openings, calculate hip/valley lengths, optimise sheets, price or issue anything. Computed results must remain draft and ineligible for verified quote use.

## Proposed integration (not implemented)

Import `calculateDraftRoofArea` from `src/studio/industries/roofing/roofArea.ts` in a future roofing area worksheet. Supply explicit plane id, horizontal gross plan area in m², measurement reference, pitch in degrees from horizontal, pitch reference, and horizontal opening areas with their references. Show per-plane gross/opening/net true areas and totals, together with the returned draft status and limitations. No default pitch is supplied. This helper does not accept a verified flag and must not feed a verified BOM/quote adapter.

Before workflow acceptance, connect real calibrated area evidence and source identity in the application adapter; check geometric overlap/containment there. Add project save/reload and real browser worksheet tests. Existing authored roof pitch defaults must not silently populate verified measurements. Root owns shared UI/contracts and global ledger updates.

Proof: `proof/growth/2026-09-13-industry-agents/roofing/`. No browser sessions, background helpers or servers were launched; no cleanup needed. No full build or packaged-app claim. No changes to git index or shared files by this worker.

## SC-02 — Draft assistant adapter (adapter tested; root wiring pending)

Root delegated `assistantTool.ts` and `assistantTool.test.ts` under the roofing directory. Thin pure adapter exposes `calculate_draft_roof_area`, an explicit-input description, strict JSON Schema generated from the runtime Zod schema, and execution through the existing draft helper. The root owns project binding, permission classification and appTools integration.

Three adapter tests pass on DANS1; scoped TypeScript check exits 0. The explicit QA 3:4 pitch fixture produces 100 m² gross, 5 m² openings and 95 m² net; original supplied references remain, input is unchanged and output is quote-ineligible. Missing pitch/reference, extra verified flag, unexpected job-binding input, duplicate plane IDs and over-deductions reject. No model request or live-tool acceptance is claimed yet. Proof: `roofing/ASSISTANT-ADAPTER.md`.

## Roof sheet coverage worksheet � implementation awaiting browser qualification

2026-09-13: Added independent optional sheetCoverage controlled form beneath existing roofing areas. Explicit developed rectangle dimensions, effective sheet cover (side lap already included), ordered sheet length, end lap (including explicit zero), measurement and supplier references. Exact integer decimal arithmetic to nine decimal places; domain bounds10,000m/field and1,000,000sheets. Calculates columns/courses/order linear length and coverage excess, draft-only and quote-ineligible. No product defaults, opening deductions or geometry edits.

Existing saved RoofForm remains valid without new field; blank coverage does not block area calculation. Input edits hide only corresponding result. Tool adapter strict schema name calculate_draft_roof_sheet_coverage; root owns registration/routing/receipt integration.

DANS1 unique snapshot sheet-coverage-unit-20260913 passed8focused tests (old area workflow plus new coverage boundaries). Initial dependency-junction setup quoting error produced missing-zod failures; fixed environment and actual tests then passed. Proof roofing/sheet-coverage/unit-final.log. Shared typecheck and browser/provider execution pending root freeze; no end-user completion claimed yet.

### Executed UI/tool qualification

Visible DANS1 Edge9341: empty coverage inputs, explicit8m�9m/.8mcover/5morder/.2mendlap?20sheets100lm. Editing hides only coverage result; pre-existing100gross/5opening/95net roofarea remains intact. Save/reload and unobstructed820px tablet rendering verified. Actual assistant tool returned matching result with project unchanged and conversation persisted, but initially substituted wrong general course formula.

Receipt now returns exact input strings, explicit piecewise formula and expanded steps. Nine focused tests pass, including9.8m run?2courses and9.800000001?3. Fresh actual assistant call9.8m run returned20sheets100lm and correctly explained first5m then4.8m. One model-origin tool; project and saved industry draft unchanged, all new chat entries retained after reload. Edge remains open idle.

Residual model explanation limitation: final prose simultaneously says end laps included and transverse laps excluded; Developer review says secondcourse ends inside although exactboundary. Numerical calculation and returned formula are correct, but do not claim flawless generated explanation. Original and corrected turns retained under sheet-coverage/formula-actual-turn.json plus verdict and screenshots. Root informed for follow-up; no provider retries or hidden evidence edits.

Fresh-chat isolation attempt: actual Add?New chat UI retained old thread and created076c7bc1-7916-476b-a9d7-35316d332066. One real tool call returned correct20sheets100m for9.8mrun; primary answer now faithfully explains first5m+4.8m and lap inclusions. Developer review remains incorrect: claims9.81m still requires2courses (actual3), and incorrectly compares9.8/4.8 with2. No further retries authorized/performed; this is an unresolved model-review accuracy issue, not calculator failure.

Persistence readback caveat: dynamic store-module import after reload exposed an unhydrated alternate job ID, so its null archive was not treated as loss. Direct readChatArchive for the known QA project confirms both old/new threads and every new entry persisted; visible DOM also shows new reply. Supplemental screenshot call timed out and is not claimed successful. Browser left open; no source edits or state seeding used.
