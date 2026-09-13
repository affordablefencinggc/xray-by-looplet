# Quantity surveying: classification foundation

User authorization: “continue. spin up an agent for each insustry to work without collision”.
Branch: `feat/architect-cad-engine`. Owned paths: this file, `src/studio/industries/quantity-surveying/**`, and `proof/growth/2026-09-13-industry-agents/quantity-surveying/**`.

## SC-01 — Explicit classification and quantity reconciliation [domain helper tested; integration open]

Requirement: IND-38 task T-2; T-06 and T-15. The current industry specification identifies classification as its highest-leverage missing workflow. Existing register references to `src/studio/priceBooks.ts` are stale; that file does not exist in this checkout.

Implement a pure helper accepting user-defined hierarchy nodes and explicit item assignments. Keep exact quantities separated by unit and declared evidence status; retain source metadata. Show unclassified items and reject duplicate identities, missing parents, cycles and assignments to absent nodes. Reclassification must not rewrite or duplicate measurement inputs.

Machine acceptance: focused tests for reconciliation, mixed units/evidence, invalid graphs, invalid input and immutable reassignment; scoped TypeScript check. Root owns integration and shared checks.

Product acceptance remains open: no UI, persistence adapter, estimate issue workflow or verified source/calibration validation is included. Classification completeness is not measurement verification. No rates or published classification codes are invented. No background processes or browser changes.

### Executed evidence

- `node --experimental-strip-types --test src/studio/industries/quantity-surveying/classification.test.ts`: 11 passed, zero failed.
- Scoped `npx tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --strict --skipLibCheck --allowImportingTsExtensions` over the helper and test: exit 0. Full application typecheck remains root-owned.
- Output explicitly declares `status: draft-classification` and `verifiedQuoteEligible: false`, even when every item is classified.
- Ordinary decimal strings such as `1.0` and `1.20` normalise losslessly; no exponential, negative, non-finite or implicit unit conversions.
- Evidence: `proof/growth/2026-09-13-industry-agents/quantity-surveying/` contains executed test output, typecheck output and exact new-file patch.
- No task-owned background processes were launched; no browser state changed.

### Integration handoff (not implemented)

Add an adapter from explicit measured-item snapshots to the helper's item schema; preserve document identity, source revision, region and calibration reference rather than deriving them from the current active sheet. Store the user-defined hierarchy ID/revision and assignments separately from measurements. A picker may update only assignments, recompute the report, and show `unclassifiedItemIds` until empty. Render `totals` for report reconciliation, not the sum of overlapping ancestor rollups. Both unit and declared evidence category remain separate in all summaries. This helper does not validate whether a declared measurement is actually calibrated, and must remain excluded from verified quote/issue routes until existing provenance gates and a reviewed adapter are applied. UI, save/reload and issuing require their own tests.
