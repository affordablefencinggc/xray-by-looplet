# az4 QA runs (run b1117e054a71)

| Session | Scenario | Runner report (proof/growth/runner/…) | Exit | Cmds | Time | First ✗ |
|---|---|---|---|---|---|---|
| az4-prod-regress | prod-warm-long.json | 2026-09-08T20-43-28-045Z-az4-prod-regress | 0 | 3 | 1.8 s |  |
| az4-prod-regress | prod-warm-long.json | 2026-09-08T20-43-29-982Z-az4-prod-regress | 0 | 3 | 0.2 s |  |
| az4-prod-regress | prod-warm.json | 2026-09-08T20-43-30-224Z-az4-prod-regress | 0 | 6 | 0.2 s |  |
| az4-prod-regress | prod-saves-1.json | 2026-09-08T20-43-30-466Z-az4-prod-regress | 0 | 30 | 0.8 s |  |
| az4-prod-regress | prod-sheets-scenario-0-import.json | 2026-09-08T20-43-31-312Z-az4-prod-regress | 0 | 12 | 1.1 s |  |
| az4-prod-regress | prod-sheets-scenario-a-rename-desktop.json | 2026-09-08T20-43-32-488Z-az4-prod-regress | 0 | 32 | 1.8 s |  |
| az4-prod-regress | production-hardened-layout.json | 2026-09-08T20-43-34-413Z-az4-prod-regress | 0 | 34 | 0.9 s |  |
| az4-prod-regress | production-hardened-guards.json | 2026-09-08T20-43-35-379Z-az4-prod-regress | 0 | 28 | 0.8 s |  |
| az4-prod-regress | prod-pricing-a-desktop.json | 2026-09-08T20-43-36-260Z-az4-prod-regress | 0 | 22 | 0.9 s |  |
| az4-prod-assist | prod-warm-long.json | 2026-09-08T20-43-37-233Z-az4-prod-assist | 0 | 3 | 1.2 s |  |
| az4-prod-assist | prod-warm-long.json | 2026-09-08T20-43-38-513Z-az4-prod-assist | 0 | 3 | 0.2 s |  |
| az4-prod-assist | prod-wireframe-desktop.json | 2026-09-08T20-43-38-733Z-az4-prod-assist | 0 | 37 | 21.5 s |  |
| az4-native | native-saves-1.json | 2026-09-08T20-43-54-399Z-az4-native | 0 | 29 | 1.3 s |  |
| az4-native | native-sheets-0-import.json | 2026-09-08T20-43-55-809Z-az4-native | 0 | 11 | 1.2 s |  |
| az4-native | native-sheets-a-rename.json | 2026-09-08T20-43-57-091Z-az4-native | 0 | 31 | 2.0 s |  |
| az4-native | native-hardened.json | 2026-09-08T20-43-59-198Z-az4-native | 0 | 21 | 0.5 s |  |
| az4-native | native-wireframe.json | 2026-09-08T20-43-59-774Z-az4-native | 0 | 36 | 25.6 s |  |
| az4-prod-assist | prod-wireframe-tablet.json | 2026-09-08T20-44-00-279Z-az4-prod-assist | 0 | 23 | 33.6 s |  |
| az4-native | native-wireframe-undo.json | 2026-09-08T20-44-25-478Z-az4-native | 0 | 22 | 24.5 s |  |
| az4-prod-assist | prod-workbench-desktop.json | 2026-09-08T20-44-33-977Z-az4-prod-assist | 1 | 29 | 16.0 s | ✗ Evaluation error: Error: Paused after eight assistant steps. Completed actions are retained; send another message to continue. |
| az4-prod-assist | prod-workbench-continue.json | 2026-09-08T20-44-50-014Z-az4-prod-assist | 0 | 14 | 4.5 s |  |
| az4-native | native-workbench.json | 2026-09-08T20-44-50-045Z-az4-native | 1 | 28 | 0.4 s | ✗ 54 elements have role "button", but none match name "Open Redburn BR250157 plan in 3D". Names seen: "Live assistant", "Backups", "Settings", "Log in", "Collap |
| az4-native | native-workbench-continue.json | 2026-09-08T20-44-50-550Z-az4-native | 1 | 14 | 0.1 s | ✗ Evaluation error: TypeError: Cannot read properties of null (reading 'checked') |
| az4-native | native-workbench.json | 2026-09-08T20-45-24-541Z-az4-native | 1 | 24 | 21.0 s | ✗ Evaluation error: Error: Paused after eight assistant steps. Completed actions are retained; send another message to continue. |
| az4-native | native-workbench-continue.json | 2026-09-08T20-45-45-644Z-az4-native | 1 | 14 | 28.2 s | ✗ Wait timed out after 25000ms |
| az4-native | native-workbench-verify.json | 2026-09-08T20-46-32-862Z-az4-native | 1 | 10 | 0.5 s | ✗ 10 elements have role "button", but none match name "Close". Names seen: "Close Project backups", "Save project backup", "Import backup", "Active (1)", "Archi |

Total scenario commands: 519.
