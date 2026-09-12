# Handover — X-Ray by Looplet, 2026-09-12

You are taking over work on `feat/architect-cad-engine` in `C:\Users\danie\repo\xray-by-looplet`. Read this whole file before touching anything. It is long on purpose: the rules here are not style preferences, they are what makes work in this repository count.

Owner: Daniel (`affordablefencinggc`). He runs a fencing contracting business and is building X-Ray as a professional takeoff, CAD and estimating workspace.

---

## 1. The single most important rule

**Nothing is done without a code diff plus executed or inspected proof.**

Not "the tests pass". Not "the button is there". Not "it should work". A claim is finished when there is:

1. a diff showing exactly what changed,
2. an executed test or log proving the behaviour,
3. an inspected screenshot where the change is visual — meaning *you actually looked at the image*, not that you saved one,
4. and a record of what is still **not** proven.

Daniel has been burned by agents reporting completion on green builds. The register described below exists because of that. If you are tempted to write "verified", stop and ask what a sceptical reviewer would still doubt.

**Report failures plainly.** If a test fails, say so and show the output. If you skipped something, say you skipped it. An honest gap is worth more than a confident overstatement, and overstatement is the one thing that will get your work thrown out.

---

## 2. Hard guardrails (harness-enforced, not negotiable)

These are enforced by hooks and by `AGENTS.project.md`. Violating them breaks Daniel's trust and possibly his working tree.

- **Never `git add -A`, `git add .`, or `git add --all`.** Stage explicit paths only, every time.
- **No commit, push, merge, `reset --hard`, `checkout --`, stash or worktree unless Daniel names the checkpoint.** When he does, the command must carry `# checkpoint: <name>` in the commit message.
- **Never `git stash`** unless you have no alternative. It nearly cost a session's work here: `stash pop` failed because two unrelated dev-server log files had changed underneath, and the whole tree had to be recovered from `stash@{0}` file by file. Back up to the scratchpad instead.
- **Never kill a process you do not own.** Stop only processes you started, through an identity-checked path. The 10-minute rule in `AGENTS.project.md` applies.
- **`LATEST-VERIFIED-BUILD.md` changes only after every gate passes, including native shutdown.** Do not touch it casually.
- **Tablet, laptop and desktop scope only.** Phones are explicitly out of scope (Daniel's decision, 2026-09-07). Do not add phone claims or phone CSS.

There is **another chat working in this repository** on assistant and floor-construction files. Before editing anything under `src/studio/assistant/`, `src/studio/LiveAssistant.tsx`, `src/studio/floorConstruction.*`, `src/studio/FloorConstructionStudio.tsx`, or `src/desktop.tsx`, check `git log` and file mtimes. Prefer new modules over edits to shared files.

Two files in `proof/growth/2026-09-09-assistant-surface/` (`dev-8091.stdout.log`, `dev-8091.stderr.log`) are **permanently dirty** — a running dev server writes to them. They are not yours. Never stage them, and do not try to "clean" the tree by reverting them.

---

## 3. What this project is

X-Ray is a desktop/tablet web app (Vite + React + TanStack Router, with a Tauri shell in `src-tauri/`) for construction professionals. Its parts:

- **Drawings / Sheets** — import PDF plans, name and organise source sheets.
- **Takeoff / Measure** — calibrate a scale, measure lengths, areas and counts against the original page coordinates.
- **Design (architectural workspace)** — a real parametric CAD surface: layered walls, hosted openings, slabs, roofs, plans/elevations/sections that regenerate, schedules, and authored drawing sheets. This is where recent work has been.
- **Estimate / Cost** — price books, workbook import, and a bounded supplier-price research contract.
- **Proof** — the evidence surface.

The architectural workspace is the most developed area and the one you are most likely to work in.

---

## 4. The register: `PROFESSIONAL-A-Z-CHECKLIST.md`

This is the spine of the project. **375 requirements across 28 categories**, each with an ID like `C-03`, `D-13`, `SO-01`.

Current state (2026-09-12):

| State | Rows | Meaning |
|---|---|---|
| verified | 6 | Complete stated behaviour proven to the tick rule |
| partial | 104 | Real implementation with executed proof and a named remaining boundary |
| dependency-blocked | 19 | Blocked on an external dependency, chiefly an unselected account service |
| failed | 1 | Attempted and not achieved (Q-13 installed-app verification) |
| gap | 245 | Not implemented |

### How the register is maintained — read this carefully

**The markdown is generated once, then hand-maintained.** `planning/professional-coverage/generate.mjs` writes `PROFESSIONAL-A-Z-CHECKLIST.md` only `if (!existsSync(checklistPath))`. After that, the reviewed assessments in the markdown are authoritative and `assessment.mjs` reads them back so a regeneration never resets them.

Therefore:

- To **change an assessment**, edit the markdown row directly.
- To **add a requirement**, add a `Name => Acceptance` line to the right block in `planning/professional-coverage/catalogue.mjs`, then add a matching assessment line to the markdown, then run `node planning/professional-coverage/generate.mjs`. It will refuse to generate until every new row has an assessment — that guard is deliberate.
- Row IDs are **positional**: the Nth line in a category block becomes `X-0N`. Every category currently ends at 14 except `D`, `E`, `T` (15), `SO` (5) and `PH` (3).

A row's format is strict, because tooling parses it:

```
- [ ] **D-13 Batch printing and issue sets** — <acceptance>. State: partial (assessed 2026-09-12). <reasoning, evidence paths, and what remains>
```

`- [x]` is only allowed when the state is `verified`; `assessment.mjs` throws otherwise.

### Delivery states

`gap → partial / in-progress / failed / dependency-blocked → verified`

A row goes to `partial` when something real is implemented and proven, **with a named boundary**. It reaches `verified` only when the complete stated acceptance is proven, including inspected visual proof at declared viewports and a tested platform build. Almost nothing is verified. That is correct and honest, not a problem to fix by relabelling.

---

## 5. The industry specifications: `planning/industry-specs/`

There are 68 industry profiles in `planning/professional-coverage/industries.mjs` (fencing, roofing, quantity surveying, HVAC, and so on). Each was one line — a coverage list, not a specification.

Six have now been decomposed into practitioner task catalogues:

- `fencing.md` — Daniel's own trade, carries his contractor practice
- `roofing.md`
- `quantity-surveying.md`
- `residential-building-design.md`
- `drafting-services.md` — written as a stress case at the capable end
- `hvac.md` — written as a stress case at the empty end

**62 remain.** `TEMPLATE.md` is the contract and was validated against both extremes without needing changes.

### The rule that makes these useful

**Task availability is computed from the register, never written.** Each task declares `requires:` register IDs; its state is the weakest of those rows. A spec that asserts its own state fails validation.

```
node planning/industry-specs/validate.mjs          # report
node planning/industry-specs/validate.mjs --json   # machine-readable
node --test planning/industry-specs/validate.test.mjs   # 11 tests
```

There is one extra rule worth understanding, because it was added after a real mistake: **a task naming a `blocked-by:` is floored to `gap` regardless of its rows.** The first fencing draft computed four tasks as `partial` purely because their measurement rows were `partial` — but each needed a solver that does not exist. Shared capability is not a validated workflow. The report prints `(rows say partial; floored by blocker)` so the flooring is visible.

If you add or edit a spec, `validate.test.mjs` will catch: unknown requirement IDs, asserted states, duplicate task IDs, `[S]` sources that do not resolve, and any task claiming `verified`.

---

## 6. What the specs found, and what to build next

Ranking blockers by how many *profiles* each stops (regenerate with `validate.mjs --json`):

| Row | Profiles | State | Title |
|---|---|---|---|
| **D-09** | 4 | gap | Drawing revisions and supersession |
| V-05 | 4 | dependency-blocked | Recipient and distribution list |
| **D-10** | 4 | gap | Revision overlay and slip-sheeting |
| **D-15** | 4 | gap | Visual and vector revision delta |
| PH-01 | 3 | gap | Element lifecycle status |
| K-01 | 3 | gap | Component and assembly libraries |
| F-13 | 3 | gap | Progress quantities and claims |

### Recommended next slice: the revision trio (D-09 / D-10 / D-15)

These are one coherent problem — **knowing what changed between issues** — and they now top the ranking. They are also exactly what the just-shipped issue-set feature lacks: D-13 stores no issue history, so the project holds no record of what was issued when. Building D-09 would close that boundary and unblock four profiles.

Suggested shape, following the patterns already in the codebase:

1. **Store an issue record** when an issue is exported: its sheets, revision, purpose, timestamp and a hash of each sheet's layout. New module, e.g. `src/studio/architect/issueHistory.ts`.
2. **Supersession** (D-09): a later issue supersedes an earlier one; the earlier stays readable and is marked superseded, never deleted. The repository's existing convention is to mark rather than delete — follow it.
3. **Delta** (D-15): compare two issue records and report sheets added, removed and changed, with a quantity variance table.
4. **Overlay** (D-10) is the visual layer and is the largest piece; treat it as its own slice.

Do not attempt all four at once. One slice, one proof, one commit.

**Do not start V-05.** It is `dependency-blocked` on an account service that has not been selected. That is Daniel's decision, not an engineering task.

---

## 7. Recent work (the last five commits) — the patterns to copy

```
3c386a7 feat(sheets): issue selected drawings as a reviewed set with a register
bfef177 fix(architect): stop the workspace collapsing to a 260px column
ff1fe86 fix(sheets): fit title block fields in the exported PDF too
3f73c2b fix(sheets): fit title block fields so long metadata cannot overrun
88cf7ef docs(register): add set-out and phasing categories from industry specs
```

Each has a proof directory under `proof/growth/`. **Read `proof/growth/2026-09-12-d13-issue-set/README.md` as the model for what a proof record looks like.**

Five things these slices did that you should do too:

**Read the code before believing the register.** D-07 was assessed `gap` with the reasoning "project metadata cannot update linked fields". That was wrong — a title block with linked fields already rendered on every sheet. The register was corrected to `partial`. Assessments can be stale; the code decides.

**Measure at the schema's real limits, not at a plausible-looking sample.** The first PDF overflow check used a long-ish address and found nothing. The schema allows 500 characters (`model.ts`), and at 500 it overflowed badly on A3. Read the Zod schema, use its maximum.

**Verify the artifact, not the helper.** The PDF title-block fix was proven by inflating the PDF's content streams and decoding the drawn text operands — reading what actually landed in the file. `proof/growth/2026-09-12-d13-issue-set/verify-issue-pdf.mjs` is a reusable example.

**Prove a pre-existing defect is pre-existing.** When the workspace collapse was found, it was confirmed by reverting the changed file to `HEAD`, re-running the identical scenario, getting identical numbers, then restoring. Never let a found defect be mistaken for one you caused.

**Write the boundary down.** Every proof README ends with what is *not* proven. The D-13 record says plainly: dev-server browser only, no installed run, no tablet capture, download path not exercised, no issue history stored.

---

## 8. The codebase, where it matters

### Architectural workspace — `src/studio/architect/`

| File | What it holds |
|---|---|
| `model.ts` | Zod schema for the whole design. `validateProject` is the gate. `demonstration(id)` builds a test project. Note the limits: project name 200 chars, address 500, designRevision 40. |
| `authoredSheetSet.ts` | Named drawing sheets: add, duplicate, select, rename, reorder, archive, recover. Pure functions returning unsaved drafts. |
| `sheets.ts` | `paperSize`, `sheetViewports`, `exportDrawingPdf` (single sheet, pdf-lib, real vectors), `exportIssueSetPdf` (D-13), `saveDownload`. |
| `issueSet.ts` | D-13 issue state: selection, order, register, file name. |
| `titleBlock.ts` | D-07 field fitting. `fitText` estimates for screen; `fitTextMeasured` takes a real font metric for the PDF. |
| `ArchitectSheets.tsx` | The sheets UI, including the issue panel. |
| `ArchitectWorkspace.tsx` | Tabs and the workspace shell. Mounted from `Studio.tsx` via `SketchPane`. |
| `architect.css` | Styles, including the U-03 grid fix — read the comment there before touching selectors. |

### House style (match it)

- **Pure functions returning unsaved drafts**, validated with Zod, committed by the caller. See `changeAuthoredSheets`.
- **Explicit refusals with useful messages.** "Keep at least one active drawing sheet. Add another sheet before archiving this one." — not "invalid".
- **Stale-review guards.** Destructive or outward-facing actions take a snapshot, and refuse if the design moved. Both `changeAuthoredSheets({type:"archive"})` and `exportIssueSetPdf` do this. Copy the pattern.
- **Fail closed.** A refused save preserves the previously stored bytes.
- **Comments explain *why*,** especially where something looks odd. The repeated class selector in the U-03 fix has a comment saying it is deliberate, so nobody "tidies" it away.
- Tests are `node --test` with `--experimental-strip-types`, colocated as `*.test.ts`.

### Gotchas that have already cost time

- **CRLF.** Most files are CRLF. A regex ending `(.*)$` captures the trailing `\r`. `validate.mjs` normalises; your code may need to.
- **`sheet` and `sheetSet.activeId` must move together.** Changing one without the other is refused by `validateAuthoredSheets` with "Active drawing sheet does not match its saved layout." (This caught a real bug during D-13.)
- **pdf-lib writes hex strings** (`<48656C6C6F> Tj`), not literal text, and standard Helvetica has **no ellipsis glyph** — use `...`.
- `.studio-left-rail` is hidden with `display:none` but stays in the DOM, so `:has(> .studio-left-rail)` still matches in `workspacePanels.css`. This caused the U-03 collapse. The underlying fragility is unfixed.
- **Screenshots are gitignored** — `.gitignore` line 59 is `screenshots/*`, so everything under `screenshots/` is excluded. Take them, *look at them*, reference their paths in the proof README — but they are not committed. Do not `git add -f` them. Proof directories under `proof/growth/` **are** committed.

---

## 9. How to run and prove things

### Tests and typecheck

```bash
node node_modules/typescript/bin/tsc --noEmit
node --experimental-strip-types --test src/studio/architect/architect.test.ts \
  src/studio/architect/titleBlock.test.ts src/studio/architect/sheetExport.test.ts \
  src/studio/architect/authoredSheetSet.test.ts src/studio/architect/issueSet.test.ts
node --test planning/industry-specs/validate.test.mjs
```

Current baseline: **73/73 architect tests, 11/11 spec tests, `tsc --noEmit` exit 0.** If any of these fail before you change anything, stop and investigate — do not build on a red baseline.

### Browser proof (Fast CDP)

A dev server is already running on **`http://127.0.0.1:8091/`** (PID 57888). **It is not yours — do not kill it.** Check it is alive with `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8091/`.

Scenarios are JSON opcode arrays run through:

```bash
node .agents/skills/fast-cdp-testing/scripts/browser-batch.mjs <session-name> <scenario.json>
```

Working opcodes (copy these exactly — other spellings silently do nothing):

```json
[["open","http://127.0.0.1:8091/","--timeout","120000"],
 ["set","viewport","1680","1050"],
 ["wait","--fn","document.querySelector('[data-hydration-status]')?.getAttribute('data-hydration-status')==='ready'","--timeout","120000"],
 ["eval","(()=>{ /* returns a string you will see in the log */ })()"],
 ["screenshot","screenshots/growth/<date>-<slice>/01-thing.png"]]
```

To reach the architectural workspace: click **Design** → **Architectural workspace** → wait for `.arch-tabs button` → click **Drawing sheets**.

Notes learned the hard way:
- Use **1680x1050**. At 1280 the architect workspace is too cramped to photograph usefully.
- **Assert, don't just photograph.** Return values from `eval` and check them. `{"alert":"...","exportDisabled":true}` is proof; a screenshot alone is not.
- After a CSS hot-reload the session can go stale (`os error 10060`). Close it and use a new session name.
- Chrome's PDF plugin **does not expose its render surface to CDP** here. Do not waste time trying to screenshot a PDF; read its bytes instead.
- **Close every session you open**: `node .temp/npm/_npx/8e62322f9a68a26a/node_modules/agent-browser/bin/agent-browser.js --session <name> close`

### Before any commit

1. Back up changed files to the scratchpad and **verify the copy**, not just that `cp` exited 0.
2. `tsc --noEmit`, the test suites, `git diff --check`.
3. `git add` **explicit paths only**.
4. `git diff --cached --name-only` and read it — confirm nothing unexpected, and that the two dev-server logs are absent.
5. Commit only with Daniel's named checkpoint, message ending:
   `Co-Authored-By: <your model name> <noreply@...>`
6. Nothing has been pushed. Do not push without explicit instruction.

---

## 10. Open items, honestly stated

**Unfixed, known, recorded:**

- The shared grid in `workspacePanels.css` still sizes itself from a `display:none` element's presence in the DOM. The architect workspace is patched around it; another workspace hiding a rail would hit the same trap. The durable fix belongs in `workspacePanels.css`, which is near the other chat's area.
- No issue history is stored (D-13's boundary, and the reason D-09 is the natural next slice).
- No built-browser or installed-app verification for any of the last four slices.
- No tablet capture at 1024x768 for any of them, though tablet is in scope.
- D-07 has no template system: the title block is at fixed coordinates and cannot be substituted with a firm's own.

**Research gaps in the specs:**

- Six of nine external sources cited across the six specs are **unverified** — cited to name a discipline or calculation, never to state a value, and their claims are marked `[P]` (proposed) rather than `[S]` (sourced). No supplier manual, sample deliverable or practitioner interview has been consulted.
- Each spec ends with open questions. The fencing ones are answered (Daniel's own practice). The other five need practitioners.

**Decisions only Daniel can make:**

- Which account service to select — this alone unblocks V-05 and much of category A.
- Whether the `SO`/`PH` categories and `E-15`/`T-15`/`D-15` rows added on 2026-09-11 are structured as he wants (see `planning/PROPOSED-REGISTER-EXPANSIONS.md`).
- Whether to push any of the five unpushed commits.

---

## 11. Where everything lives

| Path | What |
|---|---|
| `PROFESSIONAL-A-Z-CHECKLIST.md` | The register. 375 rows. Authoritative. |
| `planning/professional-coverage/` | Generator, catalogue source, 68 industry profiles. |
| `planning/industry-specs/` | Six industry specs, the template, the validator. |
| `planning/PROPOSED-REGISTER-EXPANSIONS.md` | The SO/PH merge record. |
| `proof/growth/<date>-<slice>/` | Proof records. Read the D-13 one first. |
| `screenshots/growth/<date>-<slice>/` | Screenshots (gitignored). |
| `AGENTS.project.md` | Project rules including the 10-minute process rule. |
| `.agents/skills/ledger/SKILL.md` | The ledger discipline. |
| `.agents/skills/fast-cdp-testing/SKILL.md` | Browser testing. |
| `AZ-WAVE3-LEDGER.md`, `walkthrough.md` | Prior wave ledger and proof ledger. |

---

## 12. If you remember one thing

Daniel does not need you to be fast. He needs to be able to trust what you tell him.

Read the code before believing a claim about it — including claims in this file. Measure at real limits. Prove the artifact, not the helper. Say what you did not do. When the validator or a schema refuses your change, it is usually right and you are usually wrong; that has happened repeatedly in this work and each time the guard was correct.

Good luck.
