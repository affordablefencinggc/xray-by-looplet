# Architect walking boundaries — development acceptance

Executed 8 September 2026 AEST in the existing isolated `growth-navigation-architect` browser, development app at 8080, Windows Chromium, 1440 × 1000. No normal user profile, application source, packages, CRM, production build, or repository staging was changed by this QA task.

Final combined run: **104 commands passed in 20.9405 seconds**, exit 0. Exact runner ID: `2026-09-07T15-29-50-344Z-growth-navigation-architect`. Scenario SHA256: `fb2c1bf502700f82e1d97a39d9b951bf58435a9ede66535257b98c7525de65b9`. Local exact copies: `architect-final-executed.json`, `architect-final-report.json`, and `architect-final.log`. Fresh browser `error` and `unhandledrejection` event monitor remained empty for the complete final journey; the final console output was empty.

The saved Courtyard studio demonstration has a supported slab x0–9/z0–6 metres. Internal door D02 is centred at x6/z3, width 0.87 m. Exterior D01 is centred x4.5/z6, width 1.8 m; there is no modelled slab beyond it, so that exterior opening is deliberately not used to claim supported passage. Window W01 is centred x3/z0, width 2.4 m, sill 1 m.

| Check | Actual result |
| --- | --- |
| Internal closed door blocks held W | Feet x5.711269/z2.990164; `navigationBlocked=true` for 12 consecutive observed frames. |
| Nearby door prompt | Visible Open door button and E hint while facing D02 from the supported studio floor. |
| E opens the leaf | Actual keydown/keyup, busy-state reach screenshot, progress reaches 1; feet remain identical throughout the opening animation. |
| Walk through opened door | Feet cross wall plane to x6.520756; blocked=false, eye 1.65 m above authoritative feet. |
| Visible button opens door | A new walking entry resets the door; Open door: Door click animates the leaf, then held W reaches x6.521527. |
| Window boundary | Feet stop at z0.398051, blocked=true for 12 consecutive frames. |
| Solid wall boundary | Feet stop at x0.399061, blocked=true for 12 consecutive frames. |
| Unsupported start | Picker click outside the slab produces the supported-landing alert, remains in Orbit, and preserves prior camera within 0.000001 m. |
| Free Fly | Actual forward flight crosses the building to z−1.060401, no walking feet, blocked=false. Separate first attempt recorded full route from [12.636,1.896,13.196] to [1.248,1.896,−1.075]. |
| Escape | All walking and flight segments return to Orbit; pointer capture method restored at completion. |

The input route uses actual SVG picker clicks, drag look, keyboard events reaching the real controller, and requestAnimationFrame predicates against camera/feet telemetry. No camera or model position is assigned by the test. Pointer-lock refusal is deliberately injected into this isolated session to exercise supported drag fallback; the real method is restored afterward. Browser coordinate rounding produces picker locations near the requested coordinates, and actual measured values are retained above. Movement watches have safety deadlines that release held keys; completion depends on geometry and frame predicates, never arbitrary sleeps.

Visual inspection covered these actual final screenshots under `screenshots/growth/`:

- `walk-boundaries-architect-door-prompt-attempt2.png`
- `walk-boundaries-architect-door-closed-block-attempt2.png`
- `walk-boundaries-architect-door-reach-attempt2.png`
- `walk-boundaries-architect-door-open-attempt2.png`
- `walk-boundaries-architect-door-through-attempt2.png`
- `walk-boundaries-architect-door-button-reach-attempt2.png`
- `walk-boundaries-architect-door-button-through-attempt2.png`
- `walk-boundaries-architect-wall-block-attempt2.png`
- `walk-boundaries-architect-invalid-start-attempt2.png`
- `walk-boundaries-architect-fly-escape-attempt2.png`

The prompt, button, hand reach animation, disabled busy action, navigation controls, and invalid-start message are legible and unobstructed. Close wall/door views naturally fill the small model panel with the approached material; displacement telemetry supplies the physical proof that a static image cannot. Also inspected the first-attempt window-block and Fly-through-building images; final corresponding files are preserved separately.

Retained failures and limits:

- Setup attempt1 stopped at reload with a connection-read timeout while the development application was temporarily blank during parallel module/HMR edits. Console history showed missing-module/dynamic-route failures. It recovered without app edits or server restart; setup attempt2 passed 11 commands. Diagnostic and original logs remain intact.
- Solids attempt1 passed wall/window checks and showed the correct invalid-start alert, then failed a test-only exact camera string comparison. Actual Z differed by approximately 9e−16 m. Final proof uses the stated numerical tolerance; no product change was required.
- The CLI page-error collector retained three blank historical entries even after its clear command. Therefore this report does not claim that collector was empty. Fresh runtime event monitoring and the final console are the evidence for this journey's zero new runtime errors.
- Final combined Fly starts its first telemetry sample before the next renderer frame; that sample is not used to claim flight origin. The separate passing Fly attempt provides the origin above, and both runs verify the destination beyond the building and unrestricted behavior.
- This acceptance concerns the authored Courtyard fixture in development. It does not certify every model, stair arrangement, collision shape, browser, production/native release, tablet, Mac, or Linux. Door closing/sweep safety and source-model stairs are covered by other owners, not claimed here.

Session is released in Orbit with the original pointer-lock method restored. No further code changes requested by these results.
