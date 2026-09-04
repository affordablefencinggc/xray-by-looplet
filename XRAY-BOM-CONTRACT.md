# X-Ray job-to-BOM contract v1

Status: **frozen for SC-07 implementation review**
Schemas: `xray.job-to-bom/v1` request and `xray.bom/v1` success/error
Machine contract: `contracts/xray-job-bom-v1.schema.json` and `src/studio/bomContract.ts`

This is the sole supported boundary from a reviewed workbench job to a fencing BOM. The browser compiler verifies and normalises inputs; the later deterministic rules kernel derives quantities. Neither side may read legacy takeoff quantities, mutable UI state, local storage, files, network data, or ambient defaults.

SC-07 produces physical quantities only. BOM objects cannot contain rates, amounts, tax, margin, Looplet identifiers, receipts, transmission state, or stock-order quantities. Stock selection, roll ordering and reusable offcut allocation remain a separate order kernel; case I expressly freezes that boundary.

## Fail-closed input

- Every object is strict. Unknown keys fail.
- `requestId` is transport correlation. It and `inputDigest` are excluded from canonical input JSON; identical retries have the same SHA-256 digest.
- Source dimensions are positive integer millimetres. Results are canonical non-negative decimal strings: no exponent, negative zero, leading zero, or insignificant trailing zero.
- The active non-sample PDF, DXF or SVG and every cited photo require a stored SHA-256 and a current runtime verification of the original. Photo links are reciprocal.
- Each used sheet has one locked selected calibration, bound by candidate identity and a digest of scale, transform, points and known-distance evidence.
- Every run and gate has a current positive revision and an attributed approval bound to that exact revision.
- Every run has exactly one recipe matching `(system, profile)`. Unsupported systems, profiles, slopes, ground, sleepers, retaining modes and gates block. There are no conventional defaults.
- Every material model, footing, allowance, gate hardware model and component references explicit accepted assumptions with source, effective date, actor and acceptance date. Missing or unresolved references block.
- Stored gross, gate deduction and net lengths must reconcile exactly with remeasured integer segment lengths and current gates.

## Topology

`topologyNodeId` is derived from `(sheet, exact canonical document-space x, exact canonical document-space y)` after applying the inverse canvas transform and normalising `-0` to `0`. No tolerance, proximity merge or rounding radius is allowed. Exact same-sheet vertices share one node across runs; different sheets never merge. A branch touching the middle of a segment is a junction only when the main run contains an explicit vertex there.

Runs, gates, photos and calibrations are sorted by stable identity. Canonical JSON recursively sorts object keys while preserving those normalised arrays. BOM line IDs and `groupKey`s must likewise be stable and sorted. BOM data contains no generated timestamp or random identifier.

## Geometry and bay capability

For each run, `grossMm = sum(segment.lengthMm)`. A gate interval is represented exactly as doubled integers: `[2*centreOffsetMm-widthMm, 2*centreOffsetMm+widthMm]`. Gates must be wholly contained in their named segment and must not overlap.

The approved run `specification.bayWidthMm` and recipe capabilities are different facts:

- `specification.bayWidthMm` is the estimator-approved design input.
- `recipe.maxBayWidthMm` is a hard capability. An approved width above it blocks compilation.
- `recipe.postSpacingMm` is the product's structural spacing capability.
- The later rules kernel uses the named effective limit `min(specification.bayWidthMm, recipe.postSpacingMm)`. There is no hidden precedence and none may be omitted.

Each segment is split at gate boundaries. Each positive residual span is divided independently: `bays = ceil(spanMm / effectiveLimitMm)`, with interiors evenly distributed within that span. Paling and sheet cover calculations are performed for every resulting bay before summing; they are not rounded once over a residual span or over global net length.

## Typed recipe capabilities

Recipes explicitly carry Colorbond effective sheet cover and rail rows; timber paling cover and rail rows; chain-wire mesh height, mesh roll length, reuse policy, top-rail rows, incident-strainer bracing policy and gate-boundary role; role-specific footing diameter/depth; accepted allowances; and exact gate hardware models keyed by gate type and width.

Free-text gate hardware is evidence only. Leaf, boundary-post, hinge-set, latch and drop-bolt counts are never inferred from it. Each request gate copies one exact supported recipe model and its typed counts; mismatch blocks at the contract boundary.

Components use only explicit semantic bases: post roles, bays, incident strainer ends, infill sheets, palings, rail cuts/length, mesh length/area, gate openings/leaves/hardware, concrete volume, removal length or retaining length. A missing capability blocks rather than choosing a default.

## Physical post roles

A document-space post site is counted once. The deterministic precedence is:

1. system gate-boundary rule (`strainer` for chain wire; `gate` for Colorbond and timber);
2. junction;
3. corner;
4. end;
5. ordinary.

The winning role selects exactly one role component and one role-specific footing. Chain-wire gate boundaries remain strainers, not additional gate posts. Incident strainer ends count fence spans meeting a strainer and are a separate bracing/tie basis, not extra physical posts.

## Deterministic arithmetic

Rules use decimal arithmetic and declared `ROUND_HALF_UP` display scales. Circular footing calculations freeze pi as `3.141592653589793`. One accepted allowance may apply to a component's full-precision raw result; its positive rounding increment must use the component's unit, and purchase-increment rounding occurs afterward. Multiple allowances on one component block because v1 declares no ordering between them.

Worked H freezes the stages:

```text
raw = 3*pi*(0.25/2)^2*0.6 + 2*pi*(0.30/2)^2*0.8
    = 0.201454628911445476125 m3 (display 0.201455)
allowed = raw*1.10
        = 0.2216000918025900237375 m3 (display 0.221600)
round up to 0.01 m3 = 0.23 m3
```

## Output and API

Success binds job revision, input digest, document hash, recipe-set identity/digest and ruleset version. Each sorted line has a stable identity, category, item code, canonical quantity/unit, structured rule/version/expression/operands/result, confidence tier, typed evidence and exact assumptions. Summary counts reconcile with lines and blockers. Invalid requests return `ok: false` with typed issues and no BOM.

```ts
compileBomRequest(input: {
  job: FencingJob
  runtimeAssets: RuntimeAssetReadiness
  hydrationSettled: boolean
  recipeSet: BomRecipeSet
  requestId: string
}): Promise<
  | { ok: true; request: BomBuildRequest }
  | { ok: false; issues: BomIssue[] }
>
```

Helpers: `bomBuildRequestSchema.parse`, `bomBuildResponseSchema.parse`, `canonicalBomInputJson`, `computeBomInputDigest`, and `verifyBomInputDigest`. The compiler is not a rules kernel. TypeScript and Python rules implementations must independently consume the frozen requests and emit byte-equivalent expected responses.

## Frozen worked proof A-I

| Case | Frozen result |
|---|---|
| A | 2,500 mm at 2,400 => 2 bays/3 posts; exact 4,800 => 2 bays/3 posts |
| B | L runs 4,800 + 3,000 => 4 bays and 5 unique physical posts |
| C | T with three 2,400 mm edges => 3 bays and 4 physical posts |
| D | 10,000 with gate `[3,000,5,000]`: residual 3,000 + 5,000, net 8,000, 5 bays, 7 sites (2 end, 3 ordinary, 2 gate), 762 cover => 13 sheets, 2 rail rows => 10 cuts/16 lm |
| E | Same timber geometry at 90 cover => 91 palings by per-span rounding. Chain wire at 3,000 spacing => 3 bays, 5 posts (4 strainer, 1 line), 4 incident strainer ends, 8 lm/14.4 m2 mesh and 8 lm top rail, with explicit roll/reuse policy |
| F | Overlapping gate intervals => blocker |
| G | 2,000 double gate => 1 opening, 2 leaves, 2 boundary posts, 2 hinge sets, 1 latch, 1 drop bolt |
| H | 3 ordinary `.25 x .6` and 2 gate `.30 x .8`, then 10% and 0.01 increment => 0.23 m3 |
| I | BOM raw quantity is not a stock/order quantity; ordering remains outside SC-07 |

`engine/fixtures/bom-contract/` is the executable golden record: Colorbond, timber, chain-wire and concrete request/response pairs, overlap blocker and `worked-cases.json`. Tests assert worked values, schema strictness, canonical digests, exact topology/shuffle parity, runtime proof, approvals, capability blockers and typed hardware mapping.
