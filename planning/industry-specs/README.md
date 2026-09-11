# Industry specifications

Per-industry task catalogues for the 68 profiles in `planning/professional-coverage/industries.mjs`. Each spec decomposes one profile into tasks a practitioner would recognise and binds each task to the A–Z requirement IDs it depends on.

**Availability is computed, never written.** A spec that asserts a state fails validation. Every `requires:` id must resolve to a real row in `PROFESSIONAL-A-Z-CHECKLIST.md` (375 requirements, 28 categories).

```
node planning/industry-specs/validate.mjs          # report
node planning/industry-specs/validate.mjs --json   # machine-readable
node --test planning/industry-specs/validate.test.mjs
```

## Status, 2026-09-11

Six of 68 drafted. **50 tasks: 8 compute as `partial`, 42 as `gap`.** No task computes as `verified`, and the test suite asserts that none may.

The first four were chosen to contrast: fencing (nothing built), roofing (measurement exists, set-out does not), quantity surveying (consumes measurement, needs auditability), residential design (the most-built area, and the honesty test).

Two more were then written as **template stress cases**, to check the format before committing it to the remaining 62:

- `drafting-services.md` — the capable end. A draftsperson consumes geometry and produces documents, so if any profile has reachable tasks it is this one. It produced two `partial` tasks with no blocker (precision drafting, CAD exchange), confirming the template is **not biased toward pessimism**.
- `hvac.md` — the empty end. Every category it inherits (H, N, O, W) is a whole-category gap. The risk was nine identical "no solver exists" rows. It instead produced one reachable task and three distinct blocker classes, confirming the template **still says something useful about undelivered disciplines**.

**Template verdict: no change required before the remaining 62.**

The specs are **research-incomplete**. Six of nine external sources cited across the six are unverified (the other three are internal citations to this repository) — cited to frame a task, never to state a value — and their claims are demoted to `[P]` accordingly. No supplier manual, sample deliverable or practitioner interview was consulted in this pass. Open questions at the end of each spec are the interview script.

## What the specs found about the register

Cross-cutting findings, most to least consequential:

1. **Revision comparison blocks four of six profiles.** D-09, D-10 and T-09 are gaps; roofing T-7, QS T-5, residential T-6 and drafting T-3 all stop there. Measured as the widest gap in the ranking below.
2. **There is no set-out or optimisation category.** Category T measures; nothing turns a measurement into a buildable arrangement. Fencing needs bay division, roofing needs plan-to-true-area development and length packing. Arguably one missing category, not two industry quirks.
3. **Design phase / existing fabric / demolition is absent from all 364 rows** — and it defines residential alteration work, the dominant residential project type.
4. **T-06 classification blocks the whole QS profile.** Without a cost-code spine an estimate cannot be reported, benchmarked or compared.
5. **No preliminaries row exists in category E.** Time-related site cost is a standard, separately-built estimate component.

Findings 2, 3 and 5 were requirements that no register row held, which meant the original 364 understated the work. **All three are now merged** (2026-09-11) as the `SO` and `PH` categories plus `E-15`: the register stands at 375 requirements across 28 categories, every previously reviewed assessment unchanged. Record: [../PROPOSED-REGISTER-EXPANSIONS.md](../PROPOSED-REGISTER-EXPANSIONS.md).

## Which blockers cost the most, measured

Counted across all six specs: for every task computing as `gap`, which unbuilt rows does it name? Ranked by how many *profiles* each blocks — breadth across trades is what makes a row worth building first. Recomputed 2026-09-11 after the register merge, so these now include the new rows.

| Row | Profiles | Tasks | State | Title |
|---|---|---|---|---|
| D-13 | 5 | 7 | gap | Batch printing and issue sets |
| V-05 | 5 | 6 | dependency-blocked | Recipient and distribution list |
| D-09 | 4 | 7 | gap | Drawing revisions and supersession |
| D-10 | 4 | 4 | gap | Revision overlay and slip-sheeting |
| D-15 | 4 | 4 | gap | Visual and vector revision delta |
| D-07 | 4 | 4 | gap | Title blocks and templates |
| PH-01 | 3 | 5 | gap | Element lifecycle status |
| K-01 | 3 | 3 | gap | Component and assembly libraries |
| F-13 | 3 | 3 | gap | Progress quantities and claims |

Three conclusions:

1. **Issuing work blocks more profiles than doing it.** Four of the top six are category D documentation rows — title blocks, revisions, overlay, delta and batch issue. Every trade that has to *hand something over* stops there, and **none needs a solver**. This is the cheapest broad unlock available and it is documentation work, not engineering.
2. **V-05 is not a build decision.** It is `dependency-blocked` on an account service that has not been selected, so it blocks five profiles without anyone being able to write code against it. A procurement decision is silently gating the catalogue.
3. **PH-01 entered the table immediately.** Element lifecycle status — telling existing from new from demolished — blocks three profiles on its first day in the register, which is the evidence that its absence was real rather than a drafting preference.

**Every one of the 8 reachable tasks is measurement of a drawing, or core drafting geometry.** No task involving pricing, issuing, site capture or a discipline solver is reachable in any of the six profiles. If X-Ray has a near-term user, it is someone measuring and drawing — not someone quoting or handing over.

Regenerate this ranking from the specs with `validate.mjs --json`.

## Next

1. **Fencing decisions recorded** — Affordable Fencing GC contractor practice incorporated into `fencing.md` (bay division, pack sizes, slope thresholds, gate post upgrades, pool evidence scope, repair matching).
2. Take the open questions to practitioners for roofing, QS, residential design, drafting and HVAC.
3. Promote `[P]` items to `[S]` where verified supplier manuals or standards are held.
4. ~~Review the proposed register expansions~~ — **merged 2026-09-11**. `SO` (5 rows), `PH` (3 rows), `D-15`, `E-15` and `T-15` are live; the register is now 375 requirements across 28 categories, with every previously reviewed assessment intact. The specs are rebound to those ids and no longer carry prose blockers for them.
5. Work through the remaining 62 industry profiles using the template, which the two stress cases validated without change.

The task-catalogue data model and the collapsed bottom bar are **not built**. `validate.mjs --json` is the shape the UI would read.

