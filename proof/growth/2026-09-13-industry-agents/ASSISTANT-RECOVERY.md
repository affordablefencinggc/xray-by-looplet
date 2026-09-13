# Assistant recovery checkpoint — 2026-09-13

Baseline: 191ebb5, branch feat/architect-cad-engine. All execution evidence below comes from DANS1. This checkpoint repairs the failed assistant comparisons recorded in FORMS-INTEGRATION.md; historical failures remain unchanged.

## Behavior and observed results

Explicit requests for one supported draft calculator now expose that calculator and context readers initially. An unsupported execution claim can receive one scoped retry. Withheld prose remains in the audit archive but is excluded from the provider's working conversation. The per-request tool boundary rejects unrelated calls; normal declarations resume after a real calculator invocation.

Quantity classification explains that a top-level parent and an absent source require explicit null values. Validation remains strict: empty objects, empty parent identifiers and invented source placeholders are not silently repaired. Explicit correction-only requests that prohibit tools can return an explanation without an unnecessary workflow-selection call. Action requests retain their existing completion requirements.

An independent review then found that a contradictory request such as “No tools. Draw a wall and explain it.” could reopen normal declarations. A separate blanket-prohibition predicate now keeps zero tools while leaving the action route incomplete. Selective exceptions remain distinct. The follow-up passes 38 focused tests and full typecheck, including a simulated provider mutation attempt that executes zero calls. See hvac/no-tools-prohibition. Build a8a4f707ac43 passes web and native packaging with this final follow-up; the earlier full regression and build do not include these last three changed files. Its production browser campaign passes 34 operations, with desktop/tablet screenshots inspected by root.

A fresh live HVAC explanation-only request also passes: correct historical 16 m²/64 kg explanation and Developer review, zero fresh tool events, unchanged project and exact conversation persistence after reload. See hvac/no-tools-live.

- Roofing: a fresh real calculator invocation produced 95 m² net, matching the manual worksheet. The final answer and Developer review agree and persist through reload. One internal recovery was necessary; this does not establish first-attempt reliability. See roofing/FORM-MODEL-RECOVERY.md.
- HVAC: the existing fresh comparison produced 16 m² and 64 kg with actual tool execution and matching review; no redundant provider request was made.
- Quantity surveying: the scoped request executed call_1f4917677fbe45ce9d608b53 with the supplied nulls and returned exact totals 0.3 / 0.3 / 0. Its explanation still incorrectly suggested omitting parentId. A subsequent correction-only request now delivers the correct required-null explanation and refers to the historical receipt without claiming another execution. Exact conversation/project/draft reload checks pass. See quantity-surveying/focused-retest and discussion-retest.

## Verification

- Full final regression: 201 script tests and 1,189 TypeScript tests in 89 suites; full typecheck passes. See hvac/final-regression.
- Production build 2f08ad4c8ef1: web and Windows native build complete successfully. Production browser campaign passes 34 operations with no console/runtime errors or horizontal overflow. Root visually inspected desktop roofing and tablet quantity worksheet screenshots; controls and labels are readable. See final-build-2f08ad4c8ef1.
- Independent review matched all 834 web and 104 native inputs at its timestamp, before the final no-tools follow-up, and verified both native artifact hashes. Native packaging subsequently replaced the shared dist directory with desktop assets; the recorded production browser check applies to the preceding web build. The independent report records both asset inventories without claiming the replaced web assets still exist.
- Root inspected the delivered quantity correction screenshot: a visible receipt identifies the original call, unchanged project and explicit null inputs. Full text and persistence assertions are in the recorded browser results.
- Real packaged Python engine qualification passes contract status, four frozen request/result fixtures, both explicit bay layouts and 26 protocol tests. The schema digest now matches the unchanged canonical contract. See hvac/native-engine/fixed.
- Build 76df1ffc8521 failed because staging omitted an existing Rust module. The final manifest includes all current Rust modules. The failed attempt is preserved; it is not a product acceptance result.

The native build cache now reuses only a verified successful artifact with a matching native source hash; a missing or different cache uses a cold build. Corrupt matching caches fail closed. Ten cache branch checks pass; see roofing/NATIVE-CACHE.md.

## Remaining scope

Native end-user import/calibrate/trace/material-generation checks are still in progress. The qualified Python executable is explicitly configured for an isolated QA process: this does not establish automatic engine installation or default discovery in a distributed app. Whole-industry readiness and the remaining industry queue remain open. No source geometry, calibration, engineering authority or prices are inferred by these calculators.

Native status intermittently reports unavailable, including after a successful warm query. The host has a two-second status deadline. A separate bounded-handshake/UI-thread fix is being developed after this checkpoint and is not included in build a8a4f707ac43. The native test imported its synthetic SVG through the actual file picker and picked calibration endpoints; locked measurement and material-generation acceptance remain pending. Failed observations are preserved in roofing/native-ui.
