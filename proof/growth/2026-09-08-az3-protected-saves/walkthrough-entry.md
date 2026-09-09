## [B-12 / B-13 / B-02] Protected main project record writes (SC-02)

**Date:** 2026-09-08  
**Branch:** `feat/architect-cad-engine`  
**Commit / working state:** `uncommitted on 39a50dc7358ae4058d73296ab0c9f338d0df57dd`  

### Scope

The main job record (`xray:fencing-job:v2`) is now written with a compare-and-swap against the exact bytes this window last loaded or wrote, so a stale window cannot silently overwrite a newer revision saved by another window; a `storage` listener marks the window stale as soon as another window writes; the recovery notice explains that a newer revision exists, offers "Reload latest revision" and a download of this window's unsaved revision. Quota/readback failures keep the previous stored bytes byte-identical and the in-memory edit, and an explicit retry persists it. "Saved" continues to appear only after readback-verified storage.

### Checklist

- [x] `B-12` — Concurrent edit protection: stale writer cannot silently overwrite a newer revision (same-window CAS and cross-window storage event, proven at unit, store and browser level)
- [x] `B-13` — Storage failure recovery: quota error preserves previous data byte-identically and supports retry (store test + tablet CDP proof)
- [x] `B-02` — Automatic save feedback: "Saved" appears only after durable storage succeeds (re-verified, unchanged readback design)
- [x] Evidence / provenance impact reviewed (persistence only; no geometry, takeoff or pricing data changed)
- [x] Desktop proof captured
- [x] Tablet 1024x768 proof captured
- [x] Logic proof captured where applicable

### Files changed

- `src/studio/persistence.ts`
- `src/studio/store.ts`
- `src/studio/ProjectRecoveryNotice.tsx`
- `src/studio/persistence.test.ts`
- `src/studio/projectRecoveryStore.test.ts`
- `proof/growth/2026-09-08-az3-protected-saves/**` (README, code.diff, tests.log, typecheck.log, scenario JSON, this entry)
- `screenshots/growth/2026-09-08-az3-protected-saves/*.png`

### Exact diff summary

- `loadFencingJob` returns `raw` (the stored text it parsed, v2 else legacy). `saveFencingJob` accepts `{ expectedRaw }`; when provided and the stored text differs it returns `{ ok:false, stale:true, error }` without touching storage; on success it returns the bytes written as `raw`. `loadOrCreateProject` creates the first record with `expectedRaw:null`. Readback verification and the legacy key are unchanged.
- Store: new `lastSavedJobRaw`, `projectWriteStale`, `noteExternalProjectWrite`. `saveCurrentProject` passes `expectedRaw = lastSavedJobRaw`; on stale it sets `projectWriteStale`, `persistenceError` and `persistenceRecoveryBlocked` (autosave subscriber already stops on that flag). `hydratePersistence` records `loaded.raw` and clears `projectWriteStale` on success, which `retryProjectLoad` reuses. `storage` event listener added inside the existing `typeof window` block.
- `ProjectRecoveryNotice` gains a stale branch (`data-project-recovery="stale"`) with "Reload latest revision", "Download unsaved revision from this window" and the existing record download; ordinary load-failure branch unchanged.
- Tests: 6 new persistence tests, 3 new store tests, quota test extended with byte-identity assertions. `ProjectDetails.tsx` unchanged.

### Evidence and data status

- **Document source:** `sample` (fresh default project in isolated browser sessions; no plan attached)
- **SHA-256 status:** `not applicable` (no source documents involved)
- **Calibration status:** `not applicable`
- **Affected evidence states:** none (persistence layer only)
- **Quote / BOM status:** `blocked` (unchanged; no pricing or BOM data touched)
- **Limitations:** Main job record only; per-module records keep their existing guards. Not the full restore/write-gate design; no Web Lock lease. Rename flow's own pre-check fires before the store, so the store-level notice was proven via the Components "Add note" autosave. Download buttons asserted present and 44 px, file delivery not exercised via CDP. Footer "Errors 1" is the in-app diagnostics entry for the handled persistenceError, not an uncaught error.

### Verification executed

```text
node --experimental-strip-types --test src/studio/persistence.test.ts src/studio/projectRecoveryStore.test.ts src/studio/domain.test.ts src/studio/projectBackup.test.ts
tests 48, pass 48, fail 0 (proof/growth/2026-09-08-az3-protected-saves/tests.log)
```

```text
node node_modules/typescript/bin/tsc --noEmit
exit 0 (proof/growth/2026-09-08-az3-protected-saves/typecheck.log)
```

```text
node scripts/fast-cdp-test.mjs az3-saves-s1 proof/growth/2026-09-08-az3-protected-saves/scenario-1-same-window-stale.json
30 commands, exit 0 — proof/growth/runner/2026-09-08T12-46-02-084Z-az3-saves-s1.json
node scripts/fast-cdp-test.mjs az3-saves-s2 proof/growth/2026-09-08-az3-protected-saves/scenario-2-two-tabs-storage-event.json
28 commands, exit 0 — proof/growth/runner/2026-09-08T12-46-11-103Z-az3-saves-s2.json
node scripts/fast-cdp-test.mjs az3-saves-s3 proof/growth/2026-09-08-az3-protected-saves/scenario-3-quota-tablet.json
22 commands, exit 0 — proof/growth/runner/2026-09-08T12-46-15-067Z-az3-saves-s3.json
(retained failure: cold-start timeout proof/growth/runner/2026-09-08T12-45-11-025Z-az3-saves-s1.json, exit 1)
```

### Visual proof

- Desktop: `screenshots/growth/2026-09-08-az3-protected-saves/s1-03-stale-notice-desktop.png` (sha256 ecbe6d9794aa963e48919836b45bb2b01e06925209db31d45f25457483c114e5), `s1-04-reloaded-desktop.png` (8c6b9bc0cc91e2a740cab3ea719bd2a954f26a97ec491bd8cf806de93abd97d1), `s2-03-t1-stale-desktop.png` (7f139e6932db2ec056da3556643f6c6a6ac7ce34167613823de559d17ff4421e), `s2-04-t1-reloaded-desktop.png` (0d5a657f1f13bec7f6b9f2497ea7a6a6257ab3b5cd46627c340d194f7d2c29d5)
- Tablet 1024×768: `s3-02-quota-unsaved-tablet.png` (d6da628f500f24ecde360d27f8dc6b6f9d18aa8c60705146a811f8f4df34c4c6), `s3-03-quota-recovered-tablet.png` (053b70587d5aeafe519b92baf841c63576605902659d87475f30a5044343e6c5)
- Interaction state: `s1-02-rename-guard-desktop.png` (1a5ad5566814ffd4ded5ead333d45e2584a4afb25b717e586e8140069b3665ca), `s2-02-t2-renamed-desktop.png` (2f72a1a004ab18e28207a80f5d942e8bdcff0f279c2f9fd3cfc2702cd2a91028); before states `s1-01`, `s2-01`, `s3-01`

### Result

Unit and store tests prove that a stale write is refused with the stored newer bytes byte-identical, that a storage event blocks autosave, that reload adopts the newer revision and clears the stale state, and that quota/silent-write failures leave the previous bytes byte-identical until an explicit retry succeeds. The CDP runs prove the same in the browser: eval assertions on `localStorage` bytes at each step, the stale notice with 44 px buttons at 1280×800, the storage-event path across two tabs, and the quota/retry path at 1024×768 with "Saved · revision 2" only after the retry wrote and read back. Screenshots were inspected and match the asserted DOM state.

### Remaining work

- Extend compare-and-swap to per-module records (BOM, inventory, architecture, price books, sheet metadata) per the restore-transaction plan.
- Consider a Web Lock lease for multi-window editing so the losing window is warned before editing, not only at save.
- Decide whether `ProjectDetails` rename should defer to the store-level stale notice instead of its own inline pre-check (currently both guards exist; behaviour is safe but the messages differ).
- Exercise the unsaved-revision download's file delivery once the agent-browser download path is reliable.
