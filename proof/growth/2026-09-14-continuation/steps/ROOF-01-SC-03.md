# ROOF-01-SC-03: coverage excess contract and live acceptance

2026-09-14. Baseline bcc5c3e, feat/architect-cad-engine. User authorized continuation with "proceed". Status: receipt change verified; ROOF-01 remains OPEN because generated prose failed acceptance.

Requirement: distinguish geometric coverage excess from cutting/waste quantities in the assistant answer and self-review. [Exact source diff](../code.diff) and [file hashes](../source-manifest.json) include preserved inherited changes. This continuation changes sheetCoverage.ts, sheetCoverageTool.ts and sheetCoverage.test.ts: explicit calculation.excessRun plus cuttingSchedule with null per-sheet waste/offcuts, and an analytic conservation regression through the real tool adapter. No arithmetic, source authority or quote eligibility is promoted.

[DANS1 focused output](../focused-tests.log): 106 tests pass, including roofing, QS and the inherited infill suites. Full TypeScript passes. [Final web gates](../build-proof/results.json) pass on build 09c014abc002. These prove code behavior, not language-model accuracy.

One actual MiniMax-M3 user turn was sent on DANS1. [Archive](../live-roofing-2026-09-14T11-12-03-123Z/archive.json), [executed operations and reload result](../live-roofing-2026-09-14T11-12-03-123Z/result.json). It correctly returns 2 courses at 9.8 m and 3 at 9.81 m, states cutting quantities are not calculated, and retains identical entries after reload. However, its lap explanation says the lap "Halves the length contribution" and describes the decimal boundary as a "PDF-point". Both are false for the supplied dimensions. Its review also offers an example beyond the supported nine-decimal precision. This is NOT a clean explanation pass; no second paid turn was made to seek a favorable result.

[Desktop generated reply](../live-roofing-2026-09-14T11-12-03-123Z/desktop-reply.png) was visually inspected and shows the model's review acknowledging null cutting quantities. [Tablet reload](../live-roofing-2026-09-14T11-12-03-123Z/tablet-reloaded.png) accompanies archive persistence proof. Screenshots are not arithmetic evidence; the archive is the verbatim failure record. Prior setup failures are preserved under remote-evidence/live-roofing* and reached no send operation.

Remaining: accurate generated lap/boundary prose and independent acceptance. These are synthetic QA inputs, not measured roof quantities or a verified quote. Browser context cleanup succeeded; [owned dev process cleanup](../remote-evidence/cleanup.json) is recorded.
