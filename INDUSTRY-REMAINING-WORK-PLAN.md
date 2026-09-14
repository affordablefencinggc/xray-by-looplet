# Remaining work: active industries

Planning baseline: e82433a, feat/architect-cad-engine, 14 September 2026. Requested by the user: “create a plan for remaining work for all industries we are working on”. This is a delivery plan, not new implementation or acceptance evidence.

## Scope and current position

Four industries are active. Fencing is retained as deferred work. The other 63 profiles remain queued in [the 68-industry checklist](INDUSTRY-CHECKLISTS.md); they are not silently included in the active implementation batch.

| Industry | Existing foundation to preserve | Remaining destination |
| --- | --- | --- |
| IND-01 Residential architecture — first priority | Referenced lifecycle assignments, before/proposed views, solid-wall comparison, retained apertures, labelled PDF and frozen saved drafts | Coordinated alteration plans, sections, schedules and an auditable issue set |
| IND-29 Roofing and cladding | Manual true-area and rectangular sheet-coverage worksheets, saved inputs and assistant tools | Source-linked roof quantities, stock layout, hips/valleys/penetrations, flashing and fixing schedules |
| IND-30 HVAC and refrigeration | Manual straight rectangular/round duct area/mass and external wrap worksheets | Coordinated services network, explicit sizing inputs and equipment/commissioning schedules |
| IND-38 Quantity surveying | Exact classification, hierarchy, filters, item-once CSV, saved worksheets and assistant tools | Source-linked measured cost plan, explicit rates, alternatives and revision comparison |
| IND-43 Fencing — deferred | Qualified synthetic bay layouts, native generation and bundled-engine evidence | Stock cutting, slope/set-out, repair/gates and complete installation journey |

Existing evidence is narrower than whole-industry acceptance. Latest residential baseline passes 1,515 regression tests, 100 dev/106 production/20 mounted-adapter checks and web/Windows packaging. It does not establish the other industries’ final UI/assistant acceptance. See [proof index](INDUSTRY-PROOF-INDEX.md) and [historical work queue](INDUSTRY-AGENT-TODO.md).

## Delivery order and parallel ownership

Use a coordinator plus three worker slots. Agree input/output types and exact file ownership before each batch. These are planned assignments, not claims that workers are currently running.

| Wave | Worker A | Worker B | Worker C | Coordinator |
| --- | --- | --- | --- | --- |
| 1 — close known gaps | Residential infill/before-state contract and fixtures | Roofing boundary explanation and independent review correction | QS CSV explanation and tablet acceptance | Reconcile stale status records; define shared evidence contract; audit current HVAC wrap acceptance |
| 2 — complete geometry and source binding | Residential authored infill/changed-repair geometry | Roofing measured planes/edges/penetrations | HVAC section/network identities and explicit fittings | Integrate shared source references, persistence and revision invalidation; qualify QS source adapter sequentially |
| 3 — quantities and schedules | Residential lifecycle allocation and demolition/repair schedules | Roofing stock layout, flashing and fixing schedules | HVAC coordinated network/equipment schedules | Integrate QS rate-book binding, alternatives and revision comparison in bounded sub-batches |
| 4 — end-to-end acceptance | Residential coordinated issue workflow | Roofing job walkthrough | HVAC job walkthrough; then QS slot | Shared regression, production and native checks; independent acceptance review; consolidate per-industry evidence |

Residential stays first priority. Roofing/QS known answer failures should be closed before adding more capabilities to those assistant workflows. If a worker lacks an agreed contract, it performs a bounded read-only audit or waits; it does not invent shared types. Serialise DANS1 browser campaigns and full builds to prevent interference. Do not start the next queued industry merely because a slot is free.

Root owns shared model/persistence/export contracts, tool registration, theme, canonical checklists and git. Roofing, HVAC and QS workers own their existing `src/studio/industries/<industry>/` directories. Residential ownership is assigned per file because its core is shared; no two workers edit model, drawing or export files together. Reconcile the older assignments in `planning/industry-work/coordination.mjs` before any automated dispatch.

## Shared prerequisites

- [ ] SH-01 Reconcile old “pending” notes against later proof, especially PH-01, fencing SC-01, the assignment register and intermediate-build statements. Preserve original failed evidence; record which later result supersedes it.
- [ ] SH-02 Define reusable source bindings: project/document identity, source revision/hash, selected sheet/entity, units, calibration and evidence status. Editing/replacing the source invalidates dependent results. A typed reference remains an authored reference.
- [ ] SH-03 Define shared report/issue metadata and revision rules. Preserve frozen issued contents and distinguish draft export, saved draft, reviewed estimate and issued deliverable. Reuse existing issue infrastructure where suitable.
- [ ] SH-04 Qualify assistant claims against actual current receipts and saved state. Compare primary and Developer responses independently; test tool execution, refusal/no-tool requests, failed operations, reload and project switching. No repeated retries until one happens to look correct.
- [ ] SH-05 Apply the agreed charcoal/ocean-blue theme to new controls and reports. Verify labels, keyboard actions, focus, tablet layout and long/error states. Preserve adjustable top rows.
- [ ] SH-06 Establish final release matrix for each claimed platform: dev and production browser; Windows native journey; installer upgrade/uninstall where claimed; macOS/Linux only with actual package/runtime evidence. Existing Windows build success is not cross-platform acceptance.

## IND-01 — Residential architecture

References: [residential scope](planning/industry-work/residential-architecture.md), [phase work and latest proof](planning/industry-work/residential-phase-geometry.md).

| ID | Remaining work | Dependency and acceptance |
| --- | --- | --- |
| RES-01 | Represent explicit infill geometry and independent before/proposed shapes for changed repairs | Agree geometry/identity contract first. Preserve authored sill/bottom offsets, layers and references; never turn “remove fixture” into an inferred solid. Existing saved drafts remain readable. |
| RES-02 | Implement entry/edit/clear and stage resolution for that contract | After RES-01. Door and elevated-window infill, partial infill, changed repair, demolished hosts and invalid replacements get exact fixtures. Check undo, stale review, project isolation and reload. |
| RES-03 | Allocate work quantities by lifecycle and resolve shared-volume ownership | After RES-02 and explicit allocation rules. ID/order-invariant fixtures; show existing/new/demolished/repaired quantities separately. Shared boundaries cannot be attributed by arbitrary IDs. |
| RES-04 | Add demolition, salvage/disposal, repair and material schedules | After RES-03. Require supplied product/waste/disposal assumptions; report unknowns separately. Enable material sync only for supported reviewed quantities; retain its blocker elsewhere. |
| RES-05 | Coordinate stage plans, sections, elevations, room/opening schedules and annotations | After RES-02; quantity schedules additionally require RES-03/04. Classify or explicitly review annotations rather than silently carrying all-work notes into an issued stage. Check cross-view IDs and replacement fixtures. |
| RES-06 | Issue a frozen coordinated alteration set with revision comparison | After RES-05 and SH-03. Bind exact source/stage/basis/annotations; supersession cannot rewrite prior issues. Export all intended sheets and schedules; reopen and compare revisions. Saved drafts remain a separate feature. |
| RES-07 | Complete an actual residential workflow and independent assistant/Developer review | After preceding steps. Survey/brief → existing work → alteration → edit/undo → quantities → schedules → issue → reopen. Verify UI, saved data and exported contents on desktop/tablet/native. Mark the industry gates only for the qualified scope. |

Immediate next residential step: RES-01, followed by RES-02. Retained-void and saved drafts are already implemented; do not rebuild them.

## IND-29 — Roofing and cladding

Reference: [roofing work and recorded answer failures](planning/industry-work/roofing.md).

| ID | Remaining work | Dependency and acceptance |
| --- | --- | --- |
| ROOF-01 | Correct and freshly verify assistant/Developer sheet-course explanation | Keep correct calculator arithmetic. With 5 m sheets and 0.2 m end lap, 9.8 m is exactly two courses; 9.800000001 m and 9.81 m require three. Explain effective cover/side lap separately from end lap. Require actual receipt, accurate independent review and conversation reload. |
| ROOF-02 | Bind area/pitch/edge inputs to current measured roof evidence | SH-02. Preserve calibration/source identity; verify opening containment/overlap and changed-source invalidation. Manual worksheets remain usable and visibly unverified. |
| ROOF-03 | Add geometric development for hips, valleys and unequal pitches | ROOF-02. Analytic independent fixtures and explicit intersection assumptions; no projected length presented as true length. |
| ROOF-04 | Add bounded stock-sheet layout and cut/waste reporting | ROOF-02/03 as applicable. Explicit effective cover, laps, orientation, stock lengths and penetration rules; separate purchase coverage, offcuts and reusable stock. Existing rectangular coverage counts are not a nesting solver. |
| ROOF-05 | Produce flashing, fixing and re-roof scope schedules | ROOF-03/04. Explicit product detail/revision, counts/lengths and supplied fixing rules. Strip-out/disposal stays separate; unknown manufacturer requirements block the relevant detail. |
| ROOF-06 | Qualify roof plan → quantities → stock/schedules → export/reopen | SH-03/04 and preceding roofing steps. Hips, valley, penetration and boundary fixture; edit invalidation, project isolation, tablet/native, actual export and accurate assistant/Developer comparison. |

## IND-30 — HVAC and refrigeration

Reference: [HVAC foundation](planning/industry-work/hvac.md) and later integration checkpoints in [the work queue](INDUSTRY-AGENT-TODO.md). Later wrap functionality must be judged from its own evidence, not the older helper-only description.

| ID | Remaining work | Dependency and acceptance |
| --- | --- | --- |
| HVAC-01 | Close current-package straight-duct/wrap worksheet acceptance | Later wrap evidence already passes the 18.5 m² fixture and assistant/Developer explanation of twice insulation thickness; do not reopen superseded failures. Qualify metal and wrap together on current built output: entry/edit/reload/project isolation, tablet and supported exports. Confirm incomplete mass remains unknown and insulation geometry stays distinct from duct dimensions. |
| HVAC-02 | Add source-bound section identities and explicit fittings/branches | SH-02 plus agreed network schema. Retain shape/dimensions/units, host/connection identities and evidence. Separate straight-area calculations from explicit fitting allowances. |
| HVAC-03 | Coordinate a multi-zone duct/pipe network | HVAC-02. User-entered routes, elevations and equipment connections; report disconnected nodes, incompatible dimensions and clashes. Do not claim coordination from a list of independent sections. |
| HVAC-04 | Introduce bounded load/sizing and equipment schedules | HVAC-03 plus explicit room loads, design conditions, equipment/product data and reviewed calculation method. Retain assumptions and check independent fixtures before enabling outputs. Missing design data blocks sizing. |
| HVAC-05 | Add insulation/material and commissioning schedules with export | HVAC-02/03; sizing-derived fields require HVAC-04. Preserve supplied performance/product references, unknowns and revisions; no invented commissioning results. |
| HVAC-06 | Qualify room/equipment inputs → network → schedules → issue/reopen | All preceding steps and SH-03/04. Desktop/tablet/native checks, source changes, project isolation, exact exported quantities and independent assistant/Developer review. |

Network/sizing work is a new implementation phase, not a claim that the current area/wrap calculators already perform engineering design.

Latest bounded HVAC evidence: [wrap report](proof/growth/2026-09-13-industry-agents/hvac/wrap-upgrade/REPORT.md), [form/browser acceptance](proof/growth/2026-09-13-industry-agents/hvac/form-browser/README.md). Fencing native checks stored inside an HVAC/roofing proof directory do not qualify HVAC/roofing workflows. Compare current source/artifact hashes before scheduling another build; later residential packages supersede the old intermediate build as source checkpoints, but still need industry-specific acceptance.

## IND-38 — Quantity surveying and cost consultancy

References: [classification foundation](planning/industry-work/quantity-surveying.md), [report and known open acceptance](planning/industry-work/quantity-surveying-report.md).

| ID | Remaining work | Dependency and acceptance |
| --- | --- | --- |
| QS-01 | Correct assistant/Developer explanation of the actual CSV and hierarchy | CSV contains one row per actual item, including parent-direct assignments; hierarchy fields are retained. Inclusive parent/child totals overlap and must not be added together. Verify against actual downloaded bytes, current tool receipt and reload. |
| QS-02 | Finish tablet report interaction and final compiled-report acceptance | QS-01 can run independently of layout work. Exercise all/classified/unassigned/subtree filters, expanded hierarchy, empty/mixed-unit views, CSV download and edit invalidation on tablet and current built output. Earlier worksheet acceptance does not qualify the newer report. |
| QS-03 | Bind classified rows to immutable measured evidence | SH-02. Preserve source/calibration/revision and evidence classes; stale inputs invalidate reports. Exact decimal totals remain separated by units and evidence; no classification-to-verification promotion. |
| QS-04 | Connect explicit rate books and auditable estimate calculations | QS-03. Bind currency, rate unit, supplier/reference/revision and explicit allowances/tax treatment. Missing/incompatible rates remain unresolved; no silent zero or guessed conversion. |
| QS-05 | Add alternatives, estimate revisions and change comparison | QS-04 and SH-03. Separate quantity/rate/scope changes; keep alternatives outside base totals unless selected. Frozen prior estimates remain unchanged. |
| QS-06 | Export/reopen an auditable cost-plan package | QS-05. Include source rows, classification, assumptions, exclusions, rates and revision comparison. Verify exact item-once aggregation, assistant/Developer responses and desktop/tablet/native journey before industry acceptance. |

## IND-43 — Fencing: retained, deferred

Reference: [fencing ledger and later correction](FENCING-IMPROVEMENTS-TODO.md). The synthetic bay-generation/native engine checkpoint is already accepted within its stated scope. Do not restart that work from the older unchecked wording.

- [ ] FENCE-01 When resumed, implement stock nesting/cut lists with explicit stock lengths, kerf, end allowances and reuse policy; reconcile every cut and offcut against required pieces.
- [ ] FENCE-02 Add slope/rake/step constraints and ground clearances using an explicit reviewed product schedule.
- [ ] FENCE-03 Complete existing-product repair matching, substitution mismatches, gate hardware and installation evidence.
- [ ] FENCE-04 Complete source → measure → specification → set-out → materials → review → issue/reopen, plus remaining installer/platform claims. Preserve historical engine and full/equal-bay proof.

Fencing does not consume a worker slot until the deferred priority is resumed.

## Required proof for every completed step

Every task above is still open until its own acceptance is executed. Within each implementation batch use SC-01 scope, SC-02 implementation, SC-03 lifecycle/persistence, SC-04 assistant/independent review, SC-05 device/export checks and SC-06 regression/build. Link both the task ID and applicable whole-industry gate; a passing subtask cannot close a broader gate automatically.

Use `proof/growth/<date>-<industry>-<batch>/steps/<task-id>-SC-<nn>.md`, with separately named screenshots for each relevant state. Every step file includes exact diff/commit, source/build identity, fixture and assumptions, executed logs/receipt, screenshot links, observed result, cleanup and remaining limits. Capture actual exports and inspect their contents; a screenshot alone cannot prove arithmetic, saved bytes or compilation. Nonvisual work uses executed output and explicitly says what its accompanying screenshot demonstrates.

All product tests, builds and browser/native proof run on DANS1. Verify source hashes before execution, inspect screenshots, run relevant regression/typecheck, then verify actual built output. Web/native builds use the maintained worker sequentially. Stop verified task-owned processes after use. Preserve failed attempts and distinguish source failure, harness failure and external dependency.

This planning-only change requires document/link review, not a product build or fabricated screenshot. Completion records for future work must appear in [the proof index](INDUSTRY-PROOF-INDEX.md), [industry acceptance checklist](INDUSTRY-CHECKLISTS.md) and completion ledger only after evidence passes.

## Queue after the active work

The remaining 63 profiles stay in the existing register. A previous [next-batch proposal](planning/industry-work/next-batch-proposal.md) suggests flooring/finishes (IND-44), concrete/precast (IND-24), and plumbing/gas (IND-31); it is a candidate sequence, not a new active assignment. Before starting any, define its bounded scope, required evidence and exclusions, then apply the same six proof gates. Do not label all 68 industries complete because their checklists or calculators exist.


2026-09-14 continuation update: RES-02-SC-01 supported full-infill / before-repair-height editing is verified; overall RES-02 remains open. ROOF-01 and QS-01 failed actual MiniMax acceptance and remain open. Current individual proof links and next steps: [TAKEOVER-TODO.md](TAKEOVER-TODO.md).
