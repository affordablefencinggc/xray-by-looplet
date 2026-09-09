# az5 QA runs (run 8e14ac427997)

Every row is one Fast CDP runner report under proof/growth/runner/. Production rows ran against the candidate preview 127.0.0.1:8096 (real provider from .env.local); native rows against the isolated exe over CDP 9281 (provider configured in process memory only). The r2 rows are the state-aware re-runs described in verification.md; no assertion was weakened.

| Session | Scenario | Runner report (proof/growth/runner/…) | Exit | Cmds | Time | First ✗ |
|---|---|---|---|---|---|---|
| az5-prod-regress | prod-warm-long.json | 2026-09-09T03-05-50-583Z-az5-prod-regress | 0 | 3 | 1.7 s |  |
| az5-prod-regress | prod-warm-long.json | 2026-09-09T03-05-52-382Z-az5-prod-regress | 0 | 3 | 0.2 s |  |
| az5-prod-regress | prod-warm.json | 2026-09-09T03-05-52-613Z-az5-prod-regress | 0 | 6 | 0.2 s |  |
| az5-prod-regress | prod-saves-1.json | 2026-09-09T03-05-52-847Z-az5-prod-regress | 0 | 30 | 0.8 s |  |
| az5-prod-regress | prod-sheets-scenario-0-import.json | 2026-09-09T03-05-53-728Z-az5-prod-regress | 0 | 12 | 1.1 s |  |
| az5-prod-regress | production-hardened-layout.json | 2026-09-09T03-05-54-926Z-az5-prod-regress | 0 | 34 | 1.1 s |  |
| az5-native | native-saves-1.json | 2026-09-09T03-05-55-854Z-az5-native | 0 | 29 | 1.3 s |  |
| az5-prod-regress | production-hardened-guards.json | 2026-09-09T03-05-56-064Z-az5-prod-regress | 0 | 28 | 0.8 s |  |
| az5-prod-regress | prod-wireframe-desktop.json | 2026-09-09T03-05-56-968Z-az5-prod-regress | 0 | 37 | 45.8 s |  |
| az5-native | native-sheets-0-import.json | 2026-09-09T03-05-57-246Z-az5-native | 0 | 11 | 1.2 s |  |
| az5-native | native-hardened.json | 2026-09-09T03-05-58-493Z-az5-native | 0 | 21 | 0.4 s |  |
| az5-native | native-wireframe.json | 2026-09-09T03-05-58-970Z-az5-native | 0 | 36 | 30.5 s |  |
| az5-native | native-workbench.json | 2026-09-09T03-06-29-550Z-az5-native | 1 | 24 | 20.5 s | ✗ Evaluation error: Error: Paused after eight assistant steps. Completed actions are retained; send another message to continue. |
| az5-prod-regress | prod-workbench-desktop.json | 2026-09-09T03-06-42-926Z-az5-prod-regress | 1 | 29 | 0.5 s | ✗ 54 elements have role "button", but none match name "Open Redburn BR250157 plan in 3D". Names seen: "Backups", "Settings", "Log in", "Collapse left  |
| az5-prod-regress | prod-workbench-continue.json | 2026-09-09T03-06-43-589Z-az5-prod-regress | 1 | 14 | 0.0 s | ✗ Evaluation error: TypeError: Cannot read properties of null (reading 'checked') |
| az5-prod-unlock | prod-warm-long.json | 2026-09-09T03-06-43-725Z-az5-prod-unlock | 0 | 3 | 1.5 s |  |
| az5-prod-unlock | prod-warm-long.json | 2026-09-09T03-06-45-357Z-az5-prod-unlock | 0 | 3 | 0.2 s |  |
| az5-prod-unlock | prod-unlock-a-design-edit.json | 2026-09-09T03-06-45-644Z-az5-prod-unlock | 0 | 28 | 31.2 s |  |
| az5-native | native-workbench-continue.json | 2026-09-09T03-06-50-226Z-az5-native | 0 | 14 | 5.3 s |  |
| az5-native | native-workbench-verify.json | 2026-09-09T03-06-55-625Z-az5-native | 1 | 10 | 0.0 s | ✗ 10 elements have role "button", but none match name "Sheets". Names seen: "Close Project backups", "Save project backup", "Import backup", "Active ( |
| az5-native | native-unlock-a-design-edit.json | 2026-09-09T03-06-55-792Z-az5-native | 1 | 28 | 50.3 s | ✗ Evaluation error: Error: Roof still present |
| az5-prod-unlock | prod-unlock-b-takeoff.json | 2026-09-09T03-07-16-997Z-az5-prod-unlock | 0 | 25 | 18.9 s |  |
| az5-prod-unlock | prod-unlock-c-price-import.json | 2026-09-09T03-07-36-022Z-az5-prod-unlock | 0 | 24 | 14.3 s |  |
| az5-native | native-unlock-b-takeoff.json | 2026-09-09T03-07-46-218Z-az5-native | 1 | 25 | 60.1 s | ✗ Wait timed out after 60000ms |
| az5-prod-unlock | prod-unlock-d-export.json | 2026-09-09T03-07-50-391Z-az5-prod-unlock | 0 | 23 | 15.7 s |  |
| az5-prod-unlock | prod-unlock-e-render.json | 2026-09-09T03-08-06-208Z-az5-prod-unlock | 0 | 26 | 35.5 s |  |
| az5-native | native-unlock-c-price-import.json | 2026-09-09T03-08-46-443Z-az5-native | 0 | 24 | 35.8 s |  |
| az5-native | native-unlock-d-export.json | 2026-09-09T03-09-22-398Z-az5-native | 1 | 23 | 15.1 s | ✗ Evaluation error: TypeError: Cannot read properties of null (reading 'checked') |
| az5-native | native-unlock-e-render.json | 2026-09-09T03-09-37-630Z-az5-native | 1 | 21 | 0.0 s | ✗ 3 elements have role "button", but none match name "Model". Names seen: "close", "Block", "Allow" |
| az5-native | native-workbench-verify-r2.json | 2026-09-09T03-18-30-593Z-az5-native | 0 | 11 | 0.9 s |  |
| az5-native | native-unlock-a-design-edit-r2.json | 2026-09-09T03-18-31-538Z-az5-native | 1 | 29 | 46.7 s | ✗ Evaluation error: Error: No storey added |
| az5-prod-workbench | prod-warm-long.json | 2026-09-09T03-18-32-655Z-az5-prod-workbench | 0 | 3 | 1.3 s |  |
| az5-prod-workbench | prod-warm-long.json | 2026-09-09T03-18-34-009Z-az5-prod-workbench | 0 | 3 | 0.2 s |  |
| az5-prod-workbench | prod-workbench-desktop.json | 2026-09-09T03-18-34-244Z-az5-prod-workbench | 1 | 29 | 21.1 s | ✗ Evaluation error: Error: Paused after eight assistant steps. Completed actions are retained; send another message to continue. |
| az5-prod-workbench | prod-workbench-continue.json | 2026-09-09T03-18-55-407Z-az5-prod-workbench | 0 | 14 | 4.3 s |  |
| az5-native | native-unlock-b-takeoff-r2.json | 2026-09-09T03-19-18-354Z-az5-native | 0 | 24 | 26.4 s |  |
| az5-native | native-unlock-d-export.json | 2026-09-09T03-19-44-856Z-az5-native | 0 | 23 | 20.3 s |  |
| az5-native | native-unlock-e-render.json | 2026-09-09T03-20-05-269Z-az5-native | 0 | 21 | 19.2 s |  |
| az5-native | native-unlock-a-verify-r2.json | 2026-09-09T03-22-03-227Z-az5-native | 1 | 5 | 0.0 s | ✗ Evaluation error: Error: Architect workspace not mounted |
| az5-native | native-unlock-a-verify-r2.json | 2026-09-09T03-24-12-004Z-az5-native | 0 | 9 | 0.5 s |  |

Total scenario commands: 765. Rows: 40.
