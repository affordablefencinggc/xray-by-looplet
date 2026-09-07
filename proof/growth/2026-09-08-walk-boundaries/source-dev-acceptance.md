# Source walking boundaries — development acceptance

Executed 8 September 2026 AEST in the isolated `growth-navigation-dev` Windows Chromium session at 1440 × 1000. Final scenario `walk-boundaries-dev-04.json` passed **85 commands in 24.717 seconds**, exit 0. Exact runner: `proof/growth/runner/2026-09-07T15-39-24-998Z-growth-navigation-dev.json`; saved scenario SHA-256 `95874929aa3a6f5694b7dbcba9875c333c419e02585f73d5fbab0ad42f55aee6`. The adjacent `.log` and `.scenario.json` preserve the executed sequence.

| Check | Measured result |
| --- | --- |
| Closed lounge bifold blocks forward walking | Feet approximately −0.027474 / 0.015 / 3.049742 m. |
| Body too near the opening sweep | Step-back request appears; the journey backs away before opening. This is expected physical clearance. |
| E opens the door | Visible reach animation and disabled Opening action; actual door progress reaches 1. |
| Walk onto the terrace | Feet approximately −0.027474 / −0.070 / 4.218993 m, eye Y 1.580 m. The floor drops 85 mm. |
| Close from the terrace | Visible button closes the leaf; renewed forward motion stops at Z 3.600810 m. |
| Reopen and return across threshold | Feet return to Y 0.015 m, Z 2.251606 m. Narrow fixed threshold and finish details remain physical geometry. |
| Actual 18-tread stair ascent | Feet approximately −6.205718 / 3.120 / −2.120311 m. |
| Stair return | Reverse walking reaches the lower landing with the floor-height predicate satisfied. |
| Exit and controls | Escape returns to Orbit. Five lower navigation controls remain visible; the original top view controls remain present. |

Inputs operate the actual picker, drag look, keyboard events and door button. Completion predicates inspect rendered frames, authoritative feet, camera height and actual door state. The test does not teleport the camera or modify model geometry. It deliberately exercises drag fallback in an isolated browser and restores the original pointer-lock method afterward.

Visual inspection: root inspected `walk-boundaries-dev-04-slide-open.png`, `terrace-stepdown.png`, `stairs-upper.png`, and `stairs-return.png`. The sheet/collision agent inspected the same prefix with `reach.png`, `closed-from-terrace.png`, `threshold-return.png`, and `controls.png`. The reach hand, busy/open action, keyboard hint and navigation hint are legible; the hint clears the assistant and the reserved bottom dock. The threshold-return image shows the interior floor and opposite wall. Close door images alone cannot establish collision; executed displacement telemetry supplies that proof.

The final journey's fresh runtime event monitor reports no newly observed errors. Its final CLI `errors` output still contains three historical blank entries, so an empty accumulated collector is **not** claimed. Earlier scenarios 01/02/03 and logs remain intact: initial HMR/transient state, an overly strict prompt assertion, and an attempt to open without first stepping clear were corrected in the test journey. Do not describe all prior failed attempts as product fixes.

Independent geometry regression `source-integration.mts` preserves source hashes and checks prepared source door assemblies, closed/open/reset passage in both directions, 100 separate movement frames each way, terrace support, and real source stairs. Synthetic landings appear only in the separately named isolated stair unit test, never as proof of the complete model connection. Eleven collision unit tests cover thin walls, sliding/corners, transformed doors, windows, ceilings, thick solids, 300/310 mm limits, fine finish details and unsupported gaps. `focused-tests-02.log` records 45 passing focused tests across the navigation slice. Architectural-viewer development acceptance is recorded separately in `architect-acceptance.md` (104 commands).

The 15-file scoped snapshot is `proof/growth/2026-09-08-08-walk-boundaries-source/`; scope SHA-256 `47df19d2548b7bcb0d3d3afaba25d0904eb2bccb74d9335293ca49558ce5110c`. Its `code.diff` and source manifest identify the reviewed changes.

Limits: R-02 remains partial at the full catalogue level. The actual Redburn stair ends around Z −2.405 m while the upper walkway starts around Z −3.325 m: approximately 0.92 m of missing support. Walking stops at that gap; no floor is invented. Door operation is a view-only inferred presentation behavior, including a sliding approximation of the bifold. This does not establish engineering accuracy, compliant access, all-model compatibility, physical tablet testing or native macOS/Linux support. Normal project data, original model/PDF bytes and CRM code remain untouched by these checks. Production and Windows-native release acceptance must be added separately before Stage 08 is finalized.
