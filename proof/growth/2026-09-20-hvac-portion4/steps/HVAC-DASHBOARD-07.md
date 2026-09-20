# HVAC-DASHBOARD-07 - proof index and staged checkpoint closeout

Requirement: the local status dashboard must show actual HVAC progress, preserve unfulfilled criteria and identify the active branch. Every completed bounded step has its own test/screenshot/diff record.

[Exact dashboard, generator and ledger diff](../source/status-and-dashboard.patch). The generator now reads Current execution branch from the ledger, falling back to its baseline branch; it no longer hardcodes an obsolete branch label.

Executed DANS1 [dashboard campaign](../campaigns/hvac4-dashboard2/output/browser-results.json): 9/9 PASS. SC-12/13/14 are partial and carry current proof links/counts; SC-09 remains partial; search and expansion work; tablet has no horizontal document overflow; correct branch displayed. Inspected [desktop screenshot](../campaigns/hvac4-dashboard2/output/captures/dashboard-hvac-desktop.png) and [tablet screenshot](../campaigns/hvac4-dashboard2/output/captures/dashboard-hvac-tablet.png). The prior 8/8 dashboard run is preserved, before the branch-label correction.

Dashboard totals: 10 done, 4 partial, 6 pending; machine gate 2058/2058. This is a source/proof index, not a deployment claim. Three curated HVAC screenshots were added without changing historical evidence. Companion live checklist, completion log and walkthrough record only bounded completed workflows and identify outstanding engineering scope.

Evidence integrity: [returned evidence audit](../source/returned-evidence-check.json) matches SHA-256 for 199 DANS1 evidence files; all 20 current HVAC/package source files match freeze2. Ten browser campaigns, including preserved failures, have stopped/already-exited cleanup receipts. [Final DANS1 readback](../final-dans1-readback.json) reports no listeners on owned test ports 9339/8091 and the exact local dashboard SHA-256 950b82f5b8d08bb664f2c3c9c574316e2bf607602b872a6ba226fbf41d95ba95. These local hash comparisons are readback, not extra product tests.

Checkpoint history: stage 1 froze at 114 changed files and pushed 7f043fe6; stage 2 triggered at 105 and pushed 3b42c063. Both remote hashes were read back and work automatically continued. Final evidence/documentation is a smaller coherent third checkpoint. Explicit staging only; no main merge, force push or deployment.

Product proof: [SC12 straight/wrap](SC12-STRAIGHT-WRAP-04.md), [SC13 network](SC13-NETWORK-05.md), [SC14 schedules](SC14-SCHEDULES-06.md), [PDF visual readback](HVAC-PDF-03.md). Broad HVAC closure and the shared development reload remain open as stated there.
