# Structural connection-count trial — 2026-09-06

Authorized: “find a document tro do that on and continue”. Branch `feat/model-wireframe-navigation`, baseline `3a16e98d6b28cdcb391fc753fe849ddee2dd9ffe`. Existing shared changes, index and the previously requested restore snapshot were preserved. No staging, commit, merge, worktree or push.

## Delivered scope

SC-01: downloaded and visually inspected the official City of Thornton Fire Station 8 structural bid set, issue 2024-09-27, 23 pages. [Independent source trace](source-audit.md) records the bounded selection and arithmetic. This is a low-rise public test project, not a high-rise completeness demonstration.

SC-02: eight interior W10×22 beams in one selected roof span, sixteen distinct physical beam ends, thirty-two scheduled 7/8-inch ASTM A325N bolts. The rule uses the lesser nominal member depth, with S2.2 physical locations, S0.6 schedule and detail 1/S5.1. Stable physical IDs reject duplicates even with different record IDs; extra evidence views never add quantities. Nuts, washers, length, specified weight and packed volume remain unresolved/null. These prepared counts require review and are not procurement approval.

SC-03: Components → **Open structural bolt-count trial** imports the hash-verified original PDF. Each connection has a plan marker, selectable inspector, evidence gallery, source-page navigation, saved note/review/revision and JSON export. Changes to notes reset the local approval checkbox. Review storage is scoped by project/source; invalid versions, wrong source/project and concurrent updates block writes. Original unreadable bytes remain intact. The immutable definition revision prevents silently reusing reviews under a changed counting definition.

## Executed and visual proof

- Typecheck passed; [typecheck log](typecheck.log).
- Full test suite passed: **612 tests**, comprising 198 script tests and 414 TypeScript tests, including nine new counting/persistence regressions. [Test log](tests.log).
- Web production build and NSIS desktop build passed. [Web build](build.log), [desktop build](desktop-build.log). The initial all-target desktop command encountered the existing WiX/MSI tooling failure; the actual distributed NSIS target built successfully.
- Six focused scenarios passed on development and built web apps, and six on packaged and installed native apps, with no captured page/console errors. Covers real PDF import, physical count, review persistence after reload, actual JSON file download and readback, evidence-page navigation and unreadable-storage protection. Mobile layout was checked in browser; native checks used the actual desktop window.
- Development and built desktop/mobile smoke checks passed without baseline divergence. [Dev smoke](../../../screenshots/connection-count/dev-smoke.json), [built smoke](../../../screenshots/connection-count/built-smoke.json).
- Inspected actual desktop, mobile and native screenshots. [Count overview](../../../screenshots/connection-count/dev/01-count-overview.png), [mobile](../../../screenshots/connection-count/dev/07-mobile.png), [installed app](../../../screenshots/connection-count/installed/01-count-overview.png), [downloaded installed export](../../../screenshots/connection-count/installed/export.json).
- Browser control used Playwright/Edge and the native WebView debugging connection; this does not claim MCP transport or Android testing.

## Installed result and recovery

Verified native build SHA-256: `30359783448d99d2d5ed210141f2af9264c9c1c9284524bc7894cb8e23faa98c`.

Verified installed SHA-256: `049e110596fda4b738297b83dd0cde791f0c889f417d1ecee9f656d9044dfbc2`. Complete binary identity matches after the documented Tauri NSIS marker substitution. [Identity](bundle-identity.json), [installed test](installed-qa.json), [installation and backup](install.json), [normal app launch](installed.json).

All native tests used isolated disposable profiles. The user's existing app data was retained. Task-owned development, preview and debugging listeners were stopped; the normal installed app was reopened. [Service cleanup](services-stopped.json).

[Exact task-only code diff](code.diff) compares touched files with their before-task copies, avoiding attribution of pre-existing changes. [Changed-file and asset hashes](changed-files.json). The original source PDF is bundled without alteration, alongside unaltered rendered crops. Whole-building extraction, high-rise fabrication completeness and engineering approval remain outside this completed trial.
