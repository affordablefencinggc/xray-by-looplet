# SC-10 — generated closeout record and dashboard

Result: **PASS**, DANS1 campaign `dash-b53bbd9c931f`, 2026-09-19T14:52:42Z–14:52:48Z (2026-09-20 Australia/Brisbane). This is documentation verification after the separate [SC-10 product receipt](SC10-USE-MEASURED-01.md), not additional product or deployment acceptance.

## Exact change and executed checks

- [Exact documentation diff](../sc10-closeout-docs.diff): only the SC-10 ledger section/summary row, three stale SC-10 references in the catalogue, two curated SC-10 images, and generated dashboard HTML. No catalogue state/count promotion, shared-workbench edit or other slice status change.
- Executed on DANS1: `node scripts/build-full-dashboard.mjs`, then `node scripts/validate-dashboard.mjs`: [451/451 PASS](../dashboard-final/validate.stdout.log). [Command receipts and cleanup](../dashboard-final/results.json).
- [Raw-CDP browser receipt](../dashboard-final/browser/browser-results.json): **105/105 PASS**, zero browser errors, 11 screenshots. Source statuses, counts, links, filters, accordion, keyboard navigation, modal focus and desktop/tablet layout checked. All 58 curated image assets decoded; this does not requalify historical behaviour.
- Generated HTML and repeat generation have identical SHA-256 `2833c7fa0bec09095dd39b62f30c3792228f40149e1df10228c9bb956dda50af`. Root `XRAY-STATUS-AND-PROOF-DASHBOARD.html` was copied from this artifact and matched that hash. [Returned artifact manifest](../dashboard-final/sha256-manifest.json), [source manifest](../dashboard-final/source-manifest.json).
- Counts are derived, not hand-edited: **9/20 done (45%)**, 1 partial, 10 pending. SC-09 remains partial and SC-11 pending. Catalogue remains 6 verified / 110 partial / 19 blocked / 1 failed / 239 gaps; 116/375 is coverage only. Established 1951/1951 machine gate remains the prior 9abf pack, not a new current-source full-suite result.

## Visual review

All 11 captures are covered by visual inspection. Four final files are byte-identical to the inspected first campaign; seven changed files were opened and inspected again after final retrieval. The dashboard is readable at desktop 1600×1000 and tablet 1024×768; tablet vertical scrolling is intentional. Exact statuses, open roadmap and bounded historical-proof captions remain visible.

| State | Named screenshot | Inspection |
| --- | --- | --- |
| Desktop summary | [Summary](../dashboard-final/browser/captures/dashboard-summary-desktop-1600x1000.png) | Identical inspected bytes |
| Combined SC-10 filters | [Filters](../dashboard-final/browser/captures/dashboard-combined-filters-desktop-1600x1000.png) | Identical inspected bytes |
| Desktop SC-10 evidence | [Expanded evidence](../dashboard-final/browser/captures/dashboard-expanded-evidence-desktop-1600x1000.png) | Identical inspected bytes |
| Tablet SC-10 evidence | [Tablet evidence](../dashboard-final/browser/captures/dashboard-expanded-evidence-tablet-1024x768.png) | Identical inspected bytes |
| Filtered proof gallery | [Gallery](../dashboard-final/browser/captures/dashboard-filtered-gallery-desktop-1600x1000.png) | Re-inspected |
| Desktop historical proof modal | [Desktop modal](../dashboard-final/browser/captures/dashboard-lightbox-desktop-1600x1000.png) | Re-inspected |
| Tablet historical proof modal | [Tablet modal](../dashboard-final/browser/captures/dashboard-lightbox-tablet-1024x768.png) | Re-inspected |
| Catalogue failed-row filter | [Desktop catalogue](../dashboard-final/browser/captures/dashboard-az-filter-desktop-1600x1000.png) | Re-inspected |
| Tablet catalogue filter | [Tablet catalogue](../dashboard-final/browser/captures/dashboard-az-filter-tablet-1024x768.png) | Re-inspected |
| Eleven remaining closeout slices | [Open roadmap](../dashboard-final/browser/captures/dashboard-open-roadmap-desktop-1600x1000.png) | Re-inspected |
| Tablet summary | [Tablet summary](../dashboard-final/browser/captures/dashboard-summary-tablet-1024x768.png) | Re-inspected |

## Reproduction and retained intermediate proof

The existing dashboard generator, validator and raw-CDP runner were unchanged. Two staged helper copies were used: [scenario builder](../dashboard-tools/build-scenario.mjs) changes the focused card from SC-09 to SC-10 ([diff](../dashboard-tools/scenario.diff)); [worker](../dashboard-tools/run-static.ps1) adds a graceful-close attempt before identity-checked server termination ([diff](../dashboard-tools/worker.diff)). Their executed hashes are in the final source manifest. Place these copies at their original `proof/growth/2026-09-19-dashboard-refresh/` paths in an isolated source snapshot to reproduce; canonical helpers were not overwritten.

The earlier `dash-e9a85199defe` return is retained under [dashboard/](../dashboard/results.json). It passed before correcting the three stale SC-10 catalogue prose references; it is intermediate evidence, **not** the final generated document. Final proof is exclusively `dashboard-final/`.

The static server was stopped with verified ownership; the browser launcher records cleanup. Source hashes remained unchanged during execution. Other repository evidence links were syntax-checked, not all navigated. Browser emulation is not live-device, native-package or deployment proof. Checkpoint is awaiting Daniel's explicit-path approval; this record does not claim a push.
