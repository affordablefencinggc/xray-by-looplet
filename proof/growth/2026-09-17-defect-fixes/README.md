# Defect fixes — D1&ndash;D8

Proof note for the eight defects registered in
[`../2026-09-17-assistant-sweep-review/index.html`](../2026-09-17-assistant-sweep-review/index.html)
(register at &sect;1). Written 2026-09-17 on `feat/architect-cad-engine`, landed as three commits by
concern under the checkpoint `assistant-defect-fixes-2026-09-17` — pushed to origin, and
`LATEST-VERIFIED-BUILD.md` untouched.

```
09f1771  fix(assistant): stop the model's own text leaking, and stop the manual lying about it   (D1, D2, D7)
5d0de3a  fix(assistant): let the packet's own control flow reach the user                         (D3, D6)
88e2e52  fix(assistant): gate every tool that changes the workspace, and say what it changes      (D4, D5, D8)
```

This directory is not part of those commits, so the note is the repair record rather than part of what they
shipped; every file it cites is in the working tree or a tracked path, and the record is committed on its own.
`code.diff` was taken from the working tree before staging and, as the change was committed,
**`git diff 26f5deb 09f1771` — the range `push.out.txt` beside it records — was byte-identical to it** —
93,178 bytes, `cmp` clean. Two comments have been corrected since, one per file and both
comment-only: `skills.ts`'s docstring, quoted in the page&rsquo;s §2, and a rationale comment in
`skills.test.ts` — each gave the same wrong mechanism the corrected prose gave. Those two are the only
thing the comparison adds today, so the "byte for byte" wording is retired here rather than left
standing; `code.diff` itself is unchanged, and `check-tree-delta.mjs` runs the whole relation below
rather than leaving it to this sentence.

The rule this directory answers to: **nothing is done without a code diff plus executed or inspected
proof.** Every claim below names the artifact that carries it, and the three that are not established
are labelled as not established.

## Status, defect by defect

| ID | Defect | Status | How it is established |
| --- | --- | --- | --- |
| **D1** | Internal planning text shown to the user | **Mitigated, not verifiable** | Source + unit. The strip now covers all three tagged shapes and no longer welds; the one surviving candidate site is named below and deliberately untouched. The triggering run is not reproducible on demand. |
| **D2** | Words welded together where text was removed | **Fixed** | Executed unit tests on `stripReasoning`; the observation itself stays unattributed (see below). |
| **D3** | A three-word answer is never delivered | **Fixed — live** | Accepted run `03-07-12-626Z-qa-defect20-d3`, the register's failing objective verbatim. |
| **D4** | Approval prompt built from keys the prompting tools never send | **Fixed — live + executed** | Executed catalogue probe (`probe-tool-keys.out.txt`); accepted runs `03-27-24-335Z-qa-defect22c-d8` and `05-16-24-468Z-qa-defect22d-d4` show the card the user reads. |
| **D5** | A quota-consuming tool admitted as a read | **Fixed** | Unit + source. The stale-outcome half is a deliberate non-change, argued below. |
| **D6** | The edit that most needs a prompt never reaches the gate in ask mode | **Fixed** — the prompt in ask mode, the refusal on every path | Unit + source-order assertions; accepted run `03-27-24-335Z-qa-defect22c-d8` for the prompt path. The authority refusal no longer pre-empts the prompt — the composed check used to run ahead of `authorize`, so this name threw on every route — which is what made ask mode return an error where the mode promises a prompt. Reason the tool-specific run was not attempted is in *Limits*. |
| **D7** | The manual contradicts itself about the assistant's own limits | **Fixed** | Executed check `check-d7.out.txt` against the generated file that ships. |
| **D8** | Five tools that change state are admitted as reads | **Fixed — live** | Refuse half: accepted run `03-07-26-824Z-qa-defect21-d8`. Gate entry in ask mode: accepted run `03-27-24-335Z-qa-defect22c-d8`. |

Seven of eight fixed; one mitigated. Two of the register's three never-observed behaviours were
observed live for the first time here (D3's delivery, D8's refuse half), and D8's admit half — already
live in the register — is now closed.

## The design decision the whole fix rests on

Three separate places defined "read vs. edit", independently:

- `EDIT_TOOLS` / `VIEW_TOOLS` (`src/studio/assistant/skills.ts`)
- the `STATE_CHANGING_TOOL` regex (`src/studio/assistant/contextBudget.ts:93`)
- `workbenchTools.read` / `workbenchTools.editWithPermission` (`src/studio/assistant/workbenchStructure.ts:46-63`)

D5 and D8 are what happens when the permission gate keys off the first of those alone:
`permissionVerdict` returned `allowed` for **any** non-edit tool, so navigation, viewer changes, the
drafting animation and a metered render all ran unprompted in every mode, including one named
"Read only".

The fix adds a **third class** rather than moving names between the existing two:

```ts
const EFFECTFUL_TOOLS = new Set([
  "navigate_workspace", "show_design_in_model", "hide_designed_model", "control_draftsman", "generate_render_visualisation",
]);
export const isAssistantEffectfulTool = (name: string) => EFFECTFUL_TOOLS.has(name);
export const isAssistantGatedTool = (name: string) => isAssistantEditTool(name) || isAssistantEffectfulTool(name);
```

`isAssistantGatedTool` is consumed in exactly one place — the permission gate in `permissions.ts`.
`isAssistantEditTool` still drives the other four readers —
`contextBudget.isStateChangingTool` and the three pending-action paths: the packet's refusal, the
runtime's pre-flight and the `edits` alias that sets and preserves `pendingAction`. Edit membership
still decides the model's tool list as well, through `EDIT_TOOLS` itself, since `assistantToolAllowed`
tests `VIEW_TOOLS` first and all five are members. That separation is the fix, not
an accident, and the alternative was rejected on evidence. Adding these five to `EDIT_TOOLS` would
have gated them — the gate this fix had to change keyed on that set and nothing else
(`permissionVerdict` before the change: `if (!isAssistantEditTool(toolName)) return 'allowed';`) —
and would have left the model's tool list untouched, because `assistantToolAllowed`
(`skills.ts:144-145`) returns true on `VIEW_TOOLS` membership before it consults `EDIT_TOOLS`, and
all five names are in `VIEW_TOOLS` too (`skills.ts:101`, `:104`, `:111-113`) — `skills.test.ts`
asserts exactly that. What rules it out is that edit membership feeds five readers and the permission
gate is only one of them: the other four all mean *writes the project record* — the context
handover's state-changing list (`contextBudget.ts:95`), the packet's pending-action refusal
(`workPacket.ts:81`), the runtime's pre-flight (`workPacketRuntime.ts:125`) and the `edits` alias that
sets and preserves `pendingAction` (`workPacketRuntime.ts:152`). Added to the set, a pane move would
have entered that bookkeeping and a render would have counted as a state change in the handover. The
gate needed a wider predicate, not a wider edit set; `probe-effectful-class.mjs` runs each of these
against the shipping modules. The variant that would bite the tool list is a move *out of*
`VIEW_TOOLS`, which would strip navigation out of **read-only mode** outright — where the
architecture workflow still requires it as its first step. In ask mode it would have survived the
move, as an edit tool, so the workflow's first step would have become a permission card in one mode
and unreachable in the other. The suite would have gone green while the product lost a documented
workflow. `skills.test.ts` now also pins the separation: effectful, gated, and *not* an edit.

## Why the effectful class must not enter the pending-action gate

D5 also complained that the render tool "never trips the stale-outcome gate". It still does not, on
purpose:

- `pendingAction` is cleared on a tool's own outcome at exactly one site (`workPacketRuntime.ts:172`); every post-execution path
  preserves it, and `workPacket.ts:81` then blocks **every** edit tool until it is reconciled. The one
  other write that can leave it null is the pre-execution recheck's restore (`workPacketRuntime.ts:158`),
  which runs before the tool does: it undoes the intent `:153` had just set — for an edit tool it restores
  the null `workPacket.ts:81` already guarantees was there — and is a no-op for any other tool, so it
  cannot discard an outcome.
- `isConfirmedRejection` (`actionOutcome.ts:16-17`) recognises only `draw_architect_elements` and
  `edit_architect_elements`. A navigation or render whose *result* is an error — the path that
  would set `pendingAction` if these names were edits, since a refusal at the prompt returns before
  the bookkeeping (`workPacketRuntime.ts:145-150`) — could therefore never be cleared by a rejection,
  and would block all later edits for the life of the packet.

The gate exists for durable project mutations. A render or a pane move has no project state to
reconcile: its outcome is a receipt, and it surfaces as an ordinary tool failure. So the fix gives
these tools the thing D5 actually needed — the prompt and the mode check — and keeps them out of
bookkeeping designed for mutations. `workPacketRuntime.ts:125,152,165,172` and `workPacket.ts:81` still
key off it — the guard at 125, and the `edits` alias at 152, which gates the set at 153, the catch's
preserve at 165 and the clear at 172 — and, before the tool runs, the restore at 158.

## D6: the deferral no longer answers for the refusal

The register's wording is exact: *"in ask mode where the tool is declared and a prompt is what the mode
promises, `review_takeoff_item` returns an error instead of a prompt, and the user is never asked."*
`checkProfessionalAction` is a pure, unconditional name test —

```ts
if (tool === 'review_takeoff_item' || /^(send_|issue_|approve_|certify_|publish_)/.test(tool))
  throw Error('Professional approval or external issue requires verified human authority. This work packet permits internal drafts only.');
```

— so no user decision and no route can ever satisfy it. What was wrong was **where that test sat**: it
was reached through the composed `checkPacketAction`, which the runtime called ahead of the workflow
step and ahead of the `authorize` callback that shows the prompt. So for this one name the throw fired
on every route, before any prompt could be shown and before the deferral reply that would have told the
model to select a workflow. The user saw an error where the mode promises a question;
`status: not-executed`, which the deferral would have returned, was never reached at all. What moved is
where the two halves sit: the composed call is now made after the user has decided
(`workPacketRuntime.ts:151`), and the authority refusal is made before a deferral at `:140`.

Two ways to satisfy the register were rejected as wrong:

- **Leave the composed check where it was, ahead of the prompt.** Reverts D6 outright — and the register
  is right that the prompt is what ask mode promises.
- **Defer after `authorize`.** Would show a permission card for every deferred tool, asking the user to
  approve something the app has already decided cannot run.

The fix is targeted: `checkProfessionalAction(tool)` is called **inside** the `if (next)` branch, so a
would-be deferral of a professional verb is refused with the reason that actually applies, while a
selected route still reaches D6's prompt. `checkPacketIntegrity` still runs before both, and
`checkPacketAction` still runs on the path that is not deferred, so the refusal fires either way and
neither check was weakened. `workPacket.test.ts` asserts the two are separable; the register's own
objection — that the model was being sent to look for a route to a forbidden tool — is what closes.

## A finding beyond D1–D8, introduced by this diff and fixed

Reviewing the change adversarially turned up a defect **this diff widens**, so it is fixed here rather
than filed: `grantedForChat` is one process-global `Set` keyed by tool name alone, and "for this chat"
was enforced only by the chat-level actions that clear it (`resetChatGrants`, called from clear /
archive / continue / restore). **Opening another project is also another chat, and nothing cleared it.**
A tool the user allowed once in one project's chat therefore ran unasked in a different project's chat.

Pre-existing for the twelve edit tools; this diff extends it to navigation, viewer changes, the drafting
animation and a metered render, which is why it is fixed rather than reported. `scopeChatGrants(projectId)`
records the project the grants belong to and clears them when it changes, called from the assistant
hook's job-id effect — the effect whose whole purpose is that the chat identity changed. It is a no-op
while the project is unchanged, so a readiness or hydration flip inside one chat cannot silently revoke a
decision the user did make. Each of the two review runs that carried this claim put it to two
independent verifiers with different lenses, both told to refute it; all four verdicts declined to, and
they are copied verbatim into `grant-verdicts.json` rather than cited by run id.

## Executed evidence

| Artifact | What it shows | Result |
| --- | --- | --- |
| `code.diff`, `code.diff.stat.txt` | The complete change | 17 files, **+452 / −60**, no new source files (93,178 bytes). |
| `check-tree-delta.mjs`, `.out.txt` | The working tree's relation to `code.diff`, run rather than asserted | `code.diff` is byte-identical to the pushed range `git diff 26f5deb 09f1771` (93,178 bytes); the only paths differing from `HEAD` are `skills.ts` and `skills.test.ts`; every changed line in them is a comment line (21 lines, 0 not comments); the other fifteen committed paths carry an identical diff in the working tree; and `skills.test.ts` runs green with the corrected comment in it. **6 of 6**. |
| `full-test.log` | The whole repository suite after the change | Two `"ok": true` records, one per script — `verify-master-plan.mjs` (line 8) and `verify-bom-goldens.mjs` (line 339); node suites **203 pass / 0 fail** and **1517 pass / 0 fail**, `cancelled 0 / skipped 0 / todo 0` — 1,720 tests. The exit status the run returned is appended to the log by the wrapper that ran it (`exit=0`). |
| `typecheck.log` | `npm run typecheck` | exit 0 (`tsc --noEmit`, no output). |
| `rust-test.log` | `cargo test --lib` in `src-tauri` — the half the npm suite cannot reach | **47 passed, 0 failed**, including `assistant_ai::tests::system_instruction_appends_the_brief_to_the_safety_manual`, the pin that caught this change's own +3-byte regression. |
| `probe-tool-keys.mjs`, `probe-tool-keys.out.txt` | D4's partition, read out of the shipping modules | 38 tools: **17 gated** (12 edits + 5 effectful), **21 read-only**; effectful-and-also-edit: **none**; dead prompt branches: **0**; gated tools with no title: **none**; dead title rows: **none**. Each of those readings is asserted rather than printed — **10 of 10** — and the probe exits non-zero on any of them. |
| `check-d7.mjs`, `check-d7.out.txt` | D7 against the generated file | `64 rounds per send` and `256 tool calls per send` present, matching `DEFAULT_EXECUTION_BUDGET`; the superseded pair absent from both brief and atlas — **both halves asserted**, not one asserted and the other printed; brief **11,994 of a 12,000 ceiling**. |
| `probe-effectful-class.mjs`, `.out.txt` | What the effectful class is, and what the rejected alternative would have done | Runs the real predicates: the 38-name catalogue splits into **12 edits / 5 effectful-not-edits / 21 other declared reads / 0 unclassified** — 12 + 5 + 21 = 38, the 17 gated and 21 read-only the row above states; the five effectful names are themselves declared reads, so the probe's separately printed `26 declared reads` contains them; `assistantToolAllowed` stops moving with `allowProjectEdits` for exactly the five (`skills.ts:145`'s first disjunct decides them, so no `EDIT_TOOLS` membership can change it), while the gate before this change keyed on that set alone (read out of `git show 88e2e52^`); five readers of `isAssistantEditTool` outside tests, of which the gate's own `isAssistantGatedTool` is one; with a pending action set the witness edit tool is refused by `workPacket.ts:81` — the refusal keys off `isAssistantEditTool`, so it covers all 12 — and none of the five is; `isStateChangingTool` is false for all five and true for the witness edit; and `isConfirmedRejection` answers false for every name but the two draw tools, handed the one receipt shape that clears one. It also resolves against the tree each `file.ext:N` token the page and this note print — and fails one that lands on a blank or on a comment line, `//` included; a shorthand continuation and a range&rsquo;s second endpoint spell out no filename of their own, so they are not resolved; its own section G states how many occurrences that is and how many are distinct, and neither figure is repeated here, because this note is one of the two documents counted; on its first run section G caught a real one, a `skills.ts` line this pass's own comment correction had moved onto the docstring. **51 of 51**. |
| `check-payloads.mjs`, `check-payloads.out.txt` | The page's four inlined figures against every PNG under `proof/` | **4 payloads**, each a PNG and all four distinct, and **0 of 4** matching the bytes of any PNG under `proof/` — the count it is held against and their digests are in its recorded output rather than quoted here, because every capture this bundle gains moves them. That comparison is what licenses reading the page's figures as the accepted runs' frames rather than the re-run ones. **4 of 4**. |
| `tabulate-runs.mjs`, `runner-index.out.txt` | The live-run index | 26 reports: **4 accepted turns / 4 re-run at the committed revision / 5 substantively excluded / 1 diagnostic**, plus **12 close-operation-only** entries. Every accepted, re-run and close-operation report exits 0; the four that do not — two `exit 1` and two `exit null` from the rig's spawn timeout — are among the excluded runs, and §6 labels each with its own status. |
| `check-housekeeping.mjs`, `check-housekeeping.out.txt` | The count claims above, checked against the record rather than restated | 25 passes, 51 sessions, **50 of 50** temporary profile directories gone after close, 1 persistent directory still present, and the record's last twenty-eight entries exactly this work's sessions, each `exitCode: 0` with its daemon and every profile directory gone. Also that the owned dev server was stopped rather than retained, and that the user-facing preview is the only server kept — that last reading run as well against three perturbed copies of the record, each of which it must reject, so a record that keeps a second server on any port cannot pass it. **13 of 13**. |
| `check-page.mjs`, `check-page.out.txt`, `report-*.png` | The report page itself, checked and then rendered | 21 classes used / 25 defined, tag balance clean, no unresolved substitution, fonts the only external host, every one of the 21 tokens defined inside each of the two dark blocks — the two are read one at a time rather than merged into one list, so a token defined in only one of them fails the check instead of passing on the pair — and the footer's inventory of this directory held in both directions: 26 file names and one glob standing in for its 6 captures, over all 32 entries, so an artifact the footer omits or one it names but the directory does not hold both fail it — its recorded output counts 29 `<code>` tokens to get there, the other two being the directory paths the footer also names, which are skipped because they name no file in this directory. Rendered at 1600×1000 as five captures — the top, the register and the fix, the committed-revision re-runs, §4's evidence table from its `code.diff` row down, and the page tail (§7 Limits, Scope and the proof footer) — and the readings are that viewport's own DOM: 4 tally tiles, 21 table rows, all 4 inlined screenshots loading, the body ground painted from the token, and no horizontal overflow. The 400×900 pass re-reads horizontal overflow alone and took the sixth capture. That is a narrow-viewport robustness reading of this page, not a device-scope claim, which stays tablet, laptop and desktop. The rendered reading is the shipped page's own report (`2026-09-17T10-48-35-327Z-qa-render-final11`), whose scenario declares 78 booleans over the page — 46 that must read true (the re-run block, the four readings, every corrected sentence, the disclosure that the retracted 76.2 s figure is stated beside the note that no artifact established it, the footer's own inventory, the two clauses and the split card readings the previous round re-worded, this round's corrected footer clauses and their retired wordings read as absent, the scope bullet that now says the commits are pushed, the push record the footer's inventory counts, and two structural checks) and 32 that must read false (31 superseded wordings and one geometry reading that catches horizontal overflow) — and every one of them lands as declared. The renders before it are kept in the record rather than dropped: `qa-render-final3`, whose one failed assertion was the scenario's fault and not the page's (a pattern written as a single line against a sentence the source wraps in two, which `document.body.textContent` therefore does not contain — the eval now compares whitespace-collapsed prose), and `qa-render-final4` through `qa-render-final9`, each superseded when a passage of the page was corrected after its captures had been taken — `qa-render-final8` by the §7 correction, whose first form re-worded the clause before the one it aimed at and turned one of the scenario's own readings false, so the edit was narrowed back to the sentence the audit had sustained, `qa-render-final9` by the footer correction, which had credited `runner-index.out.txt` to a script that writes no file, and `qa-render-final10` by the push: four passages in this bundle said the commits were unpushed, and the push made all four false the moment it landed. |

The probe asserts the partition rather than printing it for a reader. It builds the real catalogue via
`createAppTools(port)` and holds every reading above against it, including the keys `INTENT_KEYS` names —
the list `describeToolIntent` actually reads, exported from the shipping module, so the branches and the
catalogue cannot drift apart again the way they did in the first place. Three of its ten readings are the
invariants the unit test at `permissions.test.ts` asserts (key coverage, a plain-word title for every
gated tool, no title without one); the counts, the effectful class and the dead-row emptiness are what it
adds to it.

## Live runs

Rig: `../2026-09-16-live-assistant-rig/` (batch 3 builds scenarios 20–23 into
`build-scenarios-defects.mjs`). A turn is never re-sent to obtain a more favourable answer. Each of
the four accepted runs was then driven a second time — once — against the committed source; those
re-runs are listed after the accepted set.

**Accepted** (one per behaviour; each `exitCode: 0`):

1. `2026-09-17T03-07-12-626Z-qa-defect20-d3` — **D3.** The register's objective verbatim
   (`No tools. Reply with exactly: LIVE TURN OK`) on a non-discussion route. The answer is delivered:
   the assistant entry reads `LIVE TURN OK`, zero tool rows, no error, and the saved packet closes
   `review-required` with `nextAction` exactly
   *"Tool use was prohibited for this message, so no tool step was required…"*. Pre-fix this same
   objective produced no answer at all (scenario 08, `11-01-05-965Z`).
2. `2026-09-17T03-07-26-824Z-qa-defect21-d8` — **D8, refuse half.** Read-only mode, an effect-bearing
   non-edit put in front of it deliberately. `navigate_workspace` is refused with
   *"Read-only mode: the user has not allowed changes. Nothing was changed."*; the pane is unchanged
   before and after; the packet is `blocked`. This is the half the review page said had never been
   observed — the register's own scenario 09 had recorded the opposite by accident.
3. `2026-09-17T03-27-24-335Z-qa-defect22c-d8` — **D8 gate entry + D4 title.** Ask mode. The card the
   user decides on reads **"The assistant wants to: Move the workspace"** — user-facing wording, not a
   raw tool id — with summary *"on the current project"*. Deny dismisses it; the tool receipt is
   *"The user declined this action. Nothing was changed; ask before retrying."*; the pane is unchanged
   at all three readings; no navigation succeeded. (The summary in that reading is the pre-fix text: no
   branch read `pane`, so the fallback fired. Run 4 below re-observes the same scenario.)
4. `2026-09-17T05-16-24-468Z-qa-defect22d-d4` — **D4's prompt names the destination.** The same
   scenario, opcode for opcode, as run 3 — copied out of the runner's archived
   `.scenario.json` by `.temp/live-rig/build-22d.mjs`, which rewrites the screenshot path and nothing
   else, so the only variable between the two readings is the source. The card now reads
   **"The assistant wants to: Move the workspace"** with summary **"measure"** — the pane it is about
   to move to, read from `navigate_workspace`'s own `pane` argument. At the moment of the prompt the
   workspace was on `cost` and the assistant's own message said it would navigate to Measure, so the
   prompt names the destination the user is being asked to approve. Deny dismisses it;
   `navigate_workspace` is the only failed tool row; the pane is `cost` at all three readings
   (before, after deny, final); the turn closes `state: "done"` with `navigateToolsSucceeded: 0`.
   Screenshot: `screenshots/22d-d4-card-names-destination.png`.

**Re-run at the committed revision** (`qa-recheck-*`, one per accepted behaviour, each `exitCode: 0`):

Every measurement in the accepted set was captured between 13:07 and 15:16 local time (03:07–05:16 UTC),
and the source moved underneath them. Eleven of the seventeen files in this change were written after the
three early runs and before the fourth — `assistant_ai.rs` and the two `minimaxAi.server` files at
15:06–15:07, `workPacketRuntime.ts` at 15:07, `workbenchStructure.ts` at 15:08, `WIRING.md` and
`build-assistant-context.mjs` at 15:08, and `permissions.ts` and `useAssistantChat.ts` with their two
test files at 15:11. D3 at 13:07, D8's refuse half at 13:07 and D8's gate entry at 13:27 therefore measured
a working tree that is not the tree the three commits contain; a timestamp cannot say whether those later
writes touched the behaviour under test, which is why each was driven again. D4 at 15:16 ran 282 s after the
last of those writes and 110 s before the first commit, so it measured the committed source. The three
commits were made at 15:18:14–15:18:32. Each scenario was then driven once more, unmodified, against the
committed source on the owned dev server at `127.0.0.1:8085`. All four reproduced. The readings below are
the runs' own output, not a summary.

| Run | Was | Reads |
| --- | --- | --- |
| `05-49-17-844Z-qa-recheck-d3` | D3 | `{"answerDelivered":true,"workflowIncompleteError":false,"toolsRun":0,"replyLength":238}` — the packet closes `review-required` with `pendingAction: null` and the same `nextAction` sentence as the accepted run. |
| `05-49-36-237Z-qa-recheck-d8-readonly` | D8, refuse half | `{"navigateToolsSucceeded":0,"navigateAttempts":2,"refusalVisible":true}` — the model called `navigate_workspace` before selecting a workflow and was stopped there, then called it again and was refused by the mode: *"Read-only mode: the user has not allowed changes. Nothing was changed."* The pane reads `cost` before and after, `unchanged: true`; the packet is `blocked`. |
| `05-50-05-933Z-qa-recheck-d8-ask` | D8 gate entry | `{"outcome":"permission-card","cardTitle":"The assistant wants to: Move the workspace","cardSummary":"measure","storePending":null,"mode":"ask","working":true,"elapsedMs":10101}` — deny dismisses the card, no navigation succeeds, the pane is `cost` at all three readings. |
| `05-50-35-117Z-qa-recheck-d4` | D4 | the same card reading, `cardSummary: "measure"`, at the committed revision, 15.1 s after the send. |

The two ask-mode re-runs also reproduce the §7 instrument finding at the committed revision — a painted
card beside `storePending: null`. Reports, logs and the archived scenarios each consumed are in
`proof/growth/runner/` under the `qa-recheck-*` names, and every archived scenario is byte-identical to
its accepted counterpart — all four pairs compared opcode for opcode, no differences — which is what
"unmodified" means here. The screenshots are **not** in that directory: the runs inherited the accepted
scenarios' own output paths, so seven captures under `../2026-09-16-live-assistant-rig/screenshots/` were
written a second time and now hold the committed-revision frames —

```
20-d3-no-tool-answer-composed.png           21-d8-readonly-refuses-navigation-composed.png
20-d3-no-tool-answer-replied.png            21-d8-readonly-refuses-navigation-replied.png
21-readonly-mode-selected.png               22-d8-ask-navigation-prompt.png
                                            22d-d4-card-names-destination.png
```

The four figures printed on the page are unaffected as printed — they were inlined into `index.html`
before the re-runs ran, and none of the four payloads now matches the bytes of any PNG under `proof/` —
which `check-payloads.mjs` measures rather than assumes. The three captures the page does not inline have
no earlier copy here, so what they show now is the committed-revision frame. Run 4's citation at the top of this
section points at one of the seven: it shows the same card reading the same summary, from the committed
revision rather than from the accepted run.

**Diagnostic, kept as evidence for a limit rather than as a verification:**

- `2026-09-17T03-26-10-068Z-qa-defect23b-diag` — the run that characterised why scenarios 22/22b hung:
  `denyButton: true` while `pending: null`, `workPacketState: "working"`, rendered tail
  `Running navigate_workspace…`.

**Excluded, and why:**

| Run | Reason |
| --- | --- |
| `03-06-17-845Z-qa-defect20-d3` | exit 1 — the page never hydrated (`Operation timed out. The page may still be loading…`). No turn was driven, so a single retry was legitimate; `03-07-12` is the accepted one. |
| `05-14-13-165Z-qa-defect22d-d4` | exit 1 at 26.0 s — the `open` opcode timed out. The rig hands the whole scenario to the browser as a single `batch --bail` invocation (`scripts/fast-cdp-test.mjs:21`), so execution stopped at the opcode that failed, the `open`: two opcodes in, and **no turn was sent**, which is why a single retry is legitimate here too — there is no answer to obtain a more favourable version of. The report's `commands: 57` is the scenario's opcode count, not a count of opcodes run, and the log is four lines against the accepted run's 113. The report carries no error string and the log's only diagnostic is one wait giving up (`Operation timed out. The page may still be loading or the element may not exist.`). The cause is not established by an artifact: this row previously gave a cold module-graph figure (`/src/styles.css` in 76.2 s against 5 ms warm) that no file in the proof directory records. Re-running after warming is `05-16-24`, the accepted one. |
| `03-07-48-835Z-qa-defect22-d8` | exit null, 600 s spawn timeout. The poll read the store's `pending`, which reads `null` while the card is painted; no turn completed. Superseded by `22c`. |
| `03-18-43-804Z-qa-defect22b-d8` | Same instrument, same outcome (400 s). Superseded by `22c`. |
| `03-25-38-810Z-qa-defect23-diag` | exit 0 in 3.2 s but the settle condition fired on its first tick: the loop kept ticking only while the archive reported `busy:true`, and it reported `busy:false` before the send's write had landed, so an absent `busy` reads the same as a turn that has not started. Its whole reading is `{"mode":"ask","pending":null,"grants":[],"busy":false,"error":null,"workPacketState":null,"nextAction":null,"entries":0,"fresh":[],"renderedRows":0,"renderedTail":[]}`. Superseded by `23b`. |
| `03-18-32`, `03-18-33`, `03-18-35`, `03-28-19`, `03-28-50`, `03-28-52`, `03-28-53`, `05-17-46` (`qa-defect*`) | **Close operations, not turns.** `close-campaign-browsers.mjs --apply` re-runs the rig with a one-opcode `[["close"]]` scenario per owned session, and the rig writes a normal report for every invocation. `tabulate-runs.mjs` identifies them by `scenarioOps === 1`; `runner-index.out.txt` carries the running total, which moves with every cleanup. They must not be read as superseded turns. |

## Limits — what is not claimed

- **D1 is not fixed.** No client-side rule can tell an untagged reasoning passage apart from an answer.
  The strip now handles all three *tagged* shapes (closed block, unterminated block, orphan closing tag)
  and leaves a space instead of welding. The one surviving candidate site is
  `src/studio/assistant/conversation.ts:129`, which emits a tool-calling round's text as a durable
  assistant bubble — correct for real model text, and exactly how a leaked passage would become
  permanent. It is deliberately unchanged: dropping text from tool-calling rounds would silently discard
  real messages, and the register's observation was 1 run in 5, not reproducible on demand. Verified
  only that the file is untouched by this change (`git diff 26f5deb 09f1771 -- src/studio/assistant/conversation.ts`
  empty — and empty at the later bases too, `5d0de3a` and `88e2e52`).
- **D2's observation stays unattributed.** The belt is located at a word boundary (`so the save has the
  rightcontext.` — run `00-20-23-609Z-qa-live-10-ask-mode-deny`), which is *consistent* with a removed
  block, and the register's hedge stands: no archived provider output distinguishes that from the model
  writing `rightcontext` as one word. What is fixed is the mechanism the app controls — deleting a block
  no longer joins its neighbours. Both tests and the register's own wording are on that reading.
- **D6's live half is observed for the path, not for the tool.** `checkPacketIntegrity` now runs before
  `authorize` and `checkPacketAction` after, on a single code path shared by every gated tool, and
  scenario 22c observed that path reaching its prompt. Observing it specifically for
  `review_takeoff_item` would mean asking a live model to record a professional approval — the one thing
  the product forbids and `checkProfessionalAction` exists to refuse — so it was not attempted. The
  refusal itself is an unchanged pure function with its own test, and the source order is asserted in
  `workPacket.test.ts`.
- **D3's wiring has no behavioural test, and that is not fixable here.** `beginGovernedWork` opens
  IndexedDB first (`workPacketStore.listWorkPackets` → `open()`), which rejects when
  `globalThis.indexedDB` is absent — and there is no IndexedDB shim in this repository, so nothing under
  `node --test` can drive the function. The guard is therefore a source assertion, and a source
  assertion a comment could satisfy is not a test: `discussionOnly.test.ts` now strips comments before
  matching, and proves the stripper works, so the three load-bearing lines (the decision, the early
  return that keeps the requirement from withholding the answer, and the routing brief) must be live
  code. What it still cannot catch is a *behavioural* regression that keeps those three lines and
  defeats them elsewhere. A hand-written
  IndexedDB fake would close that and was rejected: at this size it would be unverified test
  infrastructure proving itself rather than the browser, and the browser path is covered instead by
  accepted run `03-07-12-626Z-qa-defect20-d3`, which drives the real storage stack.
- **The grant scope is per project, not per chat-in-a-project.** `scopeChatGrants` covers the project
  switch. Changing chat *within* a project is already covered by the four existing `resetChatGrants`
  callers — clear, restore, continue-in-new-chat and archive-the-active-chat, and `newChat` in
  `LiveAssistant.tsx:555` routes through `clear`. Grants remain in memory only and never survive a
  reload. Not verified live: the cross-project carry-over was established by source reading and two
  independent review runs — four adversarial verdicts, none refuted (`grant-verdicts.json`) — not by a
  live run in two projects. Those verdicts are copied in verbatim, so their line citations are as their
  authors wrote them, not re-resolved against the tree: the two comment-only corrections since have
  moved `skills.ts` five lines (`isAssistantGatedTool` was `skills.ts:138`, is `:143`), and no check
  re-resolves a citation inside the record.
- **The manual has 6 characters of headroom** against its 12,000-character ceiling. The builder refuses
  rather than truncates: `composeBrief` returns its `errors` when the brief is over the ceiling
  (`build-assistant-context.mjs:149-156`) and `main` prints them and returns 1 (`:228`) — the only
  `throw` in the file is its error re-raise at `:72`. It fails loudly rather than silently, but the next
  edit to any `context/*.md` will need to buy space rather than spend it.
- **The ask-mode instrument finding is a finding, not an explanation.** The store's `pending` reads
  `null` while the permission card is painted in the DOM, and that pairing is recorded in four runs
  rather than inferred: `03-26-10-068Z-qa-defect23b-diag` reads `outcome:"permission-card"` with
  `pending:null`, `denyButton:true` and six rendered rows in one snapshot 12.1 s after the send;
  `03-27-24-335Z-qa-defect22c-d8` logs `storePending:null` beside the card it read; and the two
  ask-mode re-runs at the committed revision — `05-50-05-933Z-qa-recheck-d8-ask` and
  `05-50-35-117Z-qa-recheck-d4` — read the same null beside the same painted card. The card is
  rendered from `usePermissions(state => state.pending)` (`PermissionControls.tsx:15-20`), so the
  obvious reading is that the eval's `import('/src/studio/assistant/permissions.ts')` observes a
  different module instance than the app — but that was not established, and the `permissionsModuleUrls`
  probe that was meant to settle it returned `{"permissionsModuleUrls":[],"count":0}` — an empty list,
  which is inconclusive either way. Scenario 22c therefore reads the DOM, which is what the user reads
  and clicks.
- **Nothing here is a native-app or device claim.** All live work is the browser build on this machine
  (hostname `Daniel`), web server session kept attached per the approved Windows testing arrangement.
  Device scope stays tablet/laptop/desktop.
- **Committed and pushed.** Three commits by concern on `feat/architect-cad-engine`, pushed to `origin`
  (`push.out.txt` records the remote's answer), no PR, and `LATEST-VERIFIED-BUILD.md` untouched. Each
  commit was staged by explicit path. **Commit 1 is not
  verified in isolation**: checking that would need a worktree or a stash of the later two, both of
  which the standing constraints forbid without Daniel naming them, so the claim that each commit is
  independently green rests on reading, not on execution. What *is* executed is the whole suite on the
  final tree, and that `git diff 26f5deb 09f1771` was byte-identical to `code.diff` as the change was committed.
  The working tree carries two further changes the three commits do not — the `skills.ts` docstring the page quotes in §2,
  and a rationale comment in `skills.test.ts` that repeated the same wrong mechanism, both comment-only and both corrected
  after the commits — so that comparison today adds those two comments and nothing else,
  uncommitted and disclosed rather than folded into `code.diff`.

## Process housekeeping

Twenty-eight owned agent-browser sessions — the eight defect runs (`qa-defect20-d3`, `qa-defect21-d8`,
`qa-defect22-d8`, `qa-defect22b-d8`, `qa-defect22c-d8`, `qa-defect22d-d4`, `qa-defect23-diag`,
`qa-defect23b-diag`), the five earlier page-render and verification runs (`qa-report-page`,
`qa-report-page2`, `qa-report-page3`, `qa-report-page3-verify`, `qa-report-page4`), the four
committed-revision re-runs (`qa-recheck-d3`, `qa-recheck-d8-readonly`, `qa-recheck-d8-ask`,
`qa-recheck-d4`) and the eleven renders of this page — the first two on the page as it then stood, the third
whose only failed assertion was the scenario's own, the fourth through tenth each retired when a passage of
the page was corrected after its captures had been taken, and the eleventh carrying the shipped bytes
(`qa-render-final`, `qa-render-final2`, `qa-render-final3`, `qa-render-final4`, `qa-render-final5`,
`qa-render-final6`, `qa-render-final7`, `qa-render-final8`, `qa-render-final9`, `qa-render-final10`,
`qa-render-final11`) — were closed through
`.temp/live-rig/close-campaign-browsers.mjs --apply`, which identity-checks each session by name
(pattern `/^(qa-|look-sweep)/`) before closing it through the rig's own `[["close"]]` opcode. Each close
wrote an ordinary runner report, and each closed session's identity check, exit code and
profile-directory state are in the record's `sessionsClosed` rather than asserted here.
`runner-index.out.txt` indexes closes only for the sessions its own filter matches
(`/qa-(defect|recheck)/`: the twelve close-operation rows in that index), so the page-render and verification closes and the
render closes are ordinary reports in `proof/growth/runner/` alongside every other run, not rows in
that index. Three foreign sessions (`ghl-brief`, `looplet-qa`, `smoke`) were listed and left untouched,
and the user-facing preview on :8080 was not touched.

The script merges each pass into
[`../2026-09-17-assistant-sweep-review/process-table.json`](../2026-09-17-assistant-sweep-review/process-table.json)
rather than starting it fresh: `passes` appends, and `sessionsClosed` keeps every earlier entry except a
session that closes again, whose entry is replaced with the newer one. (The rest of the object is rebuilt
from the script's own template each pass, which is how an earlier amendment to the dev-server block was
lost; that block is now derived at write time, below, so it cannot be.) The table records 51 sessions
across 25 passes, and its last twenty-eight entries are exactly the sessions this work started: the eight defect
runs, the five earlier page-render and verification runs, the four committed-revision re-runs, and the eleven
renders of this page, each closed after a verified identity check and each recorded with `exitCode: 0`.
50 of 50 temporary browser profile directories were gone after close; the single persistent profile is the
deliberate restart-persistence fixture from the sweep.

An audit of this bundle read the sibling record too, and found four passages in it that its own citation
contradicts: two readings of this table left in the present tense after later passes had moved them, and
two statements of the first pass's temporary-directory count as 18 of 18 where the record holds 17 — that
pass closed 18 browsers, and one of them, `qa-live-21-restart-real`, ran against the persistent
`--profile` directory, so the strict predicate never counted it as temporary. Both notes now read this
table at the same figures, and the sibling
[`README.md`](../2026-09-17-assistant-sweep-review/README.md) carries the change as a row in its own
corrections table rather than having it applied quietly. No page passage was touched for it, so the
shipped render still covers the page exactly as it stands.

The recorded outputs are held to the same standard as the checks that write them. Every `.out.txt` in this
directory is re-run by `.temp/live-rig/verify-bundle-final9.mjs` and compared, byte for byte, with what its
script prints today. On the run that closed this round it reported **1 of 8 differ**, and the artifact it
named was `check-page.out.txt`: the copy on disk printed the footer's inventory as it stood before the push's
own record joined this directory — **28 names over 31 files**, the reading the round-8
audit's copy of that output still carries — where the check prints **29 over 32** now, the
thirty-second file being `push.out.txt`, which the footer names. That is this bundle's own first defect class
sitting in its own evidence table: the row above quotes the page's current figures while the file it names as
their carrier was a pass behind, so a reader opening that copy would have found the row contradicted by the
artifact beside it. The check was right and the page was right; only the copy was stale, and `--apply` rewrote
it from the check's own passing stdout — refusing to rewrite anything that exited non-zero, so a failing check
cannot record its failure as the claim — after which the plain re-run reports **0 of 8**. No artifact was added
to this directory for it (every file here must be named in the page's own footer, so a new one would mean
editing the page and invalidating the shipped render), and no page byte was touched.

The completeness critic run over the same audit found one figure in this note that the record had outgrown.
This note's Process housekeeping paragraph still named twenty-seven owned sessions and ten renders, and made
`qa-render-final10` the render carrying the shipped bytes — twenty-seven lines above the paragraph that
already read twenty-eight and eleven, and beside the evidence row that names the shipped report as
`2026-09-17T10-48-35-327Z-qa-render-final11`. The record settles it: 51 closed sessions, the last 28 of them
this work's, eleven of those renders, and the push is what retired the tenth. The paragraph reads the
record's figures now, and the check that carries the same numbers is what holds it there.

**The anchor that check compared against moved with HEAD; this round pinned it, and committed the proof.**
`check-tree-delta.mjs` read `HEAD~3`, which is the right range only while HEAD is the third of the three
commits: the next commit on this branch would move it onto commits that have nothing to do with `code.diff`,
and a check that fails for a reason unrelated to its claim is not evidence — the failure it would have
reported is a property of where HEAD is, not of the working tree it is about. It now takes its range from
the `push.out.txt` beside it, which already records the push as `26f5deb..09f1771`, prints that range, and reads
nothing that moves with HEAD: the range is pinned, and the one line that could have moved — whether the
pinned tip is still in HEAD's history — is monotone, so it prints the same before and after a commit rather
than reporting where HEAD has got to. Every other reading is the one it printed before: 93,178 bytes in
`code.diff` and in the committed diff, the two corrected paths the only ones differing from HEAD, the other
fifteen carrying an identical diff, 21 changed lines with none of them code, +684 bytes over the change's
own paths, and six of six. The recorded `.out.txt` was rewritten by the bundle verifier
(`.temp/live-rig/verify-bundle-final9.mjs --apply`) for the printed labels alone, after which the plain
re-run reports 0 of 8 recorded artifacts differing from a fresh run. No page byte was touched, so
`qa-render-final11` still covers the bytes that shipped.

The untracked evidence under `proof/growth/` is committed as the commit that carries this directory, which
`git log -1 -- proof/growth/2026-09-17-defect-fixes` resolves: the four bundles —
`2026-09-16-live-assistant-rig`, `2026-09-16-remaining-work-plan`, `2026-09-17-assistant-sweep-review` and
`2026-09-17-defect-fixes` — and the 467 session files under `runner/`, so the proof for the three fix commits
is in the repository and not only on this machine. This round's push answer is recorded in
`.temp/live-rig/proof-push.out.txt` rather than in a file here, because a new file in this directory
invalidates the page that names every file in it. The two comment-only corrections in `skills.ts` and
`skills.test.ts` stay deliberately uncommitted, which is what the page's Scope and the paragraph below say:
committing them would make those sentences false, and repairing a page means re-rendering it and re-taking its
captures, so they wait for the round that can. The page's own two `HEAD~3` readings stay true either way: the
one it asks of `conversation.ts` is empty, because that file is not among the change's seventeen paths —
measured at `26f5deb`, `5d0de3a` and `88e2e52` — and the other is dated to the moment of committing, where the
pinned range is its reproducible form. Eight `.tmp-*` scratch files that sat in the repository root are now
under `.temp/live-rig/scratch/`, which is ignored — the reason the root is clean.
The owned dev server on :8085 outlived the sessions only because the re-runs still needed
it. Once they were finished it was stopped through its own identity-checked path —
`.temp/live-rig/server-8085.ps1 -Stop`, which re-reads the executable, command line and creation time
from the live process table and compares them to the ownership record before terminating anything. The
stop left `Stopped owned dev server. Verified processes terminated: 50804. Port 8085 released.` in
`.temp/live-rig/server-8085-cleanup.txt`, and the record carries that log: its `devServer` block is
derived at write time from the ownership record
(`daemonPid`, `daemonCreation`, `daemonCommandLine`) and from that file (`stoppedAt`, `cleanupLog`),
so the record and the log cannot drift apart. The user-facing preview on :8080 was not touched and is
still serving.

## Files

```
code.diff                    the complete change (93,178 bytes)
code.diff.stat.txt           the stat line
full-test.log                the full repository suite, post-change
typecheck.log                npm run typecheck, post-change
rust-test.log                cargo test --lib in src-tauri, post-change
grant-verdicts.json          the four adversarial verdicts on the carry-over, verbatim
probe-tool-keys.mjs/.out.txt D4's executed catalogue probe
probe-effectful-class.mjs/.out.txt  the three tool classes, run against the shipping modules
check-d7.mjs/.out.txt        D7's executed check against the generated brief
tabulate-runs.mjs            the live-run index, read out of the runner reports
runner-index.out.txt         its output, regenerated by that script (it writes no file itself)
push.out.txt                 the push's own record — the remote's answer for the branch, read back
index.html                   the report page (local file — artifact publishing is blocked here)
inline-shots.mjs             inlines the report's screenshots, so the page stands alone
check-page.mjs/.out.txt      static self-check of the report page
check-payloads.mjs/.out.txt  the page's four inlined figures against every PNG under `proof/`
check-housekeeping.mjs/.out.txt  the record's figures, checked against it
check-tree-delta.mjs/.out.txt  the working tree against code.diff, run
report-desktop.png           the page at 1600×1000, top
report-desktop-mid.png       the page at 1600×1000, the register and the fix
report-desktop-evidence.png  the page at 1600×1000, §4's evidence table from its code.diff row down
report-desktop-recheck.png   the page at 1600×1000, the committed-revision re-runs
report-desktop-fixes.png     the page at 1600×1000, the tail: §7 Limits, Scope, footer
report-phone.png             the page at 400×900 (a narrow-viewport reading, not a device claim)
README.md                    this note
```

Artifacts this note cites that live outside this directory:

```
../2026-09-16-live-assistant-rig/scenarios/22d-d4-card-names-destination.json
                             run 4's opcodes: run 3's, with the screenshot path rewritten
../2026-09-16-live-assistant-rig/screenshots/22d-d4-card-names-destination.png
                             run 4's card naming "measure"; the committed-revision re-run wrote this path
                             last, so the file now holds the same reading from that later run
../runner/2026-09-17T05-16-24-468Z-qa-defect22d-d4.scenario.json
                             the runner's own archive of exactly what run 4 consumed
.temp/live-rig/build-22d.mjs the script that derived run 4's opcodes from run 3's
```
