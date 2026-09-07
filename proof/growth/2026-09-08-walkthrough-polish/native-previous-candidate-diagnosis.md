# Superseded candidate 197 — native fixture diagnosis

This diagnosis preserves candidate 197 and its failed original 169-command native run. It does not sign off the forthcoming walkthrough polish or its new body-based arm.

Original failure: `proof/growth/runner/2026-09-07T15-45-45-835Z-growth-boundaries-native.log`. Door opening, terrace stepdown, closing, reopening and threshold return had passed; the next floor-picker click was rejected and the wait for a valid start timed out. The actual visible message was: “Move farther from the floor edge or step. The previous start is retained; select a clear point before continuing.”

Read-only native measurement reproduced the cause. The scripted stair point x−6.2/z2.6 mapped to requested client x602.896445/y656.561971. The native `MouseEvent` stored integer client x602/y656, corresponding to model x−6.246035856/z2.571179431. `assessWalkStart` rejects that actual point with the same edge message, while the exact requested point passes. This is a test fixture placed too close to a support edge, not an application geometry or controller defect. Evidence: `native-pixel-diagnostic.json`, runner `15-51-55-856Z-growth-polish-native-diagnostic`, and `native-start-assessment.json`.

Recovery changed only the test's requested stair landing z from 2.6 to 2.8 (logical plan y265.13142857142856 instead of y261.5657142857143). It resumed from the already open native picker and passed **76 commands in 16.190932 seconds**, exit0: valid placement, ascent, descent, Fly, Escape and five bottom camera actions. Actual upper feet were [−6.246035856,3.119999886,−2.136926783]. Exact recovery runner: `2026-09-07T15-53-06-678Z-growth-polish-native-diagnostic`; scenario SHA256 `38a540b52c46bced62f66ec03b03f8cc724a3c557195ebb400e6ca4b2be5b342`. Original failure remains unchanged; recovery is not mislabeled as a complete fresh 169-command pass.

Inspected actual screenshots:

- `screenshots/growth/walkthrough-polish-native-diagnostic-before.png` — rejected start message shown and continuation disabled.
- `screenshots/growth/walkthrough-polish-native-stairs-recovery-stairs-before.png` — supported exterior stair foot, actual first-person view.
- `screenshots/growth/walkthrough-polish-native-stairs-recovery-stairs-upper.png` — upper stair arrival.
- `screenshots/growth/walkthrough-polish-native-stairs-recovery-stairs-return.png` — return to stair foot.

The verified isolated native process PID71092 was then closed normally with `CloseMainWindow`: request accepted and exited, no forced termination. PID executable path and SHA256 were matched to the original QA launch record immediately before closing. Exact record: `native-previous-candidate-close.json`. Normal installation/profile was untouched.

Future native journey fixtures should choose points safely inside support boundaries and retain their actual selected coordinates. The forthcoming picker layout may use a different projection, so these old plan pixels must not be reused blindly.
