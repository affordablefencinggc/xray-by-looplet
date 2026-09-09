# Sheet lifecycle slice — 2026-09-07

Implementation owns only `src/studio/sheetLifecycle.ts`, `sheetLifecycle.test.ts`, `SheetManager.tsx`, and `sheetManager.css`. It uses the existing job/document contract and `useStudio` actions. No source bytes, source document records, evidence coordinates or document workspaces are rewritten by metadata actions.

Final integration adds `useSheetLifecycle.ts`. `useSheetLifecycle(jobId, document)` returns `{ value, error, reload }`; it listens for cross-window storage changes and the same-window `xray:sheet-lifecycle-changed` event. `notifySheetLifecycleChanged(key)` is exported for writers. The parent now uses these values for sidebar labels, active sheet ordering and the selected sheet heading. Archive includes a retained-data review, Confirm archive and Cancel. This supersedes the register-only navigation limits below.

## Integration

```tsx
import { SheetManager } from "./SheetManager";
// Within SheetsPane, before its document preview:
<SheetManager />
```

The component manages the active source and includes a source selector for other imported drawings. It supports naming, active-order up/down moves, archive/recover, search and viewing original page indices. Archive removes a page from this register's active list only; the original source and existing page navigation still contain it. The UI explicitly states this scope. All archived sheets can be recovered, including after archiving the entire list.

## Persistence and portable-backup contract

- `sheetSourceIdentity(jobId, document)` returns the validated identity or null for unsupported/unverified sources.
- `sheetLifecycleStorageKey(identity)` binds metadata to job ID, source document ID, SHA-256, import timestamp and page count.
- `parseSheetLifecycle(raw, identity)` strictly checks format, identity and every unique original page index.
- `readSheetLifecycle(identity, storage)` reads a saved sidecar or creates unsaved default names.
- `saveSheetLifecycle(previous, action, storage)` checks the previous complete value before writing. The component calls it inside the storage key's exclusive Web Lock and checks the live source again after acquiring the lock.
- `readJobSheetMetadata(job, storage)` returns JSON array text (or null) for every existing sidecar, including inactive source documents.
- `validateJobSheetMetadata(raw, job)` validates that array against exact job source identities and returns `SheetLifecycle[]`. It rejects unknown and duplicate documents.
- A backup restore may write each validated entry using `sheetLifecycleStorageKey(entry.identity)` and `JSON.stringify(entry)`. Parent integration owns capture/restore atomicity and rollback; this module does not apply project backups.

Storage and quota failures are visible. A failed save does not update the UI as though it succeeded. Corrupt metadata is preserved and editing cannot overwrite it through the component. Browsers without Web Locks can read/view but cannot save metadata; the UI gives a clear error. Cross-window storage events refresh the register. Metadata list order never renumbers the PDF.

## Executed evidence

- `node --experimental-strip-types --test src/studio/sheetLifecycle.test.ts`: seven tests passed, covering source identity, stale writes, ordering across archived slots, all-page recovery, corruption, failed storage and portable inactive-source capture.
- `npm.cmd run typecheck`: passed after the new modules were added.
- No full build, installation, native user profile mutation or CRM change performed by this agent.
- UI integration, desktop/mobile screenshot inspection and production build verification remain parent-owned gates. **No visual completion is claimed by this note.**

## Explicit limits

This slice does not physically delete pages, split or merge PDFs, rewrite source labels, annotate revision clouds, change the existing sidebar navigation order, or share metadata with staff by itself. Those remain separate checklist items. Job backup inclusion depends on the parent's optional records integration.
