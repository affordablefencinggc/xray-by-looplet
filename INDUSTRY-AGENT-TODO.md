# Industry agent work queue

Authorized 2026-09-13: “spin up an agent for each industry to work without collision”.
Baseline d6c39da, branch feat/architect-cad-engine. Uses the X-Ray engine and Ledger proof rules.

The 68-profile queue and exclusive worker paths live in `planning/industry-work/coordination.mjs`.
Only three worker slots are available alongside the coordinator. Queued does not mean running.

- [x] SC-00 Assign roofing, HVAC and quantity surveying to separate workers with disjoint folders.
- [x] SC-01 Review roofing helper and executed proof: 7 tests; explicit pitch/area inputs, draft-only outputs.
- [x] SC-02 Review HVAC helper and executed proof: 10 tests; straight duct area and optional explicit sheet mass, draft-only outputs.
- [x] SC-03 Review quantity-surveying helper and executed proof: 11 tests; exact decimal classification, visible residue, no verification promotion.
- [ ] SC-04 Integrate accepted work into user workflows sequentially, with browser proof and shared regression checks.
- [ ] SC-05 Assign the next queued industry when a slot is available and its bounded scope is defined.
- [x] SC-06 Shared single-request lock replaced with three-request bound;39 server tests/typecheck passed on DANS1. Three actual simultaneous replies completed with own project identity and unchanged state. Answer-quality failures remain separately open.
- [x] SC-07 Misleading option pills fixed:16 tests on DANS1 plus visible removal of eight incorrect roofing pills. Worker ownership of richReply.ts/test.ts released after proof.
- [ ] SC-08 Preserve the requested complete answer across internal workflow corrections and distinguish current tool receipts from prior evidence. HVAC owns conversation.ts/test.ts; QS owns developerMode.ts/test.ts and app-atlas.md/contextManual.gen.ts. Root owns remaining shared integration.

Workers may change only their assigned industry module, report and proof directory. Root alone edits shared UI, contracts, canonical checklists and the git index. No worker commits, full builds, browser sessions or dependency changes. Cross-industry needs are proposals for root review, not permission to edit shared code.

Each worker must report a concrete requirement, exact files, meaningful test results and remaining integration gaps. An isolated passing helper is not a working end-user feature and does not promote industry readiness. Existing fencing acceptance remains open in `FENCING-IMPROVEMENTS-TODO.md`.

First batch finished 2026-09-13. The three worker assignments remain reserved for their integration follow-ups; no worker is still running this batch. Combined execution passed 41 tests (28 module tests, 2 ownership tests, 11 industry-register checks). Root reviewed each implementation. No shared UI, persisted project schema, package dependency or industry-readiness state changed. Next integration starts with roofing, then HVAC and quantity surveying, one user workflow at a time.
