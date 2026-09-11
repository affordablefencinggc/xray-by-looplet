# Industry specification: HVAC and refrigeration

Drafted 2026-09-11 against `planning/industry-specs/TEMPLATE.md` v1. Availability is computed by `node planning/industry-specs/validate.mjs`; no state is asserted here.

**Why this profile was written sixth.** It is the template stress case at the empty end. Category H (building services) is one of the eleven whole categories the register assesses as a gap, on the stated grounds that "X-Ray holds discipline labels rather than engineering engines." If the template only produces nine identical "no solver exists" rows here, it adds nothing for roughly a third of the 68 profiles and needs changing before the remaining 62 are attempted.

## 1. Profile binding

Verbatim from `planning/professional-coverage/industries.mjs`:

```
HVAC and refrigeration|Mechanical services engineer / contractor|Route and size a multi-zone services installation|Room loads, architectural model and equipment data|Coordinated duct/pipe network and commissioning schedule|H,N,O,W
```

Register id: **IND-30**. Inherited: H, N, O, W plus the universal set.

**Finding.** All four inherited categories (H, N, O, W) are assessed as whole-category gaps. This profile inherits nothing but gaps, which is why writing it matters: it tests whether the template can still say something useful about a discipline we have not built.

## 2. People and jobs

| Role | Does | Signs off |
|---|---|---|
| Mechanical services engineer | Load calculations, equipment selection, system design | The design and its calculations |
| HVAC contractor / estimator | Prices, procures and installs the system | Installed system and commissioning |
| Sheet metal fabricator | Makes ductwork from the coordinated layout | Fabrication accuracy |
| Commissioning agent | Balances, tests and certifies performance | Commissioned performance |
| Certifier / regulator (external) | Assesses energy and ventilation compliance | Compliance — **never X-Ray** |

Project types: **new work** (system to a new building), **repair / replacement** (plant replacement in an operating building — a large share of real work), **inspection** (performance audit, fault diagnosis), **maintenance** (filter, belt, refrigerant service schedules).

## 3. Workflow

| Stage | Real work | DAY stage |
|---|---|---|
| Receive | Architectural model, room schedule, performance brief | DAY-01, DAY-02 |
| Calculate | Room-by-room heating and cooling loads | DAY-03 |
| Select | Equipment selection against calculated loads and part-load behaviour | DAY-03 |
| Route | Duct and pipe routes through available ceiling and riser space | DAY-03 |
| Size | Size ducts/pipes for flow, pressure drop, velocity and noise | DAY-03 |
| Coordinate | Clash-resolve against structure, electrical, hydraulic, sprinklers | DAY-04 |
| Price | Duct by weight or area, pipe by length, equipment, insulation, labour | DAY-05 |
| Issue | Coordinated layouts, schedules, specifications | DAY-06 |
| Commission | Balance, test, record and hand over | DAY-07 |

**Finding.** This profile exposes a gap in the *universal* working-day scenario: DAY-07 "use on site" is written for field inspection and photo capture, but commissioning is a measurement-and-certification activity producing a performance record. There is no DAY stage for commissioning, and no category O row reached in this spec covers it.

## 4. Task catalogue

#### T-1 Take off duct and pipe quantities from a coordinated layout
intent:      Measure installed duct area/weight and pipe lengths for pricing or verification
inputs:      A coordinated services layout (from any source, including a consultant's drawing)
outputs:     Duct areas/weights by size, pipe lengths by diameter, fitting counts
requires:    T-01, T-03, T-05, T-10, T-11
origin:      [P]
notes:       The one HVAC task that needs no services engine. A contractor measuring someone else's drawing is doing calibrated 2D takeoff, which exists. Duct is priced by sheet metal area or weight, which is length times perimeter — arithmetic over measured geometry. This is the profile's realistic near-term entry point.

#### T-2 Calculate room loads
intent:      Determine heating and cooling loads room by room
inputs:      Geometry, construction, orientation, occupancy, weather data
outputs:     Peak and part-load figures per room, with assumptions recorded
requires:    H-01, H-02, W-02, Q-08
blocked-by:  No thermal solver, no weather data, no validated calculation method. Category H is a whole-category gap.
origin:      [P]
notes:       Requires benchmark validation (Q-08) and qualified review before any output could be relied on. X-Ray must not present an unvalidated load figure as a design input.

#### T-3 Size ducts and pipes
intent:      Size the distribution network for flow, pressure drop and velocity
inputs:      Flow rates, layout, fitting losses, noise limits
outputs:     Sized network with calculated pressure drops
requires:    H-03, H-04, Q-08
blocked-by:  H-03 airflow and pressure calculations is a gap; no hydraulic or aeraulic solver exists
origin:      [P]
notes:       Same discipline as roofing T-5 (stormwater) and plumbing sizing: a fluid calculation against a published method. If one validated hydraulic engine were ever built it would serve several profiles at once.

#### T-4 Route services in available space
intent:      Find workable duct and pipe routes through ceiling voids and risers
inputs:      Architectural and structural model, available zones, service priorities
outputs:     Routed network respecting clearances and access
requires:    C-01, C-08, R-03, R-12, H-05
blocked-by:  No 3D routing tool, no section boxes (R-03), no federation (R-12), no services model
origin:      [P]
notes:       Routing is a 3D spatial problem against other trades' geometry. R-03 clipping and R-12 federation are the shared blockers with residential T-8 and BIM coordination.

#### T-5 Coordinate and clash-check against other trades
intent:      Find and resolve conflicts with structure, electrical, hydraulic and sprinklers
inputs:      Federated models from each discipline
outputs:     Clash register with resolutions, re-tested
requires:    I-03, I-04, R-12, R-10
origin:      [P]
notes:       IFC (I-03) and BCF (I-04) exchange are both `partial`, so the *interchange* exists while the *coordination* does not. Precisely the "shared capability is not a validated workflow" case template rule 5 exists for.

#### T-6 Schedule equipment and produce a specification
intent:      Produce the equipment schedule and specification for tender
inputs:      Selected equipment, performance duties, control requirements
outputs:     Equipment schedule, specification, tender documents
requires:    K-01, K-02, D-07, I-09, D-13
blocked-by:  Category K component and assembly libraries is a whole-category gap; no manufacturer product data
origin:      [P]
notes:       Equipment selection depends on manufacturer performance data at specified conditions. A product library is a shared need across HVAC, electrical, fencing (gate hardware) and roofing (profiles).

#### T-7 Price a services installation
intent:      Build a priced estimate from measured quantities and equipment
inputs:      Takeoff from T-1, equipment prices, labour rates, insulation
outputs:     Priced estimate with build-ups and preliminaries
requires:    E-01, E-02, E-03, E-08, E-09, E-15
origin:      [P]
notes:       Ductwork labour is typically derived from sheet metal weight and fitting counts — the same build-up problem as QS T-3. Shared, not HVAC-specific.

#### T-8 Record commissioning results
intent:      Capture balancing and performance test results as the handover record
inputs:      Measured flows, temperatures, pressures against design figures
outputs:     Commissioning record, deviations, certificates, O&M handover
requires:    O-01, O-02, F-06, F-07, V-03
blocked-by:  Category O operations is a whole-category gap; F-06 inspection and test plans is a gap
origin:      [P]
notes:       The commissioning record is the legal handover artefact and feeds facilities management (IND-68). It is a structured measured-versus-design comparison, which is a data problem rather than a solver problem — arguably more reachable than its category suggests.

## 5. Capability assessment

Computed by `validate.mjs`.

- **T-1 computes as `partial` with no blocker** — and that is the finding. Even in a whole-gap discipline, the *contractor's measurement task* is reachable, because measuring a consultant's drawing needs no services engine. This is the realistic entry point into every services trade: serve the estimator, not the designer.
- **T-2, T-3 are solver gaps** requiring benchmark validation and qualified review. They must never be presented as near-term.
- **T-4, T-5 share blockers** (R-03, R-12) with residential design and BIM coordination.
- **T-6, T-7, T-8 are shared-infrastructure gaps** — libraries, build-ups, operations — not HVAC engineering.

**Template verdict.** The template survives the empty end. It produced one reachable task, three genuinely distinct blocker classes (solver, spatial, shared infrastructure) and a finding about the universal working-day scenario. It did not degenerate into nine identical rows. **No template change is required before the remaining 62.**

## 6. Sources

| Key | Title | Publisher | Date | Reference | Used for |
|---|---|---|---|---|---|
| XR-REG | PROFESSIONAL-A-Z-CHECKLIST.md category H, O, W assessments | This repository | 2026-09-10 | `PROFESSIONAL-A-Z-CHECKLIST.md` | Establishing that H, O and W are whole-category gaps by the register's own assessment, and that naming a trade in a takeoff category is not a solver for it. Verified by reading the file in this pass. |

No external source — no design guide, no manufacturer selection data, no commissioning code — was consulted. All tasks are `[P]` apart from the internal citation. **This spec deliberately states no calculation method, coefficient or duty**, because doing so would imply a validated engine that does not exist.

## 7. Open questions

1. **Designer or contractor?** T-1 suggests the contractor/estimator is the reachable user. Is the services *designer* a target at all, given every design task needs a validated solver?
2. **Duct pricing basis** — by sheet metal weight, developed area, or linear metre by size? Decides what T-1 must output.
3. **Would a validated hydraulic engine be built once** and shared across HVAC, stormwater, plumbing and fire, or is that permanently out of scope?
4. **Commissioning records** — is capturing measured-versus-design a nearer-term product than any design calculation?
