# Declared-test coverage tooling: separate executed verification

October 12, 2026. Source `0c94244c341b73927d776a1fc3f00d2ba5281594`, existing
recovery branch. **Declared inventory/JUnit consistency only**, not authenticated
collection, complete source-function coverage, engine execution or app acceptance.

New files: `scripts/verify_qualification_coverage.py`,
`scripts/test_verify_qualification_coverage.py`,
`scripts/run-coverage-evidence-check.ps1`. Existing artifact/terminal/phase-1
implementations, historical producers, pin and receipts unchanged. No visible
product change; no screenshot required or captured.

## Executed proof

- Development `b0bd64d1f8f7`: 21 preflight + 19 coverage tests, dirty source,
  retained as development only.
- Clean worker `cda4407665ca`: same 40 tests, zero skips, preserved 109-source /
  four-helper audit; nine source hashes unchanged, clean before/after, queried
  20% cap (flags 5 / rate 2000), owner-only accounting, terminal/child exits 0,
  supervisor/runner 36052 / 70812 absent after natural completion.
- Independent `175274719595`, actor `independent-coverage-verifier`: 21 preflight
  tests in 3.599 s and 19 coverage tests in 2.062 s, **40 passed, zero skips**;
  same source/helper audit, nine baseline/worker/runner/final hashes agree,
  clean before/after at the source above. Queried 20% cap/kill-on-close;
  terminal, actual runner and independently retained actual supervisor exits 0;
  no timeout/manual termination. Observer/supervisor/runner 9312 / 69392 / 95332
  absent with no direct descendants at repeated final snapshots.
- Static review `run_00041` and independent adversarial inspection confirmed
  explicit co-omission and nodeid-mapping limits; neither calls this authenticated
  test collection. Full artifact and coverage gates remain separate.

The verifier's first external CIM snapshot arrived after this short run finished.
No live transient Python/conhost enumeration is claimed. Launch-held native
handles, runner self-CIM identity, actual exits and final job accounting are the
observed identity/cleanup evidence. A postprocessing helper initially hit the
PowerShell `R` alias; corrected external helper name, no source edit or test rerun.

## Evidence identities

Absolute parent:
`C:\Users\danie\Documents\Codex\2026-10-03\qu\work\az-web-bundle-r2\xray-recovery-evidence`.

- `coverage-records-cda4407665ca`, `coverage-supervised-cda4407665ca.*`,
  `coverage-worker-cda4407665ca-verified.json`.
- `coverage-records-175274719595`, `coverage-supervised-175274719595.*`,
  `coverage-independent-175274719595.{verification,evidence-hashes}.json`,
  `coverage-independent-175274719595-report.md`.
- Independent report SHA-256:
  `c235bbcea88dacd3cb21ea85c100f61dcfb420bb034bb97eaee048048fbddebe`.
- Reviewed 360-second external supervisor SHA-256:
  `9ae0d80006a6c8533efeaf0fdf310a37edc2e5a65848c5bc578059568f49c3c6`.
- Foreground rechecked all 24 verifier inventory files and nine source hashes.

## Scope and remaining work

Checks require external snapshot/inventory hashes, exact types, source-hash/module
representation, exact JUnit identity set, no duplicate/missing/extra declared tests,
zero collection errors/skips/deselections and no JUnit skips/failures/errors.

Removing a test from both unauthenticated inventory and JUnit can still pass while
its module remains represented; tests explicitly demonstrate that limitation.
No pytest rootdir/nodeid mapper or source-function/parameter inventory is proved.
`testInventoryAuthenticated`, `executionAuthenticated`, `freshEngineQualified`
and `appAccepted` stay false. Trusted observer/source preparation and collector
implementation in `QUALIFICATION-COLLECTION-PLAN.md` remain next engineering.
No DANS1 engine qualification, installation, promotion, push or merge occurred.