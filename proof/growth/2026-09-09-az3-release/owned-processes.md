# Owned processes for the 2026-09-09 az3 release stage

Rule (AGENTS.project.md, 2026-09-08): record owner, PID, creation time, command, purpose and last activity for every background process this stage launches; stop them at task completion, never later than 10 minutes after last use. This stage never stops processes it does not own.

| Owner | PID | Created | Command / purpose | Last activity | Stopped |
|---|---|---|---|---|---|
| az3 coordinator | (ssh, transient) | 2026-09-09 01:00 | remote-orchestrator transfer/build/collect on Dans1 (worker.ps1, High/16) | build pipeline | exits with pipeline |

Retained by design (not owned here): dev server 0.0.0.0:8080 PID 44196; user-facing preview 127.0.0.1:8095 PID 51016; Dans1 preview of run 71f5b012342b (PID 8112 on Dans1).
Flagged for their owner (other chat), not touched: agent-browser sessions growth-pencil-production-r4, growth-takeover-final-71f5-mcp, release-report-71f5; native QA app PID 56156 (release 591a4b8b5452, CDP 9273, since 2026-09-08 16:28).
| az3 coordinator | 56200 | 2026-09-08T15:07:28Z (UTC) | node --env-file=.env.local scripts/preview-built.mjs, PREVIEW_PORT=8096, cwd release-5dfc922f097f/web-artifacts — candidate production preview for QA | QA phase | pending |
| az3 coordinator | 75176 | 2026-09-08T15:09:14Z (UTC) | release-5dfc922f097f/artifacts/.../xray-by-looplet.exe, isolated profile .temp/az3-native-5dfc922f097f, CDP 9281 — native QA app (not installed) | QA phase | pending |
| coordinator (resumed chat) | 75176 | 2026-09-08T15:09:14Z | native QA app — last used 15:38:10Z (native-hardened.json) | CloseMainWindow accepted at 15:41:06Z, process still alive after 5 s, force-stopped (`native-cleanup.json`, forced:true). Same open native-shutdown-after-extended-QA issue as 2026-09-08; release promotion held. | 15:41:11Z |
| coordinator (resumed chat) | 56200 | 2026-09-08T15:07:28Z | candidate preview 8096 — last used 15:38Z (hash/build-ID verification) | Stop-Process (no window), exited | 15:41:11Z |

Observed, not owned: user-facing preview 127.0.0.1:8095 (PID 51016) was already gone when the resumed chat started at 15:35Z (not stopped by this stage; no replacement started because the build is not promoted). Dev server 0.0.0.0:8080 is now PID 16328 (started 15:31Z by another chat) and was not touched. agent-browser session az3rel-native-all closed at 15:41Z; `session list` then shows only the other chat's three sessions.
