# Proposed Register Expansions: Set-Out, Phasing, Preliminaries, and Deltas

Recorded: 2026-09-11  
Status: **MERGED 2026-09-11.** All eleven rows are live in `PROFESSIONAL-A-Z-CHECKLIST.md`, now 375 requirements across 28 categories.

Merge record:
- Rows were added to `planning/professional-coverage/catalogue.mjs` (the generated source), not typed into the markdown, then the register was regenerated.
- Every reviewed assessment survived: verified 6, partial 102, dependency-blocked 19, failed 1 all unchanged. Only `gap` moved, 236 to 247, exactly the eleven new rows. `validate.test.mjs` asserts this.
- Section 4 originally proposed `E-11` and `T-14`, both **occupied ids**; corrected to `E-15`/`T-15` before merge.
- Three toolchain guards had to be widened deliberately: `assessment.mjs` and `validate.mjs` assumed single-letter ids and would have silently dropped every `SO-`/`PH-` row, and `generate.mjs` hardcoded a 26-category count.
- The six industry specifications were rebound from prose blockers to these ids, so availability now derives entirely from the register.  
Triggered by: Validation findings across the first four industry specifications (`fencing.md`, `roofing.md`, `quantity-surveying.md`, `residential-building-design.md`).

---

## 1. Executive Summary

Mechanical validation of the first industry specifications against the then 364-row A–Z checklist revealed that the register understates real trade and design workflows in five systemic ways:

1. **Measurement ($T$) is continuous; Construction is discrete.** Category $T$ measures lengths, areas, and angles. No category converts continuous geometry into discrete, buildable arrangements (modular bay division, stock length packing, rafter pitch expansion).
2. **All 364 rows assume greenfield work.** None of the 364 rows distinguish existing fabric, demolition/strip-out, or tie-ins, directly blocking residential alterations (the stated scenario of IND-01), fence repairs, and re-roofing.
3. **Direct trade costs ignore site preliminaries.** Category $E$ models unit rates, labour, and formulas, but omits time- and site-related overheads (mobilisation, scaffolding, temporary fencing, supervision, waste).
4. **Takeoff without classification blocks estimating.** Category $T$ produces quantities, but lacks a standard cost-code classification hierarchy (Uniclass, MasterFormat, Australian Cost Codes) required for Quantity Surveying.
5. **Revision comparison is the single widest bottleneck.** $D\text{-}09$, $D\text{-}10$, and $T\text{-}09$ block 3 of the 4 profiled trades. Contractors quote revision deltas, not isolated clean sets.

Rather than unilaterally mutating `PROFESSIONAL-A-Z-CHECKLIST.md`, this document formalises the candidate categories and rows for architectural sign-off.

---

## 2. Proposed Category SO: Set-Out & Discrete Optimisation

**Intent:** Convert raw calibrated measurements into discrete, orderable, and buildable arrangements.

| ID | Title | Description | Unblocks |
|---|---|---|---|
| **SO-01** | Modular division and bay set-out | Partition linear or polygon runs into discrete modular bays within maximum spacing constraints, resolving leftover remainder bays (modular steel vs stick-built equalisation). | Fencing T-1, Balustrades T-7, Curtainwall facades, Partition walls |
| **SO-02** | 1D stock nesting and cut-list packing | Pack required cut lengths into orderable standard stock increments (e.g. 4.8m/5.4m timber, 2.4m/2.7m/3.0m posts, long-run steel) minimising scrap and offcuts. | Roofing T-2, Fencing T-1, Framing, Metal fabrication |
| **SO-03** | 2D sheet, panel, and roll layout | Set out 2D surface elements accounting for modular cover widths, side and end laps, staggered joints, and cut waste. | Roofing T-2, Cladding, Flooring/Tiling, Drywall lining |
| **SO-04** | True surface geometric development | Develop true rafter lengths, hip/valley true intersections, and pitch surface expansion factors from 2D plan projections. | Roofing T-1, Complex ceilings, Stair balustrades |
| **SO-05** | Slope contour set-out and clearance solver | Determine stepping versus raking thresholds along surveyed ground contours; compute triangular ground gaps and trigger retaining plinths and post step-downs. | Fencing T-3, Stepped retaining walls, Terraced landscaping |

---

## 3. Proposed Category PH: Phasing, Existing Fabric & Demolition

**Intent:** Model the lifecycle status of physical elements across alterations, repairs, and fit-outs.

| ID | Title | Description | Unblocks |
|---|---|---|---|
| **PH-01** | Element lifecycle status tagging | Assign and visually distinguish element states: `Existing to Remain`, `Demolish / Strip`, `Proposed / New`, and `Provisional / Repair`. | Residential T-1, Fencing T-2, Roofing T-4, Commercial fit-out |
| **PH-02** | Demolition and strip-out plan generation | Produce isolated demolition drawings and schedule material disposal quantities, salvage items, and hazardous material allowances. | Residential T-1, Roofing T-4, Demolition trade |
| **PH-03** | Existing interface and tie-in matching | Capture legacy/discontinued profile geometries, sound tie-in anchor points, and record substitution mismatch disclosures. | Fencing T-2, Heritage conservation, Window replacement |

---

## 4. Proposed Row Additions to Existing Categories

> **ID allocation checked 2026-09-11 against the live register.** Every one of the 26 categories currently holds exactly 14 rows (26 × 14 = 364), so the first free id in any category is `-15`. An earlier draft of this section proposed `E-11` and `T-14`, both of which are **occupied**: `E-11` is *Tender alternates and scenarios* (gap — and cited by `quantity-surveying.md` T-6) and `T-14` is *Bulk edit, undo and recovery* (gap). Merging those ids would have silently overwritten two live requirements. Corrected to `E-15` and `T-15` below. `D-15` was already free and is unchanged.

### Category E (Estimating & Rate Buildup)
* **E-15 Preliminaries and site allowances**: Quantify and allocate non-measured site overheads: site establishment/mobilisation, temporary fencing/scaffolding, craneage, plant hire, supervision, waste skip bins, and access constraints. (Unblocks QS T-1/T-7, Builders, Roofing T-4).

### Category T (Takeoff & Measurement)
* **T-15 Cost code and classification hierarchy binding**: Map geometric takeoff items to an extensible multi-tier classification system (e.g., Australian Cost Codes, Uniclass 2015, MasterFormat, or custom contractor cost centers). (Unblocks QS T-2).

### Category D (Drawings & Documentation)
* **D-15 Visual and vector revision delta engine**: Compute and display visual raster overlays (colour-coded red/green diffs), vector geometry modifications, and takeoff schedule variance tables between drawing revisions. (Unblocks Roofing T-7, QS T-5, Residential T-6).

---

## 5. Implementation Path

1. ~~**Review & Governance**~~ - done 2026-09-11.
2. ~~**Incorporation**~~ - done: `SO` (5 rows), `PH` (3 rows), `D-15`, `E-15` and `T-15` are merged with `gap` states and stated reasoning. Note the corrected ids: section 4 originally proposed the occupied `E-11` and `T-14`.
3. ~~**Spec Re-binding**~~ - done: 23 `requires:` lines across the six specifications now name these ids, and 26 stale prose blockers were removed. A test asserts every spec requirement resolves to a real register row.

Remaining, and **not** done here: no code implements any of these eleven rows. They are honest `gap` entries that make previously invisible work countable. The `SO` and `PH` categories in particular describe solvers that do not exist.
