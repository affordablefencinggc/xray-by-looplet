# IW-BASELINE completed audit handover

Completed: 2026-09-05. This is baseline/audit completion, not product completion or acceptance of inaccurate measurement behavior.

## Authority and continuity

Industry-wide construction source-to-verified-estimate is the product direction. Fencing is optional. This worker was reused after the orchestrator's two fresh-agent thread-limit failures; no fresh-chat claim is made. START.md records the startup packet and owned boundaries.

Initial inspected HEAD was 7ba4a14d1eccdcde1cfc15293adbf08918524c4f. Build HEAD is 1bf54983bb3ff168358f4987c8481e8cc23fb760, with a shared-tree Vite watch-ignore commit outside this worker. This worker made no commit. New construction modules and ledger artifacts were present concurrently; this was not a clean HEAD checkout. SWEEPER-VERIFICATION-LEDGER.md changed outside this lane and was not reverted; no autopilot/sweeper command or hook was executed here. An unrelated untracked root '{}' file was observed and left untouched.

## Delivered changes

- startup.sh removes the unconditional unrelated built-preview stop before its health check. It still starts npm run dev and leaves a healthy listener alone.
- startup.ps1 delegates to scripts/industry-baseline-start.mjs. The helper probes health, preserves an active recorded launcher, refuses an occupied unhealthy port, and otherwise starts npm run dev detached with windowsHide and owned log/PID records. Existing healthy-server/no-mutation path was executed twice. The cold-spawn branch was not exercised because stopping the live server would be unnecessary disruption.
- scripts/industry-baseline-ui.mjs runs real filechooser/import/calibration/trace/zoom/pan flows at 1280x800 and 390x844, captures errors and DOM/canvas observations, and supports --built. No store injection, fake bridge, source replacement or test seam is used.
- scripts/industry-baseline-build.mjs removes DATABASE_URL only from its npm build child, records source hashes before/after, exit status and log. The app-env wrapper was inspected: only VITE-prefixed file keys can enter the child, so it cannot reintroduce DATABASE_URL.

## Executed evidence

1. node scripts/browser-smoke.mjs http://127.0.0.1:8080/ screenshots/industry-baseline/dev-before.png: exit 0, both HTTP 200, no console/page errors or horizontal overflow. Desktop screenshot caught the hydration placeholder despite a green smoke verdict. It is NOT the accepted settled baseline.
2. node scripts/industry-baseline-ui.mjs: final exit 0. Waits for data-hydration-status=ready and enabled Open plan. Actual local sample-plan.svg filechooser import, known distance, two canvas clicks, Lock scale, Run trace, Finish trace, Zoom In and middle-pointer drag succeeded at both viewports. proof/audit/IW-BASELINE/ui-baseline.json records zero console/page/failed-request/HTTP-error entries.
3. node scripts/industry-baseline-build.mjs: exit 0, 2026-09-05T04:57:41Z to 04:57:43Z. proof/audit/IW-BASELINE/build.log explicitly records DATABASE_URL not set / migration skipped. build.json records unchanged sampled runtime source hashes across the build.
4. npm.cmd run preview: served the newly built Vercel output on 127.0.0.1:8081. Owned unified-exec session 93682, server PID 112940 as printed. No unrelated listener was killed. Existing preview lifecycle script was avoided because it kills any port owner.
5. node scripts/industry-baseline-ui.mjs --built: exit 0; same actual flow on unmodified production assets. built-ui-baseline.json records no console/page/failed-request/HTTP-error entries. This is genuine web built-output behavior, not native Tauri/Python engine proof.
6. npm.cmd run typecheck: exit 0, tsc --noEmit; construction worker had declared its new pure modules stable before build. git diff --check -- startup.sh passed.
7. node scripts/industry-baseline-start.mjs: healthy preview response; no process changed. Development server remains available.

The UI harness was iterated before final acceptance (missing bundled Chromium resolved with installed Edge; absent DOM file input resolved with actual filechooser; composited source-crop hashes relabelled correctly). Only final JSON/captures are accepted. These accepted baseline paths must now be preserved; future after-proof belongs in a new run directory, not over these files.

## Visually inspected proof and defect

Accepted before images: screenshots/industry-baseline/desktop-settled-before.png and mobile-settled-before.png. Source-import and Measure screenshots for both viewports were inspected. Desktop calibration/trace-before-zoom/zoom-after/pan-after and mobile calibration/zoom captures were inspected. Built desktop/mobile settled-before and zoom-after captures under screenshots/industry-baseline/built/ were inspected and match development behavior.

The measurement defect is reproduced in both dev and exact built output: zoom changes the orange traced line (100% to 125%) while the original SVG columns and 16000 label remain fixed. Panning likewise moves only the trace. JSON records unchanged source-image DOM bounds/transform and changed canvas pixel data. Source crop screenshots include overlay controls; their hashes are expressly NOT isolated source-pixel evidence.

Calibration/trace steps establish UI operation only. Points were deliberately chosen as test positions, not independently surveyed source endpoints; displayed metres are not accuracy proof. Mobile uses a narrow viewport with mouse emulation; middle-button dragging is not touch gesture proof. The interface remains fencing-coupled (Run/Gate/specification), so it is not universal-trade implementation.

## Errors, limitations and external allocation

- PowerShell execution policy initially rejected the launcher. A process-scoped attempt exposed Start-Process's duplicate Path/PATH environment error. No persistent policy was changed. Final launcher is ordinary node execution, avoiding both failures.
- node_repl browser runtime failed because its Windows sandbox setup helper was missing. agent-browser was absent from PATH and node_modules/.bin. Installed Playwright using pre-existing Edge was the documented fallback; no browser download/install occurred.
- A tool patch error caused an anomalously long tool-reported delay; no mutation from that failed patch. The subsequent ordinary update succeeded.
- Existing smoke emits a custom-share-card brand note; branding was outside this worker's ownership and is not represented as resolved.
- Cold-start launcher behavior, Linux startup execution, touch gestures, native sidecar/installer, Ubuntu BR-013, database/Supabase and external integrations remain unproven. No external service changes or credentials were used.

## Next packet

Coordinate/UI worker: read START.md, this handover, ui-baseline.json and built-ui-baseline.json; inspect desktop-trace-before-zoom versus desktop-zoom-after/pan-after. Build one document-coordinate transform shared by source and overlay, excluding caption/chrome. Reproduce exact import/calibration/trace/zoom/pan at both viewports with actual UI; add touch and source-endpoint accuracy cases. Keep this baseline immutable, put after-proof in a new owned path, rebuild exact production output after app changes, and report any new external/runtime dependencies. Orchestrator can now unlock UI fixes; this worker's next independent verification packet must be separately scoped and record the reused-thread exception if needed.
