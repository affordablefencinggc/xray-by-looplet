# Industry agent work queue

Authorized 2026-09-13: “spin up an agent for each industry to work without collision”.
Baseline d6c39da, branch feat/architect-cad-engine. Uses the X-Ray engine and Ledger proof rules.

The 68-profile queue and exclusive worker paths live in `planning/industry-work/coordination.mjs`.
Only three worker slots are available alongside the coordinator. Queued does not mean running.

- [x] SC-00 Assign roofing, HVAC and quantity surveying to separate workers with disjoint folders.
- [x] SC-01 Review roofing helper and executed proof: 7 tests; explicit pitch/area inputs, draft-only outputs.
- [x] SC-02 Review HVAC helper and executed proof: 10 tests; straight duct area and optional explicit sheet mass, draft-only outputs.
- [x] SC-03 Review quantity-surveying helper and executed proof: 11 tests; exact decimal classification, visible residue, no verification promotion.
- [x] SC-04 Actual assistant execution, readable receipts, developer-review comparison and reload proof pass for all three synthetic calculators. Whole-industry readiness remains open.
- [ ] SC-05 Assign the next queued industry when a slot is available and its bounded scope is defined.
- [x] SC-06 Shared single-request lock replaced with three-request bound;39 server tests/typecheck passed on DANS1. Three actual simultaneous replies completed with own project identity and unchanged state. Answer-quality failures remain separately open.
- [x] SC-07 Misleading option pills fixed:16 tests on DANS1 plus visible removal of eight incorrect roofing pills. Worker ownership of richReply.ts/test.ts released after proof.
- [x] SC-08 Current-turn named-tool checks, app-preflight origin, original-request preservation and withheld-candidate filtering tested; final live replies/reloads pass within documented guard limits.

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
