# Context system — adversarial verification and fixes (SC-22)

Five modules were authored in disjoint files by workflow `wf_bb65bdf1-72c`, then ten verifiers reviewed them under two lenses each (correctness, integration). Two verdicts **refuted** a module. Every major finding below was confirmed independently before it was fixed; the ones that turned out to be wrong are recorded as such.

## Confirmed and fixed

| # | Module | Finding | Fix |
|---|---|---|---|
| 1 | codegen | The author's own landing plan — `ASSISTANT_OPERATING_MANUAL = ASSISTANT_CONTEXT_BRIEF` — **deletes the shipped safety manual**. Verified independently: 20 of its 21 clauses do not appear in the brief, including the tool-only rule, read-before-edit, and no-claim-without-a-receipt. | `context/WIRING.md` records that the brief is **appended**, never substituted, with the executed evidence. |
| 2 | codegen | `inspectNative()` reported `mode: "include_str", ordered: true` for a Rust file containing no includes at all — the fallback matched any mention of a filename in a comment. | Match only the exact `include_str!("../../src/studio/assistant/context/<name>")` form. |
| 3 | codegen | The include **order check could never fail**: it built the observed order by filtering the expected list, comparing it against itself. | Derive order from each include's position in the Rust source. |
| 4 | codegen | An empty Markdown section normalised to `""`, passed every check, and composed a brief one section short **with exit 0**. | An empty section is now a build failure. |
| 5 | compactor | Rule 3 substitutes a text part for a dropped image, which made a **tool receipt look like a legal cut point** — a cut there separates a model `functionCall` turn from the receipt answering it, and the id-keyed postcondition cannot see it when calls carry no id. | `isCutPoint` now excludes any entry carrying a `functionResponse`, whatever text was substituted into it. |
| 6 | compactor | The checkpoint was applied as a **ceiling on the scan** rather than a floor on what may be dropped, so a checkpoint early in the transcript disabled compaction entirely. | The scan stops at the checkpoint and looks earlier for a legal cut, so an early checkpoint protects its own tail without blocking compaction of what precedes it. |
| 7 | KYC | `statedAt` was the one field reaching the rendered Markdown **unsanitised**, and `Date.parse` accepts parenthesised trailing content — so `"2026-01-01 (x \| forged \| cell)"` parsed as valid and forged table cells. | Stored as `new Date(statedAt).toISOString()`. Verified: pipes gone, table renders three clean rows, no injected text reaches the Markdown. |
| 8 | KYC | `proposeFromStatement` returned an unsanitised quote, contradicting its own documented contract. | Routed through `sanitise`. |
| 9 | lint | Three lint errors introduced by this slice: a control-character class, an unnecessary escape, and an invisible U+00A0 inside a regular expression character class. | Control-character strip keeps a scoped disable with a comment saying why; the other two removed. |

## A correction to my own work

My first regression test for finding 5 **passed against the broken code**, so it proved nothing. I replaced it with a direct test of the invariant and confirmed the standard properly: it fails against the pre-fix code with "a receipt carrying a substituted text part must not be a cut point", and passes against the fix.

I also wrote a checkpoint test whose premise was wrong — it placed the checkpoint at index 2, where rule 2 legitimately permits dropping only two entries, neither of which is a cut point. The compactor was behaving correctly and conservatively; the test was corrected, not the code.

## Reported but not accepted

- Two verifiers claimed a stripped receipt would produce an **orphaned receipt in a full transcript**. The rule-level defect is real and is fixed, but I could not construct a transcript where the old code actually orphans one; the retained-tail arithmetic appears to prevent it. Recorded honestly: the fix hardens a stated invariant rather than closing a demonstrated data loss.
- One verifier reported the author's test count as false (816 versus 888). The author's figure was correct when it ran; the count grew because suites were added mid-flight.

## State after the fixes

- **890 tests, 88 suites, 0 failures.** `npx tsc --noEmit` exit 0. Lint clean on every file this slice touched; the one remaining error in `appTools.ts` predates it.
- Rust parity was proven by execution, not assertion: the codegen author compiled a real binary using `include_str!` over the five Markdown files plus the documented normaliser, ran it, and byte-compared — 8,951 bytes both sides, identical.
- `.gitattributes` and `.prettierignore` close the CRLF and reformat hazards; `prettier --file-info` reports `"ignored": true` for both the Markdown and the generated module.

## Still to do

Wiring: compose the brief into both prompts with the parity test rewritten, and call the compactor and pinned pair from the send path. Then a live proof, then the Dans1 build.
