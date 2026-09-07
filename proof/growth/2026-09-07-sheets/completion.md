# D-06 / D-14 sheet growth proof — 7 September 2026

## Scope and result

**Development acceptance passed; production/native release verification remains with the coordinating agent.** No build, install, CRM edit, commit or user browser profile mutation was performed by this slice.

- D-06: Custom discipline labels persist with the exact source revision. Group by discipline performs a stable alphabetical group sort; manual order remains available outside filtered lists. Renamed labels and active managed order feed the existing sidebar. Export downloads every original page in managed order, with discipline, archive flag and saved views. The original PDF is not reordered or rewritten.
- D-14: Personal local saved views retain original page identity, source-relative centre and zoom. Opening a view on another page restores that original page and viewport. Resizing and full reload were verified against actual rendered source geometry. Views are removable and removal survives reload. They are included in the sheet metadata backup contract and ordered register export.

## Executed evidence

| Check | Evidence | Result |
|---|---|---|
| Before UI | `before.json`, `before.log`; `before.png`, `before-views.png` | Inspected |
| Three discipline assignments, grouping, reload and mobile | `groups-final.json`, `groups-final.log`; `groups-desktop.png`, `groups-mobile.png` | Passed |
| Real downloaded register bytes | `download-proof.mjs`, `download.log`, `download-proof.json`, `ordered-register.json` | Passed; 13 pages in order 3,2,1,4…13; first groups Architecture/Civil/Structural; saved Drainage junction view included |
| Real pan/zoom capture, page switch, restore, resize, reload | `bookmarks.json`, `bookmarks.log`; `bookmarks-desktop.png` | Passed; page 2 at 156.25%; source centre measured within 0.002 normalized units |
| Write capacity failure, removal/reload, group filter | `failures.json`, `failures.log`; `storage-refusal.png`, `discipline-filter.png` | Passed; failed storage left prior raw metadata bytes unchanged; temporary view removed while retained view survived |
| Final mobile workflow after parent layout correction | `mobile-final.json`; `../runner/2026-09-07T13-00-34-820Z-xray-sheet-growth.log`; three final mobile images below | Passed; 15 commands in 1.377 seconds; source centre restored after reload; inspector follows drawing |
| Meaningful unit tests | `unit-tests.log` | 13 passed, 0 failed |
| Full TypeScript gate | `npm.cmd run typecheck` executed after final source guard | Exit 0 |
| Explicit browser page errors | `errors.json` | `success:true`, `data.errors:[]` |
| Final 44-pixel mobile lower controls | `mobile-controls44.json`; `../runner/2026-09-07T13-04-34-177Z-xray-sheet-growth.log`; `bookmarks-mobile-controls44.png` | Passed; all 8 buttons at least 44×44, viewport-contained, centre hit tests reachable; original page 2 and saved centre retained |

Source identity remains SHA-256 `b57956f76b5dc893ac2b28a021f3f92e345807e326d6b1f8313e373f9145ad38`, 13 original pages. This slice writes only the lifecycle sidecar; source byte storage and drawing evidence stores are not mutation targets.

The final downloaded register is 2,814 bytes, SHA-256 `950f3aa5f51476bb3d22e367a415c155c0a3cebf2fd08d03dc8bbe5a905cee6f`.

## Images for the self-contained stage report

All images are under `screenshots/growth/2026-09-07-sheets/` and were visually inspected:

1. `before.png` — source register before discipline controls.
2. `before-views.png` — drawing workflow before saved views.
3. `groups-desktop.png` — three grouped disciplines and original page indices.
4. `groups-mobile.png` — responsive register controls.
5. `bookmarks-desktop.png` — restored original page 2 and saved view.
6. `storage-refusal.png` — real capacity error with original view still present.
7. `discipline-filter.png` — Civil filter keeps original page 2 and disables ambiguous reorder.
8. `bookmarks-mobile-final.png` — complete mobile saved view controls.
9. `bookmarks-mobile-canvas.png` — restored drawing and original lower navigation toolbar.
10. `bookmarks-mobile-inspector.png` — inspector follows drawing in one scroll flow.
11. `bookmarks-mobile-controls44.png` — final enlarged lower controls, visually inspected; use this instead of the earlier canvas image for current layout.

`bookmarks-mobile.png` and `bookmarks-reloaded.png` document the earlier shared-layout overlap. They are historical findings, superseded by the three final mobile images. `groups.log` contains an earlier controller reload timeout; use `groups-final.log` for the passing replay. The isolated browser stayed healthy and was reattached as `xray-sheet-growth` on its own CDP port 50580. Normal installed CDP 9254 was never used.

## Compatibility and boundaries

The existing `xray.sheet-lifecycle/v1` format/key remains. Page records gain **optional** `discipline` and `bookmarks`; legacy records parse unchanged without inserted defaults. Current backup capture/validation includes them automatically. Older strict app readers reject enriched records rather than silently discard the added metadata. `SourceSheetBookmarks.tsx` has a distinct basename from pure `sheetBookmarks.ts` for Windows case-insensitive resolution.

Saved views belong to the device's project/source metadata; there is no new account sync or per-staff sharing claim. Up to 20 views per page are supported. Pending traces/calibration and stale/unknown source identities refuse navigation or mutation. Original page indices, archive impact review and source evidence are preserved. Export is an ordered JSON register, not a regenerated/reordered PDF.

Final acceptance should be entered into the shared ledger only after the coordinating agent's production/native checks and combined report are complete.
