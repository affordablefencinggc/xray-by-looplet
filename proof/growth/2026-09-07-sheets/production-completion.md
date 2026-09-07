# Production sheet / saved-view / backup proof

Frozen candidate identified by root: `a8a8c4946d93`. Tested existing isolated `growth-production` browser at `http://127.0.0.1:8086/`. No source edits or production rebuild occurred in this verification slice.

## Passed

- `production-sheets.json`: 64 commands, 4.638 seconds, exit0. Fresh imported Redburn source renamed original page1 to Structure overview / Structural and page2 to Site and drainage plan / Civil; grouping persisted original order2,1,3…13. Actual right-mouse pan and two zoom clicks captured Release drainage detail at156.25%. Switching to page1/reset then opening the saved view restored original page2 and source-relative centre. Reload retained names/groups/order/view. Mobile centre error was within0.002; all8lower toolbar buttons were at least44×44 and reachable by centre hit tests.
- `production-backup.json`: 22 commands,4.530seconds,exit0. UI saved a named backup, then read-only IndexedDB verification read the actual stored package string. SHA/bytecount matched its catalogue. Backupv2 contains13sheets, bothnameddisciplines, savedview,2pricingbooks,0pricedworksheetrows,1originalPDF. Every packaged original asset's decoded bytes matched its SHA.
- UI Inspect and Review restore impact completed with no conflicts. Original stored plan metadata and byte digest matched the verified package. Exact current job/sheet/pricing localStorage strings remained unchanged by backup save and impact review. This is preflight verification, not implemented apply/recovery.
- `production-download.mjs backup` and `production-download.mjs register`: actual UI downloads completed via browser events; received filesystem bytes validated. Backup file matches stored package digest. Register retains all13originalpages in managed order2,1,3…13, disciplines and savedview.
- `production-errors.json`: explicit browser error query, errors empty.

## Exact logs

- `proof/growth/runner/2026-09-07T13-17-40-496Z-growth-production.log` (sheet workflow)
- `proof/growth/runner/2026-09-07T13-19-26-878Z-growth-production.log` (backup/preflight)
- `production-backup-download.log`, `production-backup-download-proof.json`
- `production-register-download.log`, `production-register-download-proof.json`

The first register download attempt had an incorrect exact Close label and refused before closing the dialog. It was corrected to the observed accessible label Close Project backups; the completed retry and download hash are the final evidence. No app change was needed.

## Downloaded artifacts

- `production-backup-package.json`:9,343,637bytes; SHA-256 `3517f4f853e876bb3c8a316f2d3ea4e9d8233dc1111ec918fc735d47ed22d6d5`.
- `production-register.json`: actual ordered register; file bytecount/hash recorded in `production-register-download-proof.json`.
- Original plan SHA-256 remains `b57956f76b5dc893ac2b28a021f3f92e345807e326d6b1f8313e373f9145ad38`.

## Images for stage HTML

All under `screenshots/growth/2026-09-07-sheets/`, all visually inspected:

1. `production-before.png`
2. `production-groups.png`
3. `production-bookmark-desktop.png`
4. `production-bookmark-mobile.png`
5. `production-bookmark-mobile-canvas.png`
6. `production-backup-saved.png`
7. `production-backup-preflight-desktop.png`
8. `production-backup-preflight-mobile.png`

Desktop and mobile content are readable; sheet controls, source drawing, lower navigation and following inspector are present. Backup review has its own scrolling dialog; lower impact rows remain reachable beneath the captured upper rows.

## Portable native reuse

`portable-backup.json` is the22-command equivalent with a stage-neutral backup name and screenshot prefix `candidate-backup-`. It requires the identity/key/source globals created by the preceding portable sheet scenario. Root should replace screenshot prefixes in a copy for native proof. Pricing may be absent on a fresh native fixture; it still checks exact presence/absence and byte equality. This avoids falsely claiming pricing rows existed. Native UI/platform acceptance remains root-owned.
