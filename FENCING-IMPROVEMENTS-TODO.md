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
