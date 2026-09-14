# RES-01 SC-02 — Explicit infill geometry and independent changed-repair shapes

Status: complete for the domain/geometry contract in `src/studio/architect/**`, proven by executed tests and
typecheck. Entry/edit/clear UI for the new disposition is RES-02 and is explicitly NOT claimed here.

Baseline commit: bcc5c3e76c901916ffedd600b89699097bf72d04, branch feat/architect-cad-engine.
All changes left UNSTAGED in the working tree. No git mutation was run.

## Requirement

RES-01: "Represent explicit infill geometry and independent before/proposed shapes for changed repairs.
Preserve authored sill/bottom offsets, layers and references; never turn 'remove fixture' into an inferred
solid. Existing saved drafts remain readable." Contract agreed first in [SC-01](RES-01-SC-01.md).

## Exact source diff

[source.diff](../source.diff) (29,104 bytes) — `git diff -- src/studio/architect/` plus the new untracked
test file appended via `git diff --no-index`.

```
 src/studio/architect/alterationStage.ts            | 30 ++++++++++--
 src/studio/architect/lifecycle.test.ts             |  6 ++-
 src/studio/architect/lifecycle.ts                  | 54 +++++++++++++++++++---
 src/studio/architect/model.ts                      | 24 +++++++++-
 src/studio/architect/retainedOpeningLifecycle.test.ts |  6 ++-
 5 files changed, 106 insertions(+), 14 deletions(-)
 + src/studio/architect/alterationInfill.test.ts (new, untracked)
```

### What was implemented

1. `model.ts` — `demolitionDisposition` became a `z.discriminatedUnion("kind", ...)` with the pre-existing
   `retain-void` member byte-identical plus a new `infill` member with the identical reference constraint.
   Added optional `repairBasis: { reference, height }` to the wall schema, and a `validateProject` invariant
   refusing a repair basis on a wall not classified `repaired`.
2. `lifecycle.ts` — `setOpeningDemolitionDisposition` now accepts either disposition kind; new
   `setWallRepairBasis` authors/clears the changed-repair before state; `setElementLifecycle` drops a
   `repairBasis` when a wall stops being `repaired` (mirroring the existing disposition-clearing rule);
   schedule rows and CSV carry both records (two new trailing CSV columns).
3. `alterationStage.ts` — explicit `infill` omits the opening from the **proposed** stage so the host wall's
   own authored layers close the former cut; an authored `repairBasis.height` is applied to the **before**
   stage only; a contradictory repair basis is a blocker.

### The decisive design point

Infill is **not** a variant of the retained void. Source read at bcc5c3e shows `kind: "void"` renders
`VOID <tag>` in plan (`drawing.ts:126-127`) and as an unfilled `#ffffff` elevation (`drawing.ts:369,372`),
counts as `summary.apertures` (`designedScene.ts:251`) and exports `IFCOPENINGELEMENT` +
`IFCRELVOIDSELEMENT` (`ifc.ts:126-128`). Reusing it for infill would render a closed aperture as a labelled
hole. Infill therefore removes the opening from the proposed stage; the restored solid is exactly the host
wall's authored layer stack, so no wall, layer, assembly or material is ever invented.

## Executed proof — tests

Independent analytic fixtures, computed from authored dimensions (4000 x 2700 x 200 mm solid = 2.16 m3;
door 900x2100 cut = 0.378 m3; window 900x1200 cut = 0.216 m3; repair before height 2400 = 1.92 m3), not
captured from resolver output.

[infill-suite.log](../tests/infill-suite.log) — `node --experimental-strip-types --test
src/studio/architect/alterationInfill.test.ts` → **tests 13, pass 13, fail 0**.

Covers contract fixtures F1–F7: retain-void unchanged (1.782/1.782); door infill 1.782 → 2.160 with delta
exactly the authored cut; elevated-window infill 1.944 → 2.160 with authored sill 900 preserved; missing
disposition still blocked; demolished host never resurrected; infill absent from drawings/scene/IFC as a
void; changed repair resolving 1.92 before vs 2.16 proposed with the source untouched; ID/order invariance;
schedule/CSV records; and a retain-void-only project still valid.

[architect-regression.log](../tests/architect-regression.log) — the eleven pre-existing architect suites
(alterationStage, retainedOpeningLifecycle, alterationQuantities, alterationDrafts, lifecycle,
lifecycleIntegration, alterationStageIntegration, alterationExport, retainedApertureRendering,
lifecycleMaterialBridge, architect) → **tests 110, pass 110, fail 0**.

Baseline before any edit was 43/43 on the five core suites; the 110-test set is the full architect regression
after the change.

[typecheck.log](../tests/typecheck.log) — `npm run typecheck` (`tsc --noEmit`) exit 0, no output.

### Two pre-existing assertions deliberately updated (not silently fixed)

Both live in files I own under `src/studio/architect/**`:

- `lifecycle.test.ts:130` pinned the exact CSV header. RES-01 appends `repairBasisReference` and
  `repairBasisHeight`; every prior column keeps its position. Header and the per-row expectation updated.
- `retainedOpeningLifecycle.test.ts:57` asserted `{ kind: "infill" }` **must throw** — it encoded the old
  contract that infill is unrepresentable, which RES-01 exists to supersede. Replaced with
  `{ kind: "partial-infill" }`, so an unsupported disposition kind is still proven to be refused.

These are contract changes, recorded here rather than presented as incidental test maintenance.

## Executed proof — browser (Fast CDP)

Dev server: `npm run dev`, vite v8.2.2 on port 8080 (no server was already running; I started it and stopped
it, see Cleanup). Session name exactly `residential-infill` per coordination.

- Desktop 1600x1000 — runner report exit 0, 17 commands,
  scenario sha256 `84761c5a980a6413ab237986308b359bdeedb659fbec77bfcba8b365028b12ef`,
  log `proof/growth/runner/2026-09-14T07-30-01-467Z-residential-infill.log`.
- Tablet 1024x768 — runner report exit 0, 16 commands,
  scenario sha256 `b926d9ff89d588bb8ba4f5f25b8535b1879e46293857a22402bc3e3a9436fdb7`,
  log `proof/growth/runner/2026-09-14T07-30-17-140Z-residential-infill.log`.

No phone/mobile viewport was tested (out of supported scope).

### What each screenshot actually demonstrates

All four were opened and inspected, not merely captured.

- [desktop-01-alteration-schedule.png](../screenshots/desktop-01-alteration-schedule.png) — the Alteration
  schedule panel on a **new, empty** project: "Alteration schedule · 0 elements", all six status counts 0,
  CSV button disabled. The runner's own eval returned `{"rowCount":0,"rows":[]}`. This demonstrates the
  panel renders and the existing material-sync/classification-only notices are intact after my change. It
  shows **no** infill data.
- [desktop-02-stage-preview.png](../screenshots/desktop-02-stage-preview.png) — the Before/proposed preview
  with the reference field, the unchanged-geometry confirmation checkbox, Stage/Level/View controls, and
  both "Volume comparison unavailable" and "Stage preview unavailable" blockers reading "Review a referenced
  geometry basis before resolving either alteration stage." This demonstrates the basis-review gate still
  blocks correctly after my resolver change.
- [tablet-01-alteration-schedule.png](../screenshots/tablet-01-alteration-schedule.png) — same panel at
  1024x768; the runner measured `panelWidth: 192, overflowsViewport: false`, and the inspected image shows
  the schedule column intact with text wrapped and no horizontal overflow.
- [tablet-02-stage-preview.png](../screenshots/tablet-02-stage-preview.png) — the stage preview at tablet
  width with controls reflowed to fit; all labels and the review button remain readable.

**Explicit limitation:** these screenshots do NOT show authored infill or a changed-repair before state.
The `AlterationPanel` offers only "Save retained void" — there is no infill or repair-basis control yet,
because entry/edit/clear UI is RES-02 by the plan's own split. The infill geometry, the closed-aperture
volumes, the preserved sill, the independent repair shapes and all backward compatibility are established
**only** by the executed tests above. No screenshot is offered as arithmetic proof.

## Cleanup

Dev server started by me and verified by PID + creation time + command line before stopping:
PID 100416, CreationDate 14/09/2026 5:24:35 PM,
CommandLine `node .../vite/bin/vite.js dev --host 0.0.0.0 --port 8080`. Stopped after use; no other node
process, browser or worker session was touched. Runner logs/scenarios are named `residential-infill` only.

## Remaining limits / OPEN

- Partial infill geometry — blocked by contract C4, RES-02.
- Repaired openings, slabs and roofs — contract C5 bounds RES-01 to the repaired wall case; RES-02.
- Entry/edit/clear UI and stage wiring for infill and repair basis — RES-02.
- `src/studio/assistant/architectBridge.ts` and `appTools.ts` still accept only `retain-void` for the
  assistant `set-opening-disposition` operation. Both are FORBIDDEN files for this worker, so the assistant
  path cannot author infill yet. Recorded as a root-integration item, not edited.
- Lifecycle quantity allocation / shared-volume ownership — RES-03. The material-sync guard in
  `materialBridge.ts` is unchanged and still blocks sync for any classified design
  (proven by lifecycleMaterialBridge suite passing).
- No production/native build was run in this step.
