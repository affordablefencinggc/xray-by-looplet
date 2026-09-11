# Industry specification: Roofing and cladding

Drafted 2026-09-11 against `planning/industry-specs/TEMPLATE.md` v1. Availability is computed by `node planning/industry-specs/validate.mjs`; no state is asserted here.

## 1. Profile binding

Verbatim from `planning/professional-coverage/industries.mjs`:

```
Roofing and cladding|Roofing estimator / installer|Measure a roof with hips, valleys and penetrations|Roof plan, sections and product dimensions|Net/stock quantities, flashing schedule and fixing details|C,M,R,T
```

Register id: **IND-29**. Inherited: C, M, R, T plus the universal set.

**Finding.** The profile line is a fair description of one task (T-1 below). It omits the two things roofers actually get wrong — sheet-length optimisation against stock lengths, and flashing/penetration detailing — and it omits re-roofing entirely, which is a large share of the real market and behaves differently from new work.

## 2. People and jobs

| Role | Does | Signs off |
|---|---|---|
| Roofing estimator | Takeoff from plans or a measured roof, sheet optimisation, quote | Quoted quantities and exclusions |
| Roof plumber / installer | Sets out, installs sheets, flashings, gutters, penetrations | Installed falls, laps, fixings, weathertightness |
| Supervisor | Orders material, schedules crane/delivery, manages offcuts | Order accuracy |
| Building surveyor / engineer (external) | Wind-load and structural adequacy where required | Compliance — **never X-Ray** |

Project types: **new work** (roof to a new structure), **re-roof / replacement** (strip and replace, often over occupied buildings), **inspection** (leak diagnosis, condition report, insurance), **maintenance** (flashing repair, gutter replacement, re-fixing).

## 3. Workflow

| Stage | Real work | DAY stage |
|---|---|---|
| Receive brief | Plans from a builder, or a site visit for a re-roof | DAY-01, DAY-02 |
| Measure | Scale off a roof plan and sections; or measure on site; establish pitch | DAY-03 |
| Develop | Convert plan area to true roof area using pitch; resolve hips, valleys, penetrations | DAY-03 |
| Optimise | Set sheet runs, lengths and laps against stock/orderable lengths | DAY-03 |
| Check | Falls, lap direction, flashing coverage, penetration clearances | DAY-04 |
| Price | Sheet, flashing, fixing, insulation, labour, crane, disposal for re-roofs | DAY-05 |
| Issue | Quote plus a cutting list and flashing schedule for the supplier and crew | DAY-06 |
| Install | Set out, install, record variations and site-measured corrections | DAY-07 |
| Revise | Builder changes pitch, adds a penetration, alters the plan | DAY-08 |

**Finding.** DAY-03 is a single stage in the register, but roofing has two genuinely different operations inside it — *develop* (geometry: plan area to true area) and *optimise* (a packing problem against stock lengths). Category T has rows for measuring (T-03, T-04) and for stock/packs (T-11), but nothing for the optimisation step that decides the actual order.

## 4. Task catalogue

#### T-1 Measure a pitched roof from plans
intent:      Produce true roof areas and line lengths from a roof plan and pitch
inputs:      Roof plan, sections or stated pitch, eaves/verge treatment
outputs:     True areas by plane, hip/valley/ridge/eave lengths, net of openings
requires:    T-01, T-03, T-04, T-05, T-10
origin:      [P]
notes:       Plan area times the rake factor for the pitch is the core arithmetic. Hips and valleys are the error source: their true length depends on the pitches of both planes meeting, not one. Unequal-pitch valleys are the case that catches people.

#### T-2 Optimise sheet lengths against stock
intent:      Decide sheet runs and lengths so the order minimises waste and avoids end laps
inputs:      Rafter lengths per plane, orderable/stock lengths, maximum single-sheet run
outputs:     Cutting list by length and quantity, offcut schedule, lap positions
requires:    T-03, T-11, E-05, E-09, SO-02, SO-03
origin:      [P]
notes:       Long-run sheets are cut to order, so "stock length" means orderable increments and a transport maximum, not shelf stock. Choosing to end-lap versus order longer is a cost-versus-risk judgement the estimator makes.

#### T-3 Schedule flashings and penetrations
intent:      Enumerate every flashing type and length, and each penetration's treatment
inputs:      Roof geometry, junction types, penetration positions and sizes
outputs:     Flashing schedule by type and girth, penetration list with details
requires:    T-03, T-06, C-12, M-04
blocked-by:  No junction typing, no flashing girth model, no sheet-metal flat-pattern capability (M-04 gap)
origin:      [P]
notes:       Flashing is sold by girth and length and is a large cost line. Girth comes from the folded profile, which is a sheet-metal development problem. Penetrations near a valley or ridge need different treatment from mid-plane ones.

#### T-4 Quote a re-roof
intent:      Price stripping an existing roof and replacing it, including the unknowns
inputs:      Existing roof type and condition, access, asbestos risk, occupancy
outputs:     Strip/dispose lines, replacement quantities, provisional allowances, staging
requires:    T-03, T-04, F-07, E-09, E-10, W-12, PH-01, PH-02
origin:      [P]
notes:       Re-roofing is priced with explicit provisional sums for what is found after strip (battens, rot, insulation). Pre-2000 sheeting raises an asbestos question that changes the whole job. Weather exposure staging is a real constraint on an occupied building.

#### T-5 Check falls and drainage
intent:      Verify roof and gutter falls carry design rainfall to outlets
inputs:      Roof catchment areas, gutter sizes, outlet positions, rainfall intensity
outputs:     Checked catchment/outlet arrangement and an issue list
requires:    T-04, H-03, G-01, W-09
blocked-by:  No hydraulic solver; category H is a gap by the register's own assessment
origin:      [S]
source:      AS3500.3
notes:       Gutter and downpipe sizing is a hydraulic calculation against a rainfall intensity for the location. X-Ray can prepare catchment areas as an input; it must not present a sizing result as verified.

#### T-6 Produce the cutting list and flashing schedule
intent:      Issue the fabrication and order documents to supplier and crew
inputs:      Approved sheet optimisation and flashing schedule
outputs:     Ordered cutting list, flashing schedule, issued and revision-tracked
requires:    D-02, D-08, D-09, D-13, I-09, I-08, V-05
origin:      [P]
notes:       This document goes straight to a roll-former. A wrong length is unrecoverable material. Revision control matters more here than on most drawings.

#### T-7 Compare a revised roof plan
intent:      Find what changed between issued revisions and re-price only the delta
inputs:      Prior and current roof plans
outputs:     Changed-area report, quantity delta, variation pricing
requires:    D-09, D-10, D-15, T-09, T-13
origin:      [P]
notes:       Builders revise roof plans constantly. Without a delta the estimator re-measures the whole roof and misses the change that mattered.

#### T-8 Record the installed roof
intent:      Capture as-built sheet layout, variations and photos for warranty and defects
inputs:      Site photos, measured corrections, variation notes
outputs:     As-built record bound to the order, variation lines, warranty pack
requires:    F-01, F-07, F-08, F-13, T-13, B-02, PH-01
origin:      [P]
notes:       Roof warranties depend on demonstrating correct laps, fixings and flashing. Photographic evidence at the right moments is the whole record.

## 5. Capability assessment

Computed by `validate.mjs`. What the bindings mean:

- **T-1 is the only roofing task whose rows are all `partial`** and which needs no missing engine. It is the single most reachable industry task found across all four specs in this pass. True-area-from-pitch is arithmetic over existing calibrated measurement.
- **T-2, T-3, T-6, T-7 are gaps for shared reasons** — optimisation, sheet-metal development, revision comparison. T-7's blockers (D-09, D-10, T-09) serve every trade that receives revised drawings.
- **T-5 is externally blocked** and must never present a hydraulic result as verified.

**The register gap this spec exposes:** the same shape as fencing. Category T measures; nothing *optimises* or *develops*. Roofing needs plan-to-true-area development and length packing; fencing needs bay division. Both are "turn a measurement into a buildable set-out" — arguably one missing category rather than two industry quirks.

## 6. Sources

| Key | Title | Publisher | Date | Reference | Used for |
|---|---|---|---|---|---|
| AS3500.3 | Plumbing and drainage — Stormwater drainage | Standards Australia | unverified in this pass | Not held locally | T-5 framing only. **Unverified**: cited to name the calculation, not to state any intensity, size or value. |

**Unverified in this pass.** No supplier technical manual (the profiled-sheeting manufacturers' installation manuals are the obvious next source), no sample cutting list, and no practitioner interview were consulted. All tasks are `[P]` apart from the single framing citation.

## 7. Open questions

1. **Orderable lengths** — what are the real length increments and transport maximum for the sheeting you'd target, and when is end-lapping accepted?
2. **Flashing girths** — are girths taken from a manufacturer's standard profile set, or folded to order per job?
3. **Re-roof provisionals** — how do you currently price the unknown under the existing roof?
4. **Pitch source** — do estimators get a stated pitch, or scale it off a section? This decides whether T-1 needs a pitch-from-geometry step.
5. **Valley detailing** — how much does unequal-pitch valley length actually come up in your target work?
