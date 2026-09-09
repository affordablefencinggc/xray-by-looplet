# B-09 restore audit — 8 September 2026

Read-only audit of the current X-Ray recovery path, followed by a separately authorized narrow backup-capture integrity correction. No editing workspace, original document/photo, user profile or CRM data was written. Full project restore is not implemented by this slice.

## Actual capability and requirement

`planning/professional-coverage/catalogue.mjs:67` requires a portable complete backup that restores sources, models, rates and evidence on a clean profile. Current v2 packages can be saved, downloaded, inspected, imported into a local library, renamed, archived and unarchived. They cannot replace the editing workspace:

- `ProjectBackups.tsx:90–108`: import adds the verified package to the library; it does not hydrate its job.
- `backupRestorePreflight.ts:33,196`: `canApply` is the literal `false`; the port exposes reads only.
- `BackupRestoreReview.tsx:62`: the UI explicitly says applying is unavailable.
- `architect/ArchitectWorkspace.tsx:586–601`: the existing architectural restore validates one design, maps its ID to the current project and commits a new design revision, preserving a raw recovery snapshot. It is not whole-project recovery.
- `ProjectMaterialsPanel.tsx:310–338` and `projectMaterialsPersistence.ts:52`: material-register restore replaces only that register, with its previous raw value archived in the same IndexedDB transaction.

The existing `planning/professional-coverage/restore-transaction-plan.md` remains a useful architecture plan, not evidence of implementation. Its old phone QA wording is superseded by the current tablet/laptop/desktop device scope.

## Capture coverage and omitted information

`projectBackupStorage.ts:25–42` explicitly captures architecture, BOM/review, component inventory, recipes, source-bound takeoff, source-bound connection review, project materials, device reference rates, sheet metadata and supplier books/worksheet. The main job includes active and inactive document workspaces. `backupPhotos` includes inactive-workspace photos. `sheetLifecycle.ts:15` places discipline groups and saved page-view bookmarks inside the captured sheet records.

`projectBackup.ts` validates every non-sample original plan and every referenced photo against the package bytes; supported plan types are PDF, DXF and SVG. The package limit is 200 MB and each original plan has a 100 MB limit. Missing material-source originals block capture rather than silently producing a complete-backup claim.

| Omitted or limited scope | Exact current location | Consequence |
| --- | --- | --- |
| Construction runtime heads, snapshots, assets and commands | `construction/runtime/repository.ts:67–86`, database `xray-construction-runtime-v1` | Separate jobs and history are not captured or restored by main-workspace v2. |
| Source-model location notes and room bounds | `componentLocation.ts:29`, `ComponentLocationMaps.tsx:249` | Actual user notes can remain outside a portable package. |
| Appearance and camera/model views | `buildingAppearance.ts:135–144`, `modelViewSnapshot.ts` | Appearance is separate device storage; latest camera snapshot is in memory. Model assets/preferences are not supplied as project backup originals. |
| Capability checklist selections | `CapabilitiesChecklist.tsx:25,443` | Per-job checklist storage is not in the backup allowlist. |
| Original supplier CSV/XLSX files | `pricing/priceBooks.ts:28–40` | Parsed rate rows, revisions, filename, source hash and mapping are retained, but the source workbook bytes are not stored in this schema or package assets. |
| Prior recovery archives and construction takeoff recovery history | Architecture/material/takeoff persistence adapters | Only current snapshots are captured; older recovery copies are not migrated. |
| Unsaved form edits, undo history, account credentials | Explicit package exclusions | A committed-data package is not a copy of every transient edit or an authenticated staff delivery. |

Do not close whole B-09 after implementing only v2 apply. Distinguish a supported main-workspace restore milestone from the full requirement, and disclose omissions in any handoff.

## Transaction and startup risks

1. `store.ts:2389–2417` immediately reconciles BOM on job change and persists job/BOM/inventory after hydration. Assigning the incoming job directly can persist mixed module state.
2. `store.ts:2187` hydration is one-shot; same-ID restores do not automatically reload architecture, pricing, material and takeoff component sessions. A controlled reload/remount is required after committed storage replacement.
3. **Newer boot behavior:** `persistence.ts:91–104` establishes a durable fallback identity on first open. Journal recovery must run before `hydratePersistence`/`loadOrCreateBrowserProject`, otherwise a clean-profile or interrupted restore can write defaults before replay.
4. **Null/default leakage:** absent inventory becomes `createSampleStructuralInventory()` at `store.ts:2257–2265`, then the hydration subscriber persists it. BOM absence also becomes a default saved envelope. The restore coordinator needs explicit restore-aware default semantics before claiming exact absent-record restoration.
5. `documents.ts:350` and `evidence.ts:264` use ordinary IndexedDB `put`; they can replace an existing original ID. Restore needs atomic absent-or-byte-identical insertion, not a read followed by an unconditional overwrite.
6. `saveBomState` and `saveComponentInventory` have per-key readback/best-effort rollback, but no workspace lease or cross-store journal. Architecture compares its session's raw value; material replacement compares within one transaction. Those protections do not make a multi-store restore atomic.
7. Source/photo import, photo deletion rollback, material scanning and design-material sync can finish asynchronously. A disabled Apply button or frozen main pane does not drain these writers. Gate persistence boundaries and invalidate pending operation epochs.
8. No transaction spans localStorage and plan/photo/material databases. A crash between module writes and active-job switch needs durable replay from raw before-images.
9. A v1 package or v2 omitted optional sheet/price field means “not captured,” not “erase it.” Explicit null means absence. Existing preflight already distinguishes them; keep that policy.
10. A current-project recovery package alone cannot preserve different-project destination module collisions. Journal exact before-images at every destination address, including originally absent records.
11. A matching impact-review fingerprint is not permission to apply. Recheck under exclusive write ownership. Older app windows that do not participate in the gate remain a separate mixed-version risk.
12. `hydrationStatus: ready` can coexist with missing/corrupt asset readiness. Post-restore acceptance must verify original assets and saved modules, not only this status flag.

## Smallest dependency-ready implementation split

| Owner surface | Files | Contract |
| --- | --- | --- |
| Main workspace integration | `store.ts`, `persistence.ts`, `Studio.tsx` | Recovery before boot writes; stop/drain async operations; restore-aware hydration/defaults; reload after commit. |
| Pure coordinator / concurrency | New `workspaceWriteGate.ts`, `workspaceRestore.ts`, tests | Explicit state machine, workspace lease, expected-value comparisons, deterministic refusal/rollback. |
| Durable storage | New `workspaceRestoreStorage.ts`; narrow plan/photo/material adapter extensions | Journal with before/after raw values, immutable incoming/recovery packages, insert-or-identical original bytes, transactional material replace-or-delete. |
| Review/recovery UI after coordinator gates | `BackupRestoreReview.tsx`, `ProjectBackups.tsx` | Review complete impact, preserve “Before restore” backup, report refusal, recovery-required state and success without misleading Apply availability. |

Recommended sequence: validate incoming package; freeze/drain participating writers; acquire an exclusive workspace lease; recheck preview fingerprint; preserve the current package and exact destination before-images; persist a durable journal; add only absent or identical originals; replace supported module records with readback; switch the active job last; persist commit; reload through recovery-aware boot and verify all required originals/modules before editing resumes.

On failure, rollback only values still equal to the planned before/after image. A third value means outside interference: preserve it and stop with recovery required. Retain newly inserted original blobs and recovery backups; never delete originals as speculative cleanup. If journal or rollback storage fails, keep editing blocked across restart.

Required proof before Apply: cancel unchanged; stale review refusal; corrupt/colliding assets refused; quota/journal failure before mutation; injected failure after each store write; process close/reopen in each phase; competing-window and late-promise writes; same-ID older restore; different-ID destination collision; raw null restoration; original PDF/photo hashes; fresh-profile browser and isolated native restoration. No normal working-data failure injection.

## Narrow integrity correction authorized in this slice

Owned source changes are only `projectBackup.ts` and `projectBackup.test.ts`:

- Previously the final live-job comparison ran before awaiting the second records read. A job edit completing during that await escaped detection. The live job is now checked after the final await.
- Capture now uses a detached validated job and detached records, so async iteration remains tied to the initial snapshot.
- Imported package validation now compares detected plan kind with the job document kind, alongside existing hash/MIME/page checks.
- Capture rejects wrong stored plan identity/kind/byte length and wrong photo identity rather than concealing them when constructing asset metadata.
- Originals are reread and their actual bytes hashed before returning the package, detecting observed removal/replacement even when the job and module records remain unchanged. Inactive-workspace photo evidence is included in this check.

These are consistency observations, not atomic snapshot isolation: an uncooperative writer can still modify storage after its last read. The package remains self-contained and validated, but full capture/apply isolation requires the write gate described above. No backup format, record schema or persisted working value changes in this slice.

Four new regression cases exercise late asynchronous job mutation, original removal/byte/metadata mutation, inactive-photo mutation and stored identity/kind/size mismatch. Existing format compatibility, complete originals, record validation and round-trip tests remain. Focused executed output and hashes are stored beside this audit; there is no new UI acceptance claim.

The parallel authored-sheet implementation adds one further integration regression: three helper-created drawing sheets retain their layouts, names, order, archive state and active selection as exact architecture raw JSON through capture and parsing. An active-sheet projection mismatch is rejected. It adds no backup format field.

Final focused execution: `node --experimental-strip-types --test src/studio/projectBackup.test.ts src/studio/backupRestorePreflight.test.ts` — 29 passed, zero failed/skipped/cancelled; `backup-integrity-final-tests.log`. Application typecheck output is in `backup-integrity-typecheck-03.log`. Earlier failures are retained: a PowerShell npm shim execution-policy failure did not run TypeScript; the first npm.cmd run found another agent's in-progress authored-sheet narrowing issue; the next found an optional-sheetSet assertion in the new test, corrected before the final run.
