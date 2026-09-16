# HVAC-02-SC-01 — Duct worksheet binds to the live project source

Date: 2026-09-16. Branch: `feat/architect-cad-engine`. Baseline: `3abaca2`.

Requirement (from [INDUSTRY-REMAINING-WORK-PLAN.md](../../../../INDUSTRY-REMAINING-WORK-PLAN.md), HVAC-02): the straight-duct material worksheet must record where its dimensions came from and must not present a total that its recorded source no longer supports.

## Files

Changed (exact diff: [`HVAC-02-SC-01.patch`](HVAC-02-SC-01.patch)):
- `src/studio/industries/hvac/ductForm.ts` — sha256 `5f41931cd3fa5c3157cbf6392d94b00a46d128f581caf8f3f06bef7b508d6bf6`. Adds `createDuctSourceBinding` and `evaluateDuctFormBinding`; a stale binding returns `result: null` so the total is withheld rather than recomputed.
- `src/studio/industries/hvac/HvacDraftPanel.tsx` — sha256 `d5f7097ae3ec8ddb2a5d34e7adcc9bed433ef68c072aa2aca628f9f9ab90d48e`. Renders the binding fieldset, the bound-source summary and the withheld-result section.
- `src/studio/industries/hvac/ductForm.test.ts` — covers the binding, the per-value source-reference requirement and the withholding rule.

Shared prerequisites, recorded in [SH-02-SC-01](SH-02-SC-01.md): `src/studio/industries/sourceBinding.ts` (sha256 `e3c418f00edfca59dc5d5d5bf8ee5da962703d421adc22ebfd1ce1fb74107461`).

## Defect found and fixed in this step

The panel originally captured the evaluation at submit time: `setCalculation({ input, evaluation, result })`. The binding block re-read the live source on every render, so after the source changed the panel could show a *current-looking* total next to a binding line that already said stale. That is exactly the failure mode the checklist forbids.

Fix: the outcome is recomputed on every render from the live source —

```tsx
const outcome = visible && !visible.error ? evaluateDuctFormBinding(value, source) : null;
```

— and every result element renders from `outcome`, never from the captured value. A stale source therefore yields `outcome.result === null` and only the withheld section renders. This was found by the browser run, not by a unit test.

## Executed checks

Full regression (all suites) — [`regression-full.log`](../regression-full.log): **1383/1383 TypeScript tests pass, 201/201 script tests pass, 0 failures**. `npm run typecheck` clean; `npx eslint` on the files above clean.

Browser run — [`runner-report.json`](../runner-report.json): `"commands": 75, "exitCode": 0`.

Two contract facts the scenario had to satisfy, both discovered by the run rather than assumed: `straightDuct.ts` requires a non-empty `sourceReference` per value, and `ductFormToSchedule` refuses a section with a blank name. The scenario now enters "Duct run D1" and one reference per dimension.

## Screenshots

| File | sha256 | What it demonstrates |
| --- | --- | --- |
| [`hvac-01-bound-dimensioned.png`](../screenshots/hvac-01-bound-dimensioned.png) | `af2183e3…b7df1e9` | Bound and calculated: Source = Ground floor plan rev C.pdf, Evidence = "Dimensioned on the source — source-derived, still draft and not eligible for a verified quote", developed area 24 m², section "Duct run D1" 24 m², sheet mass "Not calculated — supply mass per area for every section". |
| [`tablet-02-hvac-stale-withheld.png`](../screenshots/tablet-02-hvac-stale-withheld.png) | `32cdc541…71e2b119` | Tablet viewport (1024×768) after the source hash changed and Calculate was pressed again: "Result withheld — Stale: the bound source revision was edited. Recalculate against the current source." and "A stale binding cannot report a total." No area is shown. |

## What the machine checks separately

`assertHvacSaved` reads the saved draft from `localStorage` and asserts `evidenceClass: "dimensioned"`, `units: "m"`, `sourceName: "Ground floor plan rev C.pdf"`, `calibrationId: "cal:0:manual:0.0125:cand-manual-1"` and that the recorded `sha256` matches the *revised* source — i.e. the binding was created against the source as it actually stood.

## Remaining limits

- The document and its locked calibration are seeded through the app's own restore path; the binding and the calculation are driven through the real controls.
- Sheet mass is deliberately not supplied in the fixture, so the screenshot shows the "Not calculated" branch. That branch is exercised, the mass branch is not — it is covered by the unit tests, not by this browser run.
- Wrap (external insulation) is not exercised in the browser run.
- No duct sizing, fitting, seam or waste allowance is claimed, and the result is not eligible for a verified quote.
