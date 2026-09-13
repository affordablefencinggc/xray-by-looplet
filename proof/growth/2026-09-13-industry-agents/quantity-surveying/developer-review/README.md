# Developer review instruction correction

Root-delegated ownership: `developerMode.ts`, its test, `context/app-atlas.md`, and generated `contextManual.gen.ts` only. No approval or professional-authority gate was changed.

The instruction now judges the actual current user-visible response against the current request, distinguishing it from hidden candidate answers, prior packets and prior receipts. It distinguishes automatically supplied context from current-turn executed tool receipts. Static `read_workbench_structure` is not project-state readback. Reviewer/decision-owner names cannot confer verified authority or unblock controlled review. Recording-only reviews retain their explicit exemption from unrelated fresh reads, and self-review remains under 70 words with no extra tool calls solely for review.

## DANS1 evidence

- Five `developerMode.test.ts` tests pass, zero failures (`tests.txt`). These validate prompt-contract boundaries, not stochastic model compliance.
- Generator and `--check` both pass in the DANS1 dependency snapshot. All five sections normalise identically under the transcribed Rust algorithm, and native include order is checked. No Rust execution or native build occurred.
- Eleven local/remote SHA-256 hashes match, covering the edited files, generated output and every generator input, including the unmodified `assistant_ai.rs` dependency.
- `git diff --check` over the four owned files is clean. Exact diff: `changes.patch`.

Initial generator failures are retained: expanded wording exceeded the existing 12000-character ceiling, then the snapshot lacked its native read-only source input. Wording was condensed without changing the ceiling, and the unmodified dependency was staged. Final brief is 11991 characters; the existing informational 1600-token target warning remains (~2998 estimated tokens). Root owns any broader context budget work.

Live provider compliance retest is pending root sequencing; no provider message, reload or browser action was performed by this edit task. Full application typecheck remains root-owned. No background process launched.
