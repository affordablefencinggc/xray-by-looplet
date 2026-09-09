# Owned processes for the 2026-09-09 assistant-surface stage (SC-14 rail mode, SC-15 canvas right-click menu, SC-16 context guard + rich replies, SC-17 showcase)

Rule (AGENTS.project.md): record owner, PID, creation time, command, purpose and last activity for every background process this stage launches; stop them at task completion, never later than 10 minutes after last use, through an identity-checked script. Never touch processes this stage does not own.

| Owner | PID | Created | Command / purpose | Last activity | Stopped |
|---|---|---|---|---|---|
| assistant-surface coordinator | 58316 | 2026-09-09 13:39 | node scripts/with-app-env.mjs vite dev … (direct launch; vite not on PATH) | exited immediately | exited on its own (dev-8091.stderr.log) |
| assistant-surface coordinator | 44588 (cmd) → 57888 (node, listener) | 2026-09-09 13:40:42 | `npm run dev -- --host 127.0.0.1 --port 8091 --strictPort` — dev server on the live tree for the SC-14..SC-17 Fast CDP proofs and for Daniel's demos | proof runs | kept up for Daniel unless he says otherwise (dev-launch.json) |
| agent-browser sessions | surface-fixture, surface-desktop, surface-tablet, showcase-desktop | 2026-09-09 13:45+ | isolated profiles for the proofs | proof runs | closed at stage end |

Not owned, never touched: dev server 0.0.0.0:8080 (other chat, PID 3628).
| agent-browser sessions | az5-native, permissions-desktop(-2), projects-desktop, render-desktop(-2/-3/-5), render-tablet, showcase-desktop-2/-3 | various | isolated browser profiles for the proofs | proofs finished | closed 2026-09-09 15:15 through `agent-browser --session <name> close` (eleven sessions; the daemon had become unresponsive under the load — two proofs timed out at 15:11) |
| agent-browser sessions | render-desktop(-2..-5), render-tablet, permissions-desktop(-2/-3), perm-tail(-2), projects-desktop(-2), modelmode-desktop(-2/-3), showcase-desktop-3 | 2026-09-09 14:45–15:44 | isolated profiles for the SC-18/19/20/21 proofs | proofs finished | all closed 2026-09-09 15:52; verified no `agent-browser-win32-x64` process remains |

Still up by request: the user-facing dev server 127.0.0.1:8091 (node PID 57888, launched via cmd 44588) — healthy, HTTP 200. The other chat's 0.0.0.0:8080 (PID 45792) was never touched.
