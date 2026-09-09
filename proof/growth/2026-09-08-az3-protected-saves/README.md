# SC-02 — Protected main project record writes (B-12 / B-13 / B-02)

Date: 2026-09-08 · Branch: `feat/architect-cad-engine` · Working state: uncommitted on top of `39a50dc7358ae4058d73296ab0c9f338d0df57dd`
Agent-browser sessions opened and closed: `az3-saves-s1`, `az3-saves-s2`, `az3-saves-s3` (all closed with `agent-browser --session <name> close`, exit 0).

## What changed (see `code.diff`)

| File | Change |
|---|---|
| `src/studio/persistence.ts` | `JobLoadResult.raw` reports the exact stored text a load parsed (v2 key, else legacy key). `saveFencingJob(job, storage, { expectedRaw })` is a compare-and-swap: when `expectedRaw` is given and the currently stored text differs, the write is refused with `{ ok:false, stale:true, error }` (message names the other window and offers reload) and storage is untouched. Success now returns `raw` (the bytes written). Readback verification and legacy fallback unchanged. `loadOrCreateProject` writes the first record with `expectedRaw: null` so the window that initialised first keeps its record. `STALE_PROJECT_WRITE_MESSAGE` exported. |
| `src/studio/store.ts` | New state `lastSavedJobRaw: string | null`, `projectWriteStale: boolean`; new action `noteExternalProjectWrite(newValue)`. `saveCurrentProject` passes `expectedRaw = lastSavedJobRaw`; on ok it records `lastSavedJobRaw`/`lastSavedJobRevision`; on stale it sets `projectWriteStale`, `persistenceError` and `persistenceRecoveryBlocked` (the existing autosave subscriber then stops). `hydratePersistence` resets `lastSavedJobRaw` at start and records `loaded.raw` and `projectWriteStale:false` on success (used by `retryProjectLoad`). A `window.addEventListener("storage")` listener inside the existing `typeof window` block calls `noteExternalProjectWrite` for the v2 job key. |
| `src/studio/ProjectRecoveryNotice.tsx` | Stale branch (`data-project-recovery="stale"`): heading "A newer revision of this project was saved by another window", `role="alert"` message, buttons "Reload latest revision" (calls `retryProjectLoad`), "Download unsaved revision from this window" (JSON of the in-memory job), "Download saved project record" (existing). Ordinary load-failure branch unchanged. `.pill` buttons keep `min-height:44px` from `projectDetails.css`. |
| `src/studio/persistence.test.ts` | +6 tests (stale refusal leaves bytes byte-identical; matching `expectedRaw` succeeds and returns raw; first-write empty-slot semantics; readback mismatch still fails after CAS passes; CAS read failure writes nothing; legacy-only load reports raw and can be saved with it, then legacy raw becomes stale). Existing deep-equal assertions updated for the new `raw` field. |
| `src/studio/projectRecoveryStore.test.ts` | Fake window gains `addEventListener`; +3 store tests (same-window stale autosave refused, newer bytes survive, reload adopts; storage event marks stale/blocks autosave/reload clears; pre-hydration and own-write echoes ignored). Quota test extended: stored bytes asserted byte-identical during quota and silent-write failures, `lastSavedJobRaw` tracked, quota is not reported as stale, retry remains available. |

`ProjectDetails.tsx` was not changed.

## Executed commands and results

```text
node --experimental-strip-types --test src/studio/persistence.test.ts src/studio/projectRecoveryStore.test.ts src/studio/domain.test.ts src/studio/projectBackup.test.ts
→ tests 48, pass 48, fail 0 (raw output: tests.log). Before implementation the 11 new/extended assertions failed (red first), then passed after the change.

node node_modules/typescript/bin/tsc --noEmit
→ exit 0, empty output (typecheck.log)

git diff --check -- <the five source files>
→ exit 0
```

## Fast CDP proof (dev server http://127.0.0.1:8080, reused, not restarted)

Fixture identity: each session is a fresh isolated agent-browser profile, so the app created its default project on first open: name `New project`, revision 1, stored v2 record 817 bytes. No sample plan attached. All scenario JSON files are in this directory; the runner saved copies, logs and reports under `proof/growth/runner/`.

| Scenario | Session | Runner report (exit) | Result |
|---|---|---|---|
| `diagnose-open.json` first attempt of scenario 1 | az3-saves-s1 | `proof/growth/runner/2026-09-08T12-45-11-025Z-az3-saves-s1.json` (exit 1) | Cold-start timeout on the very first command of a brand-new session (log contains only "Operation timed out"); retained as a failure. |
| `diagnose-open.json` (warm-up + pane list) | az3-saves-s1 / s2 / s3 | `…T12-45-55-642Z-az3-saves-s1.json`, `…T12-46-09-213Z-az3-saves-s2.json`, `…T12-46-13-087Z-az3-saves-s3.json` (exit 0) | Hydration reaches `ready`; the ten panes are present; `errors` empty. |
| `scenario-1-same-window-stale.json` (desktop 1280×800) | az3-saves-s1 | `proof/growth/runner/2026-09-08T12-46-02-084Z-az3-saves-s1.json` (30 commands, 1.38 s, exit 0) | See below. |
| `scenario-2-two-tabs-storage-event.json` (desktop 1280×800, tabs t1/t2) | az3-saves-s2 | `proof/growth/runner/2026-09-08T12-46-11-103Z-az3-saves-s2.json` (28 commands, 1.76 s, exit 0) | See below. |
| `scenario-3-quota-tablet.json` (tablet 1024×768) | az3-saves-s3 | `proof/growth/runner/2026-09-08T12-46-15-067Z-az3-saves-s3.json` (22 commands, 0.97 s, exit 0) | See below. |

### Scenario 1 — same-window stale write (B-12, compare-and-swap)

1. Sheets pane, stored record captured (`New project`, revision 1, 817 bytes).
2. Rename flow with a foreign newer revision written by `eval` after the name editor opened (name `Other window revision`, revision 2, 827 bytes, no storage event fires in the same tab). Clicking **Save project name** was refused by the existing `ProjectDetails` stored-bytes check ("The project changed while you edited its name…"); eval asserted the stored bytes are byte-identical to the foreign revision and the visible name stayed `New project`. This is the rename flow's own pre-check; it runs before the store is touched, so the store-level guard is exercised by the next step.
3. Store-level path: Components pane → "Add trade or specification note" → **Add note** (`addTrade` bumps the job revision and triggers autosave). `saveCurrentProject` refused the write (`stale:true`); eval asserted stored bytes === foreign bytes (827), the stale notice message ("A newer revision of this project was saved by another window…"), all three buttons present at 44 px height, hit-testable, no horizontal overflow.
4. **Reload latest revision** → notice gone → Sheets shows `Other window revision`, "Project record saved on this device · revision 2"; eval asserted the stored bytes were still byte-identical to the foreign revision after reload (reload does not write).
5. `errors` → no uncaught runtime errors.

### Scenario 2 — two tabs, storage event (B-12, cross-window)

t1 opened and hydrated (`New project`, revision 1). t2 opened at the same URL, renamed the project to `Second window name`; t2 showed revision 2 saved and "Project name saved on this device". Switching to t1: the DOM wait resolved on `[data-project-recovery="stale"]` produced by the `storage` event (no sleep). Eval asserted the alert text "Another window saved a newer revision…", the stored record's name `Second window name`, the editing UI unmounted, three buttons at 44 px. **Reload latest revision** → t1 shows `Second window name`, "revision 2" saved. `errors` empty.

### Scenario 3 — quota failure and retry (B-13 / B-02, tablet 1024×768)

Rename to `Quota retry name` with `Storage.prototype.setItem` throwing `DOMException('Injected quota failure','QuotaExceededError')` for the v2 job key. Eval asserted: stored bytes byte-identical to the pre-failure record (817 bytes), in-memory name retained (`Quota retry name`), no `data-project-record-save=saved` claim, status "Project record save is not confirmed", unsaved notice with the quota message and a 44 px "Retry saving project" button, no stale notice (quota is not stale), no horizontal overflow. After restoring `setItem`, **Retry saving project** → unsaved notice gone, "Project record saved on this device · revision 2", stored record name `Quota retry name`, revision advanced 1 → 2. `errors` empty.

## Screenshots (all opened and inspected with the Read tool)

Directory: `screenshots/growth/2026-09-08-az3-protected-saves/`

| File | Viewport | What is visible |
|---|---|---|
| `s1-01-before-desktop.png` | 1280×800 | Sheets pane. "CURRENT PROJECT / New project / Job revision 1 · local workspace / Project record saved on this device · revision 1", Rename project button, Sheet register, right rail Model readiness. Footer: Logs 9, Console 0, Errors 0. |
| `s1-02-rename-guard-desktop.png` | 1280×800 | Rename form open with input "Rename attempt in stale window", Save/Cancel buttons; alert "The project changed while you edited its name. Cancel and reopen the name editor to use the latest version."; name still "New project", revision 1 saved. Errors 0. |
| `s1-03-stale-notice-desktop.png` | 1280×800 | Components pane replaced by the stale notice: kicker "NEWER REVISION EXISTS", heading "A newer revision of this project was saved by another window", the compare-and-swap message, explanation, buttons "Reload latest revision", "Download unsaved revision from this window", "Download saved project record", small note about reloading. Footer Errors 1 (in-app diagnostics entry for the handled persistenceError, see limitations). |
| `s1-04-reloaded-desktop.png` | 1280×800 | Sheets pane: "Other window revision / Job revision 2 · local workspace / Project record saved on this device · revision 2". Notice gone. |
| `s2-01-t1-before-desktop.png` | 1280×800 | t1 Sheets pane: "New project", revision 1 saved. Errors 0. |
| `s2-02-t2-renamed-desktop.png` | 1280×800 | t2 Sheets pane: "Second window name / Job revision 2 / Project record saved on this device · revision 2", status "Project name saved on this device. New backups use this name." Errors 0. |
| `s2-03-t1-stale-desktop.png` | 1280×800 | t1 Sheets pane replaced by the stale notice with the storage-event message "Another window saved a newer revision of this project. Saving from this window is paused…", three buttons. Errors 1 (diagnostics entry). |
| `s2-04-t1-reloaded-desktop.png` | 1280×800 | t1 Sheets pane: "Second window name / Job revision 2 / Project record saved on this device · revision 2". |
| `s3-01-before-tablet.png` | 1024×768 | Tablet layout, Sheets pane: "New project", revision 1 saved. No horizontal overflow. Errors 0. |
| `s3-02-quota-unsaved-tablet.png` | 1024×768 | Top card "Project changes are not confirmed saved / Could not save the project: Injected quota failure / Keep this window open…" with "Retry saving project"; Current project card shows "Quota retry name / Job revision 2 / Project record save is not confirmed", Rename project disabled, name form still open with the inline alert. Errors 1 (diagnostics entry). |
| `s3-03-quota-recovered-tablet.png` | 1024×768 | Unsaved card gone; "Quota retry name / Job revision 2 / Project record saved on this device · revision 2". |

SHA-256 of the screenshots is recorded in `walkthrough-entry.md`.

## Limitations (stated explicitly)

- Scope is the main job record (`xray:fencing-job:v2`) only. Per-module records (BOM, component inventory, architecture, price books, sheet metadata, materials) keep their existing guards; they are not covered by this compare-and-swap.
- This is not the full restore/write-gate transaction design in `planning/professional-coverage/restore-transaction-plan.md`; no Web Lock lease was added. The guard is a read-compare-write on localStorage in one synchronous tick, which is sufficient for a single-threaded window but is not a cross-process lock.
- The rename flow in `ProjectDetails.tsx` has its own stored-bytes pre-check that refuses before the store is reached; in scenario 1 the store-level notice was therefore demonstrated through the Components "Add note" edit (which autosaves via `saveCurrentProject`), not through Rename. `ProjectDetails.tsx` was not modified.
- The two download buttons in the stale notice were asserted present, labelled and ≥44 px, but the actual file delivery was not exercised through CDP (a previous slice documented agent-browser download-path failures). The unsaved-revision download serialises the in-memory job only; it is not a complete backup of drawings and photos, and the notice says so.
- Footer "Errors 1" in the stale/quota screenshots is the WorkspaceDiagnostics counter that logs the handled `persistenceError` as an in-app diagnostic entry; it is not an uncaught runtime error. The runner's `errors` opcode was empty in all three scenarios.
- The first scenario-1 attempt on a brand-new session timed out on its first command (cold Chrome start); it is retained in `proof/growth/runner/2026-09-08T12-45-11-025Z-az3-saves-s1.*` and the scenario passed unchanged on the warm session.
- A storage event with `newValue === null` (another window cleared the record) is also reported as "newer revision"; on reload `loadOrCreateProject` would then create a new record from this window's in-memory job. Not exercised.
- Device scope: desktop and tablet landscape only; no phone claim.

## Coordinator follow-up (2026-09-08 23:04) — two minor verifier findings closed

Independent verifiers accepted SC-02 (no blocker/major findings) and raised two minor points, both fixed by the coordinator within the slice's files:

1. `projectWriteStale` was only cleared by a successful reload, so a reload that failed (unreadable record or storage read error) kept the "newer revision exists" heading in front of a load-failure message. `hydratePersistence` now clears `projectWriteStale` in both failure branches (`src/studio/store.ts`), so the ordinary preservation notice with its retry/download actions is shown instead. New store test: "a failed reload after a stale event shows the load-failure notice, not the newer-revision heading" (unreadable JSON and a storage read error; the unreadable bytes stay untouched).
2. The stale notice repeated its message in a second paragraph; `src/studio/ProjectRecoveryNotice.tsx` now shows the `role="alert"` message once plus the existing consequence note.

Executed:

- `node --experimental-strip-types --test src/studio/persistence.test.ts src/studio/projectRecoveryStore.test.ts src/studio/domain.test.ts src/studio/projectBackup.test.ts` → tests 49, pass 49, fail 0 (`tests-root-followup.log`).
- `node node_modules/typescript/bin/tsc --noEmit` → exit 0 (`typecheck-root-followup.log`).
- `node scripts/fast-cdp-test.mjs az3-root-saves-s2 scenario-2-two-tabs-storage-event-v2.json` → exit 0, 28 commands (`proof/growth/runner/2026-09-08T13-03-48-208Z-az3-root-saves-s2.json`); screenshots `screenshots/growth/2026-09-08-az3-protected-saves/v2-s2-*.png`. `v2-s2-03-t1-stale-desktop.png` inspected: heading "A newer revision of this project was saved by another window", the message shown once, three 44 px buttons, no duplicate paragraph.
- `node scripts/fast-cdp-test.mjs az3-root-saves-s1 scenario-1-same-window-stale-v2.json` → first attempt exit 1 on a cold session (os error 10060 on command 1, `2026-09-08T13-03-17-900Z-az3-root-saves-s1`, retained as a failed run); after warming the session with `diagnose-open.json` (exit 0) the scenario passed, exit 0, 30 commands, 1.24 s (`2026-09-08T13-04-29-675Z-az3-root-saves-s1.json`); screenshots `v2-s1-*.png`.
- Sessions `az3-root-saves-s1` and `az3-root-saves-s2` closed (Browser closed).

The original `s1-*`/`s2-*` screenshots and their hashes are retained as the pre-fix state. Scope unchanged: main job record only; development server only.

## Coordinator follow-up 2 (2026-09-08 23:34) — quota/retry re-run against the final bytes

The critic noted that scenario 3 had only run before the follow-up edits and only at tablet size. Re-run against the final `store.ts`: tablet 1024x768 `scenario-3-quota-tablet-v2.json` → exit 0, 22 commands (`proof/growth/runner/2026-09-08T13-34-14-737Z-az3-root-saves-s3.json`, screenshots `v2-s3-*.png`); desktop 1280x800 `scenario-3-quota-desktop-v2.json` (same steps, viewport changed) → exit 0, 22 commands (`2026-09-08T13-34-15-696Z-az3-root-saves-s3.json`, screenshots `v2d-s3-*.png`). `v2d-s3-02-quota-unsaved-desktop.png` inspected: "Project changes are not confirmed saved · Could not save the project: Injected quota failure" with the 44 px "Retry saving project" button, the in-memory name "Quota retry name" retained, "Project record save is not confirmed", status strip Errors 1 (the handled diagnostics entry). The other chat's floating Live assistant pill overlaps the Sheet register heading in that capture; it is outside this slice's files. Session `az3-root-saves-s3` closed.
