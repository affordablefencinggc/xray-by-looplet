# Read-only restore impact review

Implemented `src/studio/backupRestorePreflight.ts` with injected read-only ports. No storage mutation methods, restore apply, lock acquisition or journal creation are exposed. `canApply` is always false.

Acceptance scope: B-10 integrity/impact preview foundation. B-09 complete restore and B-12 stale-writer exclusion are **not complete**. A fingerprint detects observed changes but cannot replace a transaction lease, durable before-image, rollback journal, startup recovery or coordinated write gate.

The review reparses and fully verifies the package before reading destinations. It inventories explicit active-job, legacy-job, current/target module, source-bound sheet, materials, and original-file addresses. Different-project modules and global reference rates are preserved by default. Legacy packages that omitted sheet/pricing records are unsupported for those records, not treated as instructions to delete them. Unknown/orphaned addresses and the package's existing exclusions remain outside coverage.

Destination records are hashed twice and existing project module schemas/owners/source keys validated. Original content is hashed from actual bytes and checked against stored metadata and incoming expectations. Current-job references retain independent expectations even where an incoming original uses the same ID. Missing current originals block a complete recovery before-image. A stale live main job, unreadable/corrupt destination, reused original identity, or changed snapshot is reported as blocking. Returned fingerprints include the backup digest, current job, destination digests, original metadata/content digests and global-rate choice; raw saved data is not returned to the UI.

Executed evidence: `preflight-tests.tap`, Node built-in test runner, 14 tests passed, zero failures. Cases cover source/module corruption, exact allowlist reads, byte-preserving behavior, target collision/removal, global preservation, legacy omissions, current/incoming shared-ID hazards, destination schema/owner failures, asynchronous changes and repeat-review staleness. This is execution proof for the module only; root owns browser screenshots, integration checks and production/native verification.

Reproduce the focused check:

```powershell
node --experimental-strip-types --test --test-reporter=tap src/studio/backupRestorePreflight.test.ts
```

The stable API is `assessBackupRestore(backup, ports, { expectedFingerprint?, restoreReferenceRates? })`. It returns project identities/revisions, rows, warnings, blocking issues, backup SHA-256 and destination fingerprint. Invalid incoming packages reject before reading target ports; callers should display that validation error without enabling replacement.
