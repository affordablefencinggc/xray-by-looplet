# Fencing improvement ledger (IND-43)

Authorized 2026-09-13: "continue with perfecting 1 industry at a time". Baseline ba805bf on feat/architect-cad-engine. Other industries wait; no whole-industry completion claim.

- [x] SC-00 Source-control cleanup: all 288 local files retained, source status empty; cleanup pushed through ba805bf.
- [ ] SC-01 / SO-01 Explicit bay division (implementation and development checks passed; package acceptance still open): preserve legacy equal-bay recipes; add reviewed modular full-bay/terminal-cut rule to both kernels, record recipe revision/digest, expose choice in the materials workflow. Test exact division, remainders, gates, corners, invalid choices and cross-language parity before advancing.
- [ ] SC-02 / SO-02 Stock nesting and cut lists with explicit stock and kerf inputs.
- [ ] SC-03 / SO-05 Slope/rake constraints from a reviewed product schedule.
- [ ] SC-04 Repair matching, gate hardware and installation evidence journeys.
- [ ] SC-05 Full fencing walkthrough: source, measure, specification, set-out, materials, review, issue/reopen; identify external engineering and supplier dependencies.

SC-01 boundaries: BOM recipe contract/schema, TypeScript/Python rules, recipe revision helper, Cost pane layout choice, focused tests and proof. Preserve archived BOMs and fixture bytes. No automatic compliance, rate, stock-width or engineering approval. No changes to other industry implementations.

2026-09-13 proof: TypeScript/Python parity includes exact full bays, terminal remainders, 2,001mm gate and corners. Edge synthetic QA project changed full -> equal -> full and retained the selected recipe across a development reload. DANS1 a21b5a8b5b1f web build/typecheck passed. Whole SC-01 remains open for installed-app generation and built-browser/tablet interaction. Do not advance to another industry.


2026-09-13 native QA checkpoint (after daf2cfe): Windows package a8a4f707ac43 builds successfully. Isolated visible package2f08ad4c8ef1 imported a labelled5m synthetic SVG through its file picker, picked and locked calibration, traced one5.00m run, recorded explicitly QA-only specification operands, and persisted full/equal bay selections through reload. Changing layout reopens assumptions as intended. Generation remains unaccepted: the wrapped engine handshake intermittently reports unavailable although five direct CLI statuses pass. A bounded asynchronous handshake fix and an independently exposed scratch-directory owner defect are under test. Default bundled-engine installation remains separate/open. No real construction or professional approval is claimed. Native screenshots and failed status observations: proof/growth/2026-09-13-industry-agents/roofing/native-ui/.

2026-09-13 DANS1 build recovery: e173b12b942c passed current-source type checking, focused tests, web build, native compilation and NSIS packaging. PowerShell verified the successful a8a4 dependency cache, invalidated only copied local app/host packages and required fresh executable output. Smart App Control remained enabled. Native host suites previously passed 37 tests plus 41 Tauri tests; browser provider status passed 22 development operations and production navigation passed 19 desktop/tablet operations. Native generation remains pending actual visible UI acceptance; SC-01 stays open. Evidence: proof/growth/2026-09-13-industry-agents/build-e173b12b942c/.
