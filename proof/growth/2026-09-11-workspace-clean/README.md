# Drawings workspace cleanup

User approved the next refinement with “go”. Changes build on the navigation/card removal verified in build `09d7372f5f65`.

- Empty Drawings has one Open drawing action; removed the empty sheet register, duplicate introductory heading, instructional steps and empty sidebars.
- Loaded Drawings retains the source preview and drawing-only left sidebar. Sheet administration is available under Manage sheets. Model navigation and evidence counters no longer clutter that sidebar.
- The generic Model readiness sidebar is now confined to Checks / Review issues. Dedicated component, cost and proof inspectors remain. The model viewer retains its own controls; the generic drawing sidebar no longer appears in Renders.
- The collapsed bottom bar exposes one Diagnostics button. Expanding it reveals Logs, Console, Errors and Status; capture, keyboard controls and resizing remain. The collapsed button is aligned left to avoid the assistant strip covering it.

## Evidence

`code-diff.patch` compares the three changed files with the previous immutable build. Product files: `Studio.tsx`, `WorkspaceDiagnostics.tsx`, `workflowNavigation.css`.

All execution on **DANS1** via `tonys-test-pc`; test root `C:\Users\danie\XRayBuilds\workspace-clean-20260911`. Isolated browser contexts, no user project mutations or provider calls. The SVG fixture is explicitly a test drawing. The final harness intercepts the native file chooser's click and supplies a File through the real input/change/import path; it does not test the operating system's chooser UI.

| Gate | Result |
| --- | --- |
| `chooser-verified/result.json` | Dev: 32/32 raw-CDP operations passed. |
| `production/result.json` | Built output: 32/32 operations passed. |
| `regressions.log` | 37 tests passed: document preview, sheet lifecycle, workspace panels and shortcuts. |
| `completion.json` | Dependency install, typecheck, focused tests and web build passed through the DANS1 worker, High priority / 16 workers. |
| `cleanup-verification.json` | Zero task test listeners remain. |

Browser checks cover a single empty-state action, hidden diagnostic tabs until expanded, Logs switching, readiness retained in Checks, actual SVG import, drawing-only controls, Manage sheets, persisted source after reload and the assistant opening. Desktop and tablet screenshots were visually inspected in both dev and production; hashes are in the result files. No uncaught runtime exceptions. Production has no AI credentials, so the assistant connection notice is expected.

Earlier harness attempts used a case-sensitive rendered-text check and an un-intercepted headless file chooser; they timed out. Final results above supersede those attempts. No product failure is concealed by changing the assertions: final checks use the actual heading text and real file-input change handler.

Build `C:\Users\danie\XRayBuilds\runs\ece8d5585289`, source SHA-256 `ece8d5585289795b7940860d3c18b0045ece111c04cdc303a90ac9e4d9caf684`. Task-owned servers/browser were stopped with identity checks; user preview and unrelated sessions retained. No commit, deployment or native release performed.
