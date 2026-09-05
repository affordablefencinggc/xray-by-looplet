# Model scope zoom — bounded helper completion

The delegated helper is implemented and integrated desktop behavior is evidenced. This is not a production release or whole-project completion claim.

## Owned change

- `src/studio/ModelScope.ts` (350 lines): `createModelScope` with unchanged agreed interface; exported testable normalization, pointer mapping, crop/projection and renderer-state restoration helpers.
- `src/studio/ModelScope.test.ts`: 14 focused tests. No package scripts or shared source files edited by this worker.
- `proof/audit/IW-SCOPE-ZOOM/`: `report.html`, `results.json`, unit/typecheck logs, exact new-file `helper.patch` and `tests.patch`.

The implementation creates a circular overlay and two private render targets. A cloned perspective or orthographic camera re-renders actual geometry at 2–8x, with a bounded 160–360 CSS pixel display and maximum 720x720 render pixels. A Three.js OutputPass applies the existing renderer's tone mapping, exposure and output conversion. Crosshairs remain on the exact pointer ray at all four edges; the display clamps but the source camera crop may extend just outside the original view. Pointer input passes through. Scope has no permanent animation loop.

The helper restores render target/cube face/mip, viewport, scissor/test, autoClear, shadow update flags, XR enabled state and render counters in finally, including failed readback. It disposes its own targets, output material/fullscreen helper and DOM/listeners, never shared scene geometry or materials. Escape and visible state belong to the integrating UI.

## Executed proof

- `node --experimental-strip-types --test src/studio/ModelScope.test.ts`: 14/14 passed. Includes perspective/orthographic exact zoom, existing view offsets, transformed parent camera, all edges at DPR1/2, input bounds, state restoration after success/failure, and idempotent resource/listener cleanup.
- `npm.cmd run typecheck`: passed. Initial PowerShell `npm` launcher was execution-policy blocked; using the installed `npm.cmd` required no policy change. Two initial TypeScript issues were corrected before this passing gate.
- Explicit Prettier applied only to the two owned source/test files.
- Root independently reviewed the earlier 13-test projection/state version; lifecycle test was added afterward and separately passed.
- Actual desktop CUA in own Edge task tab 2025846168: before Model without Scope; after integration, 4x upstairs window/mullion; 8x/320px on the same detail; pass-through selection updates source evidence; Plan mode shows a magnified roof edge flashing; Escape hides lens and AX toggle changes 1 to 0. Returned own tab to Orbit with scope off. CUA screenshot images are in the task transcript.
- UI worker's saved dev browser proof: `proof/audit/IW-REAL-3D-VIEWER/visual-2026-09-05T10-15-47-759Z/results.json`: all 14 scenarios passed, errors empty. Scope checks cover 2/4/8x distinct actual pixels and unchanged camera, diameter bounds, idle stopping, pointer leave, Escape UI synchronization, and orthographic projection. Helper source/test SHA256 match this run's input binding.
- Visually inspected the actual saved `10-scope-4.png` and `11-scope-plan.png`, linked in the HTML report alongside the before image.

## Remaining external work and limits

UI/release worker owns final frozen-input production build/browser proof and main HTML ledger. Delivery worker owns staging/commit/release actions. No Git mutation performed by this worker. No mobile browser tests, as the user explicitly requires desktop only. The Pictures reference filename remains unidentified; implemented architectural inspection scope based on the user's stated intent. Postprocessing can slightly alter transparent edge/background blending compared with the main direct render; actual solid geometry appearance was visually checked in CUA.

No helper source changes are pending. Future changes invalidate the source hashes and require rerunning the relevant gates.

The HTML report itself was not browser-rendered by this worker: the app URL returned Not Found, then the browser URL policy rejected the local file URL. No alternate access was attempted after that rejection. The report's referenced real screenshots were visually inspected, and the delivery worker owns normal tracker publication/render verification.
