# Industry specification: Fencing, gates and balustrades

Drafted 2026-09-11 against `planning/industry-specs/TEMPLATE.md` v1. Availability states are **not written here** — run `node planning/industry-specs/validate.mjs` to compute them from `PROFESSIONAL-A-Z-CHECKLIST.md`.

This is a product specification. Nothing in it asserts that X-Ray performs any of these tasks today.

## 1. Profile binding

Verbatim from `planning/professional-coverage/industries.mjs` line 43:

```
Fencing, gates and balustrades|Estimator / installer|Measure runs, gates and corner connections|Site plan, boundary measurements and product system|Source-linked takeoff, stock list and installation record|C,F,L,M,T
```

Register id: **IND-43**. Inherited categories: C, F, L, M, T, plus the universal A, B, D, E, I, J, Q, U, V, Z.

**Finding against the existing profile line.** Its stated scenario — "measure runs, gates and corner connections" — is one task of the nine below. The profile also silently merges three products with different engineering bases: fencing (spacing and wind load), pool barriers (a life-safety code with non-climbable zones), and balustrades (a structural handrail load case). Treating them as one profile is the reason IND-43 cannot carry a useful state. This spec splits them.

## 2. People and jobs

| Role | Does | Signs off |
|---|---|---|
| Estimator | Site measure or plan takeoff, material list, quote | The quoted price and its exclusions |
| Installer / leading hand | Sets out, digs, concretes, fixes panels and gates | Installed line, heights, gate operation |
| Business owner | Supplier rates, margin, warranty terms | The issued quote and variations |
| Certifier / building surveyor (external) | Inspects pool barriers where required | Compliance — **never X-Ray** |

Project types:

- **New work** — a boundary or internal run on a new or existing site.
- **Repair / replacement** — part of a run replaced, often matching an existing product no longer sold.
- **Inspection** — pool barrier re-inspection; balustrade condition check.
- **Maintenance** — gate hardware adjustment, panel re-fixing, post re-concreting.

## 3. Workflow

| Stage | Real work | DAY stage |
|---|---|---|
| Receive brief | Phone/site enquiry, address, photos, sometimes a site plan or survey | DAY-01, DAY-02 |
| Measure | Site measure with wheel/laser or scale off a plan; record slope, obstructions, services | DAY-03 |
| Set out | Divide runs into bays, place ends/corners/gates, resolve leftover bays | DAY-03 |
| Check | Heights, gaps, gate swings, pool-barrier zones, retaining interaction | DAY-04 |
| Price | Supplier rates by stock length/pack, waste, labour, concrete, hardware | DAY-05 |
| Issue | Quote with exclusions and assumptions; plan or sketch for the installer | DAY-06 |
| Install | Set out on site, adjust for reality, record what was actually built | DAY-07 |
| Revise | Client changes a gate, adds a run, moves a line; re-price | DAY-08 |

**Finding.** DAY-05 assumes a supplier workbook. In fencing the rate source is very often a trade price list PDF or a phoned-in price, and the *pack/stock-length* rounding matters more than the unit rate. E-05 (unit and pack normalization) is the row that actually gates this trade, and it is a gap.

## 4. Task catalogue

#### T-1 Estimate a boundary run
intent:      Price a straight or multi-leg boundary fence from a plan or site measure
inputs:      Boundary dimensions, product system, height, ground line
outputs:     Bay set-out, post/rail/panel counts, stock list, priced quote
requires:    T-01, T-03, T-10, T-11, E-01, E-03, E-09, SO-01, SO-02
origin:      [P]
notes:       The bay division algorithm depends strictly on construction system:
             1. Modular steel (Colorbond): Panels and rails have fixed manufacturing widths (standard 2.36m or 3.10m post centres). Equalising all bays requires angle-grinding every sheet and rail on site, which is commercially non-viable. The rule is: maximum full standard bays + one cut bay placed at a terminal end, corner, or gate junction.
             2. Stick-built timber paling: Rails (4.8m or 5.4m) are cut to length on site spanning two bays. The rule is: equalise all bays to stay strictly within maximum post centres (typically <= 2.40m). Number of bays N = ceil(Length / 2.40m); bay width = Length / N.
             Corners and ends consume one dedicated post and corner bracket assembly each.

#### T-2 Replace part of an existing run
intent:      Quote replacing a damaged section while matching the retained fence
inputs:      Photos, measured damaged extent, existing product identification
outputs:     Matched material list, make-good allowance, disposal line
requires:    T-03, T-10, T-11, F-07, E-01, E-09, PH-01, PH-03
origin:      [P]
notes:       Repair matching requires a 4-point field protocol:
             1. Sheet profile family & pitch (e.g. Lysaght Neoscreen vs Smartascreen vs Trimdeck/corrugated).
             2. Post profile (C-post vs double-C vs 50x50 SHS vs timber).
             3. Colour name (current Colorbond standard vs discontinued colours like Riversand, Wilderness, Harvest).
             4. Substitution disclaimer: when discontinued, specify the closest modern profile and flag client mismatch risk.
             Scope must price demolition/disposal of the damaged section, post extraction or sleeve-over, and tie-in brackets to the sound retained post.

#### T-3 Set out a run on a slope
intent:      Decide stepped versus raked panels and compute resulting heights and gaps
inputs:      Ground levels or slope percentage along the run, product limits
outputs:     Per-bay step/rake, post lengths, ground-gap schedule, retaining plinth allowance
requires:    T-01, T-05, T-03, T-11, C-01, SO-05
origin:      [P]
notes:       Grade threshold governs the set-out method:
             1. Slopes <= 3-5% (fall <= 50-100mm per 2.36m panel): panels rake within standard rail bracket tolerances without cutting.
             2. Slopes > 5%: panels must step. Stepping creates a triangular gap beneath the bottom rail.
             3. If ground gap exceeds 50mm, a retaining plinth (treated pine sleeper 200x50mm or Colorbond steel plinth) is slotted into the C-posts beneath the bottom rail.
             4. Stepped panels with plinths require upgrading post lengths from standard 2.4m to 2.7m or 3.0m to maintain minimum 600mm in-ground depth.

#### T-4 Quote a gate
intent:      Specify and price a pedestrian or vehicle gate within a run
inputs:      Opening width, swing/slide, hardware, self-closing requirement
outputs:     Gate leaf size, hardware list, post upgrade, priced line
requires:    T-03, T-11, E-01, E-09, M-07
blocked-by:  No hardware/product catalogue; no gate assembly solver with automatic post substitution
origin:      [P]
notes:       Gate placement triggers two non-negotiable rules:
             1. Automatic post upgrade: standard line posts (C-post or light 50x50x1.6mm SHS) flex under gate slam and misalign latches. Single pedestrian gates (900-1000mm) must substitute 65x65x2.0mm SHS or 75x75x2.5mm SHS steel (or 100x100mm timber). Vehicle/double gates (3000-4200mm) require 75x75x3.0mm, 89x89mm, or 100x100x3.0mm SHS.
             2. Leaf sizing deduction: clear opening width is never leaf width. Leaf Width = Opening - Hinge Gap (15-20mm) - Latch Gap (15-20mm).
             Hardware schedule includes heavy-duty self-closing hinges, D-latch or key-lockable magnetic latch, and drop bolts for double gates.

#### T-5 Rural fencing run
intent:      Price a wire fence over a long distance with strainers and droppers
inputs:      Distance, terrain, wire type and count, strain-post positions
outputs:     Wire runs, strainer/stay assemblies, dropper spacing, stock list
requires:    T-03, T-05, T-10, T-11, E-01, E-09
blocked-by:  Strain-post placement (a function of direction change and distance) and wire-run length including sag are not modelled anywhere
origin:      [P]
notes:       Priced per kilometre with wire sold by roll length (500m / 1000m coils); the pack-rounding problem (E-05) dominates. Strainer post and stay assemblies occur at every direction change > 15 degrees and at maximum 200m intervals on straight runs. End and strainer assemblies represent the majority of material and labour cost, not the line wire.

#### T-6 Pool barrier compliance check
intent:      Check a proposed or existing barrier against the applicable pool-safety requirements
inputs:      Barrier geometry, gaps, heights, non-climbable zones, gate self-closing
outputs:     A checked geometry record and an issue list for a certifier
requires:    T-03, T-01, Q-08, W-11
blocked-by:  No rules engine, no standards content, and no qualified-review path. X-Ray must not state compliance.
origin:      [S]
source:      AS1926.1
notes:       Liability boundary: X-Ray must NEVER issue a compliance verdict or regulatory sign-off (e.g. Form 15 / Form 16).
             X-Ray's role is strictly to generate a "Certifier Geometric Audit & Evidence Sheet" verifying:
             1. Barrier height >= 1200mm above finished ground level on the approach side.
             2. Ground clearance beneath barrier <= 100mm throughout (including stepped panels).
             3. Picket/infill gaps <= 100mm clear.
             4. 900mm Non-Climbable Zone (NCZ) quadrant arc projected from the top of the barrier, flagging climbable objects (retaining wall steps, taps, adjacent boundary fences, trees).
             5. Gate opens outward away from pool enclosure, equipped with self-closing hinges and latch >= 1500mm above ground (or shielded).

#### T-7 Balustrade to a deck or stair
intent:      Set out and price a balustrade including stair rake and infill
inputs:      Deck/stair geometry, height requirement, infill type, fixing substrate
outputs:     Post positions, rail lengths, infill schedule, fixing list
requires:    C-01, C-12, T-03, T-11, S-04, E-01
blocked-by:  Barrier loading is a structural design case (S-04); no validated solver exists
origin:      [S]
source:      AS1170.1
notes:       Distinct from fencing: it is a structural life-safety element subject to imposed handrail line loads (C3 occupancy / residential handrail load cases). Substrate fixing (top-mount to timber joist vs side-mount/fascia bracket into concrete) requires structural verification. Stair rake alters every picket/glass panel and post height.

#### T-8 Produce the installer's set-out
intent:      Give the installer a dimensioned plan of what to build
inputs:      Approved set-out, site plan, service locations
outputs:     Dimensioned sheet, bay schedule, gate positions, issued to the crew
requires:    D-01, D-02, D-07, D-08, D-13, C-12, I-08, V-05
origin:      [P]
notes:       In practice this is often a marked-up photo. A real sheet is the upgrade, but it must survive being printed and carried. Must detail bay widths, post hole depths, gate opening deductions, and plinth requirements.

#### T-9 Record what was actually installed
intent:      Capture as-built line, product and variations for the job record and warranty
inputs:      Site photos, measured changes, variation notes
outputs:     As-built record bound to the original quote, variation lines
requires:    F-01, F-07, F-08, F-13, T-13, B-02, PH-01
origin:      [P]
notes:       This closes the loop that makes the next repair quote (T-2) possible. Captures installed depths, concrete bag count, as-built line, and variations.

## 5. Capability assessment

Computed by `validate.mjs`. Summary of what the bindings mean:

- **No fencing task reaches "existing."** Every task above depends on at least one `gap` row.
- **Closest to reachable:** T-1 and T-2 — their measurement and pricing rows are `partial`; what they lack is the bay-division solver, which is not a register row at all.
- **Structurally blocked:** T-6 and T-7 need a standards rules engine and a structural solver respectively. Both are correctly `gap` in the register (categories Q, S, W) and must not be represented as near-term.
- **External dependency:** T-8 and T-9 need issue sets and offline field packages — D and F category work that serves every trade, not just fencing.

**The register gap this spec exposes:** bay division, strain-post placement, gate hardware substitution and raking limits are real engineering content with no A–Z row to hold them. The register's category T covers *measuring* a fence; nothing covers *setting one out*. That is a genuine finding for the register, not a fencing-only concern — roofing has the same shape of hole (see `roofing.md`).

## 6. Sources

| Key | Title | Publisher | Date | Reference | Used for |
|---|---|---|---|---|---|
| AS1926.1 | Swimming pool safety — Safety barriers for swimming pools | Standards Australia | unverified in this pass | Not held locally | T-6 framing only. **Unverified**: cited to frame geometry and NCZ rules, not to assert certification. |
| AS1170.1 | Structural design actions — Permanent, imposed and other actions | Standards Australia | unverified in this pass | Not held locally | T-7 framing only. **Unverified**: cited to name the handrail load case, not to state a value. |

**Both external standards are unverified in this drafting pass.** Under template rule 2 their claims are demoted: numeric requirements are framed as geometric checks for certifier evidence rather than issuing a verdict.

No formal supplier technical manual or sample deliverable has been checked into the repo in this pass. Every task above is therefore `[P]` except the two framing citations.

## 7. Open questions and practitioner decisions

Decisions recorded from Affordable Fencing GC contractor practice (2026-09-11):

1. **Bay division rule**:
   - *Modular steel (Colorbond)*: Fixed panels (~2.36m or 3.10m centres). Rule is **maximum full bays + 1 cut bay** at the terminal end/gate. Cutting all bays is rejected (too much site labour).
   - *Stick-built timber paling*: Rails span two bays (4.8m/5.4m). Rule is **equalise all bays** within max post spacing (<= 2.40m centres).
   - *Aluminium slat*: Prefab panels cut to fit or custom welded bays equalised across run for visual symmetry.
2. **Stock lengths and pack units (E-05 input)**:
   - *Posts*: 2.1m (for 1.5m fence), 2.4m (for standard 1.8m fence with 600mm in-ground footing), 2.7m/3.0m (for slopes, stepped panels, or retaining plinths).
   - *Rails*: 2.36m, 3.10m (Colorbond); 4.8m, 5.4m (treated pine 75x38mm, 75x50mm, 100x50mm).
   - *Infills*: Colorbond packs of 3 sheets (820mm cover); Timber palings (100x16mm, 150x16mm) in packs of 10 or pallet lots of 250.
   - *Concrete*: 20kg bags (rapid set / concrete mix). Formula: 1.5 to 2 bags per line post; 2 to 3 bags per gate or corner post.
   - *Fasteners*: Tek screws (10-16x16mm hex head, color-matched) in boxes of 500 or 1,000.
3. **Slope handling**:
   - *Raking vs Stepping*: Rake allowed up to 3-5% slope (~50-100mm fall per 2.36m panel). Steeper slopes require stepping.
   - *Bottom gap*: Ground gap > 50mm triggers a retaining plinth (treated pine sleeper 200x50mm or Colorbond steel plinth) and upgrades post length to 2.7m.
4. **Gate posts**:
   - Pedestrian gates (900-1000mm) automatically substitute heavy-wall 65x65x2.0mm or 75x75x2.5mm SHS steel (or 100x100mm timber).
   - Vehicle/double gates (3000-4200mm) automatically substitute 75x75x3.0mm, 89x89mm, or 100x100x3.0mm SHS.
   - Clear opening deduction: Leaf Width = Opening - Hinge Gap (~15-20mm) - Latch Gap (~15-20mm).
5. **Pool barriers**:
   - Strictly a "Certifier Geometric Audit & Evidence Pack" (1200mm height, <=100mm bottom gap, 900mm NCZ arc check, self-closing outward swing gate, latch >=1500mm). X-Ray explicitly disclaims regulatory certification.
6. **Repair matching**:
   - 4-point protocol: profile family & pitch, post type, colour identification (standard vs discontinued), and client substitution disclaimer.

Remaining open questions for supplier integration:
- Real-time supplier price sheet import formats (Lysaght / Stratco / Metroll price lists in PDF or CSV) for E-05 / E-09.
- Wind classification mapping (Region B / TC2 vs TC3 per AS4055) for post embedment depth and rail screw count tables.
