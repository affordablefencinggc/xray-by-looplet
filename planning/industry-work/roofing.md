# Roofing worker — IND-29

Approved by user: “spin up an agent for each industry to work without collision”.
Branch: feat/architect-cad-engine. Shared-file integration belongs to the root agent.

## SC-01 — Draft plan-to-true roof area (helper tested; integration open)

Requirement: roofing T-1, register T-04. Audit found pitch in architect geometry but no isolated estimator area-development helper.

Exclusive writes: `src/studio/industries/roofing/`, this file, and `proof/growth/2026-09-13-industry-agents/roofing/`.

- [x] Read industry specification and inspect existing roof/pitch paths.
- [x] Implement explicit-input arithmetic with no implicit pitch/product defaults.
- [x] Run analytic and failure-boundary tests: 7 pass, 0 fail; scoped TypeScript check exit 0.
- [x] Hand off integration boundary; leave workflow acceptance open.

This slice does not measure a plan, validate calibration, resolve overlapping openings, calculate hip/valley lengths, optimise sheets, price or issue anything. Computed results must remain draft and ineligible for verified quote use.

## Proposed integration (not implemented)

Import `calculateDraftRoofArea` from `src/studio/industries/roofing/roofArea.ts` in a future roofing area worksheet. Supply explicit plane id, horizontal gross plan area in m², measurement reference, pitch in degrees from horizontal, pitch reference, and horizontal opening areas with their references. Show per-plane gross/opening/net true areas and totals, together with the returned draft status and limitations. No default pitch is supplied. This helper does not accept a verified flag and must not feed a verified BOM/quote adapter.

Before workflow acceptance, connect real calibrated area evidence and source identity in the application adapter; check geometric overlap/containment there. Add project save/reload and real browser worksheet tests. Existing authored roof pitch defaults must not silently populate verified measurements. Root owns shared UI/contracts and global ledger updates.

Proof: `proof/growth/2026-09-13-industry-agents/roofing/`. No browser sessions, background helpers or servers were launched; no cleanup needed. No full build or packaged-app claim. No changes to git index or shared files by this worker.

## SC-02 — Draft assistant adapter (adapter tested; root wiring pending)

Root delegated `assistantTool.ts` and `assistantTool.test.ts` under the roofing directory. Thin pure adapter exposes `calculate_draft_roof_area`, an explicit-input description, strict JSON Schema generated from the runtime Zod schema, and execution through the existing draft helper. The root owns project binding, permission classification and appTools integration.

Three adapter tests pass on DANS1; scoped TypeScript check exits 0. The explicit QA 3:4 pitch fixture produces 100 m² gross, 5 m² openings and 95 m² net; original supplied references remain, input is unchanged and output is quote-ineligible. Missing pitch/reference, extra verified flag, unexpected job-binding input, duplicate plane IDs and over-deductions reject. No model request or live-tool acceptance is claimed yet. Proof: `roofing/ASSISTANT-ADAPTER.md`.
