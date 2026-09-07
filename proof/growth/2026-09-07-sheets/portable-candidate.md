# Portable built/native scenario

Prepared scenario, **not yet executed against the release candidate**. Root owns execution and stage-specific screenshot inspection.

Prerequisites: isolated target opened, UI imported the Redburn 13-page source, no prior sheet metadata/bookmarks for that import. The scenario selects Sheets itself, uses original page indices rather than fixture project names, and never imports dev source modules or accesses a Zustand debug hook. It is independent of hostname/port and works after root has selected the native/built target.

Run through `scripts/fast-cdp-test.mjs <isolated-session> proof/growth/2026-09-07-sheets/portable-candidate.json --cdp <isolated-port>`. Before each execution, copy the JSON and replace only screenshot path basename prefix `candidate-` with `built-` or `native-` so proof is not overwritten. No `open` opcode changes the target.

The first pan is an actual right-button mouse gesture at 650,650 → 710,680, with a preceding assertion that those points are inside the visible source viewport and the start hits its canvas. If a native viewport/shell differs, adapt these four mouse coordinates based on an observed rectangle; do not weaken the capture/restore checks or use a direct state write. Desktop viewport is 1440×1000; mobile is390×844.

Expected resulting sidecar: original page2 named Site and drainage plan / Civil first; page1 named Structure overview / Structural second; other original pages untouched. Original page2 contains Release drainage detail at zoom1.5625 with noncentral source-relative centre. Full reload must retain all names/groups/order and view. Reopen restores page2 and normalized centre within0.002; mobile resize must retain it. Eight lower controls must each be at least44×44 and reachable by centre hit tests.

The scenario ends on Sheets at desktop size. Root can then configure Browser.setDownloadBehavior and use the actual Export sheet register button. Adapt `download-proof.mjs` expected first order from3,2,1 to2,1,3, expected first groups toCivil,Structural, and saved name toRelease drainage detail; use stage-specific output filenames. A valid export must retain all13 source indices and its sourceSHA. The button's status alone is not downloaded-file proof.

Backupv2 remains a separate root-owned UI step. The sheet sidecar is captured by existing backup metadata. In `src/studio/projectBackup.ts`, `records.sheetMetadata` is an optional raw JSON string; parse it as an array and select the lifecycle record by exact document/source identity. Assert these discipline/name/order/bookmark fields and exact source identity. Inspect original stored/downloaded backup bytes, not a fabricated serialization of localStorage. No backup apply or source replacement is authorized by this scenario.

`errors` prints the buffer; root should additionally read/assert `--json errors` gives an empty errors array. Native renderer reload is exercised; operating-system app close/relaunch, packaged target identity, portable backup proof and final build status remain root verification responsibilities.
