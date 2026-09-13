# Next three bounded industry slices

Proposal only, 2026-09-13. Start after current fencing acceptance and its scheduled follow-ups; root decides when the queue advances. No assignment or readiness status changes here. Work in parallel only on isolated implementation folders; integrate and accept one visible workflow at a time.

Evidence reviewed: `INDUSTRY-AGENT-TODO.md`, `coordination.mjs`, the professional industry register, current controlled worksheets, `construction/runQuantity.ts`, `construction/quantity.ts` and construction tests. Existing core calculates source-bound length/area/volume and explicit deductions; it does not invent waste, pack rules or rates. Existing worksheets prove a manual-input pattern, not complete professional workflows. No new test or provider request was run for this proposal.

## 1. IND-44 — Flooring, tiling, painting and finishes: floor covering purchase quantities

User action: enter labelled room areas, explicit deductions, product coverage per pack and a chosen waste percentage; see net area, allowance, pack count, purchased coverage and surplus separately. Begin with one floor-covering product per group; no tile layout, paint coverage or automatic pattern allowance.

Required inputs: positive decimal m2 areas, identified deductions, product reference/revision, positive pack coverage, explicitly entered waste including zero. Manual rows remain unverified/source:null. A later source bridge must preserve immutable source revision/calibration references; typing a source name is not verification.

Exact QA fixture:20m2 gross-2m2 deductions=18m2 net;10% allowance=19.8m2 requirement;1.44m2/pack?14packs=20.16m2 supplied,0.36m2 surplus above requirement. Reject deductions exceeding gross and zero pack coverage. Edit allowance to0:13packs,18.72m2 supplied. Do not conflate surplus with waste.

Exclusive worker files: `src/studio/industries/finishes/**`, `planning/industry-work/finishes.md`, matching new proof directory.

## 2. IND-24 — Concrete and precast: simple slab pour quantity

User action: enter rectangular zones with explicit length, width and thickness, deduct explicit void volumes, then optionally apply a user-entered allowance and order increment. Show geometric volume separately from suggested order volume. Excludes structural sizing, reinforcement, mix selection, foundation suitability and supplier availability.

Exact QA fixture:5m×4m×0.1m=2m3 gross;1m2 void×0.1m=0.1m3 deduction?1.9m3 net; explicit5% allowance?1.995m3; explicit0.1m3 order increment?2m3. Changing thickness to0.2m recomputes both zone and void. Reject missing thickness, excessive deductions and incompatible units. No default depth or allowance.

Exclusive worker files: `src/studio/industries/concrete/**`, `planning/industry-work/concrete.md`, matching new proof directory.

## 3. IND-31 — Plumbing and gas services: pipe and fittings schedule

User action: enter labelled pipe sections with material, diameter and length, plus independently counted fittings; obtain grouped length and count schedules. Start with a material schedule only: no pipe sizing, gas design, gradients, fitting inference, stock nesting or compliance decisions.

Exact QA fixture:PVC25mm sections10.2m+3.3m?13.5m; copper15mm2m stays separate; two explicitly entered PVC elbows and one tee remain distinct counted items. Changing one diameter must split groups without losing total length. Reject duplicate IDs, missing diameter, nonpositive lengths and fractional fitting counts.

Exclusive worker files: `src/studio/industries/plumbing/**`, `planning/industry-work/plumbing.md`, matching new proof directory.

## Shared boundary and acceptance

Root owns draft IDs/schema migration, storage/backup compatibility, worksheet host, shared styles, tool registry/permissions/receipts, Studio integration and package scripts. Agree the strict input/output schema before worker edits. Reuse controlled `value/onChange/disabled` panels, empty defaults and existing CSS classes; do not write shared quantity or fencing kernels. Results are draft-only and quote-ineligible, with explicit inputs/provenance retained and no invented prices.

For each slice, pass domain adversarial/arithmetic tests before integration. In visible Edge and the built/native app, enter the exact fixture, inspect tables, edit to invalidate results, reopen/reload, switch isolated projects and confirm persistence/no cross-project leakage. Check tablet layout and errors. Then ask the configured assistant to execute the same explicitly supplied fixture once: inspect actual call arguments and receipt, compare every quantity/category to the UI, verify unchanged project geometry and accurate final/developer review. No claim that the assistant read worksheet fields without an implemented read tool. Preserve failed attempts and require a real successful receipt before moving to the next slice; arithmetic success alone is not whole-industry readiness.
