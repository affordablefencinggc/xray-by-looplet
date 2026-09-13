# Choice-pill parser fix from actual roofing QA

Root explicitly delegated `src/studio/assistant/richReply.ts` and `richReply.test.ts` to this worker after the recorded live test. No other shared files changed.

The parser previously collected every marked list and enabled them all if any response line matched a choice cue. The live roofing report consequently offered prerequisite statements and names of already-executed tools as eight clickable replies.

The fix associates selection cues with each immediately adjacent list. Explicit report headings (blockers, observations, executed actions, receipts) remain reports even with an adjacent choice question. A following question must start with selection language; a rhetorical next heading or descriptive sentence mentioning “select” cannot activate the preceding facts. Real adjacent numbered, lettered and bullet choices retain deduplication, clipping and the eight-option limit. Developer reviews remain excluded.

The final assistant response in the saved DANS1 roofing conversation is embedded verbatim as a regression fixture in the test, decoded as UTF-8. It now produces zero option pills. Additional tests cover unrelated later questions, report headings, mixed report/choice lists, immediately preceding/following cues and intervening headings. All original tests pass.

Test execution: DANS1 only, foreground raw Node test runner, 16 tests passed, zero failed. Command:
`C:/Users/danie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe --experimental-strip-types --test C:/Users/danie/XRayBuilds/industry-visible-20260913/roofing/parser/richReply.test.ts`

`richReply-tests.txt` is the final output. The initial two failed attempts are preserved: they exposed following rhetorical questions and later descriptive “select” mentions respectively. `richReply.patch` is the exact scoped diff. Local/remote SHA-256 files establish transferred source equality. Scoped `git diff --check` passed. Root owns aggregate TypeScript checks and integration.

No browser reload, model request, UI click or source-backed takeoff was performed during this parser fix. Live visual confirmation remains pending root's provider concurrency fix. Parsing remains a conservative text heuristic: intervening prose/headings prevent options, and ordinary question extraction/fallback suggestion behavior is unchanged. No browser/window/tunnel was started or stopped; foreground tests completed.
