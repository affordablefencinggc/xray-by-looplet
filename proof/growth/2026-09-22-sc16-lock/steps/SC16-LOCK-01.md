# SC16-LOCK-01 — exclusive workspace lock, read-only gate, journal playback

SC-16 stays `[[pending]]`. This step is the machine half: an exclusive lifetime lock, the read-only second-tab gate, and journal playback. It does not close the slice.

## Executed

`node --experimental-strip-types --test src/studio/persistence/workspaceLock.test.ts src/studio/persistence/recoveryJournal.test.ts` — exit 0, [receipt](../machine/workspace-lock-test.txt). **16 pass / 0 fail.**

`npx eslint` on the six SC-16 source files — exit 0, [receipt](../machine/eslint.txt).

`npx tsc --noEmit --pretty false` — exit 0, [receipt](../machine/tsc.txt).

The read-only gate was rendered with `react-dom/server` `renderToStaticMarkup` inside the lock test. The markup contains `Project is currently open in another window (Read-Only Mode)` and `Take Over Session`, and `canMountStudio` is false while that gate is up. No browser ran.

## What the tests cover

- B1 / B2: a lease cannot heartbeat before it was acquired, and it cannot expire at the heartbeat instant.
- B5: two tabs racing `requestExclusive` — one `exclusive`, one `read-only`, one held lock.
- B6: `expiresAt` in the past with a heartbeat one second ago is clock skew. `decideLease` returns `read-only`, not `takeover`.
- B7: expiry passed and three missed heartbeats (15s) returns `takeover` with `reason: "stale-reclaim"`. The session test then reclaims once the lock is free.
- Timeout: a fresh heartbeat and a lock that is still held. Take Over waits and returns `still-held`.
- Release: the holder frees the lock and the read-only tab acquires it.
- Live takeover: the holder yields, the asker becomes `exclusive` with `reason: "takeover"`, and the previous holder is read-only.
- Fallback: with no Web Locks backend, two tabs that announce together elect the lower holder id.
- B3 / B4: journal sequences that go backwards, and two uncommitted entries, are rejected.
- B8: an in-flight save rolls back to the previous text. The committed entry stays.
- B9: two in-flight entries quarantine. Stored bytes are not changed, and playback does not throw.
- A second `stageJournalledWrite` while one save is in flight does not replace the target.

## Behaviour that landed

Normal editing now takes `xray:editing-workspace:v1` exclusive, not shared. Web Locks is the authority. A BroadcastChannel heartbeat every 5s carries the holder id and the takeover request, and it is the coordinator when Web Locks is missing. `WorkspaceStartup` does not mount Studio until this tab holds the exclusive lease. A second tab gets the read-only gate and Take Over Session. A corrupt journal pauses editing and does not mount Studio.

`stageJournalledWrite` / `commitStagedWrite` / `recoverStoredJournal` are the journal. Startup calls `recoverStoredJournal` before the lock so a staged crash rolls back before editors mount.

## Still open — do not treat this as acceptance

- **No two-tab browser run.** The human criterion (two live tabs, editing tools locked, Take Over Session) is unmeasured. Raw-CDP campaigns stay on the `dans1` host. The server render above is the gate's markup, not that session.
- **Ordinary project saves are not journalled yet.** `saveFencingJob` does not call `stageJournalledWrite`. An interrupted save of the fencing job does not roll back until a save site stages through the journal. Boot playback only repairs a journal that was actually staged.
- Browsers with neither Web Locks nor BroadcastChannel fail closed instead of opening an unprotected editor.
- A tab with Web Locks and a tab without it can still both write if the no-lock tab won the channel election with a lower holder id. Both modern tabs use Web Locks, and that pair is what B5 covers.
- SC-15's backup contract was not changed. The under-two-second PDF criterion stays unmet (`PROOF-LARGE-PDF-05`).
