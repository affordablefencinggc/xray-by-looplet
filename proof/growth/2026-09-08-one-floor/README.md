# One-floor construction studio

User scope: one floor, rapid Fast CDP verification. Authored 12 × 9m apartment cutaway, 416 separate render components, nine selectable stages. Illustrative geometry, not Dubai source data or an installation/engineering plan.

Five hexagonal ochre graphite pencils with exposed wood, ferrules and pink erasers draw persistent world-space edge segments. Fifty colour pencils deposit alternating surface-triangle hatch strokes in the target material colour. Independent 0.1-second contact bursts, aggressive raised feints, fizz and near-vertical attitudes. A component resolves to its solid material only after its hatching completes. This is procedural hatching plus material resolution, not a texture-painting editor or simulated pigment deposition.

Controls: play/pause/replay, seek, stage navigation, speed, finish, plan/fit, service exposure, backdrop/shadows/reset, image export. Expose services removes plasterboard, paint and flooring. On-demand rendering stops at rest. Tablet camera fitting corrected after visual inspection caught cropping.

The existing building viewer now applies model palette/material changes and atmosphere settings; source material restoration works. Existing tower animation remains a separate legacy reveal; the actual strokes are in the new floor studio.

## Local proof

- 11 focused tests and typecheck pass (`tests.log`, `typecheck.log`).
- `controls.json.log`: final warmed batch 3.76 seconds. All nine stages, 5/50 pencils, exposure, appearance pixel change, camera, pause/replay, desktop/tablet layouts.
- `navigation.json.log`: route entry/return in 1.24 seconds. Native route independently wired and awaiting packaged acceptance.
- `source-settings.json.log`: existing model palette/atmosphere checks in 3.49 seconds.
- Screenshots in `screenshots/growth/one-floor-*` inspected. 1024×1366 tablet, 1600×1100 desktop. No phone QA.
- [Actual motion recording](one-floor.webm): 230 observed animation frames in 6.10 seconds; live structure drawing then flooring shading at 1x. 50 independently posed colour pencils sampled.
- [Code difference](implementation.diff), against previous accepted source snapshot for inherited files and full additions for new files.

Test harness corrections: snapshot readiness now follows rendered frames for colour comparison; fresh page state avoids inherited exposure toggle; eval awaits wrapped in async functions. One reload connection timeout followed by successful warm retry. Early tablet crop and status lag were fixed, then rechecked. Earlier build 15d358f8a742 superseded by final native-route fix; no false final acceptance of that artifact.

## Final build

Accepted: source snapshot 8de25142183515a5083915793e615e388703d3b02a79d9ba65369f0cf07e915c. Build on Dans1, High/16, sequential web/native. All seven gates pass: 229 selected TypeScript tests, 14 Rust tests, typecheck, web and native builds. No installation/publication.

Production Fast CDP passed in 3.61 seconds; Windows-native in 4.65 seconds, including nine stages, controls, app route entry/return and injected build identity. Production desktop/tablet and native screenshots inspected. Native screenshots do not establish tablet support; tablet proof is the browser pass. Final source drift is empty. `final/release-8de251421835/build-identity-verified.json` and `artifacts-verified.json` bind all artifacts to this source. A premature identity-check attempt was refused while extraction was still running; checks were rerun after extraction completed and passed before native launch.

The verified production floor route is open in the user's existing X-Ray Chrome tab. Preview process 8956 and authorized local development 44196 are retained. Superseded preview 63160, isolated native test 71008 and both floor test browser helpers are closed (`preview-replaced.json`, `cleanup.json`). Native used the bounded graceful-close/termination rule; no shutdown fix is claimed. User projects and profiles preserved.
