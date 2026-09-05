# Construction runtime foundation

Import from `src/studio/construction/runtime/index.ts`. This is an isolated browser IndexedDB API; no Studio/store integration, pricing executor, account system or legacy-storage migration is installed. Direct imports use the neutral contract and lifecycle modules, avoiding the legacy/domain adapter dependency.

```ts
const repository = new ConstructionRepository();
const created = await repository.create(jobAtRevisionOne, originalAssets, {
  commandId: 'create-project-1', actor: 'local-estimator', occurredAt: jobAtRevisionOne.createdAt,
});
const opened = await repository.open('project-1');
const bytes = await repository.original('project-1', 'source-asset-1');
const result = await repository.execute(command, optionalNewOriginalAssets);
```

`OriginalAsset` is `{ assetId: string; bytes: ArrayBuffer }`. Originals must be nonempty and at most100MiB each. Creation requires all referenced originals and draft measurements. Actual bytes are copied and SHA-256 checked against each source; claimed hash flags are insufficient. Open, original retrieval, snapshot load and commands rehash stored source bytes. Imported legacy extension assets also undergo byte/hash checks; existing legacy storage is never read, modified or deleted. Format-specific PDF/SVG/IFC parsing remains an upstream responsibility; this module proves byte integrity, not drawing interpretation.

`create`, `open`, `original`, `snapshot`, `list`, `archive` return `RuntimeResult<T>`: `{ok:true,value}` or `{ok:false,code,message}`. Codes are conflict, invalid, storage, missing, corrupt, archived. `execute` implements the existing `ConstructionCommandPort` exactly: `{ok:true,job}` or `{ok:false,code:'conflict'|'invalid'|'storage',message}`; detailed corruption/missing/archive failures map to invalid at this older interface boundary.

The six existing commands are append-source, append-evidence, append-calibration, put-work-package, put-measurement and review-measurement. Envelopes and payloads are strict. Caller supplies deterministic command IDs, expected job revision, local actor and time; the repository never invents an authenticated identity. Calibration attribution must match the command actor/time. Put-measurement accepts drafts; dedicated review commands record the actual supplied local actor. Changed work-package specifications invalidate affected measurement reviews. Duplicate command identities and stale job/measurement revisions reject without writes.

`list(includeArchived=false)` returns deterministic metadata summaries, not a source-integrity assertion. `open` may inspect archived jobs; further commands reject. `archive(id,expectedRevision,attribution)` advances one revision, retains originals and snapshots, and removes the job only from default listing. `snapshot(id,revision)` reads and validates a prior immutable snapshot; it does not restore/overwrite the current head. `original` returns a defensive copy. Deletion, unarchive, undo and snapshot-to-current recovery require separately designed archival/transition commands; no history is silently discarded.

Default database `xray-construction-runtime-v1` contains heads, snapshots, assets and commands. Every accepted mutation uses one real readwrite transaction. It compares the exact head with the validated prior record, checks previous snapshot integrity and command uniqueness, compares retained original bytes, then adds immutable new snapshot and any new assets plus head and attribution. A conflicting tab wins at most one write for an expected revision. Validation and cryptographic hashing happen before opening the write transaction. Corrupt/future records and unavailable originals remain unchanged.

Options allow an isolated databaseName and an IDBFactory. Tests use the browser's real factory. `onWritesStaged?:()=> 'abort'|void` only requests an actual transaction abort (or throws); it receives no transaction handle and cannot manufacture successful persistence. `close()` releases the connection. Supplied database names must be new isolated runtime/test names, never existing application/legacy databases. Browser quota/eviction remains platform-controlled; this module does not claim backup durability beyond retained IndexedDB snapshots.

Evidence: `proof/audit/IW022/browser-runtime.mjs` bundles only this module with installed Rolldown, serves an isolated local test origin and runs real Edge IndexedDB cases. Latest immutable results path is in `proof/audit/IW022/latest-run.txt`. Desktop execution report screenshot is embedded in the canonical tracker. Historical mobile captures were made before the user removed mobile QA; no further mobile gate is required. This is a submitted foundation awaiting independent verification, not completed end-to-end estimating.
