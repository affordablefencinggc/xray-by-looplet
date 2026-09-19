# Frozen-source preflight — 9abf4c807030

Owner: `/root/sc09_review`. Executed on **DANS1**, 2026-09-19; local work was archive/overlay packaging and evidence retrieval only. No local product execution, full build, deployment or live-device qualification.

Source archive SHA-256: `363046a1168bf312022a3d8e3ed23844dd44cf6e4bbc3e658b3bac0da993af4f` (1,236 files). [Stage receipt](stage.json), [source manifest](source-manifest.json), [native manifest](native-manifest.json).

Executed [prepare-dans1.ps1](prepare-dans1.ps1) against `C:\Users\danie\XRayBuilds\preflight\9abf4c807030\source`, with archive hashes from the stage receipt. DANS1 resource policy records High process-tree priority and 16 logical processors. Source/native hashes verified before and after checks, and again at retrieval. [Evidence receipt](evidence-receipt.json), [local overlay comparison](local-receipt.json).

| Gate | Result |
| --- | --- |
| Dependency installation | Exit 0 |
| SC09 focused tests | 130/130 pass |
| Full TypeScript check | Exit 0 |
| Runner + pricing-state tests | 13/13 pass |
| Full npm test | 203 + 796 + 952 = 1,951 pass; no failures/skips |
| Scoped lint | Exit 0; 0 errors, 9 warnings |

Exact commands and durations: [script](prepare-dans1.ps1), [results](results.json). Logs: [focused](sc09-focused.stdout.log), [runner/state](runner-and-pricing-state.stdout.log), [full tests](full-tests.stdout.log), [TypeScript](typecheck.stdout.log), [lint](scoped-lint.stdout.log). The full suite includes all eight new worksheet focus tests.

Fourteen remote evidence files were retrieved and checked against remote SHA-256 hashes. Last preflight verdict was written at `2026-09-19T12:42:59.7089988Z`; retrieval source recheck at `12:45:11.7031428Z`. Working overlay matched packaged bytes at `12:45:15.3407139Z`.

Warnings are recorded, not suppressed: two ledger callback arguments; unused QSReportPanel import, assistantTool test variable and two report formatter variables; two worksheet Fast Refresh helper exports; existing PriceBookPanel ref cleanup. These are not a zero-warning claim.

The unmounted SC11 package panel and new HVAC material-basis files are intentionally excluded from this snapshot. Their separate 28-test preflight does not become integrated UI proof here.

Browser evidence and exact source diff: [combined SC09 record](../../../2026-09-19-sc09-provenance-disclosure/RESULTS.md). SC10's independent strict browser campaign stopped at its Modified-badge contrast gate; this preflight does not claim SC10 completion. Full build remains deferred until dev source qualification and explicit root authorization.
