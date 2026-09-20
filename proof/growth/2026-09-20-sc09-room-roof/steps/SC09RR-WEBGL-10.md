# SC09RR-WEBGL-10 — measured-preview graphics recovery

Bounded recovery change: verified in development and production browser. SC-09 remains partial pending the development reload investigation.

## Behavior and exact source

When WebGL2 is unavailable, the measured preview now shows a status message and **Retry 3D preview** without throwing through the worksheet. Real context loss shows a paused status; restoration redraws the retained model. Unmount disposes the renderer and releases its context. Measurements, bindings and pricing evidence are not promoted or changed by graphics recovery.

- [Exact two-file product diff](../source/webgl-recovery.patch).
- [Frozen source manifest](../source/webgl-source-manifest.json): `1388723caf33f51447d43dd01424f332969de2fe32dc6149a32f49d46d544e73`, based on `71de029f` plus the two preview edits. The updated process-ownership harness is supplied separately and hash-bound by its receipts.
- [Fresh machine gate](../machine/machine-safe2/results.json): 2,032 tests pass, TypeScript and scoped lint exit 0; 16 existing lint warnings.
- [Web build](../machine/webgl-build1/results.json): PASS, DANS1 High priority / 16 processors; source hashes checked before and after. No deployment/native build.

## Executed browser proof

- [Development recovery](../campaigns/sc09rr-1388723caf33-webgl-recovery-dev2/output/browser-results.json): **61/61 PASS**.
- [Production recovery](../campaigns/sc09rr-1388723caf33-webgl-recovery-built1/output/browser-results.json): **64/64 PASS**, including raw SSR stylesheet checks.
- [Normal production journey](../campaigns/sc09rr-1388723caf33-room-roof-built1/output/browser-results.json): **138/138 PASS**. Real room and roof edits, independent stale/pricing withholding, explicit rebind and ordinary reload remain functional.
- [Returned-artifact hash verification and cleanup summary](../machine/webgl-returned-evidence.json): all 65 checked files matched; all four campaign launchers completed cleanup.

The recovery fixture temporarily returns null for WebGL2 context requests, then restores the original browser method before clicking Retry. It next uses the real WEBGL_lose_context extension and restores that same context. At each recovery boundary the saved project string is checked byte-for-byte and the 2D canvas must remain present. No product store hooks or post-seed project writes are used. The first fault attempt denied only one request; development double mounting bypassed that transient fault, so its FAIL is preserved and not treated as product failure.

## Inspected production recovery screenshots

- [Unavailable desktop](../campaigns/sc09rr-1388723caf33-webgl-recovery-built1/output/captures/webgl-unavailable-desktop-1600x1000.png).
- [Unavailable tablet](../campaigns/sc09rr-1388723caf33-webgl-recovery-built1/output/captures/webgl-unavailable-tablet-1024x768.png).
- [Retry restored tablet](../campaigns/sc09rr-1388723caf33-webgl-recovery-built1/output/captures/webgl-retry-restored-tablet-1024x768.png).
- [Context lost tablet](../campaigns/sc09rr-1388723caf33-webgl-recovery-built1/output/captures/webgl-context-lost-tablet-1024x768.png).
- [Context restored tablet](../campaigns/sc09rr-1388723caf33-webgl-recovery-built1/output/captures/webgl-context-restored-tablet-1024x768.png).
- [Normal reloaded tablet bindings](../campaigns/sc09rr-1388723caf33-room-roof-built1/output/captures/production-reloaded-current-bindings-tablet-1024x768.png).
- [Normal reloaded desktop roof highlight](../campaigns/sc09rr-1388723caf33-room-roof-built1/output/captures/production-reloaded-roof-highlight-desktop-1600x1000.png).

All seven listed images were inspected, as were the five corresponding development recovery images. The full production journey captured 16 images; this record does not claim all 16 were inspected this turn.

## Limits and preserved diagnostics

The earlier fc02 production failure did not reproduce in either the instrumented 144/144 or original 138/138 replay before this change. The fresh static WebGL probe identified the real RTX 3080 Ti / ANGLE renderer with no GL error. Therefore this change is recovery from actual graphics unavailability, not a proven repair to the GPU driver's original failure.

The old-source development journey again failed at 118/135 on reload. Its Chrome log records a network-service crash and GPU-process exit; causation of the reload timeout is not established. The [new-source development replay](../campaigns/sc09rr-1388723caf33-room-roof-dev1/output/browser-results.json) also fails at 118/135 on reload; the [launcher receipt](../campaigns/sc09rr-1388723caf33-room-roof-dev1/output/launcher-results.json) records cleanup. This remains an open development-browser failure, not fixed by preview recovery. No native, deployment, live-device, complete SC-09 acceptance, or certified estimate is claimed. No TypeSafe Jev inference was executed.