# HVAC work: IND-30 / T-1

Authorization: user requested an agent per industry, 2026-09-13. Parent assigned HVAC only.
Branch: `feat/architect-cad-engine`. Baseline: `d6c39da`.

## SC-01 — Straight duct area arithmetic [implemented; integration open]

Audit: generic construction measurements calculate lengths, areas and volumes, but no HVAC duct developed-area helper exists. The HVAC specification identifies T-1 as reachable without a services solver.

Scope: `src/studio/industries/hvac/**`, this file and `proof/growth/2026-09-13-industry-agents/hvac/**` only. No shared schema, UI, persistence, dependencies or source-control changes.

- [x] Implement a strict, pure draft calculation for straight rectangular and round duct sections.
- [x] Preserve explicit operand references and reject malformed or unsupported inputs.
- [x] Test arithmetic, mixed schedules, invalid values and input immutability: 10 tests passed.
- [x] Capture executed proof and exact diff; report integration boundary.

All results remain draft arithmetic, never verified takeoff, equipment sizing, fabrication allowance or quote approval. No external regulatory or manufacturer values are introduced. No browser or background process is needed for this isolated module.

Proof: `proof/growth/2026-09-13-industry-agents/hvac/README.md`, `tests.txt`, `typecheck.txt`, `changes.patch`. Scoped strict TypeScript checking passed. No full application build, browser test or shared ledger edit was performed by this agent.

## Integration boundary — open

Parent can import `calculateStraightDuctDraft` from `src/studio/industries/hvac/straightDuct.ts`. It takes `{ sections }`, with unique section IDs, `shape`, `lengthM`, and either `widthM`/`heightM` or `diameterM`. Every numeric input is `{ value, sourceReference }`. All dimensions are explicitly metres and represent the developed cross section, not a guessed conversion from insulated/external dimensions. Optional `sheetMassKgPerM2` must be a supplied declaration, not an inferred gauge or density. The result has per-section inputs/calculations and totals. Missing mass on any section gives a null total, never an understated sum.

Before exposing this as verified takeoff, a separate adapter must revalidate current source revision, measurement approval, calibration, and evidence identity through existing construction contracts. Do not merely relabel this helper's draft output. UI entry, save/reload, source-opening and actual HVAC job execution remain unimplemented/unproven. IND-30 T-1 and all engineering/sizing/commissioning workflows remain open.
