# Industry specification: Quantity surveying and cost consultancy

Drafted 2026-09-11 against `planning/industry-specs/TEMPLATE.md` v1. Availability is computed by `node planning/industry-specs/validate.mjs`; no state is asserted here.

## 1. Profile binding

Verbatim from `planning/professional-coverage/industries.mjs`:

```
Quantity surveying and cost consultancy|Quantity surveyor|Issue a measured cost plan with alternate options|Drawings, specifications and current rate books|Auditable estimate, assumptions and revision comparison|P,T,W
```

Register id: **IND-38**. Inherited: P, T, W plus the universal set.

**Finding.** This profile is unlike the trade profiles: the QS is a *consumer* of X-Ray's measurement and pricing rather than a builder of geometry. Its defining requirement is auditability — every quantity traceable to a drawing revision, every rate to a source and date. That maps to rows that already exist (T-10, T-12, T-13, P-07) and is the reason this profile is closer to reachable than fencing or roofing, despite covering more ground.

## 2. People and jobs

| Role | Does | Signs off |
|---|---|---|
| Quantity surveyor | Measures from drawings, builds the estimate, writes assumptions | The issued cost plan |
| Senior QS / director | Reviews rates, margins, risk allowances | Commercial release to the client |
| Cost manager | Tracks variations and cost-to-complete during delivery | Monthly cost report |
| Client / financier (external) | Relies on the estimate for funding decisions | Their own investment decision |

Project types: **new work** (cost plan at successive design stages), **repair / refurbishment** (measured works against existing conditions), **inspection** (progress valuation on site), **maintenance** (lifecycle and replacement cost planning).

## 3. Workflow

| Stage | Real work | DAY stage |
|---|---|---|
| Receive | Drawing set and specification at a defined design stage | DAY-01, DAY-02 |
| Measure | Systematic takeoff under a measurement standard, by element | DAY-03 |
| Classify | Assign each quantity to an element / work package / cost code | DAY-03 |
| Price | Apply rate build-ups from rate books, past projects, market testing | DAY-05 |
| Adjust | Waste, preliminaries, margin, contingency, escalation, locality | DAY-05 |
| Check | Reconcile against benchmarks and the prior revision; explain movement | DAY-04 |
| Issue | Cost plan with assumptions, exclusions and a revision comparison | DAY-06 |
| Revise | New drawing revision arrives; re-measure the delta and explain the change | DAY-08 |

**Finding.** Stage "Adjust" has no home in the register. Category E holds E-10 discount/margin/contingency and E-12 escalation, both gaps, but there is no row for *preliminaries* — the time-related site cost that is a large, separately-built part of any real estimate. Recommend adding one.

## 4. Task catalogue

#### T-1 Measure an element from a drawing set
intent:      Take off quantities for one element under a measurement standard, traceably
inputs:      Drawing set at a stated revision, specification, measurement rules
outputs:     Quantities with units, each linked to the sheet and region measured
requires:    T-01, T-03, T-04, T-05, T-10, T-12, D-01, D-02
origin:      [S]
source:      NRM2
notes:       The link back to the drawing is the deliverable, not a convenience. A quantity a QS cannot defend to a contractor is worthless. T-10 measurement source links and T-12 provenance are the rows that carry this.

#### T-2 Classify quantities to an elemental cost plan
intent:      Structure measured quantities into the elemental breakdown the client expects
inputs:      Measured quantities, chosen elemental structure
outputs:     Cost plan structured by element, with quantities mapped and no orphans
requires:    T-06, T-07, T-13, T-15
origin:      [S]
source:      NRM1
notes:       Without a classification spine the estimate cannot be reported, benchmarked or compared between revisions. This is the single highest-leverage missing row for this profile.

#### T-3 Build up a rate
intent:      Compose a unit rate from material, labour, plant and overhead components
inputs:      Component costs, productivity/output constants, waste allowances
outputs:     An auditable rate with visible components and their sources
requires:    E-08, E-09, E-03, E-04, P-07, K-01
origin:      [S]
source:      NRM2
notes:       A QS defends the build-up, not the rate. Productivity constants are the firm's intellectual property and must be maintainable as a library, which is category K (also a gap).

#### T-4 Apply and audit a rate book
intent:      Apply a dated rate set across the estimate and keep what each rate came from
inputs:      Rate book with effective dates, currency, tax treatment
outputs:     Priced estimate with per-line rate provenance and effective date
requires:    E-01, E-02, E-03, E-04, E-06, P-07, P-08
origin:      [P]
notes:       "Remove" matters as much as "apply": a superseded rate set must be withdrawable without corrupting the measured quantities underneath it. Costs must never rewrite quantities.

#### T-5 Compare revisions and explain movement
intent:      Show what changed between two cost plan revisions and why
inputs:      Prior and current estimate, prior and current drawing revisions
outputs:     Movement report split into design change, measurement correction, rate change
requires:    T-09, D-09, D-10, D-15, T-13, E-03
origin:      [S]
source:      NRM1
notes:       This is the question every client asks and the hardest to answer. Splitting movement into its three causes is what distinguishes a QS report from a spreadsheet diff.

#### T-6 Price alternates and options
intent:      Cost design options side by side on a consistent basis
inputs:      Base estimate, option definitions, differing quantities and rates
outputs:     Comparable option costs with a stated common basis
requires:    E-11, T-13, W-07
origin:      [P]
notes:       Options must share assumptions to be comparable; the common basis is the deliverable. Whole-life comparison (W-07) is a further gap for options judged on operating cost.

#### T-7 Issue an auditable cost plan
intent:      Produce the client document with assumptions, exclusions and traceability
inputs:      Priced, classified estimate and its assumption register
outputs:     Issued cost plan, exportable, revision-stamped, with audit trail
requires:    T-13, I-09, I-08, D-09, V-05, E-13, E-15
origin:      [P]
notes:       T-13 reconciliation and audit exports is `partial` and is the strongest existing foundation in this profile. The gap is issuing, not reconciling.

#### T-8 Value work in progress
intent:      Assess completed quantities on site for a progress payment
inputs:      Contract quantities, site observation, prior valuations
outputs:     Valuation with quantities claimed, agreed and disputed
requires:    F-13, F-07, T-13, E-14
origin:      [P]
notes:       Distinct from estimating: it measures what exists, not what is drawn. Needs the site side of the product (category F), which is almost entirely a gap.

#### T-9 Research a market rate
intent:      Find and evidence a current supplier price for an item with no reliable rate
inputs:      Item description, region, quantity, required date
outputs:     Candidate prices with source, date and basis, reviewed before adoption
requires:    P-01, P-02, P-05, P-06, P-07, P-08, P-09
blocked-by:  P-01 and P-03 are dependency-blocked on a live search credential that is not configured
origin:      [P]
notes:       The bounded Firecrawl contract already exists with truthful failure states (proof/growth/2026-09-08-az3-pricing-research). This task is blocked on a credential, not on engineering — the one task across all four specs in that position.

## 5. Capability assessment

Computed by `validate.mjs`. What the bindings mean:

- **T-1 is the strongest task in this pass.** Its rows are all `partial` or better with no missing engine: calibrated measurement with source links and provenance is exactly what exists. A QS-facing measurement task is more reachable today than any trade set-out task.
- **T-2 is the highest-leverage gap.** T-06 classification blocks reporting, benchmarking and revision comparison simultaneously. Nothing else in this spec unlocks as much.
- **T-9 is credential-blocked, not engineering-blocked** — the only such task found.
- **T-5 and T-8** depend on revision comparison and site capture, both shared with roofing and fencing.

**Register recommendation from this spec:** add a preliminaries row to category E. Time-related site cost is a standard, separately-built estimate component with no row.

## 6. Sources

| Key | Title | Publisher | Date | Reference | Used for |
|---|---|---|---|---|---|
| NRM1 | RICS New Rules of Measurement 1: Order of cost estimating and cost planning | RICS | unverified in this pass | Not held locally | T-2, T-5 framing: elemental cost planning and revision reporting exist as disciplined methods. **Unverified**: no rule, element code or value is stated from it. |
| NRM2 | RICS New Rules of Measurement 2: Detailed measurement for building works | RICS | unverified in this pass | Not held locally | T-1, T-3 framing: measurement is performed under published rules, and rates are built up from components. **Unverified**: no measurement rule is quoted. |

**Both unverified in this pass.** They are cited to establish that these disciplines are standards-governed — which materially affects the design, since X-Ray must let a firm state *which* rules a takeoff follows rather than imposing one. Australian practice may use ANZ standard methods instead; that is an open question below. No rate book, sample cost plan or practitioner interview was consulted.

## 7. Open questions

1. **Which measurement standard** do your target users work to — NRM, an ANZ standard method, or firm-internal rules? This decides whether measurement rules are configurable or fixed.
2. **Elemental structure** — is there one classification to support first, or must it be user-definable from the start?
3. **Productivity constants** — would a firm bring its own library, and does it need to stay private to them?
4. **Progress valuation** — is site-side work (T-8) in scope, or is this profile estimating-only for now?
5. **Preliminaries** — how are they currently built: percentage, or a time-related resource schedule?
