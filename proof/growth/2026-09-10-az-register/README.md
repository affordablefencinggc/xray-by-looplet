# A–Z register completed: every requirement assessed — 2026-09-10

All 364 rows of `PROFESSIONAL-A-Z-CHECKLIST.md` now carry a state and its reasoning. Before this slice, 348 rows read `State: not-assessed. Code/proof: pending.` Now none do.

This is a **documentation and assessment** slice. No product source code was changed, so no product behaviour was added, altered or claimed. The register was measured against shipping source, and where a ledger claim and the code disagreed, the code decided.

## Result

| State | Rows | Meaning |
|---|---|---|
| verified | 3 | Complete stated behaviour proven to the register's tick rule. |
| partial | 102 | Real implementation with executed proof and a named remaining boundary. |
| dependency-blocked | 21 | Blocked on an external dependency, chiefly an account service or a live search credential. |
| failed | 1 | Q-13 installed-app verification: attempted, not achieved. |
| gap | 237 | Not implemented; nothing to assess until built. |

## Method

1. A read-only code audit mapped requirement areas to shipping source, deliberately separating a UI control existing from the underlying behaviour being implemented.
2. Every claim that drove a `partial` or `verified` state was re-checked by reading the implementation and its test assertions directly.
3. Machine gate executed on the working tree: **1,111 tests across 88 suites pass**, `npx tsc --noEmit` exits 0. Seventy-two of those tests, covering the architect, persistence, calibration, price-book and sheet-lifecycle claims, are captured in `assessment-tests.log`.
4. Document integrity was verified programmatically by `verify-register.mjs`, whose output is `register-integrity.log`: 364 rows, every row holding a valid state and a substantive reason, no replacement characters, no unbalanced emphasis.

## False positives deliberately avoided

The audit flagged traps that a keyword search would have turned into wrong ticks. Each was recorded as a gap with the reason stated in the row:

- **C-06 layers.** The model field named `layers` is a wall assembly material layer, not a CAD drafting layer with visibility and lock.
- **S, N, H, L structural, electrical, services, landscape.** These words appear as trade labels on takeoff categories and sheet disciplines. No engineering solver exists for any of them. The altitude takeoff itself records structural plans and member schedules as *missing source information*.
- **C-08 transforms.** Offset, mirror, trim, extend and fillet are genuinely implemented, which can read as a complete modify toolset. Move, rotate, scale, copy and array are absent.
- **B-09 backup restore.** A complete-looking review interface exists, but applying a snapshot is deliberately not implemented and says so on screen.
- **A-04 roles.** The assistant permission mode governs tool execution, not user roles, and does not satisfy an access-control row.

## Corrections to stale bookkeeping

- Five rows verified in the 2026-09-07 acceptance addendum (D-06, D-14, E-01, E-02, B-10) still read `not-assessed`. They now carry their addendum evidence and its stated limits.
- The findings table claimed the architect model had one sheet with four viewports. The code supports a named sheet set with add, duplicate, rename, reorder, archive and recover, and up to twelve viewports per sheet.
- Four text defects were repaired at the file tail: an em dash and three multiplication signs lost to an encoding fault, which had glued words to numbers (`at1024`, `and768`, `least44`, `the364`).

## What this does not claim

No row was promoted to verified on the strength of tests alone. The tick rule additionally requires inspected visual proof at the declared viewports and a tested platform build, and most `partial` rows say exactly that in their remaining clause. All 68 industry profiles remain not-tested, and no working-day scenario DAY-01 to DAY-08 has been completed end to end.

## Two dependencies gate the most rows

- **No account service is selected.** Authentication ships disabled with no sign-in forms, blocking all of category A and much of V and Z.
- **Applying a backup into the workspace is unimplemented.** This blocks B-09, V-03, Z-07 and the working-day scenario Z-14.

Delivering those two unlocks more of this register than any other available work.

## Files

- `PROFESSIONAL-A-Z-CHECKLIST.md` — 364 rows assessed, new "Assessment status, 2026-09-10" section, findings table corrected, text defects repaired.
- `assessment-tests.log` — executed test output.
- `register-integrity.log`, `verify-register.mjs` — structural verification of the document.
- `state-counts.log` — state tally.
