# X-Ray Workbench Contract

Approved visual source: the user's X-Ray reference captures in `C:\Users\danie\Pictures` and the restored live captures under `screenshots/xray-restored-*.png`.

This contract separates the approved workbench design from old demo behaviour. A familiar-looking screen is not evidence that its claims or actions are real.

## Non-negotiable shell

- Preserve the cream/paper and charcoal/navy X-Ray visual system, IBM Plex typography, thin technical rules, compact mono metadata, horizontal ten-mode rail, sheet rail, central source/model surface, contextual right inspector, and evidence footer.
- Preserve these production modes: Overview, Sheets, Measure, Sketch, Components, Model, Render, Review, Cost, Proof.
- Never reintroduce the green four-step fence workflow, full-page card stack, or fixed bottom action bar.
- Tradify is outside this product and must not appear in code, copy, contracts, or integration plans.

## Canonical runtime contract

- `job`, `activePlanBinary`, `photoPreviewUrls`, canonical blockers, and typed error/readiness state are the production source of truth.
- Hydration is an idempotent single-flight operation started once at the workbench root.
- Editing is unavailable until hydration settles; persistence, document, calibration, trace, and photo errors appear in the pane that owns them.
- Retrieved plan and photo bytes are rehashed before becoming ready. Metadata alone never proves that an original is available.
- Every durable atomic mutation increments `job.revision` once and appends one matching revision event.
- Every changed run, gate, or photo increments its entity revision; writes require the caller's expected revision.
- Geometry, specifications, linked evidence, and BOM changes invalidate affected approvals.
- Approved decisions require actor, decision timestamp, note support, and stale-revision rejection.
- Quote/export/handoff handlers re-check readiness internally. A disabled button is not the security boundary.

## Pane ownership

| Pane | Production responsibility | Contextual inspector | Current truth |
|---|---|---|---|
| Overview | Real job/document/evidence summary | Global readiness and recent revisions | Shell exists; demo qualification/vector claims must be removed. |
| Sheets | Import and browse verified PDF/DXF/SVG bytes and actual pages | Document metadata, hash, import errors | Storage exists; restored UI still shows fixed sample sheets. |
| Measure | Trusted calibration and editable quantity geometry | Calibration, trace editor, selected-run specification, compact photo summary | Core modules pass; all panels are currently unreachable. |
| Sketch | Visual-only annotation/guidance | Sketch layer status | Keep separate from quantity evidence and fencing specs. |
| Components | Generic assemblies/components evidenced by the job | Selection/component metadata | Current add/remove list is in-memory compatibility state. |
| Model | Honest source/manual wireframe presentation | Model readiness and source boundary | Canvas is real; preset statistics and unlabeled demos are not evidence. |
| Render | Camera/reference brief packaging only when capability exists | Provider/camera/reference readiness | Current timeout successes and provider claims are simulated and must be blocked or moved to Lab. |
| Review | `getJobBlockers(job)`, run/gate decisions, revision diff | Blocker and decision detail | Current flags read stale compatibility state. |
| Cost | Canonical derived BOM, then explicit pricing | Formula, assumptions, evidence and price-source readiness | Fixed `$3,045.08` BOM and invented rates are forbidden. |
| Proof | Photo evidence, revisioned manifest, deterministic export | Asset integrity, blockers, revision summary | Photo modules exist; current export omits canonical evidence. |

## SC-06 integration layout

- Desktop Measure: compact tool strip, trust/error strip, source canvas, item list; 320 px right inspector ordered Calibration → Trace details → selected Run specification → photo summary.
- Gate specifications remain inside the trace editor and must not be duplicated.
- Proof main column owns the full photo panel: real thumbnail, SHA-256, caption, source, run/gate links, ordering, removal, and missing-original state.
- Review selects a blocker/entity and can return to Measure with the same run or gate selected.
- Sheets renders `DocumentPreview` from verified `activePlanBinary` and generates its rail from the actual document page count.

## Responsive contract

- `>=1180px`: 168 px sheet rail, `minmax(620px, 1fr)` main surface, 260 px default inspector and 320 px Measure inspector.
- `761–1179px`: hide/collapse the sheet rail; keep a ~300 px inspector only while the canvas remains at least 520 px wide, otherwise place the inspector inline.
- `<=760px`: horizontal mode scrolling; no side rails; inline Measure order is canvas → calibration → trace → selected-run specification; Proof photos are one column.
- Inputs, buttons, and check rows are at least 44 px on touch layouts. Long filenames, hashes, and errors wrap. No document-level horizontal overflow.
- Blocking sections expand on mobile; non-blocking detail sections default collapsed. No fixed action surface may cover a form or canvas.

## Production truth boundary

| Surface | Required disposition before SC-06 completion |
|---|---|
| Project preset selector | Remove from production navigation or move to an explicitly labelled Lab/sample route. |
| Hardcoded fencing geometry/BOM | Unreachable from production panes; later replaced by SC-07 canonical BOM. |
| Browser CRM bridge | Unreachable and never reports success; SC-10 requires a Looplet-owned contract, server transport, idempotency, and receipt. |
| Fake sync queue | Unreachable; never delete queued work without a real acknowledged request. |
| Simulated Render actions | Disabled with exact missing capability or moved to Lab. No timeout-generated success. |
| Static install executable | No production download claim until provenance, signature, clean-machine install, and current-code parity are proven. |
| Untrusted engine executable | Never execute or distribute until provenance and packaged-host tests pass. |

## Proof scenarios

1. Fresh state: ten-mode shell, honest unqualified state, no stepper, no fabricated job, no browser errors or overflow.
2. Real import: verified PDF/DXF/SVG bytes and actual pages render; invalid/oversized input fails visibly; reload restores verified content.
3. Calibration: two points plus known distance produce a candidate; explicit lock enables measurements; conflict resolution and reload are proven.
4. Trace: create/edit/split/merge/delete/undo/redo/reload a multi-segment run with stable revisions.
5. Gate: place on a selected run; complete its specification; width/association atomically updates deduction and net length.
6. Run specification: every required/removal/retaining/corner/post field persists and invalidates stale approval.
7. Photos: import real JPEG/PNG/WebP, render thumbnails, rehash, caption/link/reorder/reload/remove, and surface missing or corrupt originals.
8. Review/Cost/Proof: blocker count matches the pure domain plus runtime asset blockers; no fixed BOM, invented price, fake CRM success, or incomplete proof export.
9. Render: every unavailable provider action is honestly blocked; no simulated connection, generation, clipboard, or verification claim.
10. Visual parity: inspected 1280×800 and 390×844 Measure/Proof captures, clean console, no overflow, and non-divergent built output.

## Ordered implementation boundary

1. SC-06B — harden revision, review, asset-integrity, hydration, and quote-readiness contracts.
2. SC-06C — integrate the frozen APIs into the ten-pane workbench and remove dishonest production actions.
3. SC-06D — replace the stale browser audit and prove the full real import/calibrate/trace/spec/photo/review/reload flow in development and production.
4. SC-07 — freeze and implement one versioned job→BOM contract shared by TypeScript and Python.
5. SC-08/09 — review/proof, then pricing.
6. SC-11 may proceed alongside SC-08–10 only after SC-07 freezes the engine contract.
7. SC-10, SC-12 final proof, and SC-13 remain dependent on real external contract/CI/signing environments.
