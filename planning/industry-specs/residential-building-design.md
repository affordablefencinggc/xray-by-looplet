# Industry specification: Residential architecture and building design

Drafted 2026-09-11 against `planning/industry-specs/TEMPLATE.md` v1. Availability is computed by `node planning/industry-specs/validate.mjs`; no state is asserted here.

## 1. Profile binding

Verbatim from `planning/professional-coverage/industries.mjs` line 1:

```
Residential architecture|Architect / building designer|Develop an alteration with existing/new/demolished work|Survey and client brief|Coordinated plans, sections, schedules and issue set|C,R,T,W
```

Register id: **IND-01**. Inherited: C, R, T, W plus the universal set.

**Finding.** This profile is the closest fit to what X-Ray has actually built — the architect Sketch workspace implements layered walls, hosted openings, slabs, roof presets, linked plans/elevations/sections, schedules and scaled sheets. It is therefore the best test of the template's honesty: the risk here is *overstating*, where fencing's risk was having nothing. The profile's own scenario — an alteration with existing/new/demolished work — is precisely the thing that is missing, because there is no phase or demolition concept.

## 2. People and jobs

| Role | Does | Signs off |
|---|---|---|
| Architect / building designer | Brief, concept, developed design, documentation | The issued drawing set |
| Draftsperson | Produces and revises the documentation | Drawing accuracy and standards |
| Client | Approves design and budget at stages | Design and cost approval |
| Builder | Prices and builds from the set | Buildability and cost |
| Certifier / engineer (external) | Assesses against building regulations | Compliance — **never X-Ray** |

Project types: **new work** (new dwelling), **repair / alteration** (renovation, addition — the dominant residential case), **inspection** (existing-condition survey before design), **maintenance** (not typically this role).

## 3. Workflow

| Stage | Real work | DAY stage |
|---|---|---|
| Receive brief | Client brief, budget, site survey, title constraints | DAY-01, DAY-02 |
| Record existing | Measure and draw the existing building accurately | DAY-03 |
| Concept | Test options against brief, budget and site constraints | DAY-03 |
| Develop | Resolve construction, openings, roof, levels, materials | DAY-03 |
| Check | Areas, heights, setbacks, coordination between views | DAY-04 |
| Cost check | Test the design against the budget before documenting | DAY-05 |
| Document | Plans, elevations, sections, details, schedules on titled sheets | DAY-03, DAY-06 |
| Issue | Coordinated set to client, certifier, engineer, builder | DAY-06 |
| Revise | Respond to comments, engineering, cost or client change | DAY-08 |

**Finding.** "Record existing" and the existing/new/demolished distinction run through every stage of a residential alteration and have no representation in the register. There is no phase, no demolition state, and no existing-fabric concept. For the dominant residential project type this is the defining gap, and it appears nowhere in the 364 rows.

## 4. Task catalogue

#### T-1 Draw the existing building
intent:      Produce an accurate measured record of what is there before designing
inputs:      Site measurements, photos, prior drawings, survey
outputs:     Existing-condition plans and elevations, marked as existing fabric
requires:    C-01, C-03, C-04, C-12, T-01, T-03, D-01, PH-01, PH-02
origin:      [P]
notes:       Everything downstream depends on this being both accurate and *distinguishable* from proposed work. Without the phase distinction, an alteration drawing cannot be produced at all, however good the geometry is.

#### T-2 Develop the construction
intent:      Resolve walls, openings, floors and roof into coordinated construction
inputs:      Approved concept, construction system, product selections
outputs:     Layered walls, hosted openings, slabs and roof geometry that coordinate
requires:    C-01, C-03, C-04, C-09, C-12, C-14, R-06
origin:      [P]
notes:       This is the strongest existing capability — layered walls, hosted openings, slabs and roof presets are implemented, with associative dimensions regenerating across plan, elevation and section. No blocker named because no missing engine is required for the core case.

#### T-3 Generate coordinated plans, elevations and sections
intent:      Produce views that stay correct when the model changes
inputs:      Developed model, required view set
outputs:     Plans, elevations, sections regenerating from one model
requires:    C-12, C-13, D-08, R-01, R-05
origin:      [P]
notes:       Associativity is the value: editing a wall end regenerates the annotation and the derived views. That behaviour is asserted by test today; what it lacks under the tick rule is inspected visual proof at the declared viewports.

#### T-4 Produce a titled, scaled drawing set
intent:      Lay views onto sheets with title blocks, ready to issue
inputs:      Views, sheet sizes, title block content, project metadata
outputs:     A1/A3 sheets, titled, scaled, numbered, printable as a set
requires:    D-02, D-03, D-07, D-08, D-13, I-08
origin:      [P]
notes:       Named sheet sets with up to twelve viewports at independent scales exist. What is missing is the title block and the ability to issue the set as a batch — the last step before a set is usable externally.

#### T-5 Schedule doors, windows and rooms
intent:      Derive schedules from the model that stay consistent with it
inputs:      Hosted openings, room boundaries, finishes
outputs:     Door/window schedules, room areas, consistent with the drawings
requires:    C-12, T-04, T-07, I-09
origin:      [P]
notes:       Schedules are implemented for the architect workspace. The residential-specific need is room area by a defined measurement convention, which varies by jurisdiction and client.

#### T-6 Manage drawing revisions and issues
intent:      Issue revisions with clouds, a revision table and superseded history
inputs:      Approved changes, prior issued set
outputs:     Revised set with revision marks, register and superseded prior issue
requires:    D-09, D-10, D-13, D-15, V-05
origin:      [P]
notes:       Shared with roofing T-7 and QS T-5. Three of four specs in this pass are blocked on the same revision rows, which makes D-09/D-10 the most cross-cutting gap found.

#### T-7 Cost-check the design against budget
intent:      Test the developing design against the client's budget before documenting
inputs:      Model quantities, area rates or elemental rates
outputs:     Indicative cost bound to the current design state
requires:    T-04, T-07, T-12, E-01, E-03, E-06, E-09
origin:      [P]
notes:       Cost-as-you-draw is item 6 of ARCHITECTURE-ROADMAP.md. The discipline required: derived quantities feed costs one way only, and an unsupported price stays visibly unknown rather than defaulting to zero.

#### T-8 Coordinate with consultants
intent:      Exchange the model and receive marked issues back
inputs:      Consultant models and issue files
outputs:     Federated view, resolved issue register
requires:    I-03, I-04, R-12, I-10
blocked-by:  R-12 federated model coordination is a gap
origin:      [P]
notes:       IFC and BCF exchange are `partial`; the gap is federating and coordinating, not exchanging. Lower priority for small residential work than for the commercial profiles that share these rows.

#### T-9 Issue the set for approval
intent:      Deliver the coordinated set to client, certifier and builder
inputs:      Completed sheet set, supporting schedules
outputs:     Issued package with a record of what was sent and to whom
requires:    D-13, I-08, V-03, V-05, V-06
blocked-by:  V-05 recipient and distribution list is dependency-blocked on an account service that is not selected
origin:      [P]
notes:       Preparing a package and sending it are different deliverables; the register is right to separate them. External sending requires an explicit instruction naming the recipient.

## 5. Capability assessment

Computed by `validate.mjs`. What the bindings mean:

- **T-2, T-3 and T-5 are the most capable tasks across all four specs** — real implemented geometry, associative views and schedules, with no missing engine named. Under the register's tick rule their rows remain `partial` chiefly for want of inspected visual proof at the declared viewports, which is a proof task rather than a build task.
- **T-4 is one step from usable**: title blocks (D-07) and issue sets (D-13) are the difference between a sheet set and a deliverable.
- **T-1 is blocked by an absent concept, not an absent feature.** The existing/new/demolished phase distinction is missing from the register entirely, and it defines residential alteration work.
- **T-6 is the cross-cutting blocker** shared with roofing and quantity surveying.

**Register recommendation from this spec:** add rows for design phase / existing fabric / demolition. Without them the profile's own stated scenario cannot be delivered, and the omission is invisible in the current 364.

## 6. Sources

| Key | Title | Publisher | Date | Reference | Used for |
|---|---|---|---|---|---|
| XR-ARCH | ARCHITECTURE-ROADMAP.md and ARCHITECT-SKETCH-TODO.md | This repository | 2026-09-07 | `ARCHITECTURE-ROADMAP.md` | T-2, T-3, T-4, T-7: current implemented scope and its stated remaining gates. Verified by reading the files in this pass. |

**One verified source, and it is our own.** No building code, no practitioner interview, no sample residential drawing set was consulted. The absence of an external source is itself the finding for this profile: the spec describes what we built, not independently what a residential designer needs, and it must be checked against a practising designer before it drives work.

## 7. Open questions

1. **Phasing** — how should existing, new and demolished work be represented? This is the largest single question raised by any spec in this pass.
2. **Room area conventions** — which measurement convention should room areas follow, and does it need to be selectable?
3. **Title blocks** — firm-templated, or per-project? This decides D-07's shape.
4. **Alteration versus new build** — which is the priority target? They need different things first.
5. **Consultant coordination** — is small residential work actually coordinating in IFC/BCF, or exchanging PDFs?
