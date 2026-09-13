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

Workers may change only their assigned industry module, report and proof directory. Root alone edits shared UI, contracts, canonical checklists and the git index. No worker commits, full builds, browser sessions or dependency changes. Cross-industry needs are proposals for root review, not permission to edit shared code.

Each worker must report a concrete requirement, exact files, meaningful test results and remaining integration gaps. An isolated passing helper is not a working end-user feature and does not promote industry readiness. Existing fencing acceptance remains open in `FENCING-IMPROVEMENTS-TODO.md`.

First batch finished 2026-09-13. The three worker assignments remain reserved for their integration follow-ups; no worker is still running this batch. Combined execution passed 41 tests (28 module tests, 2 ownership tests, 11 industry-register checks). Root reviewed each implementation. No shared UI, persisted project schema, package dependency or industry-readiness state changed. Next integration starts with roofing, then HVAC and quantity surveying, one user workflow at a time.
