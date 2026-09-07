# Independent Architect3D production acceptance

Passed on 8 September 2026 Australia/Brisbane against the root-provided final production candidate at `http://127.0.0.1:8088/`, in new isolated persistent session `growth-navigation-architect-production`. The associated final source archive identity is `049d8ae830ee3879139f3b686c3fd9f86aac3b0fc2aadaba33a82c67bbff62a2` from `transfer-final.json`; this is not the superseded 527 candidate. Root owns the build/artifact verification chain.

No application changes were made. The labelled Courtyard studio demonstration was created through the UI in this test profile. All tests used the actual production viewer and the declarative agent-browser runner, with no normal installed-app profile or browser-state substitution for the camera.

| Executed run | Runner timestamp on 2026-09-07 UTC | Commands | Elapsed | Result |
|---|---|---:|---:|---|
| Open production, architectural workspace, load demonstration | `14-41-55-823Z` | 10 | 3.13 s | Scene loaded; no errors. |
| Fly | `14-42-14-003Z` | 35 | 4.33 s | Locked capture; all W/S/A/D camera-relative directions; Escape. |
| Walk | `14-42-21-969Z` | 37 | 7.87 s | Actual plan start, arrival, four directions, fixed 1.65 m eye height, Escape. |
| Refused Fly capture | `14-42-43-308Z` | 43 | 4.26 s | Real drag look changed yaw by 0.30 rad; visible fallback hint and Capture mouse; explicit retry made a second refused request; all four movement directions; Escape; real method restored. |
| Refused Walk capture and immediate re-entry | `14-42-50-757Z` | 47 | 7.97 s | Drag fallback, four directions and fixed eye height; real method restored; Fly → Escape → immediate Fly entered locked mode; final Escape. |
| Final cleanup/errors | `14-43-26-126Z` | 3 | 0.03 s | Correct production origin; orbit/none; no owned pointer lock; real capture method restored; 1,408 rendered frames observed. |

The four motion runs total 162 commands; setup and final cleanup bring the executed total to 175. All six runs passed first attempt. Every passing runner has its original report, exact scenario and log under `proof/growth/runner/<date-time>-growth-navigation-architect-production.*`. Motion copies are preserved here as `architect-production-{fly,walk,denied,denied-walk}-{executed.json,report.json}` plus matching `.log` files.

[architect-production-results.json](architect-production-results.json) records actual before/after camera positions, heading, displacement vectors and signed camera-direction dot products. Normal Fly movement distances were 0.700–0.818 m; Walk distances were 0.389–0.397 m. Refused Fly and Walk still passed the same direction assertions. All walk displacement Y components stayed zero. Inputs were DOM keyboard/pointer events handled by the real controller. The assertion waited for rendered telemetry after arrival; no arbitrary sleeps or camera writes were used. Opposing movement directions return near the start, so signed geometry logs establish motion rather than relying on still-image differences.

## Visual evidence inspected

The following separate production images were opened and inspected directly; development captures were preserved:

- `screenshots/growth/nav-architect-production-setup.png`
- `screenshots/growth/nav-architect-production-fly-before.png`
- `screenshots/growth/nav-architect-production-walk-placement.png`
- `screenshots/growth/nav-architect-production-walk-before.png`
- `screenshots/growth/nav-architect-production-capture-refused.png`
- `screenshots/growth/nav-architect-production-denied-walk-before.png`
- `screenshots/growth/nav-architect-production-rapid-reentry.png`

The scene and interior render, placement is readable, active mode is visible, and the fallback button plus instructions are unobstructed after normal workspace scrolling. The placement fixture explicitly identifies free walkthrough. Screenshots from the remaining movement/exit milestones are also captured by the executed scenarios; the list above states exactly which images this independent audit inspected.

Browser error output was empty in setup, all motion runs and cleanup. Console inspection showed one existing THREE.WebGLShadowMap PCFSoftShadowMap deprecation warning, with no uncaught runtime error. Forced refusal was injected only into the test page's canvas request method and removed after the test; the final state assertion verified restoration.

**Scope remains bounded.** This passes the Architect3D production input/recovery regression. R-02 is still partial because movement collision, gravity and stair traversal are not implemented/accepted by these checks. No native package, tablet touch locomotion, phone, macOS/Linux or full industry acceptance follows from this browser run. Root independently owns source-viewer and native gates. The production QA session is released in orbit with the isolated demonstration saved.
