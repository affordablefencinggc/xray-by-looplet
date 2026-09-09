# Owned processes for the 2026-09-09 az4 release stage (run b1117e054a71)

Rule (AGENTS.project.md): record owner, PID, creation time, command, purpose and last activity for every background process this stage launches; stop them at task completion, never later than 10 minutes after last use. This stage never stops processes it does not own.

| Owner | PID | Created | Command / purpose | Last activity | Stopped |
|---|---|---|---|---|---|
| az4 coordinator | (ssh, transient) | 2026-09-09 06:34 | run-pipeline.sh → remote-orchestrator transfer/build/collect on Dans1 (worker.ps1, High/16) | build pipeline | exits with pipeline |

Not owned, never touched: dev server 0.0.0.0:8080 (other chat); agent-browser sessions growth-pencil-production-r4, growth-takeover-final-71f5-mcp, release-report-71f5 (other chat); Dans1 prior runs.
| user (Daniel) | 31164 | 2026-09-09 06:40 | vite dev 127.0.0.1:8091 on the live tree — user-facing preview of SC-08/SC-10 | user browsing | retained for the user; stop on request |
| az4 coordinator | 38112 | 2026-09-08T20:41:07Z (UTC) | node --env-file=.env.local scripts/preview-built.mjs PREVIEW_PORT=8096 (release-b1117e054a71/web-artifacts) — candidate production preview | QA phase | stopped 06:46 via cleanup-owned.ps1 (native graceful, preview Stop-Process) |
| az4 coordinator | 42396 | 2026-09-08T20:43:31.682Z | C:\Users\danie\repo\xray-by-looplet\proof\growth\2026-09-09-az4-release\release-b1117e054a71\artifacts\src-tauri\target\release\xray-by-looplet.exe isolated profile C:\Users\danie\repo\xray-by-looplet\.temp\az4-native-b1117e054a71 CDP 9281 — native QA app (not installed) | QA phase | stopped 06:46 via cleanup-owned.ps1 (native graceful, preview Stop-Process) |
| az4 coordinator | 38112 | 2026-09-09 06:45 | node --env-file=.env.local scripts/preview-built.mjs PREVIEW_PORT=8096 (release-b1117e054a71/web-artifacts) — candidate production preview | QA phase | stopped 06:46 via cleanup-owned.ps1 (native graceful, preview Stop-Process) |
