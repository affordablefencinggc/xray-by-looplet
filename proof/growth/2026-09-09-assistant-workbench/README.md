# SC-10 — Assistant workbench tools: sheets, takeoff evidence, price books, backups (development proof, 2026-09-09 02:20–02:35)

Second batch of "the assistant should be able to do anything the user asks" (Daniel, 2026-09-09; "next batch").

## What changed (code.diff, 508 lines)

- `src/studio/assistant/workbenchTools.ts` (new): pure functions over existing modules — `describeSourceSheets` / `applySheetAction` (same `sheetLifecycle.ts` sidecar the Sheets pane reads; rename with optional discipline, archive, recover; identity, page-range and already-archived/not-archived checks; the retained-evidence impact is returned with the receipt), `describeTakeoffEvidence` (per-sheet calibration state, traces with lengths/review/missing specification fields, located items, `getJobBlockers`), `describePriceBooks` (books, revisions, row counts, metadata, worksheet lines; no rate rows).
- `src/studio/assistant/appTools.ts`: five tools — `read_source_sheets`, `manage_source_sheet` (edit), `read_takeoff_evidence`, `read_price_books`, `capture_project_backup` (edit; `captureBrowserBackup` reuses `captureProjectBackup` + `storeProjectBackup` with the same hydration/save-error checks as the Backups panel and verifies the stored summary's job id and revision). The default port supplies `localStorage`, `readBrowserPriceBooks`, and `notifySheetLifecycleChanged` so the mounted Sheets pane refreshes in the same tab. `AppState.job` now also carries `calibrations` and `photos`.
- `src/studio/assistant/skills.ts`: three read tools added to the VIEW set; `manage_source_sheet` and `capture_project_backup` added to the permission-gated EDIT set. Operating manual unchanged (native parity test passes).
- `src/studio/assistant/workbenchStructure.ts`: `workbenchTools` listing and an updated `notAvailableThroughTools` (trace/calibration editing, price-book import, quotes, exports, backup restore/delete, Model-viewer drawing).
- Tests: new `workbenchTools.test.ts` (6 tests) and the tool-count update in `appTools.test.ts` (16 tools).

## Machine proof

- `node --experimental-strip-types --test workbenchTools.test.ts wireframe.test.ts appTools.test.ts skills.test.ts conversation.test.ts sheetLifecycle.test.ts pricing/priceBooks.test.ts` → tests 65, pass 65, fail 0 (`tests.log`).
- `tsc --noEmit` → exit 0 (`typecheck.log`).
- eslint on touched files → only the pre-existing `error ? reject(error) : resolve()` expression in `openArchitectWorkspace` (now `appTools.ts:81` after the added imports; line 61 at HEAD) (`eslint.log`); new files clean.

## Human proof (Fast CDP, own dev server 127.0.0.1:8091, real provider `gemini-3.8-flash`, two user-authorized messages)

- `desktop.scenario.json` (1280x800, runner `2026-09-08T16-30-22-363Z-workbench-desktop`): Redburn BR250157 imported through the Model pane (sha `b57956f7…45ad38`, 13 pages, source `web`), Sheets pane showing 13 active sheets (`desktop-01-sheets-before.png`). One message with edits allowed: "rename original page 3 to Ground floor plan with discipline Architecture, archive original page 12, then tell me the takeoff readiness blockers and which price books exist, and save a workspace backup named Assistant checkpoint". The model ran `read_project_context`, `read_source_sheets`, `manage_source_sheet` (rename, pageIndex 2), `manage_source_sheet` (archive, pageIndex 11), `read_takeoff_evidence`, `read_price_books`, `read_project_context`, `capture_project_backup` — all eight succeeded — and the conversation then paused at the existing eight-step limit ("Paused after eight assistant steps. Completed actions are retained; send another message to continue."). The scenario's final assertion therefore failed on that pause (exit 1, preserved).
- `continue.scenario.json` (same session, runner `2026-09-08T16-31-15-911Z-workbench-desktop`, exit 0): the paused state was read (all eight receipts present, one pause notice), a second message "Continue with the remaining steps…" produced the summary with no further tool calls. Assertions: saved sidecar page 3 = "Ground floor plan" / Architecture, page 12 archived, lifecycle revision 2, exactly two `manage_source_sheet` receipts; the Sheets list live-updated to 12 active + 1 archived with "03 Ground floor plan" (`desktop-02-after-assistant.png`); IndexedDB `xray-workspace-backups-v1/summaries` holds one backup "Assistant checkpoint" (job revision 2, 1 plan, 9,341,194 bytes, sha256 `a3d874f1…1577`); the Backups dialog lists it (`desktop-03-backups.png`). Browser errors: none. All three screenshots inspected.

## Process hygiene

Dev server 8091 (PID 70504, started 02:29) stopped at 02:31 via `cleanup-dev.ps1` (`dev-cleanup.json`); session `workbench-desktop` closed; the other chat's 8080 and sessions untouched.

## Remaining (not claimed)

- Dans1 build + production preview + Windows-native runs of this and the SC-08 journeys.
- The eight-step conversation cap is reached by an eight-tool request; raising it or batching reads is a product decision, not changed here.
- Still not available through tools: creating/editing traces, calibration and evidence approval; price-book import; quotes; exports/downloads; backup restore/delete.
- `capture_project_backup` was proven on a 1-plan, 0-photo project only.
