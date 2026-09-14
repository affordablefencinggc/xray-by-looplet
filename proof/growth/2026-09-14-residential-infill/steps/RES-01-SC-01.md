# RES-01 SC-01 — Geometry and identity contract for explicit infill and changed-repair before-state

Status: contract proposed. This step is scope agreement only; it asserts no implementation and no executed
geometry result. SC-02 onward carry the code diff and executed proof.

Baseline commit: bcc5c3e76c901916ffedd600b89699097bf72d04, branch feat/architect-cad-engine.
Owner: Worker A (Residential, IND-01). Files in scope: `src/studio/architect/**` only.

## Requirement

INDUSTRY-REMAINING-WORK-PLAN.md RES-01: "Represent explicit infill geometry and independent before/proposed
shapes for changed repairs", with the dependency "Agree geometry/identity contract first. Preserve authored
sill/bottom offsets, layers and references; never turn 'remove fixture' into an inferred solid. Existing saved
drafts remain readable."

`planning/industry-work/residential-phase-geometry.md` line 30 and line 43 bind the semantics:
infill "must reference authored physical geometry and its layers; never invent a wall assembly", and
"Repair with changed geometry requires a before-state basis; historical baseline remains frozen."

## Source facts this contract is built on (read, not assumed)

These were read at bcc5c3e before proposing anything:

- `src/studio/architect/alterationStage.ts:74-76` currently pushes the blocker
  "A demolished opening in a retained wall needs explicit retain-void or authored infill disposition;
  this resolver cannot invent it." Authored infill is named but not representable.
- `src/studio/architect/lifecycle.ts:14,48-60` implements only `{ kind: "retain-void"; reference }`.
- `src/studio/architect/model.ts:46` constrains `demolitionDisposition` to the `retain-void` literal, and
  `model.ts:255-256` rejects a disposition on a non-demolished or `void` opening.
- Rendering treats `kind: "void"` as a visible unfilled aperture: `drawing.ts:126-127` emits `VOID <tag>`
  text in plan, `drawing.ts:369,372` fills the elevation `#ffffff` and labels it `VOID <tag>`;
  `designedScene.ts:177,251` skips any fixture and counts the opening under `summary.apertures`;
  `ifc.ts:126-129` emits `IFCOPENINGELEMENT` + `IFCRELVOIDSELEMENT` and deliberately no `IFCRELFILLSELEMENT`.
- `alterationStage.ts:90-94` implements retain-void by rewriting the proposed opening to `kind: "void"`.

**Consequence that decides the design:** infill is not a variant of the retained void. Reusing `kind: "void"`
would render an infilled opening as a labelled hole, count it as an aperture and export it as an IFC void —
the opposite of the authored intent. Infill must instead remove the opening from the proposed stage so the
host wall's own authored layers close across the former cut.

## Contract

### C1 — Disposition identity

`demolitionDisposition` becomes a discriminated union on `kind`, keeping the existing member byte-identical:

- `{ kind: "retain-void"; reference: string }` — unchanged, existing saved data stays valid.
- `{ kind: "infill"; reference: string }` — new. Explicit authored intent that the aperture is closed.

`reference` keeps the identical constraint in both members (`trim().min(1).max(500)`), so no existing
reference becomes invalid. Both remain authored references, never verified survey evidence.

### C2 — Infill geometry is the host wall's own authored geometry

An infilled opening is **absent from the proposed stage model**. No new wall, layer, assembly, material or
solid object is synthesised. The closed volume is produced solely by the host wall's existing authored
layers no longer being cut at that location — i.e. the restored solid is exactly the host's authored layer
stack over the former opening rectangle, with its authored thicknesses, `kind`s, hatches and material
identity. This satisfies "explicit infill restores only its own authored solid volume and material identity"
(residential-phase-geometry.md line 39) and "never invent a wall assembly" (line 30).

Nothing is inferred in the reverse direction either: removing a fixture never becomes an inferred solid
unless the operator has authored the `infill` disposition explicitly.

### C3 — Preservation of authored values

The before stage is untouched by the disposition: the opening keeps `kind` (`door`/`window`), `offset`,
`width`, `height`, `sill`, `hinge`, `swing`, `tag`, `lifecycle` and its `reference`. Sill/bottom offsets and
layers are never rewritten by infill. The canonical all-work project is never mutated by stage resolution.

### C4 — Partial infill is out of scope for RES-01 and must block, not approximate

An infill that closes only part of an aperture is a distinct authored geometry problem (it needs its own
authored sub-rectangle). RES-01 represents whole-aperture infill only. Partial infill is RES-02 work and is
recorded as OPEN below rather than approximated here.

### C5 — Changed repair needs an explicit independent before-state

`lifecycle.status === "repaired"` today means "present in both stages with identical geometry", enforced by
the basis fingerprint (`alterationStage.ts:24-31,58-60`). For a repair whose geometry *changes*, the
proposed shape is the authored current geometry and the before shape must come from an explicit authored
record, never reconstructed. The contract adds an explicit per-element before-state basis:

- A repaired element may carry `repairBasis` describing its **before-alteration** shape.
- `repairBasis` is authored and referenced; it carries its own `reference` string.
- Absent `repairBasis`, a repaired element keeps today's unchanged-across-stages meaning. This keeps every
  existing project and saved draft valid.
- The historical baseline stays frozen: `repairBasis` records the before shape and never rewrites issue
  history or the saved all-work model.

Scope bound for RES-01: the repaired *wall* case (the element whose solid volume the existing quantity path
already measures), expressed as authored before-state dimensions of that wall. Repaired openings, slabs and
roofs are OPEN.

### C6 — Identity and invariance

Dispositions and repair bases are keyed by the element's own stable `id`; no lexical ID ordering may decide
any geometric or quantity outcome. Results must be invariant under ID renaming and array reordering, matching
the existing fixtures' ID-swap discipline (`alterationStage.test.ts:26-39`).

### C7 — Backward compatibility

- `alterationDraftSchema.ts` is not modified. Saved drafts are frozen `sourceJson` validated through
  `validateProject`, so a purely additive optional model field keeps every existing draft readable
  (`alterationDrafts.ts:18-37`).
- Every previously valid project stays valid; nothing existing becomes required.

### C8 — No quantity or procurement unlock

Infill and repair-basis classification remain authored draft intent. The material-sync guard in
`materialBridge.ts:13-17` stays exactly as it is — any lifecycle assignment still blocks sync. Restored infill
volume appears only in the existing stage-geometry comparison, and the geometric delta is explicitly not a
demolition, disposal, salvage, repair or procurement quantity.

## Acceptance fixtures for SC-02 (analytic, independent of implementation output)

Host wall 4000 x 2700 x 200 mm solid = 2.16 m3 uncut. Door 900 x 2100 cut = 0.378 m3.
Elevated window 900 wide x 1200 high, sill 900, cut = 0.216 m3.

| # | Fixture | Before | Proposed |
| --- | --- | --- | --- |
| F1 | Demolished door, `retain-void` | 1.782 | 1.782 (hole kept, existing behaviour unchanged) |
| F2 | Demolished door, `infill` | 1.782 | 2.160 (host's own layers close) |
| F3 | Demolished elevated window, `infill`, sill 900 | 1.944 | 2.160 |
| F4 | Demolished door, no disposition | blocked | blocked (existing blocker retained) |
| F5 | `infill` on demolished host wall | wall absent both stages; no resurrected solid |
| F6 | Repaired wall, no `repairBasis` | equals proposed (unchanged meaning preserved) |
| F7 | Repaired wall, `repairBasis` height 2400 vs authored 2700 | 1.92 | 2.16 (independent shapes) |

F2/F3 are the RES-01 core: proposed exceeds before by exactly the authored cut, and the restored volume
equals the host's authored layer stack — never an invented assembly.

## Explicitly OPEN after RES-01

- Partial infill geometry (C4) — RES-02.
- Repaired openings, slabs, roofs (C5 scope bound) — RES-02.
- Entry/edit/clear UI and stage-resolution wiring for the new disposition — RES-02 by the plan's own split.
- Lifecycle quantity allocation and shared-volume ownership — RES-03.

## Limits

This file is a scope agreement. It contains no executed result. No code was changed to produce it.
