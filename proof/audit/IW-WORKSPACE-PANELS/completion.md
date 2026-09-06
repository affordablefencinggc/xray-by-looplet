# Workspace panels and navigation — verified scope

Branch: feat/model-wireframe-navigation. Baseline: 3a16e98d6b28cdcb391fc753fe849ddee2dd9ffe. Shared changes retained; no staging, commits, worktrees, merge or publication.

The user-authorized interface and navigation work is implemented and verified. Real account authentication (SC-13) remains open: the desktop app has no connected account server. The user was asked to choose an existing Looplet service or a new email/password service. No answer or server connection has been supplied. The account shell filters out the template's dev fallback identity; no login success is claimed.

## Delivered slices

| Slice | Behavior | Executed / visual proof |
|---|---|---|
| SC-01 | Wider persistent adjustable rails; thin dark-grey inner edges and shadow only | dev/built/native/installed menu checks; 03-wide-menus.png |
| SC-02, SC-11 | Source-bound part list, red floor/room/part maps and evidence; final layout is one square preview with four right-side thumbnails | all four thumbnails swap main preview; modal annotation save/reload; 09-components.png, 10-room-modal.png |
| SC-03 | Large searchable live capability checklist, personal check persistence; accessed through Settings > Administration | capability checks and 11-capabilities.png |
| SC-04 | Web and native packaging; installed version verified without resetting user data | build logs, executable identity, installed QA |
| SC-05, SC-10 | Fly controls, keycap hints, chosen Walk starting position, Esc exit; projection badge beside Scope and aligned header | actual pointer lock/WASD/mouse checks; picker and 15-navigation-chrome.png |
| SC-06 | Render panels follow cream/charcoal | theme assertions; 01-render-cream.png, 02-render-charcoal.png |
| SC-07 | Eight model palettes, eight sky environments, weather animation/pause/reduced motion, PNG output and delayed floor hover | appearance/report.json plus current dev/built/native/installed checks |
| SC-08 | Engineering/architecture gaps displayed as planned | live capability checklist; no structural-analysis claim |
| SC-09 | 23px bottom drawer flush with bottom, click toggle, drag and keyboard resize | bottom-bar-qa.json plus all current environments |
| SC-12 | Right Settings rail, wider editors, theme switch inside, menu widths, measurement controls, reference price sheets and diagnostics | save/reload of reference rates, layout controls, account fallback exclusion, neutral lower Measure toolbar; 16-settings-prices.png, 18-measure-controls.png |
| SC-14 | 1.6-second map-style walking arrival with eased translation, gentle arc and quaternion rotation; Esc cancels; reduced motion skips animation | moving positions sampled over time, final floor/eye height, cancellation and reduced-motion checks; walkthrough-arrival.webm |
| SC-15 | Camera advances exactly 25% toward the selected mesh and pivots smoothly; details appear in right rail; manual orbit interrupts | source component selected through real canvas click (browser) and dropdown (native), camera vectors checked, reduced motion/manual-interruption checks; 19-inspection-pivot.png |

| SC-16 | CRM-inspired image viewer: main image, right details, resizable filmstrip/grid, arrows and keyboard navigation; actual photo captions persist | six photo checks each in dev and built; 20-photo-gallery.png, 21-mobile-photo-gallery.png |
| SC-17 | Actual mesh isometric floor locator with red selected floor and datum | 09-components.png and gallery/native checks |
| SC-18 | Bottom-right key guide, segmented Fly/Walk, 42px PNG, 126px floor selector and silver projection badge | browser layout assertions and 15-navigation-chrome.png |

## Validation

- Typecheck, web build and desktop NSIS build: pass. npm test: 597 tests (198 script tests + 399 TypeScript tests), zero failures.
- Actual photo import/viewer, navigation, filmstrip resizing, caption save/reload and mobile checks: six dev and six built, no errors. Gallery actions are real; no simulated Email, Docbox or OCR actions.
- Final browser interaction checks: 14 dev and 14 built; no console/page errors. Desktop and mobile exercised.
- Packaged WebView: 11 checks; installed WebView: 11; no errors. Fresh isolated test profiles; the normal application profile is preserved.
- Native mouse-dwell event is injected to isolate concurrent physical cursor movement. Full real pointer-lock/WASD/mouse movement and arrival animation are verified in controlled browser runs, not claimed as native OS input coverage.
- Generic desktop/mobile dev and built smoke render checks pass with no overflow or uncaught errors and no baseline divergence. The nonfatal generic OG placeholder note is retained; this is a construction utility.
- Screenshots visually inspected: model controls, location gallery/modal, Settings/prices, loaded Measure drawing/toolbar, desktop/mobile smoke, and native/installed views.
- The app's MCP transport was **not** exercised. The pre-existing hardcoded Connected diagnostic label is not verification of live MCP tools.

## Artifacts

- [Exact task code diff](task-code.patch), [source hashes](source-manifest.json), [task-start file snapshots](before/).
- [Dev report](../../../screenshots/workspace-panels/dev/report.json), [built report](../../../screenshots/workspace-panels/built/report.json), [native report](native-qa.json), [installed report](installed-qa.json).
- [Actual walkthrough video](../../../screenshots/workspace-panels/walkthrough-arrival.webm).
- [Inspection screenshot](../../../screenshots/workspace-panels/built/19-inspection-pivot.png), [gallery](../../../screenshots/workspace-panels/built/09-components.png), [Settings](../../../screenshots/workspace-panels/built/16-settings-prices.png), [Measure](../../../screenshots/workspace-panels/built/18-measure-controls.png).
- [Install record](install.json), [installed launch/shortcut](installed.json), [package identity](bundle-identity.json), [cleanup](cleanup.json).

Build executable SHA-256: c05707d2941a20a19a0aefc4e1a66714bd616b78ff335a1b103a15a366d7ddae

Installed SHA-256: f865e930ff8d4adfa17ec82c3c771ecabfc7427978dd95cee7c91ce0363e7ea6

The NSIS package changes only Tauri's bundle marker UNK to NSS; the entire normalized executable matches. Prior installed executables are retained as rollback copies. Earlier same-turn desktop-assets-equivalence artifacts are superseded by these final build/installed identities.

## Limits and outstanding work

- SC-13 real login/logout and email sessions need an account service and connection; organization administration/permissions are not implemented.
- Price sheets are locally saved reference rates. Automatic costing, supplier integration, tax and margins are not implemented.
- Crown Wharf geometry is an explicitly approximate source-linked reconstruction, not a verified physical stock/BOM count. Manual room marks remain separate annotations.
- Walk holds floor eye height and has no wall collision. Weather is presentation, not structural load simulation. Planned engineering items remain planned.
