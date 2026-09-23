# 02 — Industry worksheets closeout

**When:** Thu 1 – Mon 12 Oct 2026 (7 working days; QLD holiday on Mon 5 Oct) · **Depends on:** 01 · **Owner input:** HVAC velocity ruling by Wed 30 Sep

## Goal
Close SC-09, SC-12, SC-13 and SC-14 in `XRAY-PRODUCTION-CLOSEOUT-LEDGER.md`, and the industry-agent leftovers.

## Starting state
- **SC-09** (QS-03 item evidence binding) is partial; only the dev reload remains, fixed in 01.
- **SC-12** (HVAC-01/02 straight duct and wrap) is partial. The missing-velocity mass rule needs a product ruling.
- **SC-13** (HVAC-03 network coordination) is partial and depends on SC-12 and the reload fix. Round runs still use conservative enclosing boxes; hydraulic solving is not proven.
- **SC-14** (HVAC-04/05/06 sizing and schedules) is partial. Solved pressure loss and exact round clash remain.
- **INDUSTRY-AGENT-TODO** L80–83:
  - roofing screenshot citation
  - discussion-only routing rebuild
  - roofing boundary explanation
  - QS CSV explanation
  - QS tablet acceptance
- **HVAC-CLOSEOUT-TODO** L11/15/16/17 mirror SC-12..14.

## Steps
1. SC-09: re-run the full QS-03 journey on dev and production after 01. Tick SC-09 with proof.
2. SC-12: implement Daniel's ruling for missing velocity; `hvacSchedules.ts` and `ductMaterialBasis.ts` are the likely places. Add unit tests for each ruling case. Run the HVAC-01/02 qualification on Dans1.
3. SC-13: replace the conservative round-duct enclosing box with an exact round clash, or clearly label conservative results. Re-run the multi-zone network journey.
4. SC-14: implement pressure-loss solving for the straight-run and fitting cases the schedules show. Label every result "estimate — not engineering sign-off" in the UI and exports. Run the sizing and commissioning schedules journey.
5. INDUSTRY-AGENT: rebuild the discussion-only routing change; add the roofing lap/boundary and QS CSV explanation turns; cite the roofing screenshot; run QS tablet acceptance at 768×1024.
6. Run all worksheet journeys once more on a single Dans1 build.

## Exit check
- SC-09, SC-12, SC-13 and SC-14 are `[[done]]` in the closeout ledger with proof links.
- HVAC-CLOSEOUT and INDUSTRY-AGENT in-scope lines are ticked.
- HVAC outputs show the estimate label.

## Proof
`proof/growth/<date>-industry-closeout/`: per-slice runner reports, screenshots at 1024×768 and 768×1024, test logs, diffs and a README.
