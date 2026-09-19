# DASHBOARD-FINAL-03 — final catalogue and SC09 evidence refresh

19 September 2026. **Static document qualification passed.** This was the single final dashboard campaign authorized during the repository-hygiene freeze. No application source, product test campaign, ledger row or checklist row was edited by this step.

## Delivered document

The root HTML was copied from the exact tested DANS1 output and its SHA-256 matched: `a975abb91b45b334b444316e42a44c4214b453b79133062b08c1d6e33035390e`.

The source-derived catalogue now displays **116/375 covered**: **6 verified, 110 partial, 19 blocked, 239 gaps and 1 failed**. Covered means verified plus partial, not completed. Closeout remains 8 done, 1 partial and 11 pending. SC09 remains partial; SC10 and SC11 remain pending. The machine gate remains the recorded 1951/1951 snapshot, not an implied rerun of later application changes.

The gallery now contains exactly 56 curated captures: the previously reviewed 53 plus three root-reviewed SC09 built-output images. The package guard was explicitly changed from 53 to 56, and future staging now uses the already-ignored `.temp/dashboard-refresh/<run-id>/`. No prior staging directory or evidence was moved or deleted. The worker's limitation text now reports the manifest image count instead of a stale literal 53.

## Exact provenance and executed checks

- DANS1 campaign: `C:\Users\danie\XRayBuilds\dashboard\dash-6c588b0ad934`.
- [Source manifest](../campaigns/dash-6c588b0ad934/output/source-manifest.json): 66 explicit inputs, source digest `6c588b0ad934842b09fe58664218cc3593c7a2e62bbb1c886437a456f3abc846`.
- Input hashes: checklist `26f45aa80cedff18ae17564801b43c5babadb536bbef199a5f5b932bc38daf25`; ledger `7eb9ecd992dea9645f73953f6bbc801f764b014923732f6b4e17c0949d4d901b`; image manifest `e1ca212211a2870734347c6394a9940d6707cea348a217ed0836111eaa17b95e`.
- Generator exit 0; repeated generation byte-identical; **442/442 validator checks passed**: [validator output](../campaigns/dash-6c588b0ad934/output/validate.stdout.log), [overall receipt](../campaigns/dash-6c588b0ad934/output/results.json).
- **105/105 raw-CDP browser operations passed**, all 56 images decoded, source-derived counts and captions matched, zero browser errors: [per-operation results](../campaigns/dash-6c588b0ad934/output/browser/browser-results.json), [exact scenario](../campaigns/dash-6c588b0ad934/output/browser/scenario.json).
- Browser gracefully closed and owned static server stopped; all 38 returned output hashes checked: [launcher receipt](../campaigns/dash-6c588b0ad934/output/browser/launcher-results.json), [output hash manifest](../campaigns/dash-6c588b0ad934/output/sha256-manifest.json), [transfer receipt](../campaigns/dash-6c588b0ad934/transfer-results.json).
- Every packaged input still matched the current worktree immediately before the artifact was copied back. Targeted `git diff --check HEAD` passed.
- [Exact document/source/staging-helper diff](../dashboard-final-03.diff), SHA-256 `d3255184bee59e067fef927bfa3d9c2c52f84b340c5a0bc26a69c875cf755f84`. It includes the root-authored source-document/image-manifest updates consumed by this generation; this agent did not edit those inputs.

## Visual inspection

All eleven final dashboard captures were inspected. Desktop/tablet counts are correct and readable; filter controls and evidence paragraphs fit their layouts; the SC09 gallery card and lightbox show the new built-output capture with its partial-status limitations. No blank, overlapping or horizontally clipped dashboard content was observed.

| State | Desktop | Tablet |
| --- | --- | --- |
| Updated counts | [summary](../campaigns/dash-6c588b0ad934/output/browser/captures/dashboard-summary-desktop-1600x1000.png) | [summary](../campaigns/dash-6c588b0ad934/output/browser/captures/dashboard-summary-tablet-1024x768.png) |
| SC09 combined filter | [partial slice](../campaigns/dash-6c588b0ad934/output/browser/captures/dashboard-combined-filters-desktop-1600x1000.png) | — |
| Current SC09 evidence and open limits | [expanded evidence](../campaigns/dash-6c588b0ad934/output/browser/captures/dashboard-expanded-evidence-desktop-1600x1000.png) | [expanded evidence](../campaigns/dash-6c588b0ad934/output/browser/captures/dashboard-expanded-evidence-tablet-1024x768.png) |
| Remaining work | [roadmap](../campaigns/dash-6c588b0ad934/output/browser/captures/dashboard-open-roadmap-desktop-1600x1000.png) | — |
| New built SC09 gallery image | [filtered card](../campaigns/dash-6c588b0ad934/output/browser/captures/dashboard-filtered-gallery-desktop-1600x1000.png) | — |
| New SC09 image inspection | [lightbox](../campaigns/dash-6c588b0ad934/output/browser/captures/dashboard-lightbox-desktop-1600x1000.png) | [lightbox](../campaigns/dash-6c588b0ad934/output/browser/captures/dashboard-lightbox-tablet-1024x768.png) |
| A–Z statuses and filter | [catalogue](../campaigns/dash-6c588b0ad934/output/browser/captures/dashboard-az-filter-desktop-1600x1000.png) | [catalogue](../campaigns/dash-6c588b0ad934/output/browser/captures/dashboard-az-filter-tablet-1024x768.png) |

The two additional curated tablet source images were also inspected directly: [only edited run stale](../../2026-09-19-sc09-provenance-disclosure/campaigns/sc09-9abf4c807030-built2/output/production-captures/sc09-only-edited-run-stale-tablet-1024x768.png) and [full recorded binding provenance](../../2026-09-19-sc09-provenance-disclosure/campaigns/sc09-9abf4c807030-built2/output/production-captures/sc09-full-binding-provenance-tablet-1024x768.png). The dashboard campaign proves their loading and exact captions, not a new execution of the application behaviors shown.

## Scope and checkpoint allowlist

This is static dashboard proof only. Historical image availability is not current application qualification; repository evidence links outside the two named Markdown documents and 56 images were syntax-checked, not all navigated. No production build, native package, deployment or physical-device acceptance is implied.

Explicit new/changed checkpoint paths for this step: root `XRAY-STATUS-AND-PROOF-DASHBOARD.html`; this directory's `package-static.mjs`, `run-static.ps1`, `dashboard-refresh.scenario.json`, `dashboard-final-03.diff`, `steps/DASHBOARD-FINAL-03.md`; and the complete `campaigns/dash-6c588b0ad934/` (42 files). Root owns the separately reviewed ledger/checklist/image-manifest inputs and repository ignore/attribute decisions. Exclude `.temp/dashboard-refresh/` and all previous staging copies. No staging or commit was performed by this agent.
