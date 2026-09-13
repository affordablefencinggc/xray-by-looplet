# Industry agent work queue

Authorized 2026-09-13: “spin up an agent for each industry to work without collision”.
Baseline d6c39da, branch feat/architect-cad-engine. Uses the X-Ray engine and Ledger proof rules.

The 68-profile queue and exclusive worker paths live in `planning/industry-work/coordination.mjs`.
Only three worker slots are available alongside the coordinator. Queued does not mean running.

- [x] SC-00 Assign roofing, HVAC and quantity surveying to separate workers with disjoint folders.
- [ ] SC-01 Review roofing helper and executed proof.
- [ ] SC-02 Review HVAC helper and executed proof.
- [ ] SC-03 Review quantity-surveying helper and executed proof.
- [ ] SC-04 Integrate accepted work into user workflows sequentially, with browser proof and shared regression checks.
- [ ] SC-05 Assign the next queued industry when a slot is available and its bounded scope is defined.

Workers may change only their assigned industry module, report and proof directory. Root alone edits shared UI, contracts, canonical checklists and the git index. No worker commits, full builds, browser sessions or dependency changes. Cross-industry needs are proposals for root review, not permission to edit shared code.

Each worker must report a concrete requirement, exact files, meaningful test results and remaining integration gaps. An isolated passing helper is not a working end-user feature and does not promote industry readiness. Existing fencing acceptance remains open in `FENCING-IMPROVEMENTS-TODO.md`.
