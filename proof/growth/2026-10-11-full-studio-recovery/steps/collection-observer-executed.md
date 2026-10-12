# Collection observer: independently executed component proof

October 12, 2026. **PASS for the local synthetic observer regression scope only.**
Not authenticated source preparation, full engine test collection, execution
authentication, fresh engine qualification, native/UI acceptance or installation.

## Source and independent execution

Repository: `C:\Users\danie\Documents\Codex\2026-10-03\qu\work\az-web-bundle-r2\xray-recovery`.
Clean tested commit: `d553c4803ddcb3d092f1169e2762c3ae82630c49` on
`recovery/full-studio-20261011`. Additive files only:

- `scripts/collect_qualification_tests.py`
- `scripts/test_collect_qualification_tests.py`
- `scripts/run-collection-observer-check.ps1`

| Check | Clean worker `1a6dbfe4fa50` | Independent `568657937b59` |
| --- | --- | --- |
| Preflight regressions | 21 passed, 3.612 s | 21 passed, 3.929 s |
| Observer regressions | 25 passed, 20.177 s | 25 passed, 19.531 s |
| Skips/errors/failures | 0 | 0 |
| Preserved audit | 109 sources / 4 helpers | 109 sources / 4 helpers |
| Queried aggregate CPU hard cap | 20%, flags 5, rate 2000 | Same |
| Source/runtime checks | 10 source + 5 selected tool hashes unchanged | Same, independent before/after |
| Terminal / actual runner / actual supervisor exit | 0 / 0 / 0 | 0 / 0 / 0 |
| Additional actual monitor exit | Not separately retained by foreground | 0, retained outer-launcher handle |
| Final job accounting | 1, owner only | 1, owner only |
| Source state | Clean committed | Clean before and after |

Independent context `terminal-executed-verifier`, `run_00052`, actor
`independent-observer-verifier`, received sole test subownership from
`foreground-recovery-20261012-1932` after the worker completed. No overlapping
editor/test launch. Development `6e75f3247aff` also passed but is not clean proof.

## Behavior exercised

Actual installed pytest 9.1.1 collects fresh synthetic source fixtures, using fixed
local Python312 and a sanitized environment under the unchanged capped job.
No dependency installation or upgrade. The observer checks externally pinned
snapshot identities and complete extracted source bytes before/after, observes
root/config/default settings and actual item paths, preserves exact nodeids, and
maps JUnit identities with the installed version's mapper. Its output is the exact
existing `xray.collected-tests/v1`, plus separate
`xray.pytest-collection-observation/v1` in `observation.json`, published last.

A fresh **uninstrumented** `python -m pytest` process produces real synthetic JUnit
for the mapping oracle, including parameter IDs, Unicode, plain classes and
`unittest.TestCase`. The emitted inventory and that real JUnit pass the unchanged
declared-coverage validator. Collect-only body sentinels remain absent.

Negatives cover ancestor config/conftest before import, wrong root, environment
contamination, collection import failure/skips, warnings (including cleanup),
deselection, nondefault/late-mutated options, transient unexpected plugins,
duplicate/source-mismatched nodeids, omitted/empty modules, source mutation,
wrong runtime version, strict JSON/pins, unsafe paths and output no-overwrite.
Hardlink rejection uses a real hardlink. Reparse rejection injects an attribute
bit: **this suite does not claim a real junction test**.

Static review found and corrected Windows terminalprogress allowlisting,
active-versus-post-cleanup plugin evidence, uncaptured cleanup warnings and missing
unittest oracle coverage before execution. Delta review `run_00051` authorized
development testing; static approval is not the independent execution result.

## Process evidence and cleanup

Worker monitor/supervisor/runner/unittest identities 3672/83000/24284/92668 were
observed and absent after completion. Independent live snapshots retain **11**
owned identities, including outer launcher 30960, monitor 70128, supervisor 89064,
runner 94028, unittest 90728 and Python312 synthetic observer child 69596. All
observed identities and direct children were absent at final checks; no manual
termination. Creation-time/image/parent/command evidence is retained, not PID-only
ownership. The foreground repeated cleanup checks and rehashed all **31** files in
the independent evidence inventory, ten source files and five selected tool pins.

Existing per-check deadlines remain unchanged. New observer suite is 120 seconds;
each synthetic child waits at most 30 seconds with 256 KiB retained per-stream
quota and bounded cleanup/drain. External local supervisor/monitor polling budgets
are 360/400 seconds. These are **not** hard watchdog proof against blocked OS I/O;
no timeout or recovery branch was exercised. Lightweight control launchers are
outside the test CPU job; all test/product-like work inherits the queried job.

## Retained evidence and hashes

Absolute external evidence parent:
`C:\Users\danie\Documents\Codex\2026-10-03\qu\work\az-web-bundle-r2\xray-recovery-evidence`.

- `observer-worker-1a6dbfe4fa50-verified.json`, worker live observation and launch records.
- `observer-records-{1a6dbfe4fa50,568657937b59}` and corresponding `observer-supervised-*` records/logs.
- `observer-independent-568657937b59.verification.json`, `.evidence-hashes.json`, process snapshots and retained monitor/supervisor observations.
- `observer-independent-568657937b59-report.md`, SHA-256
  `10827ad483dd30422ef2624ba3be2cae24d1f7c04deb73751be2721dc054e648`.

Raw tested observer SHA-256:
`0258c0c90b6bfd5f5b9a44e8b4d08ad48a22433ec0c4999515be549cd240f57a`.
Raw test SHA-256:
`45d9deebf409b7c689ea1cccc3726262c3e0169fe77bebf4faa49f182bc45890`.
Raw runner SHA-256:
`44b9fd418e14f1677c36b753bf1b67821fa9ad6ae6a69295c1c5cc044414cc77`.

## Limits and next gate

The synthetic fixture inventories/JUnit are temporary and deleted by test cleanup;
retained regression logs are not a production engine inventory. Five runtime pins
cover selected local interpreter/pytest files, not full dependency/DLL attestation.
The component uses direct `pytest.main(..., plugins=[observer])`, not the preserved
producer module entry. It does not prove equivalent discovery on arbitrary source
or ancestor contexts, and cannot isolate malicious imported source in-process.
Full function/parameter completeness still requires an independently approved
source-bound baseline, not a self-consistent collected list. Runtime skip markers
remain unevaluated diagnostics, never executed passes or approved waivers.

Next implement pinned source-ZIP preparation and independent inventory approval,
then the separate DANS1 execution collector, queried resource/process binding,
external hard watchdog and noncircular authenticated-channel receipts. Preserve
original producer arguments, sources, phase-1 receipts, engine pin and ledgers.

`testInventoryAuthenticated`, `executionAuthenticated`,
`fullSourceTestCoverageVerified`, `fullEvidenceValidated`,
`freshEngineQualified` and `appAccepted` remain **false**.
No DANS1 qualification, staging, installation, push or merge occurred.