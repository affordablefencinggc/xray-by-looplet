# Industry-neutral construction contract (IW-SC02)

Status: implemented foundation, **awaiting independent verification and integration**. This does not add a screen or complete the construction estimating workflow.

The new `xray.construction-job/v1` and `xray.quantity-result/v1` contracts live in `src/studio/construction`. Existing `xray.job-to-bom/v1`, `xray.bom/v1`, fencing runtime, storage keys and historical snapshots remain unchanged. No database, migration, package or dependency changes are required.

## Domain and authority

A construction job contains any number of work packages. Trade is a nonblank string, not an enumeration that excludes trades. An optional `{id, version}` pack reference carries no implicit approval or installed capability. Count, length, area and volume belong to the common core; fencing is only an optional imported work package. No fence specifications or gates are required for electrical, flooring, plumbing or concrete quantities.

Source revisions contain document identity, revision number, immutable revision identity, original asset identity and lowercase SHA-256. A source locator binds both revision ID and hash plus a zero-based page, model element/property, or document section. Two documents' page 0 values cannot collide. Page locators require a known page count and in-range index. Document sections can support count/specification evidence but cannot supply geometry calibration.

`constructionJobSchema.parse` is the authoritative structural/reference validator. All objects are strict; extra fields, missing references, duplicate IDs/revisions, unknown contract versions, invalid units, nonfinite/out-of-range numbers and stale measurement reviews fail closed. It validates submitted hash consistency, **not the original bytes or the actor's identity**. The future asset resolver must verify bytes against hashes and the local command layer must establish attributed review authority (authentication only when a later integration requires it) before calling these functions. A caller cannot establish trustworthy evidence merely by manufacturing a self-consistent object.

## Measured quantities

`calculateQuantity(job, measurementId, resultId)` validates the complete job and returns a deterministic result only for a revision-bound approved measurement. It does not generate IDs, timestamps, scale, depth, waste, purchase rounding or rates.

| Kind | Inputs | Canonical output | Gate |
| --- | --- | --- | --- |
| Count | Unique item IDs and item evidence | ea | Evidence from the same source/page/model; no calibration |
| Length | Ordered polyline vertices | m | Verified calibration bound to exact source/page/model; nonzero segments |
| Area | Implicitly closed simple polygon | m2 | Verified calibration; no repeated closing vertex, intersections, reversed/overlapping edges or zero area |
| Volume | Area polygon × explicit depth with unit/evidence | m3 | Area calibration plus positive evidenced depth |
| Volume | Explicit native model property value/unit and verification attribution | m3 | Same model element and property locator, associated evidence; this is an input contract, not a new IFC importer |

Calibration retains input distance/unit, coordinate distance and reference points for the two-point method. Its scale must agree with both distance operands and the reference-point distance within relative tolerance `1e-12`. Declared-unit calibration records exactly one declared input unit per coordinate unit, has no reference points and still requires verification/evidence. Neither `unverified` scale nor a default scale is accepted.

Each deduction records identity, value, canonical unit, reason and evidence references. Deductions must not exceed gross quantity. Count deductions must be integers. Cross-document evidence is permitted for specifications, depth and exclusions; measurement, item and calibration evidence must include their own source/page/model. Duplicate item IDs on one source locator cannot contribute to multiple measurements. Detecting two different IDs for the same real-world symbol remains a source-extraction/reconciliation responsibility; no spatial duplicate detector or cross-measurement polygon/line union is claimed.

Results preserve the full measurement (including review, vertices, operands, input units, depth and deductions), work-package revision, used calibrations, complete evidence closure and source revision records. Evidence/source arrays have stable ID ordering. `parseQuantityResult` re-computes this result, checks complete provenance and rejects fabricated totals or extra/missing records. `validateQuantityAgainstJob(result, currentJob)` additionally recomputes against the current authoritative job, rejecting stale revisions and altered provenance. Use the latter before adding a result to an estimate/export; structural parsing alone is insufficient.

Geometry uses bounded IEEE-754 doubles. Coordinates are limited to ±1e12; quantities must be finite, nonnegative and at most `Number.MAX_SAFE_INTEGER`. Computation has no implicit decimal rounding. Polygon calculation translates to its first vertex to reduce cancellation. Values extremely close to geometric degeneracy can be numerically ambiguous and must be resolved upstream; this is not an exact-arithmetic geometry kernel. Planar simple polygons only; holes are explicit evidenced deductions. Polygon validation is quadratic and capped at 10,000 vertices; large-model processing needs a future bounded worker/geometry service.

## Revision lifecycle and future command integration

`validateJobTransition(previous, next)` preserves job identity/creation time, requires exactly one new job revision and a nondecreasing update time. Source revisions, evidence records and calibrations are append-only: a new calibration or replacement source requires a new identity. Changed measurement operands require the next measurement revision and draft review. Review-only changes retain the measurement revision. Work-package changes require a new package revision and invalidate affected measurement review. Legacy extension snapshots are immutable. Measurement deletion is deliberately rejected until an archival command can preserve its history.

`ConstructionCommand` defines `append-source`, `append-evidence`, `append-calibration`, `put-work-package`, `put-measurement` and `review-measurement`, each with command ID, expected job revision, actor and timestamp. `ConstructionCommandPort.execute` returns either a validated job or `conflict`, `invalid` or `storage`. This is an interface, not an installed executor. The future executor must:

1. Attribute the local actor (authenticate only when a later integration requires it), validate command payload, reject stale expected revisions and duplicate command IDs, and resolve original asset bytes/hashes.
2. Apply a single command using explicit IDs/units and revision-bound reviews; never reuse a changed source/calibration/evidence identity.
3. Validate the transition, then atomically preserve the previous snapshot plus command and next snapshot. Undo/redo must produce new revisions, never rewrite history.
4. Recompute affected quantities and use `validateQuantityAgainstJob` at estimate/export boundaries. A changed job revision makes previous results stale even if a measurement is unaffected.

Approval cannot follow changed scale silently: calibrations cannot change under their existing identity; rebinding a measurement to a new calibration changes its operands and forces draft review. Replacing evidence/source identity similarly changes references. Direct object replacement outside this lifecycle is not an authorized storage operation.

## Purchase and price separation

`purchaseRequirementSchema` links a quantity result/job revision to a versioned pack rule, item, purchase quantity/unit and evidence. No recipe engine is installed or claimed as proven here. `priceLineSchema` is a separate boundary with AUD currency, canonical nonnegative decimal-string unit rate and integer minor-unit amount. There is no floating-point money calculation or automatic amount/rate inference. Pack execution, allowances, pricing calculations and exact decimal rounding policy belong to later slices.

## Lossless legacy import

`importLegacyFencingJob(originalJobJson, {workPackageId, preservedAssets, preservedRecords})` is non-writing and accepts only legacy fencing v1/v2 JSON that passes the existing `parseFencingJob` validation. It retains the exact original JSON text in `xray.legacy-fencing-import/v1`, including unknown extra fields, IDs, original schema version, revisions, history, links and embedded snapshots. An explicitly present positive legacy job revision is retained even though the old v1 normalizer resets it. The normalizer's projection is used only for envelope metadata/validation; it never replaces the preserved original.

Supplied original binary content (base64 plus media type/hash/ID) and external serialized records are retained verbatim. The adapter has no storage access and cannot discover unsupplied IndexedDB bytes or localStorage historical records. Its caller must enumerate and supply those before a future migration claims complete asset preservation; hashes in this archival envelope are declared and must be verified by the asset resolver. No assets are silently fetched, rewritten or deleted. Unsupported versions, corrupt job/record JSON and duplicate asset/record identities are rejected.

The adapter creates an optional fencing work package with no selected pack and **zero promoted source/measurement records**. Old sheet-only calibration ownership or missing hashes are never guessed. Original documents, measurements, approvals and BOM/quote history remain exactly in the extension until an explicit future reconciliation/import flow supplies trustworthy provenance. No historical result is relabeled as a new core quantity or newly reviewed estimate.

## Interchange and proof

`contracts/construction/*.schema.json` are generated **structural** JSON Schema artifacts. Zod semantic refinements (reference joins, arithmetic, geometry, immutable transitions, provenance closure and legacy validation) cannot be represented by plain JSON Schema. Each artifact explicitly names its required semantic validator; accepting only the JSON Schema does not satisfy the contract. Run `node --experimental-strip-types contracts/construction/generate.mjs --check` to verify structural freshness, or omit `--check` to regenerate.

Run `node --experimental-strip-types --test src/studio/construction/construction.test.ts` for deterministic industry scenarios and adversarial checks. Tests are not yet added to the root test script because package edits are outside this slice. Exact execution logs and uncommitted source diffs belong in `proof/audit/IW-SC02/`; independent verification must capture the user-requested proof report screenshot before marking the slice verified. No UI behavior or whole-product completion is asserted by these tests.
