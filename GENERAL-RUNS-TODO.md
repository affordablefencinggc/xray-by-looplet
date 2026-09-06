# General construction run specifications

Approved: user “proceed”, reaffirmed “continue”, 2026-09-06.
Branch: feat/model-wireframe-navigation. Existing shared changes preserved; no staging or commits.

Scope: phase 2 of the fencing-decoupling handoff, with executed quantity proof. General run specifications, measured length / strip area / rectangular volume, persistence compatibility, and explicit fence-engine exclusion.

- [x] SC-01: General specification schema and validation; retain legacy fencing behavior.
- [x] SC-02: Editor and quantity display; source/scale checks; keep fence recipes separate.
- [x] SC-03: 574 tests, typecheck and build pass; eight browser scenarios pass in each environment; desktop/mobile screenshots inspected.
- [x] SC-04: Exact change artifact and completion record saved; temporary services stopped.

Proof: [completion record](proof/audit/IW-GENERAL-RUNS/completion.md), [code delta](proof/audit/IW-GENERAL-RUNS/implementation.patch), [user guide](output/takeoff/general-construction-runs.md).

Still outside this slice: standalone polygon/count takeoffs, ConstructionJob storage migration, generic assembly BOM packs. Material volume here is measured geometric volume, not packaged stock storage volume or inferred weight.
