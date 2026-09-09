# Release verification for run 5dfc922f097f (coordinator, resumed chat, 2026-09-09 01:35–01:45)

The three verifier agents of workflow wf_e91dbbee-357 were killed with the chat restart and a workflow cannot be resumed across sessions, so the coordinator re-ran the three lenses by command. Every line below was executed in this chat.

## Lens 1 — build and artifact identity chain
- `sha256sum release-5dfc922f097f/artifacts/src-tauri/target/release/xray-by-looplet.exe` → `2ff012d231570bcbc4e4263334712326e1565acc3f1f1190cdaa99a8711b3b69`; identical in `artifact-manifest.json`, `native-completion.json`, `qa-launch.json`.
- All 214 entries of `web-artifact-manifest.json` recomputed against `release-5dfc922f097f/web-artifacts/`: 214 match, 0 mismatch. (A first pass that resolved paths against the repo root's own `.vercel/output` reported 11 differences — those were the local build, not the artifact; discarded.)
- `results.json`: dependencies, typecheck, focused-tests, web-build, native-build (151 s), native-assistant-tests, native-material-tests all exit 0 at High priority, 16 rayon workers / 16 cargo jobs. `focused-tests.stdout.log`: tests 287, pass 287, fail 0. Attempt-1 failure preserved in `release-5dfc922f097f/failed-focused-tests/`.
- `artifacts-verified.json` status pass; `curl http://127.0.0.1:8096/` returned 200 and the served bundle contains `5dfc922f097f`.
- `node remote-orchestrator.mjs verify-source 5dfc922f097f` → drift in exactly two files: `src/studio/DraftsmanControlDock.tsx`, `src/studio/draftsman.css` (the SC-07 dock slice, edited after the freeze; recorded as post-freeze drift, not in this build). Result file `release-5dfc922f097f/source-drift-*.json`.

## Lens 2 — production evidence
- Reports `qa/production-saves.md`, `production-sheets.md`, `production-pricing.md`, `production-assistant.md`, `production-assistant-hardened.md` were written by the four production agents and the previous coordinator before the restart; their runner reports under `proof/growth/runner/*az3rel-prod-*` exist and each cited exit code was checked by the previous chat (handover). In this chat only `assistant-hardened-production-desktop.png` was re-inspected (Sheets pane at 1440x900, Live assistant panel bottom-right, edits checkbox unchecked, status strip Build 5dfc922f097f); the previous chat's inspection notes stand for the rest.
- Known stale scenarios: `production-assistant.json` and `production-floor-pointer.json` fail at their first placement assertion on this build (hardening moved the panel and storage key); superseded by `production-hardened-layout.json` / `production-hardened-guards.json` (both exit 0). No assertion was edited.

## Lens 3 — native evidence and process hygiene
- `qa-launch.json` PID 75176 confirmed via `Get-CimInstance Win32_Process` as `release-5dfc922f097f/artifacts/.../xray-by-looplet.exe` (created 2026-09-09 01:09:14 local) with WebView2 child 71092 carrying the isolated user-data-dir; CDP `/json` on 9281 answered with one page `http://tauri.localhost/`.
- Native runner logs: every log's first line is `http://tauri.localhost/`; exit codes match `qa/native-all.md`; the only scenario edit is the documented build-ID/screenshot-path change in `native-hardened.json`.
- Six native screenshots inspected with the image reader (listed in `qa/native-all.md`).
- Hygiene: `agent-browser session list` after closing `az3rel-native-all` shows only the other chat's three sessions; `qa-launch.json` installed:false; nothing was installed (the exe ran from the proof folder). The user preview 8095 was already gone at resume (not ours); dev server 8080 belongs to another chat and is alive.

## Gate result
- **Native shutdown: FAILED (bounded).** `cleanup-owned.ps1` requested `CloseMainWindow()` on PID 75176 (identity-checked); the process was still alive after 5 000 ms and was force-stopped (`native-cleanup.json`: gracefulCloseRequested true, forced true, remaining false). This repeats the open "native shutdown after an extended QA session" issue recorded on 2026-09-08 (startup-only baselines close normally). Per the acceptance rule, `LATEST-VERIFIED-BUILD.md` is NOT updated; build 5dfc922f097f stays a QA-passed candidate with a shutdown hold.
- Everything else: not refuted.
