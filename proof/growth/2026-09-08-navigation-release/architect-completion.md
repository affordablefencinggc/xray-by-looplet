# Architect3D development navigation proof

Actual browser QA completed 2026-09-08 Australia/Brisbane in isolated persistent session `growth-navigation-architect`, using `scripts/fast-cdp-test.mjs` declarative agent-browser batches. No Playwright script, normal installed-app profile, build, git operation or application source edit was used in this QA task.

## Executed acceptance

- Fly: 33 commands passed, 4.07 seconds. Real pointer lock, nonzero yaw, all W/S/A/D camera displacements in the correct camera-relative direction, then Escape to orbit.
- Walk: 35 commands passed, 7.83 seconds. Actual plan placement, animated arrival, all W/S/A/D signed displacements, constant 1.65 m eye height above the selected ground floor, then Escape.
- Capture refusal / Fly: 41 commands passed, 4.08 seconds. Page-local requestPointerLock override rejected the request. Active mode remained fly/drag. Drag input changed actual yaw by 0.30 radians. Capture mouse and the drag hint were visible; clicking retry invoked a second request. All four movement directions and Escape passed. The real capture method was restored.
- Capture refusal / Walk and rapid re-entry: 47 commands passed, 8.15 seconds. Refused capture still allowed selected placement, arrival, drag look, all four movement directions and fixed eye height. After restoring the real capture method, Fly → Escape → immediate Fly succeeded with locked capture; final Escape returned to orbit.

`architect-results.json` records actual camera positions, displacement vectors, heading, capture state and signed camera-direction dot products from every successful run. `architect-dev-*-executed.json` are the exact executed scenarios, paired with logs and runner reports. The current reusable scenarios include the later readiness improvement and may have two more commands than an earlier executed copy. All movement assertions use camera values emitted by the rendered scene, not synthetic model coordinates or private camera mutation. Inputs are DOM KeyboardEvent/PointerEvent events handled by the real controller. Opposing movement directions deliberately return close to the starting location; before/after screenshots alone are not the movement proof.

## Screenshots inspected directly

Under `screenshots/growth/`:

- `2026-09-08-architect-before.png`
- `2026-09-08-architect-fly-before.png`, `-fly-moved.png`, `-fly-escaped.png`
- `2026-09-08-architect-walk-placement.png`, `-walk-before.png`, `-walk-moved.png`
- `2026-09-08-architect-capture-refused.png`
- `2026-09-08-architect-denied-before.png`, `-denied-escaped.png`
- `2026-09-08-architect-denied-walk-before.png`, `-denied-walk-moved.png`, `-denied-walk-escaped.png`
- `2026-09-08-architect-rapid-reentry.png`

The demonstration scene renders, walk shows the interior at eye height, mode controls remain visible, and the Capture mouse fallback control and movement instructions are readable after a normal workspace scroll. The assistant does not cover those controls. Screenshots are desktop browser evidence, not tablet/native acceptance.

## Initial failures and limits

The first Sketch selection opened Source annotations; QA selected Architectural workspace next. Its layout automatically hides the side menu controls, so an attempted Collapse left menu step was removed from the test. Root confirmed a package edit caused a full development reload between Fly and the first Walk attempt; the saved demonstration reopened successfully. These are retained runner records, not hidden passing runs.

The additional refused-Walk run initially sampled prior-mode yaw during the single frame between arrival becoming idle and the next navigation telemetry update. The movement proof stopped before driving a key. The shared proof generator now waits for one observed rendered frame after idle, and the full refused-Walk flow passed. `architect-denied-walk-initial.log` preserves that failed assertion. No application change was required.

Browser error output was empty in the passing flows. Console inspection found only the existing THREE.WebGLShadowMap PCFSoftShadowMap deprecation warning (plus Vite/devtools informational messages), not an uncaught runtime error. Test data is the labelled Courtyard studio demonstration, not a supplied drawing or a verified construction model. These checks do not establish collision, gravity, stairs, tablet touch locomotion or native packaging acceptance. Root owns production/native gates.

The QA session is released in orbit with its real requestPointerLock method restored. The isolated demonstration remains saved for reproduction.
