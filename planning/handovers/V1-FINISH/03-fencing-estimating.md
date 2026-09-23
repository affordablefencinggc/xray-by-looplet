# 03 — Fencing and estimating chain

**When:** Tue 13 – Thu 22 Oct 2026 (8 days) · **Depends on:** 01 · **Owner input:** gate hardware and timber double-gate prices by Fri 9 Oct; a real fence job (drawing and site notes) by Fri 16 Oct

## Goal
Make fence → gate → material counts → real rates → revised quote → draft handover complete and dependable on a real job.

## Starting state (proven 23 Sep 2026)
- The fence + gate BOM generates on desktop with the qualified engine, matching the TypeScript reference (`proof/growth/2026-09-23-dans1-engine-build/`).
- Material-register → priced-worksheet link auto-updates on rebuild; for example palings went 561 → 815 (`proof/growth/2026-09-23-bom-pricing-link/`).
- Draft quote PDF and handover (ZIP, save to folder, Gmail, mail app) work (`proof/growth/2026-09-23-quote-draft/`, `2026-09-23-quote-handover/`).
- **Missing:**
  - hardware prices (gate hinges, latch, drop bolt, timber double gate)
  - quote issue state
  - rates printed to 2 decimals
  - FENCING-IMPROVEMENTS SC-00..05
  - master-ledger SC-08 review/proof pack

## Steps
1. FENCING-IMPROVEMENTS SC-00: cite the cleanup proof.
2. SC-01: bay-division package acceptance ("full bays + terminal cut" vs equal bays) with a test and a native journey.
3. SC-02: stock nesting with saw kerf for rails and posts. Reuse `src/studio/industries/roofing/stockNesting.ts`. Output lengths to buy (for example 2.4 m and 4.8 m) and offcuts, then feed them into the price mapping.
4. SC-03: slope and rake from a reviewed product schedule, extending the recipe beyond `supportedSlopes: ["level"]` in `fencingRecipes.ts`. Stepped and raked cases need tests and engine parity (`npm run test:bom-parity`).
5. SC-04: repair and gate-hardware journeys. Once Daniel's hardware prices are in the Looplet CRM list, map TP-GATE-HINGE-SET, TP-GATE-LATCH, TP-GATE-DROP-BOLT and TP-GATE-OPENING.
6. Quote issue (A–Z E-13): a draft → issued state in the priced worksheet/quote. An issued quote is frozen, and its PDF/JSON records the issue time and the price-book revision.
7. Print rates to at least 2 decimals in `quotePdf.ts` and the CSV.
8. SC-08 review/proof pack: only the rows the quote needs (RP-001..036 that cover quote evidence).
9. SC-05 full walkthrough on Daniel's real job: trace, spec, gate, BOM, rates, quote, revise one run, re-quote, hand over.

## Exit check
- FENCING-IMPROVEMENTS SC-00..05 are ticked.
- Every BOM line on the real job is priced, or marked "no rate" with a reason.
- A revision changes the priced lines automatically.
- An issued quote PDF matches the worksheet to the cent.
- This all runs on a Dans1 build.

## Proof
`proof/growth/<date>-fencing-v1/`: journey runner logs, quote PDFs (issued and revised), a parity report, screenshots and a README.
