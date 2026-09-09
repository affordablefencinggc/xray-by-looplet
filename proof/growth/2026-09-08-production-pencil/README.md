# Production Magic Pencil acceptance — prepared, not executed

Target only the built application at `http://127.0.0.1:8093/`. Record the verified worker artifact identity before claiming acceptance. Existing takeover development artifacts remain historical; do not replace them.

## Prepared run

`2026-09-08-8093-pencil-01/desktop-exports.json` has 29 commands. It enters the real Crown Wharf fixture from the UI, pauses the presentation, disables cinematic orbit if necessary, selects Wireframe Ascend, then clicks Solid Finish and Blueprint synchronously in one eval. There is deliberately no wait between these two actions. It asserts that the normal animation frame counter did not advance, but that the actual model state is complete with all meshes visible. The capture function's explicit renderer call is what must make the immediate export useful.

A second PNG is requested after a real frame, followed by the real Model sheets PDF button. Only an anchor's download filename is prefixed; its original click and image/PDF bytes are untouched. A recorded download request is **not** evidence that a file reached disk. Restore the filename monitor using `cleanup.json` if a run bails early.

`2026-09-08-8093-pencil-01/tablet-controls.json` has 30 commands. It independently opens the fixture, checks 1024×768 and 768×1024, and measures every visible drafting button/select at 44×44 minimum after scrolling each into view. Hit tests check actual reachability. The assistant launcher must remain unobscured. Top and bottom dock screenshots are retained for each orientation, followed by a restored model screenshot. No phone testing.

## Execution once authorized

Use an isolated persistent agent-browser session, for example `growth-pencil-production`. Do not use normal app data or an agent's occupied session. Configure downloads on that existing browser to this run's `downloads` directory before executing, using the established supported CDP setting with a normal Windows path (avoid the CLI download opcode's extended-prefix path bug).

```powershell
node scripts/fast-cdp-test.mjs growth-pencil-production proof/growth/2026-09-08-production-pencil/2026-09-08-8093-pencil-01/desktop-exports.json
node scripts/fast-cdp-test.mjs growth-pencil-production-tablet proof/growth/2026-09-08-production-pencil/2026-09-08-8093-pencil-01/tablet-controls.json
node proof/growth/2026-09-08-production-pencil/inspect-downloads.mjs proof/growth/2026-09-08-production-pencil/2026-09-08-8093-pencil-01 VERIFIED_WORKER_RUN_ID
```

Expected actual browser downloads:

- `2026-09-08-8093-pencil-01-01.png`: immediate Solid Finish capture.
- `2026-09-08-8093-pencil-01-02.png`: capture after the normal frame advances.
- `2026-09-08-8093-pencil-01-03.pdf`: UI-generated model book.

If the browser instead saves to its configured Downloads directory, preserve the original and copy only these exact run-specific files into the proof directory, verifying hashes. Do not rename or reuse old exports. Do not accept a data URL or intercepted Blob in place of an actual download.

`inspect-downloads.mjs` decodes the downloaded PNGs, reports their drawing-area difference as a diagnostic, parses the real PDF, verifies five A4 landscape pages and the illustrative subject metadata, and renders all five pages to unique PNGs. It intentionally reports `actual-files-parsed-awaiting-visual-review`: inspect the rapid PNG and all PDF renderings before declaring visual acceptance. A file signature, byte count, or nonempty canvas alone does not prove the building rendered.

Every execution needs a NEW dated tag and screenshot prefix. Generate a fresh run with `prepare-scenarios.mjs NEW_DATED_TAG`; the generator and file inspector refuse to overwrite their evidence. Preserve failed runs and record whether a retry changes the harness or the application. Current prepared source hashes are in `prepared-manifest.json`; compare them with the actual 8093 build manifest, since local source identity alone does not identify the running artifact.
