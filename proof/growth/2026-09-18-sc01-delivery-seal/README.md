# SC-01 — the SH-03 delivery record, wired into the alteration issue

Slice SC-01 of `XRAY-PRODUCTION-CLOSEOUT-LEDGER.md`: *Wire SH-03 Delivery Record to Residential Alteration
Issue Sets*. Written 2026-09-18 on `feat/architect-cad-engine`.

The ledger's own DONE criteria are quoted below each reading, because a slice is finished against what it
said it would do and not against what turned out to be convenient.

## What changed

`deliveryRecordSchema` — the SH-03 contract in `src/studio/industries/deliveryRecord.ts` — had **no
consumer**: only its own test named it. An alteration issue already froze its source under its own
`sourceSha256`, but the contract's delivery identity (`format`, `kind`, `state`, `revision`, `createdAt`,
`reviewedAt`, `issuedAt`, `sourceBinding`, `contentSha256`, `status` and the supersession pointers) was
carried by nothing, so an alteration issue set and an industry report had no shared language to speak.

- `src/studio/architect/alterationIssueSchema.ts` — the record gains an optional `delivery`, typed by the
  contract itself.
- `src/studio/architect/alterationIssues.ts` — `createAlterationIssueRecord` seals every new issue with a
  delivery record whose `contentSha256` is the hash of the same frozen bytes; `checkedAlterationIssue`
  verifies it on every reopen and fails closed with the code `CORRUPTED_ISSUE_DELIVERY` when the seal and
  the bytes have come apart or when the delivery disagrees with the fields beside it;
  `appendAlterationIssue` supersedes through `supersedeDelivery` rather than beside it.
- `src/studio/architect/AlterationIssueHistory.tsx` — each issue in the history shows the seal as it is
  verified in the browser, by recomputing the hash rather than by reading the pointer.
- `src/studio/architect/alterationStagePreview.css` — the seal's two readings.

### Why `delivery` is optional, and why that is not a weaker integration

Issues issued before the contract was wired in carry none. A required field would make every such project
fail to parse, which turns *"this project predates the field"* into *"this project cannot be opened"* — data
loss dressed as validation, which §3.2 of the ledger forbids. `checkedAlterationIssue` therefore **adopts**
the delivery identity for those from their own frozen bytes, and the adopted one is written back on the next
append. Every issue created since carries one, and every reopen verifies one.

## DONE (machine)

| Criterion | Reading | Carrier |
| --- | --- | --- |
| `deliveryRecordSchema` integrated into `AlterationIssue` | the record's `delivery` is parsed by `deliveryRecordSchema` itself, and every issued record carries one | `alterationIssueSchema.ts`, `alterationIssues.ts` |
| Reopening computes the SHA-256 of the frozen snapshot; a mismatch fails closed as `CORRUPTED_ISSUE_DELIVERY` | `assertDeliveryContentIntact(delivery, record.sourceJson, sha256Hex)` runs on every check; both the seal's mismatch and a delivery that disagrees with its record throw that code | `alterationIssues.ts`, tests 2 and 3 below |
| Unit tests verify that editing or tampering with an issued record throws | five tests added; the three tamper paths are each asserted to carry the code, and a legacy record whose bytes were edited is still refused | `alterationIssues.test.ts` |
| Regression suite passes (`npm test`), `tsc --noEmit` exit 0 | **1725 tests, 0 fail** (203 + 1522 across the two runners); `tsc --noEmit` exit 0 with no diagnostics | `npm-test.out.txt`, `tsc.out.txt` |

The suite in full, from this slice's own run:

```
ℹ tests 203     ℹ pass 203     ℹ fail 0
ℹ tests 1522    ℹ pass 1522    ℹ fail 0
```

`npm-test.out.txt` (172,981 bytes, sha256 `78b4b644f9b4eb04…`) is that run's stdout, unedited.

### ESLint, recorded as it is rather than as the gate assumes

The ledger's gate says *"ESLint reports 0 errors"*. Run repo-wide, `npx eslint .` reports **197,297 problems
(179,928 errors, 17,369 warnings) across 1,193 files and exits 1** — in `proof/` (882 files, the committed
bundles' inline scripts), `src-tauri/` (126), ignored scratch in `.temp/` (93), `src/` (45) and elsewhere.
**None of the four files this slice changed appears in that run**, and the scoped run over exactly those four
exits 0 with no output. The repository-wide failure is pre-existing and is not this slice's to fix; both
readings are in `eslint.out.txt` rather than the convenient one.

## DONE (human)

*"In Alteration Issue History modal, opening a historical revision displays a green 'Cryptographically Sealed
(SHA-256 Verified)' badge. Desktop (1600×1000) and Tablet (1024×768) screenshots attached showing the sealed
issue viewer."*

| Capture | What it shows |
| --- | --- |
| `screenshots/growth/sc01/sc01-sealed-issues-desktop-1600x1000.png` | 1600×1000. "Formal Coordinated Issue History (2 records)": **CURRENT Rev B — For Tender Reissue** sealed `a8a3f451c4725757…`, and **SUPERSEDED Rev A — For Client Review** sealed `ca9028063897669e…` pointing at Revision B. Both badges green, both hashes drawn from the records. |
| `screenshots/growth/sc01/sc01-sealed-issues-tablet-1024x768.png` | 1024×768, the same two records. No horizontal overflow at either viewport. |
| `screenshots/growth/sc01/sc01-issue-row-desktop.png` | the row's own frame at 1600×1000, row spanning y 493–650 of a 1000-pixel viewport. |

## Executed proof

The screenshots are not of a component rendered by a test harness. The scenario seeds the application's own
`localStorage` with a project built by running the real domain code
(`seed-project.mjs` in this directory builds the building, issues revision A, supersedes it with revision B,
and prints each record's seal), then drives the shipped UI — Design → Architectural workspace → the
Before/proposed preview → the issue history — through CDP under `render-scenario.json` (`build-scenario.mjs` writes it from the seed), and **asserts in the page**:

```
rows 2 · overflow false · everySealMatches true · everySealShownIsStored true
CURRENT     a8a3f451c4725757…  Cryptographically Sealed (SHA-256 Verified)
SUPERSEDED  ca9028063897669e…  Cryptographically Sealed (SHA-256 Verified)
```

- `everySealMatches` — each record's `delivery.contentSha256` equals its own `sourceSha256`.
- `everySealShownIsStored` — the hash the badge draws is one of the stored records' seals, so the badge is
  about the bytes rather than about the presence of a pointer.
- `overflow false` at both viewports.

A screenshot alone would show a badge; these readings are what make the badge a claim.

**One fixture limitation, stated rather than hidden:** the seeded basis is not a *referenced geometry* basis,
so the preview above the history reads "Stage preview unavailable … Review a referenced geometry basis before
resolving either alteration stage." That notice is about the fixture's basis, not about the seal: the history
below it renders from the records and is what the slice is about.

### Sessions

Six owned sessions ran this slice — `qa-sc01-probe` … `qa-sc01-proof` — each closed through the CLI's own
`close` after an identity check. All six left their daemon gone and their temporary profile directory gone
after the close, all exited 0. They are recorded in `process-table.json` here rather than in the assistant
campaign's record: `close-campaign-browsers.mjs` appends every session it closes to that campaign's committed
table, whose checks describe *that* campaign, so this slice's entries were lifted into this bundle and the
campaign's file was put back byte-identical to the revision it was committed at
(`check-housekeeping.mjs` passes 13 of 13 again afterwards).

The owned dev server on `127.0.0.1:8085` was started through `.temp/live-rig/server-8085.ps1` and stopped
through its own identity-checked path: **PID 84376 gone, port 8085 released**.

## Not established here

- The delivery record is not yet produced by the industry worksheets (Roofing, HVAC, QS). Those are SC-07,
  SC-11 and SC-14; SC-01 is the alteration issue set only.
- `sourceBinding` is `null` on an alteration issue: the contract allows a null binding and this artefact has
  no industry source binding to name. If a later slice binds the issue to a source drawing, that field is
  where it goes.
