# Fresh Windows engine qualification preflight — blocked before build

## Requirement and authorization

On the October 12, 2026 local continuation, the user chose: **"Proceed with fresh
engine qualification; stop before app installation."** Work stays on
`recovery/full-studio-20261011`. Preserve the fail-closed transport, old qualified
package, existing engine pin, historical proofs and `main`. No application build,
installation, deployment or further promotion was authorized by this gate.

**Outcome: tooling and source/reference inputs prepared and locally tested;
actual fresh engine build/qualification is blocked, not accepted.**

## Source and implementation

- Engine/source snapshot commit: `5a6378320ce16b9ad801db094aea31d216e52a42`.
- The relevant engine/contracts/host/application source is unchanged from the
  already tested `c93ae1e7354e7d295196ab5db0d363ed9e1a34eb`; that remains the CI
  acceptance identity. No green CI result is attributed to these new helpers.
- `main` remains `be29918ad5aa466ec0f67a0d5742af23634483a9`.
- Added build-time-only snapshot/qualification helper, nine unit tests,
  TypeScript reference-case generator, DANS1 owner/deadline wrapper and WIP
  operator documentation. No production Python/TypeScript/Rust, transport parser,
  app configuration, dependency declaration, workflow or engine-pin change.
- Exact helper hashes are in [local validation](../engine-qualification-preflight/local-validation.json).

Those are **raw tested/transferred CRLF byte hashes**, not Git-normalized source
blob hashes. Raw helper copies are retained with the attempt evidence; the
evidence directory's `.gitattributes` disables text conversion to preserve these
identities. Maintained scripts follow the repository's LF normalization. Review
their equivalence after normalizing line endings; never compare a Git LF blob
directly to a transferred CRLF digest and call that a source change.

The prior engine package still exists on DANS1. Its executable is 41,996,797 bytes
and matches pinned SHA-256
`e4693d8f2c84f125f87c316505866e23ea57aaf6e5bbc0315b0cc5360d09a49d`.
All 62 packaged source entries matched the old manifest during read-only
preflight. Against recovery source, 48 of 62 match, 14 differ and seven additional
non-cache Python files are unmanifested. Both checkout-byte and Git-blob
comparisons showed the same differences. This is incompatible with the current
staging gate: do not rewrite the old manifest or bypass the pin. This historical
binary was not executed in this continuation.

## Prepared input identities

Attempt ID: `1a9f4e6c8202`.

| Input | Bytes | SHA-256 |
| --- | ---: | --- |
| Source ZIP, 109 regular Git source/test/fixture files | 25,068,071 | `839f53364cd11db89c21fe64931cec599d2d3a64c66516d9664edd3c5cca4425` |
| Snapshot manifest | 16,619 | `4f0437f29816405846c47f831b0f254cd9a8683d4efbf02c7dfa49143b564bec` |
| Six TypeScript reference cases plus provenance | 265,166 | `e6cd64f6f2e5a8c4652af40b0077921c5248c377ba90cabcaa8b4fe9e22282df` |
| Transfer manifest | 1,616 | `3e738b13b05d6079040b76594ccdf82d5a7cbff8a1b10b06d14d31164ab2de8e` |

All six transferred payloads plus the independently pinned transfer manifest
were verified on DANS1 after the block. [Remote transfer verification](../engine-qualification-preflight/remote-transfer-verification.json).
The ZIP remained inert on DANS1; no source extraction occurred.

Local external inputs/tooling/logs are preserved at
`C:\Users\danie\Documents\Codex\2026-10-03\qu\work\az-web-bundle-r2\xray-recovery-evidence\engine-qualification-1a9f4e6c8202`.
The earlier local preparation directory ending `1a9f4e6c8201` is preserved; it
was not launched remotely. Remote inputs remain at
`C:\Users\danie\XRayBuilds\engine-qualification\1a9f4e6c8202`.
Large archives are not committed. Small records and reference cases are retained
in the campaign's `engine-qualification-preflight` evidence directory.

## Checks actually executed

1. Both worktrees initially clean and exact source identities confirmed.
2. DANS1 read-only host/capacity/build-tool inspection: 16 logical processors,
   about 32 GiB RAM, existing Python 3.12.14 / PyInstaller 6.22.3 environment;
   all five direct requirements pins matched installed versions. This was
   introspection, not a fresh provenance attestation or qualification test run.
3. Local helper suite: **9 passed**, exit 0, including invalid paths, duplicate
   casefold paths, hashes, regular-file extraction, no overwrite, source drift,
   strict JSON, case-source binding, child exit/timeout/output-limit handling.
   [Captured final output](../engine-qualification-preflight/helper-tests.stderr.log).
4. Node syntax and PowerShell parser checks: passed.
5. TypeScript references: **6 passed** — four complete frozen responses and
   equal/full-bays-terminal-cut layouts (13/14 sheets, ten rail cuts). These are
   local TypeScript calculations, **not frozen-executable parity**. All required
   kernel/schema/fixture identities matched the exact source snapshot.
6. Local test/snapshot/reference work inherited a verified Windows Job Object
   **20% aggregate CPU cap**, flags 5 / rate 2000. Output identities were rechecked.
7. Remote transfer hashes: all six matched; no engine executable was run.
8. `git diff --check` and checks for unchanged product source/transport/pin passed.

## Actual execution block and cleanup

The first detached launch recorded PowerShell PID 18256 at
`2026-10-11T20:19:58.4812274Z` but produced no owner/build output; its process was
gone when checked. Its cause is not asserted. A subsequent attached SSH attempt
(local SSH PID 62744, creation `2026-10-11T20:20:47.7023488Z`) exposed the actual
script invocation failure: **PSSecurityException / UnauthorizedAccess — running
scripts is disabled**. [Captured failure](../engine-qualification-preflight/ssh-worker.stderr.log).

Read-only policy verification returned effective **Restricted** at
`2026-10-11T20:23:52.9207437Z`; each explicit policy scope was Undefined. No policy
change, bypass flag, encoded execution of the denied script, signing workaround,
or direct alternate launch was attempted. These UTC timestamps remain October
11; the local campaign continuation date is October 12.

- [Blocked preflight](../engine-qualification-preflight/blocked-preflight.json):
  no worker `owner.json`, extracted source, `dist`, qualification verdict, or
  process with this run's command marker remained on DANS1.
- [Effective policy](../engine-qualification-preflight/effective-policy.json).
- [Local cleanup](../engine-qualification-preflight/local-cleanup.json): the
  recorded SSH process no longer exists. No owned process was broadly killed.
- The new Windows Job logic, source pytest suite, toolchain before/after inventory,
  PyInstaller build, frozen status, six frozen positive cases and eight negative
  cases **did not execute**. No worker exit/success artifact is invented.

Reviewer `run_00012` identified input/test/containment gaps; subsequent code
addressed the narrow blockers. `run_00013` statically reviewed the revised files
and supported a WIP checkpoint, not executed Windows acceptance. Neither review
ran the code or independently performed the local tests. Reviewer stopped after
review; no outstanding reviewer task is required to resume.

## Limits and next gate

This is a nonvisual step; no screenshot was taken and no rendering is claimed.
The new helper unit tests do not execute the Windows Job API. Dependency inventory
is observed installed provenance, not independently verified wheels/base standard
library or reproducible-build evidence. Output bounds are polled; containment is
whole-worker, not per-call descendant acceptance. Filesystem checks do not remove
concurrent replacement races. This is controlled-snapshot tooling, not a generic
hostile-archive service. See the WIP tooling documentation for complete limits.

Before retrying, obtain an execution method explicitly authorized under DANS1's
policy; do not weaken the host policy silently. Use a new immutable attempt,
recheck hashes and tests, and require both a successful terminal owner `exit.json`
after post-run input verification **and** the complete qualification evidence.
Even future engine qualification would not accept app staging, native host/UI,
installation, macOS/Linux, signing, deployment or release readiness.