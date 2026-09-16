# Industry step proof index

Each completed step has a separate Markdown proof record with screenshots, exact source change and executed evidence. Historical records preserve their original capture identity. A screenshot is not substituted for arithmetic, build or persistence checks.

## 2026-09-16: shared industry source binding (SH-02) and its three consumers

| Step | Proof file | Screenshots |
| --- | --- | --- |
| SH-02 Shared binding contract | [Open proof](proof/growth/2026-09-16-industry-source-binding/steps/SH-02-SC-01.md) | None claimed — nonvisual step; the consumer steps below carry the browser proof |
| ROOF-02 Roofing worksheet binds to the source | [Open proof](proof/growth/2026-09-16-industry-source-binding/steps/ROOF-02-SC-01.md) | 4 (`roof-01` … `roof-04`) |
| HVAC-02 Duct worksheet binds to the source | [Open proof](proof/growth/2026-09-16-industry-source-binding/steps/HVAC-02-SC-01.md) | 2 (`hvac-01`, `tablet-02`) |
| QS-03 Quantity worksheet binds to the source | [Open proof](proof/growth/2026-09-16-industry-source-binding/steps/QS-03-SC-01.md) | 3 (`qs-01`, `qs-02`, `tablet-01`) |
| SH-03 Shared delivery/revision contract | [Open proof](proof/growth/2026-09-16-industry-source-binding/steps/SH-03-SC-01.md) | None claimed — nonvisual contract step |

Fast CDP run: [report](proof/growth/2026-09-16-industry-source-binding/runner-report.json) — 75 opcodes, 2.53 s, exit 0, zero console errors. Regression: [full log](proof/growth/2026-09-16-industry-source-binding/regression-full.log) — 1,383 TypeScript + 201 script tests, 0 failures; after SH-03, [regression-sh03-full.log](proof/growth/2026-09-16-industry-source-binding/regression-sh03-full.log) — 1,398 TypeScript + 201 script tests, 0 failures. Whole-industry acceptance for IND-29, IND-30 and IND-38 remains open in [INDUSTRY-REMAINING-WORK-PLAN.md](INDUSTRY-REMAINING-WORK-PLAN.md).

## 2026-09-16: plan reconciliation (SH-01) and the residential slices it reconciled

The residential table in [INDUSTRY-REMAINING-WORK-PLAN.md](INDUSTRY-REMAINING-WORK-PLAN.md) had carried RES-01..RES-07 as unstarted work while other ledgers recorded them done. The reconciliation checked every line against the proof, source and tests on disk; these records were already present and were not rebuilt.

| Step | Proof file | Screenshots |
| --- | --- | --- |
| SH-01 Plan reconciliation against later proof | [Open proof](proof/growth/2026-09-16-plan-reconciliation/steps/SH-01-SC-01.md) | None claimed — nonvisual reconciliation |
| SH-05 Charcoal/ocean theme on industry controls and the QS report | [Open proof](proof/growth/2026-09-16-industry-theme/steps/SH-05-SC-01.md) | 9 (`desktop-01` … `tablet-02`), plus 2 orphans of superseded revisions |
| RES-01 Explicit infill geometry and repaired-wall before/proposed shapes | [Open proof](proof/growth/2026-09-14-residential-infill/steps/RES-01-SC-02.md) | Committed `6bccb44` |
| RES-02 Supported infill and before-repair height editing | [Open proof](proof/growth/2026-09-14-continuation/steps/RES-02-SC-01.md) | Desktop + tablet, dev + production |
| RES-02 Partial infill and replacement openings | [Open proof](proof/growth/2026-09-14-continuation/steps/RES-02-SC-02.md) | CDP `partial-infill-demo` exit 0 |
| RES-03 Lifecycle quantity allocation and shared junctions | [Open proof](proof/growth/2026-09-14-continuation/steps/RES-03-SC-01.md) | CDP `volume-demo` exit 0, `12-lifecycle-quantities-table.png` |
| RES-04 Demolition, salvage/disposal, repair and material schedules | [Open proof](proof/growth/2026-09-14-continuation/steps/RES-04-SC-01.md) | CDP `scheds-v2` exit 0, `13-alteration-schedules.png` |
| RES-05 Coordinated stage plans, schedules and annotations | [Open proof](proof/growth/2026-09-14-continuation/steps/RES-05-SC-01.md) | CDP `coord-v4` exit 0, `14-stage-coordination.png` |
| RES-06 Frozen alteration issue set with revision comparison | [Open proof](proof/growth/2026-09-14-continuation/steps/RES-06-SC-01.md) | CDP `issue-v2` exit 0, screenshots 17/18/19 |
| RES-07 End-to-end residential alteration workflow | [Open proof](proof/growth/2026-09-14-continuation/steps/RES-07-SC-01.md) | CDP `res07-v5` exit 0, screenshots 20–23 |

Regression gate after this reconciliation: [regression-full.log](proof/growth/2026-09-16-plan-reconciliation/regression-full.log) — 1,508 TypeScript + 203 script tests, 0 failures, exit 0. Seventeen suites present on disk had never run in the gate (sixteen architect suites plus `planning/industry-work/coordination.test.mjs`); they are now registered, which is the whole of the increase from 1,398 + 201. Typecheck [exit 0](proof/growth/2026-09-16-plan-reconciliation/typecheck.log); eslint [0 problems](proof/growth/2026-09-16-plan-reconciliation/eslint-new-suites.log) on the newly registered suites.

Residual acceptance is unchanged and still open: independent live assistant/Developer review, wiring the SH-03 `deliveryRecord` into the issued set, native/platform qualification, and the whole-industry gates. Several residential slices remain uncommitted in the working tree.

## IND-01: retained apertures and frozen saved drafts

Completed bounded steps: [SC-01 explicit intent](proof/growth/2026-09-14-residential-retained-drafts/steps/SC-01.md), [SC-02 aperture and PDF](proof/growth/2026-09-14-residential-retained-drafts/steps/SC-02.md), [SC-03 saved draft persistence](proof/growth/2026-09-14-residential-retained-drafts/steps/SC-03.md). Each has separately named screenshots and executed checks.

[SC-04 assistant operation and independent checks](proof/growth/2026-09-14-residential-retained-drafts/steps/SC-04.md), [SC-05 desktop/tablet production](proof/growth/2026-09-14-residential-retained-drafts/steps/SC-05.md) and [SC-06 final build](proof/growth/2026-09-14-residential-retained-drafts/steps/SC-06.md) pass. DANS1 regression201+1314, dev100, production106, mounted adapter20 and web/native build5b80085aab3f pass. Whole-industry acceptance remains open in [the residential checklist](planning/industry-work/residential-phase-geometry.md).

## IND-01: current solid-wall comparison and draft PDF

| Step | Proof file |
| --- | --- |
| SC-01 Solid-wall comparison and blockers | [Open proof](proof/growth/2026-09-14-residential-output/steps/SC-01.md) |
| SC-02 Stage-labelled draft PDF | [Open proof](proof/growth/2026-09-14-residential-output/steps/SC-02.md) |
| SC-03 Download and stale-output protection | [Open proof](proof/growth/2026-09-14-residential-output/steps/SC-03.md) |
| SC-04 Arithmetic, export content and Unicode layout | [Open proof](proof/growth/2026-09-14-residential-output/steps/SC-04.md) |

[SC-05 final desktop/tablet production proof](proof/growth/2026-09-14-residential-output/steps/SC-05.md) is complete. [SC-06 build proof](proof/growth/2026-09-14-residential-output/steps/SC-06.md) records the successful final web/native build. Whole-industry sign-off remains open in [Industry checklists](INDUSTRY-CHECKLISTS.md).

## Earlier residential lifecycle foundation

Separate records: [SC-01 scope](proof/growth/2026-09-14-residential/steps/SC-01.md), [SC-02 editor](proof/growth/2026-09-14-residential/steps/SC-02.md), [SC-03 saved history](proof/growth/2026-09-14-residential/steps/SC-03.md), [SC-05 device/export checks](proof/growth/2026-09-14-residential/steps/SC-05.md), [SC-06 build](proof/growth/2026-09-14-residential/steps/SC-06.md). Live assistant/Developer review SC-04 remains open.

## Earlier residential read-only stage preview

Separate records in the original checked-item order: [SC-01 resolver](proof/growth/2026-09-14-residential-stages/steps/SC-01.md), [SC-02 review basis](proof/growth/2026-09-14-residential-stages/steps/SC-02.md), [SC-03 blockers](proof/growth/2026-09-14-residential-stages/steps/SC-03.md), [SC-04 drawings](proof/growth/2026-09-14-residential-stages/steps/SC-04.md), [SC-05 regression](proof/growth/2026-09-14-residential-stages/steps/SC-05.md), [SC-06 device interaction](proof/growth/2026-09-14-residential-stages/steps/SC-06.md), [SC-07 build](proof/growth/2026-09-14-residential-stages/steps/SC-07.md).
