# AZ3 release QA - production-saves

- Agent: production-saves
- Platform: production browser (agent-browser, Chromium) against the candidate preview http://127.0.0.1:8096/ (hash-verified web artifacts of run 5dfc922f097f, served by scripts/preview-built.mjs). The status strip in every screenshot reads `Build 5dfc922f097f`.
- Journey: protected project saves (B-12 rename guard / B-13 storage-event stale notice / B-02 quota failure and retry)
- Session: `az3rel-prod-saves-main` (one session for all four scenarios; prod-saves-2 opens a second tab inside it). Closed at the end (`Browser closed`, exit 0).
- Result: PASS - 4/4 scenarios exit 0 on the first attempt, 0 harness edits, 11 screenshots inspected.

## Pre-flight

```
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8096/   -> 200
head -3 proof/growth/2026-09-09-az3-release/scenarios/{prod-warm,prod-saves-1,prod-saves-2,prod-saves-3-tablet}.json
```
Full scenario files were read before running. No process was started, stopped or restarted; no file under src/, scripts/, public/, src-tauri/ or any root ledger was touched; no git commands were run. Preview re-checked after the run: still 200.

## Commands (run from the repo root, in order)

```
node scripts/fast-cdp-test.mjs az3rel-prod-saves-main proof/growth/2026-09-09-az3-release/scenarios/prod-warm.json
node scripts/fast-cdp-test.mjs az3rel-prod-saves-main proof/growth/2026-09-09-az3-release/scenarios/prod-saves-1.json
node scripts/fast-cdp-test.mjs az3rel-prod-saves-main proof/growth/2026-09-09-az3-release/scenarios/prod-saves-2.json
node scripts/fast-cdp-test.mjs az3rel-prod-saves-main proof/growth/2026-09-09-az3-release/scenarios/prod-saves-3-tablet.json
.temp/npm/_npx/8e62322f9a68a26a/node_modules/agent-browser/bin/agent-browser-win32-x64.exe --session az3rel-prod-saves-main close
```

## Results

| # | Scenario | Exit | Attempts | Commands | Seconds | Runner report (.json) | Log |
|---|---|---|---|---|---|---|---|
| 0 | prod-warm.json | 0 | 1 | 6 | 1.33 | proof/growth/runner/2026-09-08T15-09-54-205Z-az3rel-prod-saves-main.json | proof/growth/runner/2026-09-08T15-09-54-205Z-az3rel-prod-saves-main.log |
| 1 | prod-saves-1.json | 0 | 1 | 30 | 0.94 | proof/growth/runner/2026-09-08T15-10-02-727Z-az3rel-prod-saves-main.json | proof/growth/runner/2026-09-08T15-10-02-727Z-az3rel-prod-saves-main.log |
| 2 | prod-saves-2.json | 0 | 1 | 28 | 1.10 | proof/growth/runner/2026-09-08T15-10-27-222Z-az3rel-prod-saves-main.json | proof/growth/runner/2026-09-08T15-10-27-222Z-az3rel-prod-saves-main.log |
| 3 | prod-saves-3-tablet.json | 0 | 1 | 22 | 0.57 | proof/growth/runner/2026-09-08T15-10-47-988Z-az3rel-prod-saves-main.json | proof/growth/runner/2026-09-08T15-10-47-988Z-az3rel-prod-saves-main.log |

Scenario SHA-256 recorded by the runner: warm 6ffbc326b4eb2dfbe423c1ce0a1a761a6e77aaebde3a78720cb6a5bac1a39ee0; saves-1 7bff8077763885f3b2caf3d0119e0df16428e203b042f75e3b9a444353064727; saves-2 219437e2e02222b602009c4cd6f27e32577ebf95d2881d9c23b0579be5caaebd; saves-3 59bd7b53062ebe4db2ee6f34559aaff09e9a7f56f341c9c1632f0209be96d49e. The runner's saved `.scenario.json` copies sit beside each log.

The first-command 10060 timeout did not occur; no retries were needed.

### prod-warm - key eval outputs
- `{hydration:"ready", ready:"complete", title:"X-Ray by Looplet", url:"http://127.0.0.1:8096/"}`
- panes: Overview, Sheets, Measure, Sketch, Components, Model, Render, Review, Cost, Proof
- `console` / `errors` opcodes printed nothing.

### prod-saves-1 (B-12 rename guard + autosave stale notice, 1280x800) - key eval outputs
- Baseline stored job: `{name:"New project", revision:1, bytes:817}`
- Foreign write injected into localStorage: `{foreignRevision:2, bytes:827}`
- Rename guard after "Save project name": `{renameGuard:"refused-before-store-write", storedEqualsForeign:true, visibleName:"New project"}` - stored bytes still equal the foreign revision, h2 not renamed, no `[data-project-recovery]` at this stage.
- Autosave (Components > add note) hit the stale guard: `[data-project-recovery="stale"]` alert = "A newer revision of this project was saved by another window. This window's change was not written so the newer revision is preserved. Reload the latest revision to continue, or download this window's unsaved revision first." storedEqualsForeign:true, storedBytes:827, viewport [1280,800], no horizontal overflow. Buttons all 44px tall and hit-testable: Reload latest revision (140x44), Download unsaved revision from this window (267x44), Download saved project record (191x44).
- After "Reload latest revision" + Sheets: `{visibleName:"Other window revision", status:"Project record saved on this device · revision 2", storedEqualsForeign:true}`
- `errors` opcode printed nothing.

### prod-saves-2 (B-13 storage-event stale notice across two tabs, 1280x800) - key eval outputs
- t1 loaded: `{t1Name:"Other window revision", t1Revision:2}` (carried over from scenario 1 in the same session's localStorage)
- t2 (new tab) rename persisted: `{t2StoredName:"Second window name", t2Revision:3, status:"Project record saved on this device · revision 3"}`
- Back in t1 the storage event raised `[data-project-recovery="stale"]`: alert = "Another window saved a newer revision of this project. Saving from this window is paused so the newer revision is not overwritten. Reload the latest revision to continue, or download this window's unsaved revision first." storedName "Second window name", storedRevision 3, editing UI (`[aria-label="Current project"]`) unmounted, no horizontal overflow, same three 44px-tall buttons (140/267/191 wide).
- After "Reload latest revision": `{t1VisibleName:"Second window name", status:"Project record saved on this device · revision 3"}`
- `errors` opcode printed nothing.

### prod-saves-3-tablet (B-02 quota failure + retry, 1024x768) - key eval outputs
- Baseline: `{name:"Second window name", revision:3, bytes:1069}`
- Injected `QuotaExceededError` on `localStorage.setItem('xray:fencing-job:v2')` -> `"quota-injected"`
- After "Save project name": `[data-project-save=unsaved]` present; `{storedEqualsBefore:true, visibleName:"Quota retry name", alert:"Could not save the project: Injected quota failure", buttons:[{Retry saving project 131x44}], viewport:[1024,768]}`; no `[data-project-record-save=saved]` (no false saved claim); `[data-project-record-save=unconfirmed]` text matches /not confirmed/; no `[data-project-recovery]` (quota not misreported as stale).
- Hook restored -> `"quota-restored"`; "Retry saving project" then "Cancel name edit": `{storedName:"Quota retry name", storedRevision:4, previousRevision:3, status:"Project record saved on this device · revision 4"}`
- `errors` opcode printed nothing.

## Screenshot inspection (all 11 opened with the Read tool)

Directory: screenshots/growth/2026-09-09-az3-release/

1. prod-saves-v2-s1-01-before-desktop.png - 1280x800 Sheets pane; Current project card reads "New project / Job revision 1 · local workspace / Project record saved on this device · revision 1" with a Rename project button; Model readiness rail on the right; status strip "Logs 9 Console 0 Errors 0 Status Build 5dfc922f097f".
2. prod-saves-v2-s1-02-rename-guard-desktop.png - Same pane with the name editor open: input holds "Rename attempt in stale window", Save project name / Cancel name edit buttons, and the guard message "The project changed while you edited its name. Cancel and reopen the name editor to use the latest version."; header still says "New project · revision 1"; strip Errors 0.
3. prod-saves-v2-s1-03-stale-notice-desktop.png - Components pane replaced by the "NEWER REVISION EXISTS" recovery panel: heading "A newer revision of this project was saved by another window", the full stale message, three buttons (Reload latest revision, Download unsaved revision from this window, Download saved project record) laid out in one row, explanatory footer; strip "Logs 11 Console 0 Errors 1".
4. prod-saves-v2-s1-04-reloaded-desktop.png - Sheets pane after reload: "Other window revision / Job revision 2 · local workspace / Project record saved on this device · revision 2"; recovery panel gone; strip "Logs 17 Errors 1".
5. prod-saves-v2-s2-01-t1-before-desktop.png - Tab t1, Sheets pane: "Other window revision / Job revision 2 / Project record saved on this device · revision 2"; strip Errors 0.
6. prod-saves-v2-s2-02-t2-renamed-desktop.png - Tab t2, Sheets pane: "Second window name / Job revision 3 / Project record saved on this device · revision 3" plus the status line "Project name saved on this device. New backups use this name."; strip Errors 0.
7. prod-saves-v2-s2-03-t1-stale-desktop.png - Tab t1 after the storage event: Sheets pane body replaced by the "NEWER REVISION EXISTS" panel with the "Another window saved a newer revision of this project. Saving from this window is paused..." message and the same three buttons; the Current project card is not rendered; strip "Logs 10 Errors 1".
8. prod-saves-v2-s2-04-t1-reloaded-desktop.png - Tab t1 after Reload latest revision: "Second window name / Job revision 3 / Project record saved on this device · revision 3"; panel gone; strip "Logs 15 Errors 1".
9. prod-saves-v2-s3-01-before-tablet.png - 1024x768 Sheets pane: "Second window name / Job revision 3 / Project record saved on this device · revision 3"; layout reflowed for tablet (narrower main column, readiness rail still visible); strip Errors 0.
10. prod-saves-v2-s3-02-quota-unsaved-tablet.png - Top banner "Project changes are not confirmed saved / Could not save the project: Injected quota failure / Keep this window open. Retry saving after resolving the storage problem." with a Retry saving project button; Current project card shows "Quota retry name / Job revision 4 / Project record save is not confirmed", the name editor still open with "Quota retry name", Rename project greyed out, and the inline error "Could not save the project: Injected quota failure"; no horizontal scrollbar; strip "Logs 10 Errors 1".
11. prod-saves-v2-s3-03-quota-recovered-tablet.png - Banner gone; "Quota retry name / Job revision 4 · local workspace / Project record saved on this device · revision 4"; editor closed; strip "Logs 11 Errors 1".

## Harness edits

None. All four scenario files were run byte-for-byte as found (SHA-256 above).

## Observations (not failures)

- The in-app status strip's "Errors" badge goes to 1 after each guarded/failed save (stale refusal in s1/s2, injected quota failure in s3) and stays at 1 for the rest of that page lifetime. This is the app's own log counter recording the refused write; the runner's `errors` opcode (page exceptions captured by agent-browser) returned nothing in every scenario. Reviewers should not read the badge as an uncaught exception.
- Scenarios are stateful across the session: s2 starts from the localStorage left by s1 (revision 2) and s3 from s2 (revision 3). The scenarios take a fresh baseline at the start, so this did not affect any assertion, but the reported names/revisions in the logs reflect that ordering.

## Limitations

- Storage is Chromium localStorage in the agent-browser profile; no real quota exhaustion was exercised - the quota path is driven by an injected `QuotaExceededError` on `Storage.prototype.setItem` as the scenario specifies.
- The "Download unsaved revision from this window" and "Download saved project record" buttons were asserted for presence, size and hit-testability only; the scenarios do not click them, so the downloads themselves were not verified here.
- No mobile (<1024px) viewport was in scope for this journey; the smallest viewport run was 1024x768.
- The native (Tauri, CDP 9281) equivalents are covered by a separate agent; this report is browser-only.
