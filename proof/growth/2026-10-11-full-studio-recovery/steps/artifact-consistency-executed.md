# Artifact consistency tooling: independent executed proof

October 12, 2026. Source commit `9cc49c9c94bb22338f2ebae18e900d3b9322b111`,
branch `recovery/full-studio-20261011`. **Local synthetic consistency tooling only;
NOT authenticated engine execution or pre-install app acceptance.**

## Requirement and code

Add fail-closed offline source/build/log/toolchain/fixture consistency checks around
unchanged legacy producers. New files: `scripts/qualification_structure.py`,
`scripts/verify_qualification_artifacts.py`, their two test modules and
`scripts/run-artifact-evidence-check.ps1`. Existing helpers, engine pin, product
code and phase-1 source/receipts remain byte-unchanged. No visible product changes;
no screenshot was required or captured.

Checks include bounded strict JSON/XML, type-aware equality, exact snapshot ZIP
and extracted file membership/digests, ZIP raw-name aliases/CRC/stored-only format,
Windows path/reparse rejection, build raw artifacts and executable digest links,
toolchain metadata/pins, JUnit counters and explicit skips, all 18 declared steps,
actual stdin/log bounds, six fixture results, eight negatives and no-overwrite
sentinel. No executable/spec/TOC is run by the offline validator.

Static reviews `run_00030`, `run_00031`, `run_00035` found and resolved Python
identity, sequential timing, worker stdout, layout request derivation, ZIP and
negative-test setup gaps. Static signoff is separate from execution below.

## Executed checks

| Suite / observation | Clean worker `949c60f956ac` | Independent `a98a9486919b` |
| --- | --- | --- |
| Preflight | 21 passed | 21 passed, 3.497 s |
| Historical source/helper audit | 109 / 4 | 109 / 4 |
| Terminal regressions | 25 passed | 25 passed, 10.311 s |
| Structural regressions | 25 passed, 5.213 s | 25 passed, 4.477 s |
| Artifact regressions | 24 passed, 83.742 s | 24 passed, 72.098 s |
| Total / skips | 95 / 0 | 95 / 0 |
| Queried CPU cap | 20%, flags 5 / rate 2000 | same |
| Terminal / actual child exit | 0 / 0 | 0 / 0 |
| Supervisor | exit record 0, process absent | independently retained actual exit 0 |
| Source integrity | 11 hashes unchanged; clean tree | baseline/worker/runner/final agree; clean tree |
| Cleanup | owner-only accounting, observed processes absent | same, all eight observed identities absent twice |

Real Windows directory-junction child and ancestor rejection executed, target
contents preserved. No skip substituted for insufficient symlink privilege.
The case-insensitive-FS collision regression injects duplicate enumeration of a
real directory entry; it does not claim two case-only NTFS directories existed.

External whole-run supervisor bound: 720 seconds; verifier's separate observer
bound: 750 seconds. Existing preflight/terminal deadlines unchanged. All runs
completed naturally; no timeouts or manual kills. Worker owner/supervisor:
54532 / 97940; verifier owner/supervisor/observer: 52616 / 32380 / 97128.

Development `efa977a3e23f` remains retained: earlier 22 structure / 23 artifact
tests, two platform skips, dirty source. It is NOT the final clean proof.

## Retained evidence

Absolute parent:
`C:\Users\danie\Documents\Codex\2026-10-03\qu\work\az-web-bundle-r2\xray-recovery-evidence`.

- `artifact-records-949c60f956ac`, `artifact-supervised-949c60f956ac.*`,
  `artifact-worker-949c60f956ac-verified.json`.
- `artifact-records-a98a9486919b`, `artifact-supervised-a98a9486919b.*`,
  `artifact-independent-a98a9486919b.{verification,evidence-hashes}.json`,
  `artifact-independent-a98a9486919b-report.md`.
- Independent report SHA-256, foreground-rechecked:
  `4fc60e39f4d3e5484fac13e9985376e00b510776fafb0d6678676af286595145`.
- External supervisor SHA-256:
  `329f3ff3653aad752e63dfc5f3e2619640bed08a90a5fe2118d081d96232ea75`.

## Explicit limitations

`executionAuthenticated`, `collectionBindingValid`, `fullEvidenceValidated`,
`freshEngineQualified` and `appAccepted` all remain **false**. A completely
fabricated internally consistent bundle can pass structural checks.

Inventory hashes ordinary file streams, not ADS/hardlinks or directory rows;
caller-owned quiescent input is required. Parser byte/node rejection bounds are
not hostile-input peak-memory isolation. Toolchain is metadata, not independent
installed-file attestation. Raw build presence/hash is not warning approval.
JUnit counters do not prove complete source test coverage. Reviewed trusted
collection/preparation requirements are in `QUALIFICATION-COLLECTION-PLAN.md`.

Root phase-1 machine-ledger scope/status is unchanged. No DANS1 qualification,
native/UI execution, staging-pin update, push, merge or installation occurred.