# Controlled QS classification form

Root delegated `quantityForm.ts`, `quantityForm.test.ts` and `QuantityDraftPanel.tsx` only. Shared host/persistence/styles/project integration remain root-owned. The panel uses the agreed controlled value/onChange/disabled contract and shared CSS classes; no runtime project store reads or writes.

The form starts empty, supports user hierarchy codes/labels/parents, decimal quantities with explicit units, evidence and assignment pickers. Stable form row keys preserve assignments when a classification code changes. Manual evidence defaults to unverified; inferred/sample may be selected, measured/verified may not. Every converted source is null. Calculation invokes the actual classification helper, displays exact grouped totals and unassigned residue, and remains quote-ineligible. Edits clear calculated results. Referenced classification removal is disabled until child/quantity assignments are changed.

## Executed on DANS1

- 22 tests passed, zero failures: 7 form tests plus 15 existing domain/adapter tests.
- Scoped strict TypeScript check including TSX: exit 0.
- Five tested input hashes match local source, including unchanged helper/shared props dependency.
- Exact new-file diff, test output and hashes are in this folder.

Tests cover empty/JSON form validation, source-null/evidence conversion, exact 0.1+0.2, reassignment preserving total/source evidence and invalidating the calculated flag, code rename retaining hierarchy links, unit/evidence separation, unknown references, cycles/duplicates, malformed decimals and JSON roundtrip.

Browser entry, keyboard/layout and project/reload persistence are **not yet verified**. Root will wire the host and freeze source before visible QA. No user source was measured, price generated or authority claimed. No browser or background process was started by this slice.
