# production-assistant — az3 release QA (run 5dfc922f097f), second pass

- Agent: production-assistant (second execution of this task; the first pass's report is preserved verbatim at proof/growth/2026-09-09-az3-release/qa/production-assistant-attempt1-2026-09-08T15-09Z.md and its runner files under proof/growth/runner/*az3rel-prod-assistant-main* / *az3rel-prod-assistant-diag* are untouched).
- Platform: production browser against the candidate preview http://127.0.0.1:8096/ (hash-verified web artifacts of run 5dfc922f097f, served by scripts/preview-built.mjs with .env.local loaded; candidate-preview.json pid 56200, healthy).
- Build identity: served index references /assets/routes-D7GyD1F7.js, which contains the build id `5dfc922f097f` and the storage key `xray:assistant-panel:v2` (no `v1`). The status strip in every screenshot reads "Build 5dfc922f097f".
- Preflight: `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8096/` printed `200`. Local time at start 2026-09-09 01:18 (+10:00); runner file names are UTC (2026-09-08T15-1x).
- Sessions opened: `az3rel-prod-assistant-run2` (warm-up + the three release scenarios) and `az3rel-prod-assistant-diag2` (warm-up + one read-only placement diagnostic). Both closed at the end with `.temp/npm/_npx/8e62322f9a68a26a/node_modules/agent-browser/bin/agent-browser-win32-x64.exe --session <name> close` (each printed "Browser closed", exit 0).
- Status: PARTIAL — production-live-image PASS; production-assistant FAIL; production-floor-pointer FAIL (deterministic, same root cause as the first pass).
- Scenario sha256 (runner-computed, identical to the first pass, i.e. the scenario files were not changed between passes): production-assistant 4e08b679172305aa6573c0396f7d3c60867a22156118211cfa6ee619b501fb9b; production-floor-pointer 86a93e09f1d93f0e2793f57667af9643b34b5c8ee4da219a7a60d4949443ef68; production-live-image ceca41675bba341693f82230c98bfeff027b2ac9a019b7a1473965d24b1aa422.
- No scenario file was edited. No harness edits. Nothing under src/, scripts/, public/, src-tauri/ or any root ledger was touched. No git commands were run. No process was started, stopped or restarted other than the two agent-browser sessions listed above.

## Commands (repo root, Git Bash)

```
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8096/                                                                   # 200
node scripts/fast-cdp-test.mjs az3rel-prod-assistant-run2  proof/growth/2026-09-09-az3-release/scenarios/prod-warm.json                # exit 0
node scripts/fast-cdp-test.mjs az3rel-prod-assistant-run2  proof/growth/2026-09-09-az3-release/scenarios/production-assistant.json     # exit 1 (attempt 1)
node scripts/fast-cdp-test.mjs az3rel-prod-assistant-run2  proof/growth/2026-09-09-az3-release/scenarios/production-assistant.json     # exit 1 (attempt 2)
node scripts/fast-cdp-test.mjs az3rel-prod-assistant-diag2 proof/growth/2026-09-09-az3-release/scenarios/prod-warm.json                # exit 0
node scripts/fast-cdp-test.mjs az3rel-prod-assistant-diag2 proof/growth/2026-09-09-az3-release/qa/diag-assistant-placement.json        # exit 0 (read-only diagnostic)
node scripts/fast-cdp-test.mjs az3rel-prod-assistant-run2  proof/growth/2026-09-09-az3-release/scenarios/production-floor-pointer.json # exit 1 (attempt 1)
node scripts/fast-cdp-test.mjs az3rel-prod-assistant-run2  proof/growth/2026-09-09-az3-release/scenarios/production-floor-pointer.json # exit 1 (attempt 2)
node scripts/fast-cdp-test.mjs az3rel-prod-assistant-run2  proof/growth/2026-09-09-az3-release/scenarios/production-live-image.json    # exit 0 (attempt 1, ONE provider send)
.temp/npm/_npx/8e62322f9a68a26a/node_modules/agent-browser/bin/agent-browser-win32-x64.exe --session az3rel-prod-assistant-run2 close   # Browser closed
.temp/npm/_npx/8e62322f9a68a26a/node_modules/agent-browser/bin/agent-browser-win32-x64.exe --session az3rel-prod-assistant-diag2 close  # Browser closed
```

## Results

### 0. Warm-up — proof/growth/2026-09-09-az3-release/scenarios/prod-warm.json — PASS
- Session az3rel-prod-assistant-run2, attempt 1, exit 0, 6 commands, 1.33 s. No first-command timeout (os error 10060) occurred in either session.
- Runner report: proof/growth/runner/2026-09-08T15-18-57-288Z-az3rel-prod-assistant-run2.json (+ .log, .scenario.json).
- Key output: title "X-Ray by Looplet", url http://127.0.0.1:8096/, hydration wait `true`, panes Overview, Sheets, Measure, Sketch, Components, Model, Render, Review, Cost, Proof.
- Diag session warm-up: proof/growth/runner/2026-09-08T15-19-13-965Z-az3rel-prod-assistant-diag2.json, exit 0.

### 1. production-assistant — proof/growth/2026-09-09-az3-release/scenarios/production-assistant.json — FAIL (deterministic, 2 attempts)
- Session az3rel-prod-assistant-run2. 56 commands.
- Attempt 1: exit 1, 0.35 s. Runner report proof/growth/runner/2026-09-08T15-19-03-132Z-az3rel-prod-assistant-run2.json, log proof/growth/runner/2026-09-08T15-19-03-132Z-az3rel-prod-assistant-run2.log.
- Attempt 2: exit 1, 0.31 s. Runner report proof/growth/runner/2026-09-08T15-19-11-156Z-az3rel-prod-assistant-run2.json, log proof/growth/runner/2026-09-08T15-19-11-156Z-az3rel-prod-assistant-run2.log.
- Log (both attempts): open "X-Ray by Looplet" ok, reload, wait launcher `true`, viewport 1440x900 ok, open-panel eval `null` (no return value; expected), focus move handle ok, press Home ok, then step index 7 `Evaluation error: Error: Default placement` from
  `(()=>{const r=document.querySelector('.live-assistant').getBoundingClientRect();if(r.left!==16||Math.abs(r.bottom-(innerHeight-16))>1)throw Error('Default placement');'Bottom-left placement verified'})()`
- Steps 8–55 never executed (keyboard move/resize 372x412, "+" menu > Skills > "/draw", References & inspiration > Mid-century brief, synthetic-brick drop, purpose "Material", reference-library screenshot, New chat retention, Use in message, Remove attachment, "/draftsman" send + conversation screenshot, Help screenshot, tablet 1024x1366 bounds + screenshot, reload + `xray:assistant-panel:v1` persistence, errors). This scenario produced NO screenshots (its first screenshot step is index 31).

### 2. production-floor-pointer — proof/growth/2026-09-09-az3-release/scenarios/production-floor-pointer.json — FAIL (deterministic, 2 attempts)
- Session az3rel-prod-assistant-run2. 33 commands.
- Attempt 1: exit 1, 0.22 s. Runner report proof/growth/runner/2026-09-08T15-19-23-136Z-az3rel-prod-assistant-run2.json, log proof/growth/runner/2026-09-08T15-19-23-136Z-az3rel-prod-assistant-run2.log.
- Attempt 2: exit 1, 0.23 s. Runner report proof/growth/runner/2026-09-08T15-19-23-484Z-az3rel-prod-assistant-run2.json, log proof/growth/runner/2026-09-08T15-19-23-484Z-az3rel-prod-assistant-run2.log.
- Failing step (index 10, after focus move handle + Home + mouse move 150,455 / down / move 290,395 / up), identical in both attempts:
  `Evaluation error: Error: Pointer drag failed {"x":1064,"y":432,"width":360,"height":452,"top":432,"right":1424,"bottom":884,"left":1064}`
  The scenario expects left 156 / top 372 (a panel that started bottom-left at 16,432 dragged by +140,-60). The panel actually sits bottom-right at (1064,432), so the mouse press at (150,455) never touched the move handle and the rect is unchanged.
- Steps 11–32 never executed (pointer resize 460x470 + screenshot, /floor-lab stage-order check, reinforcement/insulation/services/tablet screenshots, errors). This scenario produced NO screenshots.

### 3. production-live-image — proof/growth/2026-09-09-az3-release/scenarios/production-live-image.json — PASS
- Session az3rel-prod-assistant-run2, attempt 1, exit 0, 13 commands, 3.66 s.
- Runner report: proof/growth/runner/2026-09-08T15-19-30-698Z-az3rel-prod-assistant-run2.json, log proof/growth/runner/2026-09-08T15-19-30-698Z-az3rel-prod-assistant-run2.log.
- Key outputs: open ok; launcher wait `true`; open-panel eval `null`; "+" > New chat ok; drop eval `"Attached generated red test square"`; attachment wait `true`; fill + Send ok; reply wait `true`; final eval `{"provider":"configured live provider","reply":"AssistantThe test image is solid red.","syntheticImage":true}` (reply matched /red/i, no `.assistant-chat-error`, `.assistant-attachments` cleared after the successful send); `errors` printed nothing.
- Exactly ONE message (the generated 32x32 red PNG + the fixed one-sentence question) was sent to the configured provider through the preview server in this pass. Nothing else was sent to the provider.

## Root cause of the two failures (product behaviour of the frozen build vs. the scenarios' expected values; not a harness problem)

- Read-only diagnostic (diag2 session): proof/growth/2026-09-09-az3-release/qa/diag-assistant-placement.json, runner report proof/growth/runner/2026-09-08T15-19-15-342Z-az3rel-prod-assistant-diag2.json / .log, exit 0, 12 commands, 0.68 s. With an empty localStorage (`saved: null` for the v1 key) at 1440x900 the panel opens at left 882 / top 154 (360x452); after focusing "Move live assistant" and pressing Home the rect is `{l:1064,t:432,r:1424,b:884,w:360,h:452}` with bottomGap 16, activeElement "Move live assistant", style `left: 1064px; top: 432px; width: 360px;`, unchanged after a further 300 ms. Home therefore docks the panel bottom-RIGHT (right margin 16, bottom margin 16). The scenario asserts bottom-LEFT (`left === 16`).
- The served bundle carries the storage key `xray:assistant-panel:v2` only; the scenario's final persistence step reads `xray:assistant-panel:v1` and would also fail on this build.
- production-floor-pointer's hard-coded drag coordinates assume the bottom-left default and miss the panel entirely.
- Per the rules the expected values were not changed. Both failures are recorded as valid results; the scenario owner must decide whether the right-side default (and the v2 key) is the intended product behaviour, in which case the two scenarios need new expectations, or a regression against the previously accepted bottom-left behaviour.

## Screenshot inspection (every PNG produced in this pass was opened and looked at)

- screenshots/growth/2026-09-09-az3-release/production-assistant-live-image-reply.png (written 01:19:34 local by production-live-image) — INSPECTED: 1440x900 Sheets pane ("SHEETS · no verified plan", "Open a drawing / Choose a file"); the Live assistant panel is docked bottom-right over the Model Readiness column with header "Live assistant · Connected"; the conversation shows the user attachment as a solid red rectangle captioned "Attached reference", then "Assistant / The test image is solid red."; the composer is empty ("Ask anything about your project…", "+", "Enter to send"); the "Allow drawing edits and saving for this message" checkbox is unticked; the status strip reads Logs 9, Console 0, Errors 0, Status "Build 5dfc922f097f".
- screenshots/growth/2026-09-09-az3-release/production-assistant-diag-placement.png (written 01:19:16 local by the diagnostic, not by a release scenario) — INSPECTED: 1440x900 Sheets pane; after Home the Live assistant panel ("Connected", header with the move handle focused, empty conversation "Ask about your project, draw a layout, search the web or attach an image…") sits in the bottom-right corner with a 16 px margin to the right and bottom edges; status strip "Build 5dfc922f097f", Errors 0.
- No screenshot was produced by production-assistant or production-floor-pointer (both stopped before their first screenshot step).

## Limitations
- production-assistant and production-floor-pointer stopped at their first placement assertion, so on this build the release scenarios did NOT exercise: keyboard move/resize, the "+" menu (Skills, References & inspiration, New chat, Help), reference purpose sync, "/draftsman" conversation, tablet bounds, layout persistence, pointer drag/resize, and the /floor-lab stage screenshots. The first pass's supplementary floor-lab diagnostic (proof/growth/runner/2026-09-08T15-13-44-042Z-az3rel-prod-assistant-diag.*) remains the only floor-lab evidence on this build and does not substitute for the release scenario.
- The two screenshot paths are shared with the first pass; this pass overwrote them with fresh captures (timestamps above). The first pass's runner logs, reports and its dated report copy are intact.
