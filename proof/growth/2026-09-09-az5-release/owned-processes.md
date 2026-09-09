# Owned processes for the 2026-09-09 az5 release stage

Rule (AGENTS.project.md): record owner, PID, creation time, command, purpose and last activity for every background process this stage launches; stop them at task completion, never later than 10 minutes after last use. This stage never stops processes it does not own.

| Owner | PID | Created | Command / purpose | Last activity | Stopped |
|---|---|---|---|---|---|
| az5 coordinator | (ssh, transient) | 2026-09-09 12:58 | run-pipeline.sh → remote-orchestrator transfer/build/collect on Dans1 (worker.ps1, High/16) | build pipeline | exits with pipeline |

Not owned, never touched: dev server 0.0.0.0:8080 (other chat); user-facing dev server 127.0.0.1:8091 PID 31164 (kept for Daniel since 06:40); Dans1 prior runs.
| az5 coordinator | 36720 | 2026-09-09T03:05:05.4177480Z | node --env-file=.env.local scripts/preview-built.mjs PREVIEW_PORT=8096 (release-8e14ac427997/web-artifacts) — candidate production preview | QA phase | pending |
| az5 coordinator | 36592 | 2026-09-09T03:05:38.166Z | C:\Users\danie\repo\xray-by-looplet\proof\growth\2026-09-09-az5-release\release-8e14ac427997\artifacts\src-tauri\target\release\xray-by-looplet.exe isolated profile C:\Users\danie\repo\xray-by-looplet\.temp\az5-native-8e14ac427997 CDP 9281 — native QA app (not installed) | QA phase | pending |
