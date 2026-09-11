# Industry specification template

Version 1 — drafted 2026-09-11. Refine after the first four specs (fencing, roofing, quantity surveying, residential building design) are written, before the remaining 64 are attempted.

## Purpose

An industry specification decomposes one of the 68 profiles in `planning/professional-coverage/industries.mjs` into **named tasks a practitioner would recognise**, and binds each task to the A–Z requirement IDs it depends on. It replaces a single coverage line with a task catalogue.

It is a product specification, not a claim of capability. No spec may state that a task works. Availability is **computed** from `PROFESSIONAL-A-Z-CHECKLIST.md`, never authored here (decision recorded 2026-09-11).

## Rules

1. **Availability is derived.** A task lists `requires:` requirement IDs. Its state is the weakest state among those rows, using the order `gap < failed < dependency-blocked < in-progress < partial < verified`. A spec that hand-writes a state is invalid; `validate.mjs` fails the build.
2. **Sourced and proposed requirements stay distinguishable.** Every task requirement carries an origin marker: `[S]` sourced from a cited document, `[P]` proposed by us. A `[S]` item needs a `source:` reference resolvable in the Sources table. Unsourced assertions are `[P]`, without exception.
3. **Industry never changes project state.** Selecting an industry filters which tasks are offered. It must not alter the open project, chat history, AI provider, or any stored record. A project may contain several trades at once.
4. **Task granularity is a unit of work a practitioner would quote or schedule**, not a tool click. "Estimate a boundary run" is a task; "draw a line" is not.
5. **A shared capability does not imply a validated workflow.** A task requiring a solver we do not have stays `gap` even when every drawing row it names is `partial`. Name the missing engine explicitly under `blocked-by:`. **`validate.mjs` enforces this**: any task with a non-empty `blocked-by:` is floored to `gap` regardless of its rows, and the report prints what the rows said so the flooring is visible rather than silent. This rule was added on 2026-09-11 after the first fencing draft computed four tasks as `partial` purely because their measurement rows were `partial`, which would have overstated readiness in exactly the way the register's tick rule forbids. Consequently `blocked-by:` must be omitted entirely — not left blank or filled with "none" — when a task truly has no missing engine.
6. **No jurisdiction or compliance claim.** Standards are referenced as inputs practitioners work to. X-Ray does not establish regulatory compliance; say so in any task that touches a code or standard.

## Required sections

### 1. Profile binding
The exact profile line from `industries.mjs` (verbatim), its `IND-xx` id from the register, and the categories it inherits.

### 2. People and jobs
Roles who perform the work. Project types split across: new work, repair/replacement, inspection, maintenance. State who signs off.

### 3. Workflow
The real sequence from brief to revision. Map each stage to the universal working-day stage (DAY-01 … DAY-08) it corresponds to. Where the industry's real sequence does not fit a DAY stage, say so — that is a finding about the register, not a fact to be smoothed over.

### 4. Task catalogue
The substance. One entry per task:

```
#### T-<n> <Task name>
intent:      one sentence, what the practitioner is trying to achieve
inputs:      what they bring
outputs:     what they must end up with
requires:    C-03, T-01, T-03, T-11        # register IDs, drives availability
blocked-by:  <engine or dependency absent from the register, if any>
origin:      [S] or [P]
source:      <reference key, if [S]>
notes:       edge cases, units, the thing that makes this task hard
```

### 5. Capability assessment
Four buckets, each listing tasks by id: **existing** (all requirements `partial` or better), **partial**, **missing**, **external dependency** (needs a licence, credential, account service or validated solver).

### 6. Sources
Table: key, title, publisher, date, URL or local path, and what it was used for. Official documentation, supplier technical manuals, sample deliverables, practitioner feedback. A source that could not be verified is listed as unverified and its claims demoted to `[P]`.

### 7. Open questions
What a practitioner in this trade must answer before the tasks can be built.

## Validation

`node planning/industry-specs/validate.mjs` checks every spec: requirement IDs exist in the register, computed states match, `[S]` items resolve to a source, task ids are unique, and no spec asserts an availability state directly. It exits non-zero on any failure.
