# Menu recovery, model controls and inspection motion

Branch feat/model-wireframe-navigation; baseline 3a16e98d6b28cdcb391fc753fe849ddee2dd9ffe. Shared work and existing index preserved. No staging, commits, merge or push.

## Delivered

- SC-01: tiny centred rail pills remain reachable after collapse; click/keyboard reopening, drag-out reopening, resizing and width retention on both sides. Applies to desktop workspace rails, Model and Measure. Mobile keeps its existing stacked layout.
- SC-03: PNG moved into Visual settings; alternating soft grey model controls retain distinct selected states. Browser export checked by downloading real PNG bytes.
- SC-04: examined Looplet CRM's actual Automations canvas camera source. Uses its 900ms film timing and cubic-in-out ease, translated camera/anchor with a steady viewing angle and small curved path. Within 20m of selected mesh bounds, translation stays in the initial camera's image plane with no forward/backward movement. Far approach remains limited to 25% and the 20m stand-off. Fixed resize-triggered instant fit and residual orbit inertia; manual input cancels movement, reduced motion remains supported.
- SC-05: selected thumbnail and preview hover borders are one thin dark line without red halo. Internal floor highlight and level label remain red.
- SC-02: built, verified and installed the combined update; existing user profile retained.

## Proof

Typecheck, web build, NSIS build and 603 tests pass (198 script + 405 TypeScript). Eight interaction scenarios pass each in dev, built browser, packaged WebView and installed WebView, with no console/page errors. Camera samples verify steady heading, no nearby forward travel, no snap after settling and no refit after menu resizing. Six focused motion tests cover 20m boundary, rotated cameras, path curvature, endpoint easing and far stand-off. Native thin borders account for Windows DPI pixel quantization. Native export check covers the control location; actual downloaded PNG bytes are verified in the browser.

Desktop and mobile dev/built smoke renders inspected: visible content, no overflow/errors, no baseline divergence. Construction utility retains the generic nonfatal share-card note. Live CRM browser connector was unavailable; reference behaviour was examined from its actual source code, not a claimed live CRM interaction.

- [Exact task diff](task-code.patch) and [source hashes](source-manifest.json).
- [Dev interaction report](../../../screenshots/rail-recovery/dev/report.json), [built interaction report](../../../screenshots/rail-recovery/built/report.json), [native report](native-qa.json), [installed report](installed-qa.json).
- [Recorded browser interaction](../../../screenshots/rail-recovery/built/interaction-proof.webm).
- [Both menus collapsed with recovery pills](../../../screenshots/rail-recovery/built/02-both-collapsed.png), [model and thin thumbnail edges](../../../screenshots/rail-recovery/built/08-thin-thumbnail-edges.png), [PNG inside Visual settings](../../../screenshots/rail-recovery/built/04-visual-export.png).
- [CRM source reference](crm-reference.json), [package identity](bundle-identity.json), [installed launch](installed.json), [service cleanup](cleanup.json).

Snapshot before continuing the CRM camera changes: C:\Users\danie\repo\xray-by-looplet\snapshots\before-bulk-update-2026-09-06T05-39-52-470Z. 760 project code/configuration/public-asset files (85831869 bytes), working/staged diffs, git index and installed executable; all copied file hashes verified. Generated dependencies/builds, research artifacts and earlier proof excluded; live app data untouched.

Build SHA-256: 7d8d146190da5eada6afc3911a04634e24239fef702da1d9ebe56cfc85c8db19

Installed SHA-256: 2a3caee59735fde46dbede1f1842b896adaebcce86e04045daa71aab925a182e

Installed binary matches the entire built binary after Tauri's standard UNK-to-NSS bundle marker change. Prior installed executable retained as rollback. This proof supersedes earlier same-task camera/PNG/thumbnail behaviours. Existing account-service blocker and approximate source-model limitations are unchanged; no structural collision safety or MCP transport verification is claimed.
