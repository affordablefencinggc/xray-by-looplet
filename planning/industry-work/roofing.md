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

## ROOF-01 2026-09-14 — receipt/description correction; live model verification BLOCKED

Worker B, baseline bcc5c3e, changes left unstaged. Root cause established by tracing the whole path: the receipt is NOT truncated on the way to the model (appTools.ts:71 stringifies the whole object; conversation.ts:153 caps at 100,000 chars for a ~1.2 kB receipt), and the "Developer review" is the same model self-reviewing in the same turn (developerMode.ts:5), so it had the identical receipt. The defect was a missing FACT, not a missing channel: the receipt showed only the single evaluated instance and never stated where the course count changes, so the reviewer extrapolated a boundary and got it wrong ("a value at 9.81 would still be 2"; "9.8 / 4.8 lies just below 2" — both false). The self-contradictory lap prose came from limitations[0] fusing end lap and side lap into one sentence.

Fix, all inside src/studio/industries/roofing/ (+50/-6, three files): calculation now also returns coursesExpanded, courseBoundary, maxRunAtThisCourseCountM, minRunForAnotherCourseM and a wrongFormulaWarning that names and refutes the substituted formula; limitations[0] split so end lap (transverse) and side lap are separate, each forbidding the contradictory phrasing; the tool description forbids extrapolating a boundary and directs the model to quote the returned boundary fields. Arithmetic, nine-decimal exactness and domain bounds unchanged; 9.8 -> 2, 9.800000001 -> 3, 9.81 -> 3 all preserved. 20/20 focused tests pass (19 before; one added), typecheck exit 0.

Live assistant/Developer verification BLOCKED and NOT obtained. The turn failed with "Failed to fetch", work packet state blocked, provider MiniMax; a follow-up read failed with os error 10060. General egress and both provider hosts are reachable and .env.local has the keys with XRAY_AI_WEB_ENABLED=true, so the probable cause is the dev server on 8080 (PID 100416, start 17:24:35, parent 73204 — already running, NOT started by this worker, reused per instruction) lacking the process-env keys; that was not proven and is not asserted. No retries were performed to obtain a better-looking answer. A wait matched the string "Developer review" from the injected prompt echoed in the DOM, not from a model reply; screenshots disprove any reply and were renamed accordingly. Conversation reload not achieved (chrome-error + hydration timeout).

ROOF-01 remains OPEN: the explanation fix is proven derivable from tool output, not proven used by the model. Prior turns preserved unedited. Proof: proof/growth/2026-09-14-roofing-explanation/steps/ROOF-01-SC-01.md.

Persistence readback caveat: dynamic store-module import after reload exposed an unhydrated alternate job ID, so its null archive was not treated as loss. Direct readChatArchive for the known QA project confirms both old/new threads and every new entry persisted; visible DOM also shows new reply. Supplemental screenshot call timed out and is not claimed successful. Browser left open; no source edits or state seeding used.

### Coordinator takeover audit, 2026-09-14

Recovered the later MiniMax live2 run: actual receipts and prose correctly give 9.8 m = 2 courses and 9.81 m = 3, and six entries survive reload. This supersedes the earlier no-reply blocker, but ROOF-01 remains OPEN: Developer review introduces an unsupported 0.19 m per-sheet waste claim. Claude's proposed clean pass was not accepted. Original screenshots and logs remain unchanged. See [ROOF-01-SC-02 handoff audit](../../proof/growth/2026-09-14-roofing-explanation/steps/ROOF-01-SC-02-handoff-audit.md). Campaign browser is already absent; user-facing preview retained. No new provider calls.

### ROOF-01 current qualification, 2026-09-14

Receipt now explicitly distinguishes coverage excess from an uncalculated cutting/waste schedule. One new DANS1 MiniMax turn correctly leaves per-sheet waste/offcuts null but falsely says end lap halves the length contribution and calls the decimal step a PDF-point. ROOF-01 remains OPEN. Exact diff, tests, archive and screenshot proof: [ROOF-01-SC-03](../../proof/growth/2026-09-14-continuation/steps/ROOF-01-SC-03.md). No repeated paid turn was sent.
