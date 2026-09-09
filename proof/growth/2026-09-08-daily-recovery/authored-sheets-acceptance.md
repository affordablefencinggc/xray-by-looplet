# Authored drawing sheets — dev acceptance

Scoped source is frozen after the visible save-failure alert fix. This is development-browser acceptance, not a production/native release claim. No CRM or normal user profile was accessed.

## Implemented contract

- Optional `sheetSet` inside `xray.architect/v1`, using the existing architectural design storage key and backup architecture record. No additional storage key or backup envelope field.
- Format `xray.authored-sheet-set/v1`, `activeId`, and ordered entries `{id, name, archived, layout}`. The legacy `sheet` projection must exactly match the selected non-archived entry after schema parsing. Conflicting projections fail validation.
- Legacy designs remain unchanged on read. First explicit sheet edit/action creates the collection. Add/duplicate select an independent sheet; duplicates receive fresh viewport IDs, including the previously implicit default viewport.
- Rename, select and reorder persist through the existing project commit. Archive requires a review bound to the full project snapshot. Recovery retains the same sheet identity, array slot and complete layout. At least one active sheet remains; maximum 200 entries includes archived sheets.
- A1/A3 changes clamp paper frames while preserving IDs and scales. Adding a second viewport splits the initial full-page frame even when its ID was generated for a new sheet.
- Failed saves publish neither the draft nor a success notice. A local alert at the sheet controls explains that the prior saved data remains intact; retry uses the existing save path.
- Initial/reload architectural storage acquisition catches a throwing localStorage getter and blocks editing.

Owned application files: `src/studio/architect/authoredSheetSet.ts`, `authoredSheetSet.test.ts`, `model.ts`, `ArchitectSheets.tsx`, `ArchitectWorkspace.tsx`, `architect.css`. No 3D navigation/controller changes.

## Executed evidence

Final isolated session: `growth-authored-sheets-final2`, dev `http://127.0.0.1:8080/`.

`node scripts/fast-cdp-test.mjs growth-authored-sheets-final2 proof/growth/2026-09-08-daily-recovery/authored-sheets-final2.json`

**77 commands passed, exit 0, 4.7463511 seconds.** Exact runner report, log and immutable scenario are `proof/growth/runner/2026-09-07T20-22-36-228Z-growth-authored-sheets-final2.{json,log,scenario.json}`. Scenario SHA-256: `e5d916dbcb5f8e825e7be0c0be80a7a6f0cd52ca3852681ab913d560b220e579`.

The real UI journey loaded the labelled Courtyard demonstration into a fresh isolated project, duplicated a legacy sheet, renamed it, added a second viewport, changed A3→A1→A3, checked identities, reordered, invalidated an archive review by editing its sheet number, confirmed a fresh review, archived, reloaded, verified identical project ID and exact saved raw architecture, recovered the exact original entry/layout, added another sheet, injected a quota failure only for that architecture storage key, verified unchanged saved bytes and displayed sheet count, restored the storage method, successfully retried, and selected the recovered sheet.

Desktop 1440×1000 and tablet 1024×768 were captured. DOM checks confirmed no horizontal overflow and at least 44px targets for the register controls. `errors` output is empty. Console has no errors; its existing Three.js PCFSoftShadowMap deprecation warning remains. The intentional quota failure appears as product UI, not an uncaught exception.

Focused tests: 11 new authored-sheet tests pass. The earlier combined authored/Architect run passed all 30 tests before adding the eleventh resize test; existing 20 Architect tests were unchanged. Final `node node_modules/typescript/bin/tsc --noEmit` passed after the last UI edit. The backup owner independently reports 29 backup/preflight tests passing, including collection raw-byte round-trip and rejection of a divergent active projection.

Unit coverage includes unchanged legacy reads; independent duplicate IDs/layouts; save/reopen active identity and per-viewport scale; archive/reopen/recover exact ordering/layout; stale review despite unchanged numeric revision; quota failure/retry for both archive and recovery; stale-session refusal; corrupt active identities/projections and archived viewport level references; keep-one-active behavior; order skipping archived slots; exact paper-frame clamps; parametric DXF round-trip and selected-sheet vector PDF size/title.

## Screenshots actually inspected

- `screenshots/growth/authored-sheets-final2-archive-review.png`: retained viewport count, clear archive/recovery explanation and confirmation controls.
- `screenshots/growth/authored-sheets-final2-stale-review.png`: changed-design explanation and disabled confirmation.
- `screenshots/growth/authored-sheets-final2-archived.png`: retained archived entry and recovery action.
- `screenshots/growth/authored-sheets-final2-save-failure.png`: visible local alert beside sheet controls; three sheets remain after rejected duplicate.
- `screenshots/growth/authored-sheets-final2-recovered-desktop.png`: recovered named two-viewport sheet is active after successful retry.
- `screenshots/growth/authored-sheets-final2-recovered-tablet.png`: register controls fit the tablet; normal page scrolling exposes the drawing inspector below.

Readable controls and expected drawings were visible. No overlapping register actions or clipped register text was found. These screenshots do not establish phone, macOS, Linux-native or Windows-native acceptance.

## Preserved failures and scope limits

Initial readiness failed while the shared workbench hydration stayed idle; root fixed initialization and the test then reopened successfully. A subsequent pre-journey attempt encountered an HMR pane reset. The first longer journey completed archive/reopen/recover but hit an illegal top-level `return` in its assertion; the seven-command resume passed. Logs and original screenshots remain. The first clean 77-command run passed but screenshot review found the global save error above the current scroll; a local alert was added and the final 77-command run above verified it. No earlier failure was relabelled as a full pass.

Authored sheets are live layouts over the shared design. Archiving a layout does not archive model geometry or quantities. Per-sheet annotation stores, cross-sheet references, issued revision snapshots, batch issue PDFs/registers, and hard deletion are not implemented by this slice. Existing source-sheet lifecycle remains separate. PDF export still exports the selected sheet; parametric DXF and project backup retain the entire collection. Existing synchronous architectural storage byte checks are preserved; this slice does not add a new cross-window locking protocol.
