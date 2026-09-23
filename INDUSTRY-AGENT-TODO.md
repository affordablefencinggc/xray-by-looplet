# Industry agent work queue

Current forward plan: [Remaining work for all active industries](INDUSTRY-REMAINING-WORK-PLAN.md), baseline e82433a. Residential is first priority; roofing/HVAC/QS retain their acceptance and implementation work; fencing remains deferred. Historical checkpoints below retain their original status and must be read with later corrections.

Authorized 2026-09-13: “spin up an agent for each industry to work without collision”.
Baseline d6c39da, branch feat/architect-cad-engine. Uses the X-Ray engine and Ledger proof rules.

The 68-profile queue and exclusive worker paths live in `planning/industry-work/coordination.mjs`.
Only three worker slots are available alongside the coordinator. Queued does not mean running.

- [x] SC-00 Assign roofing, HVAC and quantity surveying to separate workers with disjoint folders. Proof: `planning/industry-work/coordination.mjs`.
- [x] SC-01 Review roofing helper and executed proof: 7 tests; explicit pitch/area inputs, draft-only outputs.
- [x] SC-02 Review HVAC helper and executed proof: 10 tests; straight duct area and optional explicit sheet mass, draft-only outputs.
- [x] SC-03 Review quantity-surveying helper and executed proof: 11 tests; exact decimal classification, visible residue, no verification promotion.
- [x] SC-04 Actual assistant execution, readable receipts, developer-review comparison and reload proof pass for all three synthetic calculators. Whole-industry readiness remains open. Proof: `proof/growth/2026-09-13-industry-agents/README.md`.
- [ ] SC-05 Assign the next queued industry when a slot is available and its bounded scope is defined. Blocker: still open. Next: complete the work named in this item and cite on-disk proof before checking this box. [section 02]
- [x] SC-06 Shared single-request lock replaced with three-request bound;39 server tests/typecheck passed on DANS1. Three actual simultaneous replies completed with own project identity and unchanged state. Answer-quality failures remain separately open.
- [x] SC-07 Misleading option pills fixed:16 tests on DANS1 plus visible removal of eight incorrect roofing pills. Worker ownership of richReply.ts and its test released after proof.
- [x] SC-08 Current-turn named-tool checks, app-preflight origin, original-request preservation and withheld-candidate filtering tested; final live replies/reloads pass within documented guard limits. Proof: `proof/growth/2026-09-13-industry-agents/README.md`.

Workers may change only their assigned industry module, report and proof directory. Root alone edits shared UI, contracts, canonical checklists and the git index. No worker commits, full builds, browser sessions or dependency changes. Cross-industry needs are proposals for root review, not permission to edit shared code.

Each worker must report a concrete requirement, exact files, meaningful test results and remaining integration gaps. An isolated passing helper is not a working end-user feature and does not promote industry readiness. Existing fencing acceptance remains open in `FENCING-IMPROVEMENTS-TODO.md`.

First batch finished 2026-09-13. The three worker assignments remain reserved for their integration follow-ups; no worker is still running this batch. Combined execution passed 41 tests (28 module tests, 2 ownership tests, 11 industry-register checks). Root reviewed each implementation. No shared UI, persisted project schema, package dependency or industry-readiness state changed. Next integration starts with roofing, then HVAC and quantity surveying, one user workflow at a time.

## Current integration checkpoint — 2026-09-13, 19:41 AEST

Authorization continues through the complete process. Three visible Edge profiles on DANS1 isolate roofing, HVAC and quantity-surveying QA.

- All three draft calculators are registered as project-bound read-only assistant tools; 50 focused integration tests passed on DANS1.
- Roofing live retry executed the actual tool: 100 gross / 5 openings / 95 net m²; project unchanged. First hidden fabricated claim retained as failed proof.
- HVAC live tool returned 16 m² / 64 kg. The final response hit an unnecessary workflow-selection gate; pure-calculation routing correction is under verification.
- QS first live tool returned exact 0.3 total / 0.1 classified / 0.2 unclassified. A later response fabricated execution; this remains a failed QA result, not acceptance.
- Strict chat storage now accepts model/app-preflight receipt origins. Six storage tests passed; QS and HVAC observed successful reload persistence for new turns. Earlier HMR-interrupted turns remain recorded as interrupted.
- Read-only completion preflight passed 40 focused tests and a live HVAC fresh-read/reload check. It labels app-origin calls explicitly.
- Full web snapshots 47b80d436e48 and 3e041c91ca5e built and typechecked on DANS1. Source has changed afterward; these are intermediate build evidence, not final acceptance.
- Full npm-test setup exposed missing staged repository support files. These are being transferred before interpreting product regressions.

Active bounded fixes: HVAC owns current-turn execution-claim validation; roofing owns readable calculator receipts; QS owns full-regression test staging; root owns routing integration, final browser checks, build and push. All provider requests are paused during source edits to avoid HMR interruption. No industry is promoted to complete readiness by arithmetic helpers alone.


## Accepted integration checkpoint ? 2026-09-13

All three final synthetic assistant workflows pass actual execution, developer-review comparison, unchanged-project checks and reload persistence. Full DANS1 regression:201script+1,151TypeScript tests; full typecheck passes. Build2b490c637162 passes19production browser operations. All623non-test inputs match the final tree; only the improved context-wiring test differs. Closed-Drawings orphan seam and open/collapse/reopen/Takeoff interactions verified. Failed attempts remain in proof. Native packaging, whole-industry acceptance and remaining queue stay open. Next assignments follow the pushed checkpoint.

## Next controlled-form contract — after e7c0c4d

Root owns draftPanel.ts, shared draft persistence/host, industryDrafts.css, Studio/Estimate integration, global checklists and git. Child panels are controlled: IndustryDraftPanelProps<T> = {value:T,onChange:(next:T)=>void,disabled:boolean}. Each module exports a strict Zod form schema, a create-empty-form function and its named React panel. Form values are JSON-serializable strings/booleans/arrays; no runtime project reads or writes inside panels. Root stores each draft by project+industry independently of source measurements. No dependency or shared style edits by workers.

- Roofing: RoofingDraftPanel.tsx + roofForm.ts/test.ts. Multiple explicit horizontal-area/pitch planes/openings/references, actual helper calculation, readable totals.
- HVAC: HvacDraftPanel.tsx + ductForm.ts/test.ts. Explicit rectangular/round straight sections and optional supplied mass, actual helper results/exclusions.
- Quantity surveying: QuantityDraftPanel.tsx + quantityForm.ts/test.ts. User hierarchy and quantity rows, explicit assignment/unassigned list, exact unit/evidence totals and residue.

Use existing color tokens and root-owned classes: industry-form, industry-fields, industry-actions, industry-result, industry-table-wrap, industry-note, industry-error. Native labelled fields, fieldsets, buttons and semantic tables; no new top headers. Start empty, no invented measurements/references/rates. Results disappear or are clearly invalidated when inputs change; always draft/quote-ineligible. Scope is a useful manual draft workflow, not source verification or industry readiness. Next tests exercise actual form entry, edit invalidation and project/reload persistence, then compare output with the live assistant.


## Manual industry worksheet checkpoint - 2026-09-13

Roofing, HVAC and QS controlled worksheets integrated in Estimate with project-specific saved inputs and backup/restore generation protection. DANS1 1,176 TypeScript tests plus script chain and full typecheck pass. Build 916199981aa8 passes 34 production UI operations plus 55 isolated-project operations; all 830 staged inputs match. Manual entry/edit/reload/tablet checks pass for three forms. HVAC fresh assistant crosscheck passes. Roofing skipped its tool twice (claims withheld); QS fabricated nullable placeholders and failed six calls with a misleading final explanation. These assistant failures remain open; do not promote industry readiness. See proof/growth/2026-09-13-industry-agents/FORMS-INTEGRATION.md. Next work fixes these failures before progressing the industry queue.


## Assistant recovery and native qualification - 2026-09-13

Roofing now executes the real 95 m2 comparison with one internal retry. QS executes the supplied-null classification and delivers a corrected receipt explanation; its earlier incorrect advice remains failed evidence. Explicit no-tools requests retain zero tools even with contradictory action intent. Full baseline regression: 201 script and 1,189 TypeScript tests; final prohibition follow-up: 38 focused tests and full typecheck. Build 2f08ad4c8ef1 web/native passes; follow-up build a8a4f707ac43 in progress. Native visible fencing import/calibration/materials QA remains open, including first engine status failure before successful warm status. See proof/growth/2026-09-13-industry-agents/ASSISTANT-RECOVERY.md. No whole-industry readiness promotion.

## Native fencing acceptance checkpoint - 2026-09-13

DANS1 PowerShell worker successfully rebuilds current application code using verified prior dependency artifacts; Smart App Control remains enabled. Actual native synthetic 5 m Colorbond trace produced full-bay and equal-layout receipts: 2 end posts, 2 ordinary posts, 6 rail cuts, 10 lm rails and 9 sheets. Unused unresolved recipes no longer block the selected recipe, while selected assumptions and all recipe structure remain checked. Materials controls remain visible until resolved; table no longer collapses and headers align. Final package 0cbb75d9b4e3 passes desktop/tablet readback and reload with no captured runtime errors. Python 50 distinct checks, 23 rules/compiler checks, 10 panel checks, 6 discussion routing checks, full typecheck and web/native builds pass. Web assistant supplied-evidence review delivered with zero tools and preserved conversation, but required two operator factual corrections; autonomous review quality is not passed. Proof: proof/growth/2026-09-13-industry-agents/roofing/native-ui/0cbb and related d334, selected-recipe-acceptance and quantity-surveying/native-bom-review-final-e173b12b942c directories. Recovery branch feat/architect-cad-engine, checkpoint after 0fbef2d. These native tests use an explicit qualified engine override. Default bundled-engine installation remains in progress; no whole-industry readiness claim.
## Bundled Python engine acceptance - 2026-09-13

DANS1 native build and installer 7a55db807d34 passed using the verified dependency-cache worker with Windows security unchanged. Python engine source/fixture/executable qualification is enforced at staging; Tauri packages the fixed resource and shares verified selection across status and generation. 47 native tests, 10 staging cases, full typecheck/web/native gates, and 19 production browser operations pass. Actual installer-extracted app with no engine override or Python PATH and unrelated cwd generated request 2d87d4bc-5fb4-4766-b9ee-698be72b34b9 for the synthetic 5 m fencing fixture; expected 2 end posts, 2 ordinary posts, 6 rail cuts, 10 lm rails, 9 sheets; reload retained the current receipt. Separate missing/tampered resources returned unavailable. Root inspected desktop/tablet output. Separate web assistant supplied-receipt review and Developer review were accurate without correction, zero fresh tools, unchanged project, and exact visible conversation reload. Earlier model failures retained. Recovery: branch feat/architect-cad-engine after 892bb37; proof/growth/2026-09-13-industry-agents/build-7a55db807d34/README.md. No installer registration/uninstall acceptance, native provider support, engineering approval, or whole-industry readiness claimed. Broader industry queue remains open.
## Three-industry upgrade batch - 2026-09-13 (active)

User confirmed roofing, HVAC and quantity surveying must be built concurrently, with a visible preview on this PC. Fencing SC-02 is deferred; its read-only audit produced no source changes. Three agents now own exclusive existing industry directories: roofing sheet coverage/order quantities, HVAC external insulation/wrap material, and QS filtered hierarchy reports/CSV. Root owns shared assistant registry, routing, readable receipts, integration tests and git. New forms are optional/backward compatible; no assumed product values or verification promotion. Per-industry DANS1 tests and actual assistant/Developer review checks precede final build/push. Existing local Edge preview is user-facing; product acceptance tests remain DANS1-only. User-visible Estimate > Industry worksheets was opened, without editing project quantities.

## Resumed verification checkpoint - 2026-09-14

- [x] Verify current source on DANS1: all 848 staged source hashes match; 201 script tests and 1,225 TypeScript tests pass; full typecheck passes. Missing snapshot support documents/configs/fixture caused earlier setup failures, retained in logs; no product code changed in this continuation.
- [x] Historical roofing build 73fb96374c6e desktop/tablet screenshots inspected and cited. [Individual proof, executed result, screenshots and exact diff](proof/growth/2026-09-23-industry-closeout/steps/SC-05-roofing-citation.md). No new-build claim.
- [ ] Rebuild and qualify the final discussion-only routing change: discussionOnly.ts and its test differ from build 73fb96374c6e. Do not call that package the final source. Blocker: still open. Next: complete the work named in this item and cite on-disk proof before checking this box. [section 02]
- [ ] Final built-output qualification of roofing/QS explanations remains. Actual development 35/35 and independent reply review pass after first-course and evidence-subtotal guidance; prior failed replies retained. [Tests, screenshots, diff and limits](proof/growth/2026-09-23-industry-closeout/steps/SC-05-explanations-dev.md). [section 02]
- [ ] Execute QS report tablet interaction and complete final integration acceptance before advancing the queue. Blocker: still open. Next: complete the work named in this item and cite on-disk proof before checking this box. [section 02]

Recovery: feat/architect-cad-engine; proof/growth/2026-09-13-industry-agents/resume-20260914/. Existing uncommitted industry changes preserved. No whole-industry readiness, quote eligibility or final release claim.

## Shared visual pass and industry checklist index - 2026-09-14

INDUSTRY-CHECKLISTS.md now contains six whole-workflow acceptance gates for each of the 68 industry profiles, with their own source inputs and expected deliverable. These are deliberately unchecked; existing calculator/UI acceptance is narrower and remains recorded above. Roofing, HVAC and QS remain the active batch.

Shared styling: neutral charcoal theme surfaces, deep ocean primary actions with white labels, and theme-aware architect headings/form controls. CSS source changes are applied. Fresh visual verification is open: the DANS1 Fast CDP guard rejected an unsandboxed Network Service in both Edge and Chrome before app operations. No guard or browser security setting was weakened; failed evidence is retained under proof/growth/2026-09-14-charcoal-ocean. Do not claim visual or final build acceptance from this attempt.

## Residential lifecycle foundation - 2026-09-14

User priority is now IND-01, executed by three parallel agents with shared lifecycle schema and disjoint files. Existing/new/demolished/repaired assignments require supplied references; legacy records remain unassigned. Added schedule/CSV and revision-bound assistant edit; issue metadata stays frozen. Mixed-phase material sync is blocked because existing combined quantities cannot establish phase quantities.

DANS1: 201 script + 1,265 TypeScript tests, typecheck, web/native NSIS build 20e1cd9705b0 pass. Dev 47/47, corrected charcoal 31/31, production 49/49 browser operations pass; root inspected desktop/tablet screenshots. Actual mounted assistant adapter edit saved and read back; live provider explanation/Developer response remains unverified because the isolated snapshot has no evidenced provider configuration. Native UI/installer acceptance and the whole industry remain open. Recovery: feat/architect-cad-engine after e1813d8; proof/growth/2026-09-14-residential/README.md. Next: before/proposed geometry and read-only stage previews.

## Residential stage preview - 2026-09-14

Parallel implementation adds a referenced, session-bound before/proposed geometry resolver and read-only plan/section/four-elevation preview. Geometry/lifecycle changes invalidate the review; unknown work status and ambiguous opening demolition return blockers without partial geometry. Canonical design and issued snapshots stay immutable; mixed-phase procurement remains blocked.

DANS1 full regression:201 script +1,279 TypeScript tests and typecheck pass; 14 new geometry/integration cases. Dev56/56 and production107/107 browser operations pass, including all10 element classifications through production UI, stage differences, six views, keyboard isolation and review invalidation. Root inspected desktop/tablet screenshots. Source/build d83b24da5ade; proof/growth/2026-09-14-residential-stages/README.md. Branch feat/architect-cad-engine after f3e3a5c. Phase quantities, infill/independent repaired baselines, stage issue exports, live provider/Developer review and native application UI acceptance remain open. This is a bounded feature checkpoint, not whole-industry sign-off.

Final stage build d83b24da5ade web/typecheck/native NSIS passes; final source hashes verified. Production107/107 operations pass. No installation/deployment or whole-industry sign-off. Evidence: proof/growth/2026-09-14-residential-stages/build-d83b24da5ade/native-completion.json.


## IND-01 solid-wall comparison, draft PDF and individual proof - 2026-09-14

Three parallel agents added before/proposed wall-solid union volumes and signed geometry delta; unknown assemblies, unresolved reviews and unsupported precision/complexity return blockers. Selected stage/level/view exports a labelled unissued PDF with original identity/reference, full Unicode attachment and shared-annotation limitations. In-flight output is discarded after selection/review/project changes, including change-and-back. Material synchronization remains blocked.

DANS1 full regression201 script +1,293 TypeScript tests passes; test-only PDF stream typing correction then passes14focused/fulltypecheck. Dev58/58, Unicode34/34 and final production52/52 pass; root inspected UI/PDF screenshots. First native LLVM out-of-memory failure f978f9103c26 is preserved. Same-source retry f978f9103c27 web/typecheck/native NSIS passes, final source hashes reverified. Bundle hashes differed, so production checks reran on actual f27 output. No deployment/installation/native UI claim.

User requires a separate screenshot proof file for every completed step. Added project rule, INDUSTRY-PROOF-INDEX.md, six current output step records and twelve labelled historical backfills. Individual records distinguish what screenshots show from executed numerical/build proof. Current proof: proof/growth/2026-09-14-residential-output/steps/SC-01.md through SC-06.md; exact source.diff and actual PDFs retained. Branch feat/architect-cad-engine after a381ca8. Whole-industry acceptance, issued stage history, material/work-category allocation, infill/independent repaired baselines and live assistant/Developer responses remain open.
Document status: open (4)
