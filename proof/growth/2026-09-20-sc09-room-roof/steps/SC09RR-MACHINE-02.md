# SC09 room/roof machine-2: preserved-output audit

Status: executed commands succeeded; original qualification receipt remains **FAIL**. This is an evidence audit, not a replacement PASS receipt or SC-09 completion.

Audited locally on 2026-09-20 without running any product gate. The executed commands in these records ran on DANS1. All original logs, process records, receipts and their manifest were left unchanged.

## Frozen source identity and integrity

[Original results](../machine/machine-2/results.json) record:

- Run `sc09rr-bf09e36e3100`, attempt `machine-2`, host `DANS1`, reused frozen source, 2,999 source files.
- Base HEAD `6477356316abcaee229b572dd5fc79d381b565cb` plus the frozen source snapshot; this is not a claim that the dirty SC-09 implementation was committed at that HEAD.
- Source digest `bf09e36e3100a5cfa9ef4565892edc8e28fdb791a3ec9341375af7fd91394e55`.
- Archive SHA-256 `b44ac1a5a5a35d6602f1ae5cd0751c8dca080588dfddfbd9c1d7abd37fc26936`.
- Dependency baseline `9abf4c807030`, with `packageLockMatched: true`.

Read-only audit recomputed SHA-256 and byte length for **all 29 entries** in the [original manifest](../machine/machine-2/sha256-manifest.json): **29 matched, zero mismatches, 874,594 bytes**. The directory contained those 29 files plus the manifest itself. All seven standalone command receipts exactly matched their corresponding parsed objects in `results.json`. Source/archive identities above are recorded identities; this local audit did not independently re-extract or hash the source archive.

Key immutable artifact hashes (the manifest supplies hashes and sizes for every receipt and process record):

| Artifact | SHA-256 |
| --- | --- |
| [Manifest](../machine/machine-2/sha256-manifest.json) | `2721406e14a156c1f8fa4ad6c2e3080714890865d3212cc0284a3773a0463d38` |
| [Original FAIL results](../machine/machine-2/results.json) | `6fba30625cc19aebbe6620fe6136947c90af75801b01d05614983d4d0027f400` |
| [Batch 01 stdout](../machine/machine-2/parallel/test-batch-01/stdout.log) | `baea5d83c45103bee1d9aeaaecc87320c136a7146e674a669b99004cd1f0ff37` |
| [Batch 02 stdout](../machine/machine-2/parallel/test-batch-02/stdout.log) | `e3cf576f87cb07a122b2f2378505774b0bd64c4bed387e26b2249424415eb241` |
| [Batch 03 stdout](../machine/machine-2/parallel/test-batch-03/stdout.log) | `6f950b9ff65d97871187ff190dcd53c954cef951f0710759c1e66e59c86d0855` |
| [Master-plan stdout](../machine/machine-2/serial/verify-master-plan/stdout.log) | `5c0618f09a6b112de240247052ed42715466ca63f30c5cfba8b828b92b7fb0d2` |
| [BOM-goldens stdout](../machine/machine-2/serial/verify-bom-goldens/stdout.log) | `a6821e205882a5ab68469f6713941571a056bb773807440bf76c7328aae04b27` |
| [Scoped-lint stdout](../machine/machine-2/serial/scoped-lint/stdout.log) | `bd51892dbab427112fcc9e193f264d01361aa122af74f2dc4165db34bf8aec7d` |
| [Typecheck stdout](../machine/machine-2/parallel/typecheck/stdout.log) and [stderr](../machine/machine-2/parallel/typecheck/stderr.log), both empty | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

## Actual command outcomes, not inferred receipt totals

Each linked receipt records the complete executable path and exact argument list. Executable: `C:\Users\danie\XRayBuilds\preflight\sc09rr-bf09e36e3100\runtime\node.exe`.

| Executed command / receipt | Observed result | Original receipt verdict |
| --- | --- | --- |
| [Master-plan verifier](../machine/machine-2/serial/verify-master-plan/receipt.json): `scripts/verify-master-plan.mjs` | Exit 0; output `problems: []` | PASS |
| [BOM-goldens verifier](../machine/machine-2/serial/verify-bom-goldens/receipt.json): `scripts/verify-bom-goldens.mjs` | Exit 0; `ok: true`, 10 JSON fixtures, 11 worked cases | PASS |
| [Batch 01](../machine/machine-2/parallel/test-batch-01/receipt.json): `--test` plus 12 script/planning test roots | Exit 0; 203 tests, 203 pass, 0 fail | FAIL: missing TAP counts |
| [Batch 02](../machine/machine-2/parallel/test-batch-02/receipt.json): `--experimental-strip-types --test` plus 99 source test roots | Exit 0; 858 tests, 858 pass, 0 fail | FAIL: missing TAP counts |
| [Batch 03](../machine/machine-2/parallel/test-batch-03/receipt.json): `--experimental-strip-types --test` plus 96 source test roots | Exit 0; 971 tests, 971 pass, 0 fail | FAIL: missing TAP counts |
| [Typecheck](../machine/machine-2/parallel/typecheck/receipt.json): `node_modules/typescript/bin/tsc --noEmit` | Exit 0; stdout/stderr empty | PASS |
| [Scoped lint](../machine/machine-2/serial/scoped-lint/receipt.json): `node_modules/eslint/bin/eslint.js src/studio/SourceAreaEditor.tsx src/studio/sourceAreaChanges.ts src/studio/sourceAreaDrag.ts src/studio/sourceAreaMeasurement.ts src/studio/industries/quantity-surveying` | Exit 0; 0 errors, 16 warnings | PASS |

The actual spec-reporter totals sum to **2,032 tests / 2,032 passed / zero failed** (`203 + 858 + 971`). Each batch has exactly one final summary and reports zero cancelled, skipped and todo tests. Reporter durations are 7,314.1545 ms, 11,851.022 ms and 12,258.519 ms respectively. These are execution counts, not catalogue completions or a claim of unique test names across imported companion suites. Every command records `processExited: true`, `timedOut: false`, `allOwnedProcessesExited: true`, and no cleanup actions. All seven stderr files are empty.

### Why the original aggregate is FAIL

The test logs use spec-reporter summaries such as `ℹ tests 203`, `ℹ pass 203`, `ℹ fail 0`. The receipt parser searched only for TAP summary lines matching `^# tests`, `^# pass`, `^# fail`. Consequently all three test receipts retain null counters and the errors `missing TAP tests count`, `missing TAP pass count`, `missing TAP fail count`, and `TAP result is not fully passing` despite successful process exits and fully passing spec summaries.

The original aggregate remains `verdict: "FAIL"`, `fullTestGate: null`, with error `The property "tests" cannot be found in the input for any objects.` Those receipts were not rewritten or replaced. The subsequent two-line spawn-only change uses `[string[]]` arguments and joins the `ArgumentList`; `return $tokens` was already fixed. Its [separate serial DANS1 validation](SC09RR-SPAWN-03.md) records [PASS](../machine/spawn-3/results.json) and a [verifier exit of 0](../machine/spawn-3/serial/verify-master-plan/receipt.json). No reporter correction was applied: the broad receipt parser remains unresolved, and the spawn check did not repeat the broad tests, typecheck or lint.

## Ordering evidence

All timestamps below are **2026-09-19 UTC**, as recorded in the immutable linked receipts (2026-09-20 in Brisbane).

| Command | Started | Finished |
| --- | --- | --- |
| Master-plan verifier | `16:34:34.1749778Z` | `16:34:34.3535636Z` |
| BOM-goldens verifier | `16:34:39.7641288Z` | `16:34:40.4352706Z` |
| Batch 01 | `16:34:45.8410005Z` | `16:35:08.2912171Z` |
| Batch 02 | `16:34:45.8936404Z` | `16:35:10.1958742Z` |
| Batch 03 | `16:34:45.9207024Z` | `16:35:13.0602070Z` |
| Typecheck | `16:34:45.9840112Z` | `16:35:14.4563644Z` |
| Scoped lint | `16:35:17.2187635Z` | `16:35:18.9624322Z` |

Thus the master-plan verifier finished before the BOM verifier started, and the BOM verifier finished before the earliest parallel command started. The four parallel commands overlap; lint began after all four finished. No shared-output verifier overlapped this parallel wave.

## Lint warnings retained

The [lint log](../machine/machine-2/serial/scoped-lint/stdout.log) names these 16 warnings; they are not lint errors and have not been silently removed or claimed fixed:

- `QSCostPlanPackagePanel.tsx`: eight `react-refresh/only-export-components` warnings at 22:14, 31:17, 47:23, 59:17, 64:23, 77:17, 93:17, 97:23.
- `QSWorksheet.tsx`: two `react-refresh/only-export-components` warnings at 47:17 and 99:17.
- `QSItemBindingLedger.tsx`: unused `row` at 95:19 and `entity` at 165:52 (`@typescript-eslint/no-unused-vars`).
- `QSReportPanel.tsx`: unused `HierarchicalExportRow` at 9:8.
- `assistantTool.test.ts`: unused `before` at 146:9.
- `qsReportFormatter.ts`: unused `leaf` at 290:11 and `blind` at 291:11.

No baseline comparison was performed by this audit, so it does not assign introduction/blame for these warnings. Lint was scoped exactly as the receipt states, not a whole-repository lint claim.

## Boundaries and remaining proof

- No browser, screenshot, production build, deployment, native or live-device qualification is contained in this machine attempt. Room/roof interaction and human acceptance remain unproven by this record.
- The source snapshot can support these machine results only; later source changes require their own qualification.
- The machine attempt contains no exact source-diff artifact or screenshot. The final completion record must separately link the matching code diff and inspected browser screenshots before SC-09 or any catalogue row can be completed.
- This audit changed only this new Markdown record. Product source, harness, all original evidence, ledger, dashboard and catalogue were not edited. No staging, commit, branch change or product test was performed for this audit.
