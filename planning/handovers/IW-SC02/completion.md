# IW-SC02 implementation handover

Status: **awaiting-verification**. Implementer evidence is complete for this bounded pure-module foundation. Independent code/proof review and the requested rendered proof screenshot remain required before any tracker marks IW-SC02 verified. No UI or end-to-end estimating completion claim.

Baseline/authorization: see `startup.md`; existing branch `feat/v1-production-ready`, baseline `7ba4a14d1eccdcde1cfc15293adbf08918524c4f`. No commit, branch, dependency, database, storage write or runtime integration was made by this agent. User-authorized scope was provided by parent as “Implement the plan.”

Final branch recheck remains `feat/v1-production-ready`; HEAD is now `1bf54983bb3ff168358f4987c8481e8cc23fb760`, advanced externally during shared work. This agent did not commit or change branch. Parent was notified; proof hashes identify the exact new module files independently of that external commit.

## Files delivered

- `src/studio/construction/contract.ts`: strict versioned core schemas and inferred types, cross-record source/evidence/calibration validation, separate quantity/purchase/price boundaries.
- `src/studio/construction/quantity.ts`: pure count/polyline/simple-polygon/area-depth/native-volume arithmetic; result closure and recomputation validation.
- `src/studio/construction/lifecycle.ts`: immutable source/evidence/calibration transition guard, optimistic revision and review invalidation rules; future command interface.
- `src/studio/construction/legacy.ts`: read-only original-JSON fencing v1/v2 adapter and supplied binary/record preservation.
- `src/studio/construction/index.ts`: public API barrel.
- `src/studio/construction/construction.test.ts`: 22 deterministic/adversarial tests in 3 suites.
- `contracts/construction/generate.mjs`, `construction-job-v1.schema.json`, `quantity-result-v1.schema.json`: explicitly structural interchange artifacts with named required semantic validators.
- `planning/industry-contract.md`: authoritative integration/limitations/command contract notes.

## Public API

Import from `src/studio/construction/index.ts` (browser-compatible production code; Node imports occur only in tests/schema-generation tooling).

Constants: `CONSTRUCTION_JOB_SCHEMA`, `QUANTITY_RESULT_SCHEMA`, `QUANTITY_RULESET`, `METRES_PER_UNIT`.

Schemas: `lengthUnitSchema`, `quantityUnitSchema`, `pointSchema`, `sourceRevisionSchema`, `sourceLocatorSchema`, `evidenceSchema`, `calibrationSchema`, `reviewSchema`, `measurementSchema`, `workPackageSchema`, `legacyExtensionSchema`, `constructionJobSchema`, `quantityResultSchema`, `purchaseRequirementSchema`, `priceLineSchema`.

Types: `SourceLocator`, `SourceRevision`, `Measurement`, `ConstructionJob`, `Calibration`, `QuantityResult`, `PurchaseRequirement`, `PriceLine`, `LegacyImportOptions`, `ConstructionCommand`, `ConstructionCommandPort`.

Functions:

```ts
locatorKey(locator: SourceLocator): string
calculateQuantity(input: unknown, measurementId: string, resultId: string): QuantityResult
parseQuantityResult(input: unknown): QuantityResult
validateQuantityAgainstJob(input: unknown, currentJob: unknown): QuantityResult
validateJobTransition(previousInput: unknown, nextInput: unknown): ConstructionJob
importLegacyFencingJob(originalJobJson: string, options: LegacyImportOptions): ConstructionJob
```

`constructionJobSchema.parse` performs strict parsing/reference validation. Calculate requires a matching approved measurement revision. `parseQuantityResult` is required instead of structural-only result parsing; `validateQuantityAgainstJob` is required at current estimate/export boundaries. Do not treat the barrel's source/calibration names as replacements for the existing fencing domain exports; import with aliases if composing both.

## Executed proof

| Check | Exact command | Result / captured evidence |
| --- | --- | --- |
| Focused quantities/lifecycle/legacy tests | `node --experimental-strip-types --test --test-reporter=tap src/studio/construction/construction.test.ts` | 22 pass, 0 fail; `proof/audit/IW-SC02/tests.log` |
| Full repository TypeScript | `npm.cmd run typecheck` | exit 0; `proof/audit/IW-SC02/typecheck.log` |
| Structural schema freshness | `node --experimental-strip-types contracts/construction/generate.mjs --check` | both pass; `proof/audit/IW-SC02/schema-check.log` |
| Owned code formatting | `node node_modules/prettier/bin/prettier.cjs --check src/studio/construction/*.ts contracts/construction/generate.mjs` | pass; `proof/audit/IW-SC02/format-check.log` |
| New-file diff and manifest | `git diff --no-index` for each owned source/contract file | `proof/audit/IW-SC02/code.patch`, `source-hashes.json`, `diff-check.log` |

Initial local failures were confined to newly written tests: a shared fixture locator was mutated between tests; it now uses deep clones. Legacy v1 normalizer reset the top-level revision; adapter now explicitly validates/preserves a supplied original revision, and validates any history before migration can discard it. One TypeScript narrowing issue in the native-volume test was fixed. Final captured checks above pass. PowerShell blocks `npm.ps1`; `npm.cmd` works without changing execution policy.

The baseline verification agent owns production build/browser checks. It was notified of stable source. A final added legacy-history validation and test changes are isolated in these new unused modules; root/typecheck evidence has been rerun. For review, inspect final source hashes rather than an earlier intermediate snapshot.

## Required next work

1. Independent verifier: inspect the diff; rerun focused tests/typecheck/schema freshness; inspect authority limits and legacy preservation; render/capture the requested test-result proof screenshot with actual test results. Current files carry no screenshot and should remain awaiting-verification.
2. Runtime owner: implement the attributed local actor/revision-aware command port (authentication only when a later integration requires it), atomic snapshot history and asset-byte resolver. Real asset hash/auth authority cannot be inferred from a caller-supplied object.
3. Legacy runtime migration owner: enumerate original job plus all IndexedDB binaries and independent localStorage snapshots; preserve all in the extension; reconcile missing source hashes/sheet ownership explicitly before creating generic measurements. No automatic migration exists here.
4. Source/measurement UI owner: populate locators and evidence, establish/approve calibrations and measurement revisions, and route invalidations through the transition guard. Counts do not need calibration. Area/depth requires explicit depth evidence.
5. Estimate/pack owner: install proven versioned trade packs, purchase allowances and exact decimal pricing logic separately from quantity measurement. Core includes no pack execution or pricing engine.
6. Harness owner: add the focused test/schema commands to the unified root gates when owning package/test integration. This agent did not modify `package.json`.

## Material limits

- JSON Schema files deliberately represent structure only, not semantic parity. Their `$comment` and `x-required-semantic-validator` prohibit claiming that schema-only acceptance is enough.
- Quantity calculations use bounded doubles with no hidden rounding. Geometric degeneracy/huge polygons require upstream handling. There is no cross-measurement area/length union or symbol reconciliation beyond duplicate item IDs per locator.
- Hash strings/review actor names are validated assertions, not cryptographic asset/auth proofs. Use authoritative job validation at boundaries.
- Native-volume schema does not implement a new IFC extraction capability.
- Adapter preserves supplied original assets/records exactly and never fetches or writes storage; absent external bytes must be collected by the future migration caller.
- Fencing payloads/history are archived unchanged, not relabeled as industry-neutral reviewed quantities. Original source/BOM/quote contracts are untouched.
