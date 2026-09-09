# Daily recovery — release tooling prepared

Preparation only. No source archives were created, no SSH/SCP call ran and no build or preview was launched by this task. Await the parent's explicit SOURCE FREEZE before the steps below.

Nine new release helpers were copied from the preserved walkthrough-polish stage into this folder. `release-tooling-prepared.json` records previous and adapted helper hashes. `release-tooling-verification.json` records passed JavaScript syntax/preparation checks, a verified refusal without the freeze guard, all 18 prior focused-test files retained and two added files. PowerShell Parser checked `worker.ps1`, `start-preview.ps1` and `remote-collect-artifacts.ps1` without errors; these scripts were not executed.

## Prepared behavior

- New isolated remote run and incoming directories use the first 12 hex characters of the new web-source archive hash. Existing directories/archives are refused, never removed.
- Worker executes the established Dans1 resource policy, requires 16 workers and applies High priority to child gates; web and native builds run sequentially. Dependency restore disables install scripts.
- All 18 files from the prior 145-test walkthrough release remain. Added `src/studio/projectRecoveryStore.test.ts` and `src/studio/architect/authoredSheetSet.test.ts`. Existing persistence, projectBackup and backupRestorePreflight tests already appear once. There are 20 test files; the new executed test count is not claimed before the worker runs.
- Worker sets `VITE_XRAY_BUILD_ID=$RunId` before web/native builds and includes the value in both completion records. Artifact verification requires both recorded IDs to match the run and finds that ID in production JavaScript. Actual visible web/native badge identity still needs browser/executable UI proof.
- Preview uses 8092 and refuses an occupied port. The SSH forward is also 8092. Existing 8091 and earlier previews remain untouched.
- Native dependency cache source is the verified prior `38a64f0b8c2b` run. Its EXE must match `14db2b026c8a8aaaf75c54f47be9405db0f5e81a1cb9ee455582d9646bfe72ca` and its native source hash must match the new snapshot. Cache is copied into an absent new target; Cargo still rebuilds the current application.
- Archive/file hashes, safe extraction paths, exact artifact entry lists, source drift, original build-completion artifact identities and current frozen runtime-arm assets are verified by the copied/adapted helpers.
- Package and orchestrator entrypoints require a passed fresh freeze guard and recheck each scoped file against it. Preparation verified that an absent guard refuses before packaging.

## Commands only after explicit source freeze

From the repository root, replace the placeholders with the exact parent-provided manifest/scope and computed run ID:

```text
node proof/growth/2026-09-08-daily-recovery/release-freeze-guard.mjs <source-manifest.json> <scope-sha256>
node proof/growth/2026-09-08-daily-recovery/package-web.mjs
node proof/growth/2026-09-08-daily-recovery/package-native.mjs
node proof/growth/2026-09-08-daily-recovery/remote-orchestrator.mjs transfer <run-id>
node proof/growth/2026-09-08-daily-recovery/remote-orchestrator.mjs build <run-id>
```

After WEB_READY, an independently held owner session can run `remote-orchestrator.mjs preview <run-id>` while native compilation continues. The parent owns all browser/native acceptance; no UI proof follows automatically from an HTTP response.

After both builds complete:

```text
node proof/growth/2026-09-08-daily-recovery/remote-orchestrator.mjs collect <run-id>
node proof/growth/2026-09-08-daily-recovery/release-verify-artifacts.mjs <run-id>
node proof/growth/2026-09-08-daily-recovery/release-build-identity.mjs <run-id>
```

The transfer manifest and freshly captured source identity determine the run; no prior candidate ID should be reused. No application install, deployment, profile change, git staging or push is included.
