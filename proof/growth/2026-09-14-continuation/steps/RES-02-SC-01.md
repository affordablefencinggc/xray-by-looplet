# RES-02-SC-01: full infill and before-repair height editing

2026-09-14. COMPLETE for this supported editing slice; overall RES-02 remains open for broader geometry and acceptance. Baseline bcc5c3e on feat/architect-cad-engine; uncommitted, unmerged, not deployed.

Requirement: expose the inherited full-infill and wall-height repair contracts through referenced, validated author/edit/clear paths; preserve undo, source geometry and reload. [Exact diff](../code.diff), [source hashes](../source-manifest.json). Changed by this continuation: AlterationPanel.tsx, alterationPanel.css, AlterationStagePreview.tsx, alterationStage.ts (review comment), assistant/architectBridge.ts, assistant/appTools.ts, new alterationEditIntegration.test.ts, package.json. Inherited model/lifecycle/stage changes are included and identified in that snapshot.

The UI offers retained aperture or full infill using only host layers, with a required reference. Repaired walls accept an explicit earlier height and reference; proposed height remains authored. Public and runtime assistant schemas accept infill and set-wall-repair-basis. Leaving repaired status clears obsolete repairBasis through the assistant path as it already does through the pure lifecycle helper. Stage-review wording now describes these explicit exceptions. Both new architecture test suites are included in npm test.

## Executed checks

- [DANS1 architecture and assistant-tool tests](../remote-evidence/residential-tests.log): 247 pass, 0 fail. Includes real prepareArchitectEdits calls, atomic rejection, reference validation, exact stage volumes, unchanged authored sill and repair-basis clearing. [TypeScript](../remote-evidence/residential-typecheck.log) passes.
- [Final dev UI campaign](../remote-evidence/live-residential-2026-09-14T11-26-50-286Z/result.json): PASS, no uncaught browser exceptions, contexts disposed. [Source binding](../remote-evidence/residential-current-binding.json) separately verifies the current src files and package.json against the final build manifest; it supersedes the earlier delta hash embedded in the runner result for the final review-copy additions.
- A synthetic project was deliberately seeded through saveArchitect before UI testing. It contains a 4000 x 2700 x 200 mm repaired solid wall and demolished 900 x 1200 mm window at a 900 mm sill. Actual UI actions save infill, reject a missing reference, clear, undo and redo. Actual UI actions save 2400 mm before height, edit to 2500, undo, clear and undo. The mounted assistant controller then sets 2300 mm and undo restores 2400. The runner imports the actual cache-versioned mounted bridge module, avoiding a separate unmounted module instance.
- Reload restores infill, references, 2400 mm before height and 900 mm sill. Fresh review resolves 1.704 m3 before (4 x 2.4 x .2 minus .9 x 1.2 x .2) and 2.16 m3 proposed. These are fixture geometry checks, not source-backed takeoff.
- [Web build 09c014abc002](../build-proof/results.json): typecheck, 87 broader regression tests and npm run build all pass on DANS1, High priority, 16 processors. First run 09c014abc001 omitted required PDF fixtures and failed ENOENT; new run includes the three hash-bound fixtures. Original failure preserved remotely.
- [Production browser result](../live-production-2026-09-14T11-30-13-619Z/result.json): PASS with no console/runtime/network errors. Desktop/tablet root and Architectural workspace render. This production smoke uses an empty project; the detailed edit/undo journey above is dev evidence.

## Separately named visual proof

All listed states were visually inspected. The base drawing remains the authored model; the stage preview is the evidence of the closed proposed aperture.

- [Desktop saved full infill](../remote-evidence/live-residential-2026-09-14T11-26-50-286Z/desktop-full-infill.png): reference, full-infill selection and clear control.
- [Desktop saved before height](../remote-evidence/live-residential-2026-09-14T11-26-50-286Z/desktop-before-repair.png): 2400 mm and reference, with current authored wall unchanged.
- [Tablet reloaded infill](../remote-evidence/live-residential-2026-09-14T11-26-50-286Z/tablet-reloaded-infill.png): persisted selection/reference and usable wrapped controls.
- [Reviewed before stage](../remote-evidence/live-residential-2026-09-14T11-26-50-286Z/tablet-reviewed-stage.png): original aperture retained before alteration.
- [Reviewed proposed stage](../remote-evidence/live-residential-2026-09-14T11-26-50-286Z/tablet-proposed-infill.png): solid closed aperture, one opening excluded.
- [Production desktop](../live-production-2026-09-14T11-30-13-619Z/desktop-production-editor.png) and [production tablet](../live-production-2026-09-14T11-30-13-619Z/tablet-production-editor.png): empty editor renders in the built app. No claim that those two screenshots contain infill.

Limits: full infill only, same host layers, repair height only. No partial infill, different material assembly, changed wall outline, repaired opening/slab/roof before-shape editing, work-category allocation or procurement authority. No new native package, installed app, macOS/Linux or whole-industry acceptance. No live model call authored this geometry; the actual mounted assistant adapter was invoked directly for its qualified operation. Browser used software WebGL. Transient navigation, unavailable WebGL, undo selection clearing and an unmounted duplicate module caused preserved harness failures before the final campaign; no product assertions were weakened.

[Dev cleanup](../remote-evidence/cleanup.json) and [production cleanup](../build-proof/preview-cleanup.json) stop only identity-verified campaign processes. The original user-facing local preview was retained.
