# Simplified top navigation

Implemented the user's approved refinement in the standalone X-Ray workspace.

- Project bar: Project opens a compact dialog containing drawing selection/Open, New, Rename and Backups. The project name opens Overview. The status describes only the main project record; Settings and account remain at the right.
- Five main workflows: Drawings, Takeoff, Design, Visualise, Estimate. Checks is separated at the right and contains Review issues and Evidence & exports.
- Context navigation exposes only the current workflow's screens. Existing underlying panes, drawing controls, permission guards and keyboard shortcuts remain intact.
- All three rows retain the shared adjustable/collapsible component and original storage keys. The context row's minimum height is 44px for its controls.

## Verification

All execution was on DANS1 through `tonys-test-pc`. Local work was source editing, transfer and reading proof. No provider requests or user project changes were needed: browser contexts used isolated empty projects.

| Gate | Evidence |
| --- | --- |
| Development UI | `dev-final/result.json`: 69/69 raw-CDP operations passed. |
| Production UI | `production-final/result.json`: 72/72 operations passed. |
| Relevant regressions | `regressions.log`: 48 tests passed (shortcuts, workspace panels, backups, project switching). |
| Build | `completion.json`: dependency install, typecheck, focused tests and web build passed using the DANS1 worker, High priority, 16 workers. |
| Cleanup | `cleanup-final.json`, `cleanup-verification.json`: task processes stopped; zero test listeners remain. User-facing local preview and unrelated sessions retained. |

Browser checks covered every workflow and secondary screen, opening the Project dialog, actual rename/save/reload, opening/closing Backups, project-name Overview navigation, the Measure keyboard shortcut, and independent resize/collapse/reload restoration of all three rows. Main menus were checked for horizontal overflow at 1024×768 and 768×1024 tablet sizes. Runtime exception collection was empty. Final desktop and tablet screenshots and the compact Project dialog were visually inspected; screenshot hashes are included in result files.

The preview carries no AI credentials, so its assistant connection indicator is expected to be unavailable. This task qualifies navigation, not AI availability, native packages or imported drawing operations.

Build source SHA-256: `1140a237ea846f905995413227b939a2473d132be9d02a3aa03636126d9a658f`.
Remote build: `C:\Users\danie\XRayBuilds\runs\1140a237ea84`.
Remote test evidence: `C:\Users\danie\XRayBuilds\navigation-20260911`.

Changed product files: `src/studio/Studio.tsx`, `src/studio/WorkflowNavigation.tsx`, `src/studio/workflowNavigation.css`. Earlier chat fixes and unrelated runtime logs were preserved. No commit, push, deployment or native release performed.
