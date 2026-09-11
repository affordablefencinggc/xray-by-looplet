# Industry specification: Drafting and documentation services

Drafted 2026-09-11 against `planning/industry-specs/TEMPLATE.md` v1. Availability is computed by `node planning/industry-specs/validate.mjs`; no state is asserted here.

**Why this profile was written fifth.** It is a template stress case at the capable end. A draftsperson consumes geometry and produces documents — exactly what X-Ray has most of — so if any of the 68 profiles has genuinely reachable tasks, it is this one. If the template cannot show that, it is biased toward pessimism and would misreport all 64 remaining profiles.

## 1. Profile binding

Verbatim from `planning/professional-coverage/industries.mjs`:

```
Drafting and documentation services|Draftsperson / CAD technician|Turn approved markups into a revised drawing set|Redlines, CAD standards and prior issue|Dimensioned drawings, checked references and change register|C,K,R
```

Register id: **IND-04**. Inherited: C, K, R plus the universal set.

**Finding.** The profile's stated scenario is *revision* work — "turn approved markups into a revised drawing set" — and revision is the register's single widest gap (D-09, D-10, T-09). The profile whose core loop is best supported in geometry is blocked at its defining activity. That is the clearest evidence yet for the D-15 delta engine proposed in `../PROPOSED-REGISTER-EXPANSIONS.md`.

## 2. People and jobs

| Role | Does | Signs off |
|---|---|---|
| Draftsperson / CAD technician | Produces and revises drawings to a standard | Drawing accuracy and standards compliance |
| Checker / senior drafter | Verifies references, dimensions, standards | The check before issue |
| Client (architect, engineer, builder) | Supplies markups, approves the revised set | Design intent |
| Document controller | Manages issue, transmittal and revision registers | The issue record |

Project types: **new work** (documenting a design from scratch), **repair / revision** (the dominant case — incorporating markups), **inspection** (drawing audit against a standard), **maintenance** (keeping a CAD library and template set current).

## 3. Workflow

| Stage | Real work | DAY stage |
|---|---|---|
| Receive | Redlines (marked PDF or scan), prior issued set, CAD standard | DAY-01, DAY-02 |
| Interpret | Read every markup, query ambiguities, log what will change | DAY-02 |
| Revise | Edit geometry and annotation to incorporate each markup | DAY-03 |
| Standardise | Enforce layers, lineweights, text styles, title block content | DAY-03 |
| Check | Verify every markup is addressed; check references and dimensions | DAY-04 |
| Issue | Revision clouds, revision table, transmittal, superseded set | DAY-06 |
| Archive | Retain the superseded issue as the record | DAY-06 |

**Finding.** "Interpret" — converting a redline into a tracked list of changes to make and then verifying each was made — has no DAY stage and no register row. It is the draftsperson's actual quality control, and it is invisible to the register.

## 4. Task catalogue

#### T-1 Draw to a dimensioned standard
intent:      Produce accurate geometry with correct dimensions and annotation
inputs:      Design information, CAD standard, drawing conventions
outputs:     Dimensioned drawing with associative annotation
requires:    C-01, C-03, C-04, C-09, C-12, C-14
origin:      [P]
notes:       The strongest binding in any spec so far: snaps, numeric entry, offset/trim/extend/fillet, associative dimensions and undo are all real implemented solvers with asserted tests. What the rows lack is inspected visual proof at the declared viewports, which is a proof task, not a build task.

#### T-2 Apply a CAD standard
intent:      Enforce layer, lineweight, text and style conventions across a set
inputs:      Office or client CAD standard, current drawing
outputs:     Compliant drawing, exceptions reported
requires:    C-06, C-13, K-01, K-02
blocked-by:  C-06 layers and visibility is a gap — the model's "layers" field is a wall assembly material layer, not a CAD layer. No standards or library concept exists (category K is a gap).
origin:      [P]
notes:       The register records C-06 explicitly as a false-positive risk because the field name invites one. This task is the reason that matters: a drafting service's entire value proposition is standards compliance, and the naming collision would make an assessor think it exists.

#### T-3 Incorporate a markup set
intent:      Apply every redline from a marked-up drawing and prove none was missed
inputs:      Marked-up PDF or scan, prior issued set
outputs:     Revised drawing, markup-to-change register, queries list
requires:    D-01, D-09, D-10, D-15, R-10, C-12
origin:      [P]
notes:       This is the profile's defining task and it is entirely unsupported. The deliverable is not just the revised drawing but the *evidence that every markup was addressed* — which is the "Interpret" stage the register has no room for.

#### T-4 Manage external references
intent:      Keep linked drawings, models and images resolving correctly across a set
inputs:      Referenced files, paths, versions
outputs:     Set with all references resolved and reported
requires:    I-10, I-13, I-14, D-12
origin:      [P]
notes:       I-10 referenced file management is `partial`, which is a real foundation. Broken references are the classic drafting failure and need a report, not silence.

#### T-5 Exchange CAD with the client
intent:      Send and receive DXF/DWG that survives the round trip
inputs:      Native drawing, client's required format and version
outputs:     Exchanged file with a loss report
requires:    I-01, I-02, I-13, I-14
origin:      [P]
notes:       DXF round trip preserving stable IDs is asserted by test, and native Windows DWG has independent readback of a 431-entity fixture. I-14 compatibility and loss reports is `partial`. This is genuinely one of the better-supported tasks in the catalogue.

#### T-6 Issue a revised set with a change register
intent:      Publish the revision with clouds, table, transmittal and superseded history
inputs:      Checked revised set, revision descriptions, recipients
outputs:     Issued set, revision register, transmittal record, superseded archive
requires:    D-09, D-13, D-07, I-08, V-05
origin:      [P]
notes:       Shared blocker with residential T-6, roofing T-6 and QS T-7. Four of six specs now stop at the same D rows.

#### T-7 Check a drawing before issue
intent:      Verify dimensions, references, standards and markup coverage
inputs:      Revised set, markup register, CAD standard
outputs:     Check record with findings and sign-off
requires:    Q-01, Q-14, R-10, C-12
blocked-by:  No drawing-check or review-record workflow; R-10 threaded issues is a gap
origin:      [P]
notes:       Q-14 visibly distinct capability states is one of only six `verified` rows in the register, but it concerns the product's own honesty, not drawing checking.

## 5. Capability assessment

Computed by `validate.mjs`.

- **T-1 and T-5 both compute as `partial` with no blocker** — the highest-capability tasks found across six specs. Precision drafting and CAD exchange are genuinely the product's strongest ground.
- **T-2 is a gap for a subtle reason worth preserving**: the `layers` naming collision. An assessor reading the model schema could easily mark C-06 as present.
- **T-3, T-6, T-7 are blocked on revision and review** — the profile's core loop.

**Template verdict.** The template is not biased toward pessimism: given real capability it reports `partial` without a blocker (T-1, T-5), and the six-spec spread is now 7 `partial` / 35 `gap` across 42 tasks. It distinguishes "we built this" from "we can do this job."

## 6. Sources

| Key | Title | Publisher | Date | Reference | Used for |
|---|---|---|---|---|---|
| XR-REG | PROFESSIONAL-A-Z-CHECKLIST.md category C and I assessments | This repository | 2026-09-10 | `PROFESSIONAL-A-Z-CHECKLIST.md` | T-1, T-2, T-5: current implemented precision and exchange scope, including the explicit C-06 false-positive warning. Verified by reading the file in this pass. |

No external CAD standard (ISO 128, AS1100, or a client standard) was consulted. All tasks are `[P]` apart from the internal citation.

## 7. Open questions

1. **Which CAD standard** would a drafting-service user work to — their own, the client's, or a published one? Decides whether K-01 libraries must be user-authored.
2. **Markup input format** — marked PDFs, scanned paper, or native CAD redlines? Decides whether T-3 needs OCR (D-11, a gap).
3. **Is drafting-as-a-service a target user at all**, or is this profile really describing the drafting *activity* inside the other profiles?
