# Bounded walk/fly acceptance proposal

This is a proposed verification contract, not completed acceptance. Both the source-linked model viewer (`SourceBuildingViewer`) and architectural design viewer (`Architect3D`) use `FirstPersonNavigation`; both need exercised proof after a shared change.

## Requirement mapping

| ID | Relevance | Closure boundary |
|---|---|---|
| R-02 | Walk/fly movement, direction, floor levels and visible controls | Primary row. Current UI explicitly says walls do not block movement. Direction/start/input repair must remain a partial milestone until collision/floor behavior satisfies the complete row. |
| R-01 | Orbit, pan, zoom and fit after exiting first-person mode | Regression checks that the model remains reachable; no broad every-scale certification. |
| U-02 | Discoverable keyboard commands | Visible current-mode instructions must agree with actual W/A/S/D, altitude and exit behavior. |
| U-05 | Focus and meaningful control labels | Keyboard operation, input focus, reachable exit and focus return. |
| U-09 | Recoverable input/capture denial | Pointer-lock denial must yield a working supported fallback or an explicit recoverable orbit state; never a false active-navigation state. |
| U-06 | Tablet control reachability | Existing lower controls remain reachable at the tested tablet sizes. Phone scope is excluded. |

R-08 snapshots, D-14 source-sheet bookmarks and U-04 heavy-model performance are adjacent features, not automatically accepted by fixing walk/fly.

## Executed and visual checks to retain

1. **Useful visible start.** From a named known model/floor and representative orbit view, click Fly, then separately choose a Walk start through the real dialog. Wait on completed arrival and actual camera/render geometry, not a fixed sleep. Record camera position/quaternion/FOV, selected floor/elevation, nonzero viewport bounds and screenshot. Visually verify a usable building/interior view rather than sky, a solid wall or clipped geometry. Walk eye height should match the selected elevation plus the advertised 1.65 m; test more than one available level. Do not infer collision support from eye height.
2. **Actual directional movement.** After arrival, release all keys and record the actual camera position and world-facing basis. Use real key-down/hold/key-up input for W/S/A/D, recording before/after camera coordinates. With horizontal forward `f` and right `r = f cross worldUp`, require W displacement dot f > tolerance, S < -tolerance, D dot r > tolerance and A < -tolerance. Check lateral movement while already moving forward to expose inverted A/D. Use the actual camera, not only `dataset.navigation`, a helper return value or a changing mode label. Repeat from a rotated view, not just yaw zero.
3. **Walk versus fly.** Walk maintains the chosen eye height despite looking up/down. Fly follows the documented pitch behavior; Space increases altitude and Ctrl lowers it. Shift increases measured displacement over comparable intervals. Frame timing requires tolerances rather than exact elapsed-time equality. Release keys and verify velocity settles; no permanent movement remains after release.
4. **Input denial and fallback.** Exercise actual pointer-lock success where supported, then deterministically deny/reject capture. Verify the promised fallback can look and move through its real controls without pointer lock, with readable instructions and no uncaught rejection. If that platform has no fallback, mode/camera/FOV must recover to a usable orbit view and the user must be able to retry. A denial string alone is insufficient when the UI claims navigation is active. Verify text inputs/dialog controls do not accidentally drive the camera or consume their normal keys.
5. **Exit and re-enter.** Escape during arrival, while moving and from fallback must clear held keys/velocity, release capture where owned, restore orbit controls/FOV and leave a visible model. Re-enter twice and verify fresh input still moves correctly with no duplicated event listeners or stale keys. Blur/visibility loss and viewer unmount should also stop navigation. Return to orbit, pan/zoom/fit and select a part through real controls.
6. **Existing lower controls.** Compare the same upper settings and separate lower dock before/after. Assert button labels/count/order, non-overlap and centre hit-test reachability at laptop/desktop and tablet portrait/landscape. Tablet targets stay at least 44 by 44 pixels. Exercise the lower controls that previously existed; a screenshot alone does not establish they work. Preserve source hash, selected document/page and saved project data across entry/exit unless an advertised action intentionally changes view state.
7. **Evidence and limits.** Retain the scenario JSON, runner metadata/exit code, before/start/moved/exit screenshots, actual camera samples, errors and exact source/artifact identity. Dev, built browser and isolated Windows-native checks are separate gates. If tablet is only tested with keyboard/pointer emulation, label that limit rather than claiming physical touch-controller coverage. No macOS/Linux package, collision, full industry or installation claim follows from these tests.

The existing datasets expose mode/yaw/pitch/speed/direction but do not alone prove camera translation. Prefer existing actual-camera telemetry or a narrow read-only hook over changing production movement behavior solely to satisfy a test.
