# Match collapsed bottom bars

Diagnostics and Live assistant share `--workspace-bottom-bar-height`: 38px desktop, 44px coarse-pointer tablet. Diagnostics accounts for its 1px outer border; resize start/minimum/accessibility values follow the shared height. Expanded diagnostics retains its existing behavior.

`code-diff.patch` compares the three changed files with prior build `ece8d5585289`.

DANS1 raw-CDP verification: `dev/result.json` and `production/result.json` each passed 19/19 operations. Measured equal bar heights and aligned top edges, before/after expanding and collapsing, on desktop and touch tablet. Keyboard resizing still expands the drawer. Both desktop and tablet screenshots visually inspected for dev and production; hashes are in result files. No uncaught runtime exceptions.

`completion.json`: typecheck, focused tests and web build passed through the DANS1 worker (High priority, 16 workers). Source SHA-256 `cb57e869a84ff7d1c61290ef41bcfd946e41943de303c3b4f5c926268f0fb528`; remote build `C:\Users\danie\XRayBuilds\runs\cb57e869a84f`.

Cleanup verified zero test listeners. User-facing preview and prior changes preserved. No commit, deployment or native release.
