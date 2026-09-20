# Derived-list snapshot proof (prepare-snapshot.ps1)

Owner: Claude. Date: 2026-09-20. Not a DANS1 campaign — this is the local proof that the
rewritten list derivation is complete enough to run the repo-wide gate.

## The change

`prepare-snapshot.ps1` no longer chains its file list from the previous pack's
`verified-source-manifest.json`. It derives the list from `git ls-files`, minus the
evidence and build trees, and refuses to proceed if the result omits any file that
`package.json` executes or any `engine/fixtures/*` file.

## List delta against the last chained pack (sc10-use-measured)

| | files | size |
|---|---|---|
| chained pack (sc10-use-measured manifest) | 1,242 | 314.54 MB |
| derived list (this change) | 2,989 | 409.59 MB |
| added | 1,748 | |
| dropped | 1 | |

Both figures are dominated by `public/` (146 files, 298.31 MB of drawings, models, OCR
data and the Setup.exe) — that tree was in the chained pack too. The +95 MB is the
completeness the chained list had silently lost.

Added, by tree (top): `proof/audit` 1,374 · `.grok/skills` 77 · `engine/python` 61 ·
`artifacts/research` 59 · `.agents/skills` 24 · `proof/draftsman` 17.

Dropped: `proof/growth/2026-09-19-sc10-qs-rate-delta/preflight/state-boundary.test.ts` —
a test file that lived inside the evidence tree and is not named by any npm script. It is
referenced only by the SC11 preflight's ad-hoc focused command, not by `npm test`.

## Guard proof (negative tests)

The two tripwires were exercised against a deliberately damaged list, not just the happy
path — a guard that never fires is not a guard.

| list | verdict |
|---|---|
| full derived list (this change) | pass, 0 omitted scripts, 0 omitted fixtures |
| same list minus `engine/fixtures/*` | THROW, 17 omitted fixtures, first `engine/fixtures/bom-contract/blocked-overlap.response.json` |
| same list minus one test script | THROW, 1 omitted script, first `scripts/verify-master-plan.mjs` |

## Executed proof

The derived list was staged to a scratch copy (2,989 files, 6.9 s) with `node_modules`
junctioned in, and both gates were run **from inside the stage**:

1. The two fixture-dependent files —
   `src/lib/materialAi.server.test.ts` and `src/studio/construction/aiMaterials.test.ts` —
   **19/19 pass, 0 fail, exit 0**. These are the tests that failed on DANS1 when
   `proof/audit/IW-AI-MATERIALS/fixture-result.json` was absent.
2. The full repo-wide gate, `npm test`, **1964/1964 pass, 0 fail, exit 0**
   (203 + 796 + 965 across the three `node --test` batches, plus
   `verify-master-plan.mjs` and `verify-bom-goldens.mjs`).

Raw log: [derived-list-npm-test.log](derived-list-npm-test.log) (195,667 bytes).

For comparison, the ledger's last recorded repository-wide pass is **1951/1951 on the
stale `9abf4c807030` snapshot**, recorded 2026-09-19. This run is 1964/1964 on current
source, 13 tests higher, because the snapshot is now complete. The 796-test batch that
failed 795/796 on DANS1 is the same batch that passes 796/796 here.

## What this does not prove

- No DANS1 campaign was run. This is a local stage, not a frozen-pack transfer.
- The `feat/architect-cad-engine` branch guard still blocks a real run on
  `feat/closeout-sc09-remainder`, the branch actually checked out at `6477356`.
- The pack identity is still keyed on the whole tracked tree, so a ledger or proof edit
  still mints a new `runId`. Narrowing the digest to what the gates consume is a separate
  change, not made here.
