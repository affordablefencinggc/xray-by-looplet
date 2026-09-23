# IND-01 Residential alteration workflow

Authorized: user requested continuation of IND-01 and parallel agents on 2026-09-14. Branch feat/architect-cad-engine; baseline e1813d8. This supersedes the prior next-industry order; roofing/HVAC/QS open acceptance is retained.

## First bounded slice: explicit element lifecycle (PH-01 foundation)

Inputs: existing authored walls, openings, slabs and roofs in millimetres; user-selected existing/new/demolished/repaired status and a supplied survey/client-brief reference. Legacy elements remain unassigned. No automatic survey interpretation, measured-evidence promotion, rates, demolition quantities or structural approval.

Root owns model schema, workspace integration, shared assistant/drawing/export adapters, checklist and git. Lifecycle agent owns lifecycle.ts/test.ts; panel agent owns AlterationPanel.tsx/alterationPanel.css and browser verification. After the initial read-only audit, the audit agent owns materialBridge.ts, SyncDesignMaterials.tsx and the lifecycle material/integration tests. Parallel work uses one shared optional lifecycle contract and no dependencies or separate worktrees.

- [x] SC-01 Define explicit scope, compatibility and evidence boundaries above.
- [x] SC-02 Implement validated lifecycle assignment and a readable schedule; preserve geometry and legacy records.
- [x] SC-03 Verify selection/edit/clear, undo/redo, project/revision binding and save/reload for this classification slice. Full multi-project workflow acceptance remains in the industry checklist.
- [ ] SC-04 Expose supported assistant operations and verify actual calls, final explanation and independent review. [section 04]
- [x] SC-05 Verify desktop/tablet classification UI, CSV contents and parametric DXF metadata roundtrip with draft/evidence labels. Phase-bearing drawing exports are outside this slice.
- [x] SC-06 Run final regressions, web/native builds and production browser checks for this slice. Installer execution and native UI acceptance remain open.

Whole-industry acceptance remains open. PH-01 also needs visually and quantitatively distinct work; a metadata schedule alone does not meet that requirement. Current quantity geometry unions all walls irrespective of status, so mixed-phase overlapping geometry must be addressed before phase quantities or demolition/new-work material schedules are accepted. Coordinated plans/sections/issues, survey provenance and qualified professional review remain separate gates.

## Combined machine verification

Frozen source: 598 source/package files hash-verified on DANS1 in C:/Users/danie/XRayBuilds/residential-20260914. Full regression passes 201 script tests and 1,265 TypeScript tests (40 new lifecycle/domain/material/assistant/history/exchange cases); full typecheck exits 0. Evidence: proof/growth/2026-09-14-residential/result.json, regression.log, typecheck.log and source-manifest.json.

The source now supports assignment/clear, explicit references, five-way counts including unassigned, host-conflict warning, safe CSV, and the existing project-bound revision-checked assistant edit operation. Saved geometry/IDs are retained. Issued model metadata remains frozen; stale issue review rejects classification changes. Designs with any lifecycle assignment cannot sync combined quantities to materials until phase-aware calculations are supported; legacy designs retain existing behaviour.

Final lifecycle build 20e1cd9705b0 passes web/typecheck/native NSIS packaging on DANS1. Dev browser 47/47, corrected charcoal 31/31 and actual built-output browser 49/49 operations pass, including desktop/tablet visual inspection. The mounted assistant adapter executed a saved revision-bound edit; this is not live provider explanation or independent Developer response acceptance. The isolated test snapshot has no evidenced configured provider. See proof/growth/2026-09-14-residential/README.md. Original sandbox/harness/contrast failures remain preserved.

Next active slice: separately resolved before/proposed geometry with an explicit session review basis, read-only preview and blocking unresolved classifications. No procurement or whole-industry promotion.

Individual historical step proof: [SC-01](../../proof/growth/2026-09-14-residential/steps/SC-01.md), [SC-02](../../proof/growth/2026-09-14-residential/steps/SC-02.md), [SC-03](../../proof/growth/2026-09-14-residential/steps/SC-03.md), [SC-05](../../proof/growth/2026-09-14-residential/steps/SC-05.md), [SC-06](../../proof/growth/2026-09-14-residential/steps/SC-06.md). SC-04 remains open.
