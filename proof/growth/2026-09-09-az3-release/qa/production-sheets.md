# AZ3 release QA - production-sheets

- Agent: production-sheets
- Journey: source-sheet lifecycle (D-02 rename / D-04 archive+recover / D-05 tablet + archived row)
- Platform: production browser (agent-browser, default CDP) against the candidate preview http://127.0.0.1:8096/ (hash-verified web artifacts of run 5dfc922f097f served by scripts/preview-built.mjs)
- Build shown in the status strip of every screenshot: `Build 5dfc922f097f`
- Session: `az3rel-prod-sheets-1` (one session for all seven scenarios, opened by the warm-up, closed at the end)
- Result: PASS - 7/7 scenarios exit 0 on the first attempt, no harness edits, no scenario file touched

## Pre-flight

```
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8096/   -> 200
```

Every scenario file was read in full before running (headers all `set viewport` + `open http://127.0.0.1:8096/` + hydration wait; the warm scenario opens and lists the pane nav).

## Commands (repo root, in this order, all in session az3rel-prod-sheets-1)

```
node scripts/fast-cdp-test.mjs az3rel-prod-sheets-1 proof/growth/2026-09-09-az3-release/scenarios/prod-warm.json
node scripts/fast-cdp-test.mjs az3rel-prod-sheets-1 proof/growth/2026-09-09-az3-release/scenarios/prod-sheets-scenario-0-import.json
node scripts/fast-cdp-test.mjs az3rel-prod-sheets-1 proof/growth/2026-09-09-az3-release/scenarios/prod-sheets-scenario-a-rename-desktop.json
node scripts/fast-cdp-test.mjs az3rel-prod-sheets-1 proof/growth/2026-09-09-az3-release/scenarios/prod-sheets-scenario-a2-annotate-desktop.json
node scripts/fast-cdp-test.mjs az3rel-prod-sheets-1 proof/growth/2026-09-09-az3-release/scenarios/prod-sheets-scenario-b-archive-recover-desktop.json
node scripts/fast-cdp-test.mjs az3rel-prod-sheets-1 proof/growth/2026-09-09-az3-release/scenarios/prod-sheets-scenario-c-tablet.json
node scripts/fast-cdp-test.mjs az3rel-prod-sheets-1 proof/growth/2026-09-09-az3-release/scenarios/prod-sheets-scenario-d-archived-row-desktop.json
.temp/npm/_npx/8e62322f9a68a26a/node_modules/agent-browser/bin/agent-browser-win32-x64.exe --session az3rel-prod-sheets-1 close   -> "Browser closed", exit 0
```

## Results

| # | Scenario | Runner report (proof/growth/runner/) | Exit | Attempts | Commands | Seconds |
|---|----------|--------------------------------------|------|----------|----------|---------|
| 0 | prod-warm.json | 2026-09-08T15-10-35-555Z-az3rel-prod-sheets-1.json / .log | 0 | 1 | 6 | 1.33 |
| 1 | prod-sheets-scenario-0-import.json | 2026-09-08T15-10-44-418Z-az3rel-prod-sheets-1.json / .log | 0 | 1 | 12 | 1.38 |
| 2 | prod-sheets-scenario-a-rename-desktop.json | 2026-09-08T15-11-04-720Z-az3rel-prod-sheets-1.json / .log | 0 | 1 | 32 | 2.42 |
| 3 | prod-sheets-scenario-a2-annotate-desktop.json | 2026-09-08T15-11-18-183Z-az3rel-prod-sheets-1.json / .log | 0 | 1 | 34 | 2.46 |
| 4 | prod-sheets-scenario-b-archive-recover-desktop.json | 2026-09-08T15-11-32-151Z-az3rel-prod-sheets-1.json / .log | 0 | 1 | 45 | 2.93 |
| 5 | prod-sheets-scenario-c-tablet.json | 2026-09-08T15-11-47-292Z-az3rel-prod-sheets-1.json / .log | 0 | 1 | 23 | 1.17 |
| 6 | prod-sheets-scenario-d-archived-row-desktop.json | 2026-09-08T15-12-05-890Z-az3rel-prod-sheets-1.json / .log | 0 | 1 | 19 | 1.01 |

(Runner file names are UTC timestamps; local time 2026-09-09 01:10-01:12.)

### Key eval outputs from the logs

**prod-warm**
- `{"hydration":"ready","ready":"complete","title":"X-Ray by Looplet","url":"http://127.0.0.1:8096/"}`
- panes: Overview, Sheets, Measure, Sketch, Components, Model, Render, Review, Cost, Proof. `console` and `errors` empty.

**0-import**
- Model pane -> "Open Redburn BR250157 plan in 3D" -> mesh count 198 wait returned `true`; Sheets list wait (13 li) returned `true`.
- `"Fixture imported: 21-08-26_Redburn_BR250157_Prelim_Council (1).pdf sha b57956f76b5dc893ac2b28a021f3f92e345807e326d6b1f8313e373f9145ad38 pages 13 source web"`

**A rename (desktop 1280x800)**
- Before: `{"calibrations":13,"annotations":0,"runs":0,"gates":0,"order":[0..12],"bookmark":{"id":"df6b5170-...","name":"Entry detail","zoom":1,"aspect":1.414111328125,"center":{"x":0.5,"y":0.5}}}`
- After rename: lifecycle key `xray.sheet-lifecycle.v1:["job-b79e7b09-...","document-7bf42930-...","b57956f7...","2026-09-08T15:10:44.896Z",13]`, page2 = `{"name":"Ground floor plan","discipline":"Architecture","bookmarks":1,"archived":false}`, job counts unchanged, order unchanged.
- `"Heading and navigation show Ground floor plan"`
- After reload: `heading, navigation and lifecycle record keep Ground floor plan / Architecture with 1 saved view; job counts {"calibrations":13,"annotations":0}`

**A2 annotate (desktop)**
- `"Page 2 calibration unlocked, 0 annotations, 13 calibration records"`
- `"Calibration points tapped at 490,562 and 650,562"`; `"Manual two-point candidate present, selected=true"`
- `"Page 2 scale locked: 1 unit = 0.011878036323035074 m, coordinateSpace source-page-v1, candidates 1; still 13 calibration records"`
- `"Annotation drawn on page 2: sketch Manual trace 7.863 m, 3 points, source-page-v1, SHA b57956f7; job counts {"calibrations":13,"annotations":1,"runs":0,"gates":0}"`

**B archive/recover (desktop)**
- Before archive: order [0..12] slot 1; page `{"pageIndex":1,"name":"Ground floor plan","archived":false,"bookmarks":[Entry detail],"discipline":"Architecture"}`; job `{"calibrations":13,"annotations":1,"runs":0,"gates":0,"page2Scale":0.011878036323035074,"annotation":"Manual trace 7.863 m"}`
- Review rows: `["Calibrations retained=1","Measured traces retained=0","Located items retained=0","Annotations retained=1","Linked photos retained=0","Saved views retained=1"]; still Active (13); storage unchanged`
- Archived: `Active (12); page 2 absent from Active list and navigation; storage archived=true; order unchanged; job counts unchanged; page 2 annotation and locked scale byte-identical; status: Sheet archived. Its source and measurements are preserved.`
- After reload: `still archived; navigation hides page 2; sidebar shows Sheet register · 1 archived; job calibrations 13 annotations 1 unchanged`
- Recovered: `order [0..12] equals before; slot 1; page metadata identical; Active list rows ["1".."13"]; job calibrations 13 annotations 1 identical`
- After recover + reload: `page 2 active in slot 1 with name/discipline/1 saved view; job calibrations 13 (page 2 locked at 0.011878036323035074 m/unit), annotations 1 (Manual trace 7.863 m on sheet 1, byte-identical), runs 0, gates 0; lifecycle revision 4`
- `"Recovered page 2 in the Sketch pane: Manual layer enabled (scale still locked) and the Manual trace annotation is listed"`

**C tablet (1024x768)**
- `"Tablet 1024x768: no horizontal overflow; 69 sheet-manager buttons all >= 44x44; job calibrations 13 annotations 1"`
- Review: six rows as above; buttons `[{"label":"Confirm archive","w":109,"h":44,"visible":true},{"label":"Cancel","w":61,"h":44,"visible":true}]; scrollWidth 1024 innerWidth 1024`
- `"Tablet archived list: Recover button 89x44; job calibrations 13 annotations 1 unchanged"`
- `"Tablet recover: page 2 back in slot 1 with metadata; order [0..12]; job calibrations 13 (page 2 locked 0.011878036323035074 m/unit), annotations 1 byte-identical"`

**D archived row (desktop)**
- `"Before: order [0,1,2,3,4,5,6,7,8,9,10,11,12]"`
- `"Archived row visible: ArchitectureGround floor planOriginal page 2 · Viewing · 1 saved viewsView page 2Edit sheetRecover | Recover 89x44"`
- `"Recovered again: order [0,1,2,3,4,5,6,7,8,9,10,11,12] revision 8"`

Every scenario ended with `errors` and reported nothing; the status strip in each screenshot shows Console 0 / Errors 0.

## Harness edits

None. No scenario file was modified. Verified by hashing `JSON.stringify(JSON.parse(file))` of each source scenario and comparing to the `scenarioSha256` in each runner report - all seven match:

```
6ffbc326... prod-warm
60e2cef5... prod-sheets-scenario-0-import
cca4914f... prod-sheets-scenario-a-rename-desktop
f08b4f0b... prod-sheets-scenario-a2-annotate-desktop
e9be8ee7... prod-sheets-scenario-b-archive-recover-desktop
adfd6d00... prod-sheets-scenario-c-tablet
a4ca5ad8... prod-sheets-scenario-d-archived-row-desktop
```

## Screenshot inspection (all 15 opened with the Read tool)

All at screenshots/growth/2026-09-09-az3-release/. Every frame carries the bottom status strip `Logs N · Console 0 · Errors 0 · Status · Build 5dfc922f097f` and the floating "Live assistant" pill.

- `prod-sheets-00-import-sheet-list-desktop.png` - 1280x800 Sheets pane; sidebar PROJECT SHEETS 13 (01 Sheet 1 ... 13 Sheet 13, 01 selected); Sheet register with Active (13) / Archived (0) tabs and source drawing 21-08-26_Redburn_BR250157_Prelim_Council (1).pdf; Model readiness shows Source verification SHA-256.
- `prod-sheets-A1-before-rename-desktop.png` - same Sheets pane with "02 Sheet 2" selected in the sidebar (page 2 viewing, Active (13)), before the rename.
- `prod-sheets-A2-after-rename-desktop.png` - register scrolled to show an "Architecture" group containing "Ground floor plan / Original page 2 · Viewing · 1 saved views" with View page 2 / Edit sheet / arrows / Archive; sidebar reads "02 Ground floor plan".
- `prod-sheets-A3-after-reload-desktop.png` - after reload, sidebar still "02 Ground floor plan", Active (13) / Archived (0), Logs 11.
- `prod-sheets-A4-page2-scale-locked-desktop.png` - Measure pane on Page 2 / 13 of the Redburn PDF (SHA shown); right rail "Calibration LOCKED" for Sheet 2 with two-point manual evidence "1 unit = 0.011878 m", Confidence 100%, "Unlock to change" button; Saved views (1).
- `prod-sheets-A5-page2-annotation-desktop.png` - Sketch pane, Source annotations tab, "Manual layer" pressed, a yellow diagonal trace drawn over the page 2 plan; sidebar "02 Ground floor plan".
- `prod-sheets-B0-renamed-heading-desktop.png` - Sheets pane scrolled to the SOURCE DRAWINGS heading "Ground floor plan" (READY badge) with the page 2 card showing "Preparing source page / Loading page 2" at capture time; register rows Sheet 3-5 above.
- `prod-sheets-B1-archive-review-desktop.png` - inline "Archive Ground floor plan?" review under the Architecture group: Calibrations retained 1, Measured traces 0, Located items 0, Annotations retained 1, Linked photos 0, Saved views 1; "Confirm archive" and "Cancel" buttons; tabs still Active (13).
- `prod-sheets-B2-archived-list-after-reload-desktop.png` - after reload with Archived (1) tab selected; sidebar shows 12 sheets (02 missing) plus a "Sheet register · 1 archived" pill; project record revision 5; the Architecture group header is at the bottom edge (archived row itself below the fold - see limitations).
- `prod-sheets-B3-after-recover-reload-desktop.png` - after recover + reload: Active (13) / Archived (0), sidebar back to 13 sheets with "02 Ground floor plan" selected.
- `prod-sheets-B4-recovered-page-annotation-desktop.png` - Sketch pane on page 2 after recovery; the yellow manual trace is still drawn on the plan, Saved views (1), Logs 12.
- `prod-sheets-C1-archive-review-tablet.png` - 1024x768 layout; sidebar collapsed; "Archive Ground floor plan?" review with all six impact rows and Confirm archive / Cancel fully inside the viewport; no horizontal scrollbar.
- `prod-sheets-C2-archived-list-tablet.png` - tablet Archived (1) tab; status banner "Sheet archived. Its source and measurements are preserved."; Architecture group row "Ground floor plan / Original page 2 · Viewing · 1 saved views" with View page 2 / Edit sheet / Recover.
- `prod-sheets-C3-after-recover-tablet.png` - tablet Active (13) / Archived (0) with banner "Sheet recovered to the active list."; Sheet 1 row and the Architecture group header visible.
- `prod-sheets-D1-archived-row-desktop.png` - desktop Archived (1) tab with the archived row scrolled into view: "Ground floor plan / Original page 2 · Viewing · 1 saved views" + View page 2 / Edit sheet / Recover; sidebar 12 sheets + "Sheet register · 1 archived"; SOURCE DRAWINGS "Ground floor plan" heading below.

## Limitations / observations

- The import scenario completed in 1.38 s including the mesh-count-198 wait. The runner log shows every wait returning `true` and the fixture eval passing (sha b57956f7..., 13 pages, source web), so the assertions held; the speed suggests the agent-browser profile already had the Redburn fixture cached from earlier runs on this machine. I did not clear browser storage (not permitted / not in scope) so I cannot say this was a cold import.
- Screenshot B2 is captured with the register scrolled such that the archived row is below the fold; the DOM assertion (1 `li` + Recover button) passed, and scenario D exists precisely to capture that row in view (D1 shows it). Not a product defect.
- Screenshot B0 shows the page 2 preview in its "Preparing source page" state; the scenario only asserts the heading, not preview readiness.
- Runs were against the candidate preview only; the native app (CDP 9281) and the user preview 8095 were not touched by this agent.
- The runner file timestamps are UTC (2026-09-08T15:10-15:12Z) even though the local date is 2026-09-09.
