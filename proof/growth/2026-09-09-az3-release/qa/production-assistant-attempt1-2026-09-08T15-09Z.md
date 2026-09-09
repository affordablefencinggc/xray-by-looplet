# production-assistant — az3 release QA (run 5dfc922f097f)

- Agent: production-assistant
- Platform: production browser against the candidate preview http://127.0.0.1:8096/ (hash-verified web artifacts of run 5dfc922f097f, served by scripts/preview-built.mjs with .env.local loaded; candidate-preview.json pid 56200)
- Build identity check: proof/growth/2026-09-09-az3-release/release-5dfc922f097f/build-identity-verified.json status pass, buildIdInjected 5dfc922f097f, present in routes-D7GyD1F7.js; source-drift status pass, drift [].
- Preflight: `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8096/` printed `200`.
- Sessions opened: `az3rel-prod-assistant-main` (release scenarios), `az3rel-prod-assistant-diag` (read-only diagnostics). Both closed at the end with `.temp/npm/_npx/8e62322f9a68a26a/node_modules/agent-browser/bin/agent-browser-win32-x64.exe --session <name> close` (both printed "Browser closed").
- Status: PARTIAL — production-live-image PASS; production-assistant FAIL; production-floor-pointer FAIL (both for the same product-vs-scenario reason, see root cause).
- No scenario file was edited. No harness edits. No file under src/, scripts/, public/, src-tauri/ or any root ledger was touched. No git commands were run.

## Commands (repo root, Git Bash)

```
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8096/                                    # 200
node scripts/fast-cdp-test.mjs az3rel-prod-assistant-main proof/growth/2026-09-09-az3-release/scenarios/prod-warm.json                   # exit 0
node scripts/fast-cdp-test.mjs az3rel-prod-assistant-main proof/growth/2026-09-09-az3-release/scenarios/production-assistant.json        # exit 1 (attempt 1)
node scripts/fast-cdp-test.mjs az3rel-prod-assistant-diag proof/growth/2026-09-09-az3-release/qa/diag-assistant-placement.json           # exit 0 (diagnostic)
node scripts/fast-cdp-test.mjs az3rel-prod-assistant-main proof/growth/2026-09-09-az3-release/scenarios/production-assistant.json        # exit 1 (attempt 2)
node scripts/fast-cdp-test.mjs az3rel-prod-assistant-main proof/growth/2026-09-09-az3-release/scenarios/production-floor-pointer.json    # exit 1 (attempt 1)
node scripts/fast-cdp-test.mjs az3rel-prod-assistant-main proof/growth/2026-09-09-az3-release/scenarios/production-floor-pointer.json    # exit 1 (attempt 2)
node scripts/fast-cdp-test.mjs az3rel-prod-assistant-main proof/growth/2026-09-09-az3-release/scenarios/production-live-image.json       # exit 0 (attempt 1, one provider send)
node scripts/fast-cdp-test.mjs az3rel-prod-assistant-diag proof/growth/2026-09-09-az3-release/qa/diag-floor-lab.json                     # exit 0 (diagnostic)
.temp/npm/_npx/8e62322f9a68a26a/node_modules/agent-browser/bin/agent-browser-win32-x64.exe --session az3rel-prod-assistant-main close
.temp/npm/_npx/8e62322f9a68a26a/node_modules/agent-browser/bin/agent-browser-win32-x64.exe --session az3rel-prod-assistant-diag close
```

## Results

### 0. Warm-up — proof/growth/2026-09-09-az3-release/scenarios/prod-warm.json
- Session az3rel-prod-assistant-main, attempt 1, exit 0, 6 commands, 1.37 s.
- Runner report: proof/growth/runner/2026-09-08T15-09-49-630Z-az3rel-prod-assistant-main.json (+ .log, .scenario.json)
- Key output: title "X-Ray by Looplet", url http://127.0.0.1:8096/. No first-command timeout occurred.

### 1. production-assistant — proof/growth/2026-09-09-az3-release/scenarios/production-assistant.json — FAIL (deterministic, 2 attempts)
- Session az3rel-prod-assistant-main. Scenario sha256 4e08b679172305aa6573c0396f7d3c60867a22156118211cfa6ee619b501fb9b (unchanged).
- Attempt 1: exit 1, 56 commands, 0.29 s. Runner report proof/growth/runner/2026-09-08T15-09-54-656Z-az3rel-prod-assistant-main.json, log ...-main.log.
- Attempt 2: exit 1, 56 commands, 0.31 s. Runner report proof/growth/runner/2026-09-08T15-12-10-594Z-az3rel-prod-assistant-main.json, log ...-main.log.
- Failing step (index 7, first assertion after `focus [aria-label="Move live assistant"]` + `press Home`):
  `(()=>{const r=document.querySelector('.live-assistant').getBoundingClientRect();if(r.left!==16||Math.abs(r.bottom-(innerHeight-16))>1)throw Error('Default placement');'Bottom-left placement verified'})()`
- Log output (both attempts): `✗ Evaluation error: Error: Default placement`. Preceding steps all `✓ Done` (open, reload, wait launcher true, viewport 1440x900, open panel, focus, Home).
- Steps 8..55 never executed (keyboard move/resize, + menu Skills, `/draw`, References & inspiration, Mid-century brief, synthetic-brick drop, purpose Material, New chat retention, `/draftsman` send, Help, tablet bounds, layout persistence, errors). This scenario produced NO screenshots (its first screenshot step is index 31).

### 2. production-floor-pointer — proof/growth/2026-09-09-az3-release/scenarios/production-floor-pointer.json — FAIL (deterministic, 2 attempts)
- Session az3rel-prod-assistant-main. Scenario sha256 86a93e09f1d93f0e2793f57667af9643b34b5c8ee4da219a7a60d4949443ef68 (unchanged).
- Attempt 1: exit 1, 33 commands, 0.26 s. Runner report proof/growth/runner/2026-09-08T15-12-48-578Z-az3rel-prod-assistant-main.json, log ...-main.log.
- Attempt 2: exit 1, 33 commands, 0.21 s. Runner report proof/growth/runner/2026-09-08T15-13-06-857Z-az3rel-prod-assistant-main.json, log ...-main.log.
- Failing step (index 10, after Home + mouse drag from (150,455) to (290,395)):
  `Error: Pointer drag failed {"x":1064,"y":432,"width":360,"height":452,"top":432,"right":1424,"bottom":884,"left":1064}` (identical in both attempts). The scenario expects left 156 / top 372, i.e. a panel that started bottom-left at (16,432); the panel actually sits bottom-right at (1064,432), so the mouse press at (150,455) never touched the move handle and the rect is unchanged.
- Steps 11..32 never executed (pointer resize assertion 460x470, pointer-resize screenshot, /floor-lab stage order, reinforcement/insulation/services/tablet screenshots, errors). This scenario produced NO screenshots.

### 3. production-live-image — proof/growth/2026-09-09-az3-release/scenarios/production-live-image.json — PASS
- Session az3rel-prod-assistant-main, attempt 1, exit 0, 13 commands, 6.57 s. Scenario sha256 ceca41675bba341693f82230c98bfeff027b2ac9a019b7a1473965d24b1aa422 (unchanged).
- Runner report: proof/growth/runner/2026-09-08T15-13-19-101Z-az3rel-prod-assistant-main.json, log ...-main.log.
- Key outputs: `"Attached generated red test square"`; attachment wait `true`; send; wait for reply `true`; final eval `{"provider":"configured live provider","reply":"AssistantThe test image is solid red.","syntheticImage":true}` (reply matched /red/i, no `.assistant-chat-error`, `.assistant-attachments` cleared after the successful send); `errors` step printed nothing.
- Exactly ONE message (the generated 32x32 red square + the fixed one-sentence question) was sent to the configured provider through the preview server. Nothing else was sent.
- Screenshot: screenshots/growth/2026-09-09-az3-release/production-assistant-live-image-reply.png — INSPECTED: 1440x900 Sheets pane ("no verified plan"), Live assistant panel docked bottom-right showing "Connected", the user bubble with the solid red square labelled "Attached reference", then "Assistant / The test image is solid red.", an empty composer ("Ask anything about your project…", Enter to send), Errors 0 and status strip "Build 5dfc922f097f".

## Root cause of the two failures (product change in the frozen build, not a harness problem)

- Diagnostic (read-only, diag session): proof/growth/2026-09-09-az3-release/qa/diag-assistant-placement.json, runner report proof/growth/runner/2026-09-08T15-10-59-201Z-az3rel-prod-assistant-diag.json / .log. At 1440x900 with an empty localStorage the panel opens at left 882 / top 154; after focusing the move handle and pressing Home the rect is `{l:1064,t:432,r:1424,b:884,w:360,h:452}`, bottomGap 16, activeElement "Move live assistant", unchanged after a further 300 ms. So Home docks bottom-RIGHT (right margin 16, bottom margin 16); the scenario asserts bottom-LEFT (left === 16).
- Served bundle check: `/assets/routes-D7GyD1F7.js` on 127.0.0.1:8096 contains the storage key `xray:assistant-panel:v2` and no `xray:assistant-panel:v1`. Working-tree source (untracked src/studio/assistant/useAssistantPanel.ts) reads `STORAGE = "xray:assistant-panel:v2"` with the comment "A new layout version restores the requested right-side default once", and src/studio/assistant/panelGeometry.ts `defaultAssistantRect` returns `x: viewport.width - 376, y: viewport.height - 468`. The build therefore intentionally moved the assistant's default/Home placement to the bottom-right and bumped the persistence key.
- Consequences for the release scenarios: production-assistant's "Default placement" (left===16) fails, and its final "Layout persistence" step reads `xray:assistant-panel:v1`, which no longer exists in this build (would also fail). production-floor-pointer's drag coordinates are hard-coded for the bottom-left default and therefore miss the panel. Both scenarios are semantically identical to the previous stage's accepted copies (proof/growth/2026-09-08-assistant-layout/production-*.json; only the leading `open` step and screenshot paths differ), which passed against the earlier build 5f3a3e1bc5bf on port 8095 (its log shows the same steps succeeding).
- Per the rules I did not change the expected values. The failures are recorded as valid results; whoever owns the scenarios must decide whether the right-side default is the intended product behaviour (then the scenarios need new expectations: right anchor, v2 key, new drag coordinates) or a regression.
- Screenshot: screenshots/growth/2026-09-09-az3-release/production-assistant-diag-placement.png — INSPECTED: 1440x900 Sheets pane, Live assistant panel ("Connected", empty conversation with "Ask about your project, draw a layout, search the web or attach an image…") docked in the bottom-right corner over the Model Readiness column after Home, status strip "Build 5dfc922f097f".

## Supplementary floor-lab evidence (diagnostic, NOT the release scenario)

Because production-floor-pointer failed before reaching /floor-lab, I ran the floor-lab half as a read-only diagnostic in the diag session: proof/growth/2026-09-09-az3-release/qa/diag-floor-lab.json, runner report proof/growth/runner/2026-09-08T15-13-44-042Z-az3rel-prod-assistant-diag.json / .log, exit 0, 18 commands, 1.17 s. Stage ids matched exactly `plumbing,electrical,reinforcement,structure,framing,wall-services,insulation,gyprock,painting,flooring,fixtures,appliances` (match:true); Finish and Expose services buttons were found and clicked; `errors` printed nothing. This does not substitute for the release scenario's pass.

- screenshots/growth/2026-09-09-az3-release/production-floor-diag-reinforcement.png — INSPECTED: 1440x900 Material Studies "01 / The apartment", left rail steps 01–02 ticked and "03 Slab reinforcement" active, heading "03 / SLAB REINFORCEMENT — Material resolved", two reinforcement mats and under-slab pipes on the grid, caption "Two visible reinforcement mats within the future slab…", 184 components placed, scrubber 38%.
- screenshots/growth/2026-09-09-az3-release/production-floor-diag-insulation.png — INSPECTED: "07 / WALL INSULATION — Material resolved", steps 01–06 ticked, 07 active, concrete frame with timber-framed walls filled with yellow insulation batts, caption "Insulation batts fitted between the studs and noggins before the plasterboard.", 367 components, scrubber 64%.
- screenshots/growth/2026-09-09-az3-release/production-floor-diag-services.png — INSPECTED: "12 / APPLIANCES & FIT-OFF — Complete", all 11 rail steps ticked, "Expose services" button highlighted dark (active), exposed framing/services with fridge, kitchen bench, cooktop and pendant lights, caption "Oven, cooktop, refrigerator, lights and finished outlets.", 361 components, scrubber 100%.
- screenshots/growth/2026-09-09-az3-release/production-floor-diag-tablet.png — INSPECTED: 1024x1366 portrait layout of the same complete/exposed-services state; rail shows step "12 Appliances & fit-off" active, toolbar buttons wrapped under the stage heading, Play/Replay/scrubber 100%/1x/Finish footer, nothing overflowing horizontally.

## Observations (not failures)
- Served index.html on 8096 carries `<script src="https://grok.com/grok-app-builder/extensions.js" defer>` and `/__grok/manifest.webmanifest`; these come from the project's own scripts/grok-pwa-shared.mjs PWA plugin, so they are an intentional build feature.
- The runner's `eval` lines print `null` for the scenario's own status strings (e.g. 'Open panel') because those evals do not `return`; that matches the previous stage's logs and is not a defect.

## Limitations
- production-assistant and production-floor-pointer stopped at their first placement assertion, so the compact-panel + menu, references, help, tablet bounds, pointer resize and the release-scenario floor screenshots were NOT exercised by the release scenarios on this build; only the floor-lab portion has supplementary diagnostic coverage.
- Tablet bounds for the assistant panel (1024x1366) were not verified on this build.
- Python is not on PATH on this machine; the semantic scenario diff was done with node instead.
