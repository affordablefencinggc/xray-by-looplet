# Walkthrough polish — complete source development journey

**Pass: 158 commands in 29.599816 seconds, exit 0.** Executed 8 September 2026 AEST in the released isolated `growth-navigation-dev` session at 1440 × 1000. This is development acceptance for the bounded source journey, not production/native or full R-02 acceptance.

Runner: `proof/growth/runner/2026-09-07T16-15-26-130Z-growth-navigation-dev.json`, with adjacent `.log` and exact `.scenario.json`. Executed scenario SHA-256: `c7ee70b3241c8765e8e84786d15094228bd5f8977e6dd86c55e7888425a19b4c`. Prepared scenario: `walkthrough-polish-candidate2-dev02-source.json`. The corresponding new native scenario is `walkthrough-polish-candidate2-dev02-native.json` (183 commands), prepared but not executed by this task.

The preceding source run at `16-14-06-218Z` failed a test-only post-screenshot timing assertion. The actual captured arm was visible; screenshot-tool latency advanced animation beyond 0.6 before the next command. No application change was made for this correction. The new test still requires ready asset, camera-body anchor, visible arm and opening progress 0.2–0.6 immediately before capture. It records post-capture telemetry without requiring the animation to remain frozen. Both the original failure and the new successful evidence remain preserved.

In this run, arm/door progress before capture was **0.398**, frame 6696, asset ready and anchor camera-body. After capture it was **0.714**, frame 6704, still visible. The actual `reach.png` was inspected: a textured forearm enters continuously from the lower-right canvas edge, with its hand reaching into the scene. The prompt, movement hint and bottom controls remain legible. The test does not claim that the screenshot itself was taken at exactly 0.398; these measurements bracket the capture. The arm is absent once the door is open.

| Flow | Actual result |
| --- | --- |
| SVG source placement | Requested world [0, 2.1] m; actual pointer-rounded point [−0.000285263, 2.073573484] m. Exact picker title, Close target and reachable 44 px Start action verified. |
| Closed door | Forward motion stops at Z 3.048488241 m; step-back recovery is shown before opening. |
| Open door and terrace | Feet reach [−0.000285263, −0.070000000, 4.232394241] m; camera Y 1.5799999997 m. |
| Display changes | Open door pose remains open through Wireframe and roof visibility changes. |
| Outside closed boundary | After closing from the terrace, forward motion stops at Z 3.600997295 m. |
| Reopen and return | Feet return to interior finish Y 0.0149999997 m, Z 2.372407995 m. |
| Safer stair fixture | Requested world [−6.2, 2.8] m; actual point [−6.228842341, 2.799230619] m. |
| Actual source stairs | Ascent reaches [−6.228842341, 3.119999886, −2.136408818] m; reverse traversal returns to the lower landing. |
| Fly and exit | Real W/S/A/D displacement checks pass; Escape returns to Orbit and releases captured input. |
| Bottom controls | Front, Rear, Reset, Zoom in and Zoom out each change the actual camera. |

All **16** screenshots with prefix `screenshots/growth/walkthrough-polish-candidate2-dev02-source-` were visually inspected: `slide-before`, `closed-door-block`, `reach`, `slide-open`, `open-wireframe`, `terrace-stepdown`, `closed-from-terrace`, `threshold-return`, `stairs-before`, `stairs-upper`, `stairs-return`, `controls`, `fly-before`, `fly-moved`, `fly-escaped`, and `final-controls`. Movement verification comes from recorded feet/camera data; a single exterior frame is not used to prove motion.

The fresh runtime error monitor stayed empty. The CLI's accumulated error collector still prints five historical blank entries; this is not described as an empty collector. No application source, model/PDF bytes, normal user profile or CRM code was modified during this rerun. The original pointer-capture function was restored and the session is released in Orbit.

Remaining scope: the real ~0.92 m unsupported upper stair connection is still blocked, inferred door styles are presentation approximations, and this run does not establish production/native, physical tablet, Mac/Linux-native, engineering or whole-catalogue acceptance. Separate picker/overlay tablet evidence is owned by the coverage agent. A new built candidate still requires its full journeys.
