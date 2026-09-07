# Bounded navigation development acceptance — 8 September 2026

Development acceptance passes for the executed walk/fly input, start placement, capture recovery and control-reachability checks below. **R-02 remains partial:** this is free walkthrough, with no movement collision, gravity or stair traversal acceptance. Validating the starting floor and eye height does not establish collision during movement.

The root agent exercised the source model in `growth-navigation-dev`; the navigation agent independently exercised Architect3D in `growth-navigation-architect`. Both used the actual development application, persistent isolated agent-browser sessions and declarative batches through `scripts/fast-cdp-test.mjs`. Camera position, yaw, pitch, speed, capture state and rendered-frame telemetry came from the real viewer. DOM keyboard/pointer input drove the real controller; tests did not manufacture camera coordinates. No phone, normal installed-app profile or CRM testing is included.

## Executed source-viewer acceptance

Each runner stem below is under `proof/growth/runner/` and has its original `.json` report, immutable `.scenario.json` command copy and `.log` output.

| Check | Runner stem | Commands / elapsed | Observed result |
|---|---|---|---|
| Ground walk | `2026-09-07T14-26-52-253Z-growth-navigation-dev` | 30 / 6.13 s | Locked capture; W/S/A/D moved in the expected camera-relative directions at nonzero yaw; movement settled and Escape exited. Eye height was 1.665 m, reflecting the actual supporting surface plus 1.65 m. |
| Upper-floor refused capture | `2026-09-07T14-29-22-399Z-growth-navigation-dev` | 30 / 6.04 s | Drag fallback remained functional; all four movement directions passed at upper eye height 4.785 m; Escape exited. Setup was separately exercised in the passing `14-29-06-884Z` upper-fallback batch. |
| Combined final source journey | `2026-09-07T14-30-29-254Z-growth-navigation-dev` | 83 / 13.01 s | Refused Fly capture, actual drag yaw change, restoration of the real capture API, successful Capture mouse retry, Fly W/S/A/D and Escape; unsupported walk placement refused; a recommended ground start accepted; ground W/S/A/D and Escape; reset view plus centre-hit-test reachability of top Fly/Walk and all five bottom buttons. |
| Final tablet reachability | `2026-09-07T14-35-52-940Z-growth-navigation-dev` | 26 / 2.16 s | At 1024×768 and 768×1024, seven tested top/bottom buttons were in view, hit-test reachable and at least 44×44 CSS px; no page overflow. Suggested starts were at least 44 px high. The enabled Start action was reachable by scrolling inside the dialog. |

The tablet batch checks layout, controls and dialog reachability. It opens/closes the picker and verifies the start action; it does **not** click Start in both orientations or establish physical touch locomotion. Root inspected its final landscape/portrait screenshots. The selected suggestion title was visibly corrected to dark text (`rgb(28, 24, 18)`) on the light selected background (`rgb(223, 226, 225)`).

## Executed independent Architect3D acceptance

See [architect-completion.md](architect-completion.md) and [architect-results.json](architect-results.json) for detailed camera measurements, exact executed scenarios, reports and inspected image paths.

| Check | Runner timestamp | Commands / elapsed | Observed result |
|---|---|---|---|
| Fly with normal capture | `14-27-30-689Z` | 33 / 4.07 s | Locked; four signed camera-relative displacements of approximately 0.815–0.817 m; Escape. |
| Walk with normal capture | `14-28-33-842Z` | 35 / 7.83 s | Actual plan placement and arrival; four correct directions; fixed 1.65 m eye height; Escape. |
| Refused Fly capture | `14-29-17-265Z` | 41 / 4.08 s | Drag changed actual yaw by 0.30 rad; visible Capture mouse and drag hint; second explicit retry request; four correct directions; Escape; real API restored. |
| Refused Walk capture and rapid re-entry | `14-32-10-348Z` | 47 / 8.15 s | Drag look and four correct directions at fixed eye height; real capture API restored; immediate Fly → Escape → Fly returned with locked capture; final Escape returned to orbit. |

These four passing architect runs contain 156 commands. Their before/moved/exit images were visually inspected: the model renders, the walk view shows the interior, and fallback/retry controls and instructions are readable after ordinary workspace scrolling. The fixture is the labelled Courtyard studio demonstration, not a supplied source drawing. Opposing moves return close to the start; signed camera displacement logs, not still-image differences alone, establish direction.

## Tests, corrected defects and preserved failures

- `navigation-tests.log` records 15 passing controller/placement tests; `typecheck.log` records passing TypeScript checking. These are the bounded local checks, not a claim that production/native gates have finished.
- The controller tests cover capture denial, missing/event-only APIs, stale rejection/grant after stop or disposal, rapid re-entry, pointer cancellation, editable focus/blur, selected yaw, actual camera-relative movement signs, fly vertical input and arrival. Placement tests cover supporting geometry, obstacles, invalid/unsupported positions and real step-down elevation.
- Tablet QA exposed a **pre-existing undersized Fly control**. The 44 px target correction was made before final tablet acceptance. Initial `14-31-30-767Z` and `14-32-37-689Z` logs remain failures; they are not relabelled as passes.
- Initial Start reachability assertions (`14-33-57-561Z`, `14-34-43-457Z`) sampled before dialog scrolling completed. The final scenario waits for actual in-view geometry and centre hit-test reachability before asserting. The earlier failed assertions and the `14-35-04-628Z` diagnostic against an absent picker remain preserved.
- The first source screenshot attempt (`14-26-31-458Z`) failed because its screenshot directory did not exist. The subsequent executed run passed. Initial dev-open and HMR-reset failures are retained in the runner directory.
- Root confirmed a package edit caused a full development reload between sessions. Saved architectural state was reopened before continuing.
- Additional architect refused-Walk proof initially saw stale prior-mode heading on the first frame after arrival became idle. The shared movement proof now waits for one observed rendered frame after idle. The corrected full flow passed; `architect-denied-walk-initial.log` retains the failed readiness assertion. This was a proof-readiness correction, not an application motion change.
- Passing browser error output was empty. Architect console inspection recorded the existing PCFSoftShadowMap deprecation warning and development informational messages, without an uncaught error.

## Screenshot identity and candidate identity

The initial ground and upper movement runs both wrote `screenshots/growth/2026-09-08-navigation/source-walk-{before,moved,escaped}.png`. The upper rerun overwrote those static filenames. They must **not** be presented as retained ground images. Original ground execution logs still exist; the 83-command final ground rerun has unique preserved images:

- `screenshots/growth/nav-dev-final-ground-picker.png`
- `screenshots/growth/nav-dev-final-ground-before.png`
- `screenshots/growth/nav-dev-final-ground-moved.png`
- `screenshots/growth/nav-dev-final-ground-escaped.png`

Other final source proof includes `nav-dev-final-fly-{drag,before,moved,escaped}.png`, `nav-dev-final-invalid-start.png` and `nav-dev-final-controls.png`. Root's final tablet visual proof is `screenshots/growth/nav-dev-tablet-verified-{landscape,portrait}-{controls,picker,start}.png`.

The first source candidate in `transfer.json`, SHA-256 `527de32b75e2f6aa1548c1e851aaabfa89009b6497fde95a2fc2d7c67892e0f4`, is **superseded** by the corrected final source snapshot in `transfer-final.json`, SHA-256 `049d8ae830ee3879139f3b686c3fd9f86aac3b0fc2aadaba33a82c67bbff62a2`. Both identities remain preserved. A successful build of the earlier candidate must not be used to claim verification of later tablet target/contrast corrections. Root owns final native, built-browser, artifact identity and release acceptance.

## Requirement boundary

This is evidence for a bounded R-02 input/start/recovery milestone, with relevant U-02/U-05/U-09 controls and tested U-06 tablet reachability. Source reset/control reachability supplies a narrow R-01 regression check. It does not close all R-01/R-02 behavior or adjacent snapshot, performance and industry requirements. Full movement collision/floor transitions remain open. No phone acceptance, native macOS/Linux support, physical tablet touch-controller support, installation or blanket production readiness is claimed here.
