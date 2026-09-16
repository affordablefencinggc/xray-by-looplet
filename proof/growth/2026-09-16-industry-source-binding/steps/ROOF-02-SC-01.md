# ROOF-02-SC-01 — Roofing worksheet binds to the live project source

Date: 2026-09-16. Branch: `feat/architect-cad-engine`. Baseline: `3abaca2`.

Requirement (from [INDUSTRY-REMAINING-WORK-PLAN.md](../../../../INDUSTRY-REMAINING-WORK-PLAN.md), ROOF-02): the residential/roofing area worksheet must name the project source it was taken from, record how the evidence was obtained, and **withhold its total** when that source stops being the one it was bound to.

## Files

Changed (exact diff: [`ROOF-02-SC-01.patch`](ROOF-02-SC-01.patch)):
- `src/studio/industries/roofing/roofForm.ts` — sha256 `9d870a1e14423b22c3b60f62bd18b1bf02f311c7f6b023fcd056bb89357540a9`. Adds the binding draft/creation helpers and `evaluateRoofFormBinding`, which returns `result: null` whenever the binding is stale. The recorded `sourceName` is the project document's own label (`revision.name ?? revision.id`).
- `src/studio/industries/roofing/RoofingDraftPanel.tsx` — sha256 `b216efdf64bedb16bdad577d22d036a1e92b2a3fb5fb3cd427010cc428b5655f`. Renders the Source binding fieldset, the bound-source table, and the withheld alert. The unbound availability note prints the document label: `Binds to "<name>" as it stands now.`
- `src/studio/industries/roofing/roofForm.test.ts` — covers the binding and the stale-withholding rule.

Shared prerequisites, recorded in [SH-02-SC-01](SH-02-SC-01.md): `src/studio/industries/sourceBinding.ts` (sha256 `e3c418f00edfca59dc5d5d5bf8ee5da962703d421adc22ebfd1ce1fb74107461`).

## Executed checks

Full regression (all suites), captured after the last source edit — [`regression-full.log`](../regression-full.log):

```
ℹ tests 201      ℹ pass 201      ℹ fail 0     (scripts)
ℹ tests 1383     ℹ pass 1383     ℹ fail 0     (TypeScript, includes sourceBinding.test.ts)
```

`npm run typecheck` → clean. `npx eslint` on every file this step touches → clean.

Browser run — [`runner-report.json`](../runner-report.json), log [`runner.log`](../runner.log):

```
"session": "sh02-bind", "commands": 75, "exitCode": 0
```

The run ends with the `errors` opcode and reports no console error.

## Screenshots

Each was framed by scrolling the region it names into view; all nine frames of the whole run have distinct hashes, so no two captures are the same picture.

| File | sha256 | What it demonstrates |
| --- | --- | --- |
| [`roof-01-unbound-calculated.png`](../screenshots/roof-01-unbound-calculated.png) | `0251a081…c083919` | Unbound worksheet: the availability note names the open source ("Ground floor plan rev C.pdf"), the draft total for North plane (146.4929506513747 m²) is shown, and the limitations list says references are retained but not validated. |
| [`roof-02-bound-traced.png`](../screenshots/roof-02-bound-traced.png) | `4a254705…f66c6062` | After "Bind to current project source": the bound-source table reads Source = Ground floor plan rev C.pdf, Evidence class = traced, Reference = "North plane traced on plan sheet A-201", Locator = Page index 1, Units = m, plus the bound timestamp. |
| [`roof-03-bound-after-reload.png`](../screenshots/roof-03-bound-after-reload.png) | `0541b0d3…c00afc291` | The same table, with the same values and the same bound timestamp, after a full page reload — the binding was read back from project storage, not held in memory. |
| [`roof-04-stale-withheld.png`](../screenshots/roof-04-stale-withheld.png) | `298d7400…1a115e8c0` | After the source revision's hash changes: "Draft total withheld. Stale: the bound source revision was edited. Recalculate against the current source." No total is rendered. |

## What the machine checks separately

The scenario does not rely on the screenshot to establish the binding bytes. `assertRoofSaved` reads the saved draft out of `localStorage` and compares it field by field against the contract, including `schema`, `projectId`, `sourceRevisionId`, `sha256`, `sourceName`, `units`, `evidenceClass`, `reference`, `locator.pageIndex` and `calibrationId` (`cal:0:manual:0.0125:cand-manual-1`). It fails the run on any mismatch.

## Remaining limits

- The fixture is seeded, not driven: the scenario installs the document and its locked calibration through the app's own `restoreDocumentWorkspace` and `fencingJobSchema`, because the takeoff/calibration UI is a different slice. The *binding* is then driven entirely through the real controls.
- Only the active document and its active sheet are offered. Choosing among several sources is not implemented.
- Invalidation is evaluated on read (every render of the open worksheet). There is no notification while the worksheet is closed, and no background re-evaluation.
- This proves the worksheet withholds a stale total and names its source. It does **not** verify the areas themselves against the drawing, and nothing here becomes eligible for a verified quote: `verifiedQuoteEligible` stays `false`.
