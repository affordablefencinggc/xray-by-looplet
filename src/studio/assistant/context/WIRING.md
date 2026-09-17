# Wiring the context brief

This folder is a build input. Nothing here reaches the model until the steps below are done, and
each step carries a constraint that has already broken once in review.

## The brief is added to the manual, never substituted for it

`ASSISTANT_OPERATING_MANUAL` in `src/studio/assistant/skills.ts` carries 21 safety clauses: tool-only
capability, read-before-edit, the millimetre and stable-ID rules, the no-claim-without-a-receipt rule,
the untrusted-evidence rule, the calibration and evidence-separation rules, and the research rules.
Executed check: 20 of those 21 clauses do not appear in the composed brief. Setting
`ASSISTANT_OPERATING_MANUAL = ASSISTANT_CONTEXT_BRIEF` therefore deletes the shipped safety manual.

The composition is an append:

    export const ASSISTANT_OPERATING_MANUAL = `${SAFETY_MANUAL} ${ASSISTANT_CONTEXT_BRIEF}`;

The native copy composes the same two parts in the same order, and the parity test compares the
composed results rather than a source literal.

## Order is fixed

README, app-atlas, skills-atlas, budgets, user. The guardrails come first so that a truncation at any
length keeps the safety rules and loses only the reference material.

## Normalisation must agree across languages

`normaliseManualMarkdown` collapses every run of ASCII whitespace to one space and drops empty lines.
It does not merely trim line edges: `user.md` writes empty table cells as `| Name |  |  |`, a genuine
mid-line double space, and edge-trimming alone leaves the two languages disagreeing. The Rust side
uses `split_ascii_whitespace()` so the two agree by construction rather than by coincidence.

## The generated file is not edited

`contextManual.gen.ts` is written by `scripts/build-assistant-context.mjs`. Edit the Markdown and
re-run the script. `.prettierignore` covers both this folder and the generated module, and
`.gitattributes` pins LF endings, because `prettier --write .` reflows Markdown tables and a CRLF
checkout changes what the normaliser sees; either would break byte parity silently.

## Cost is published, not hidden

The composed brief is 11,994 characters, roughly 2,999 tokens, charged on every round of every send
on both platforms. `measureContext` counts neither the system instruction nor the tool declarations,
so the panel's context meter under-reports by that amount.

`node scripts/build-assistant-context.mjs` prints both figures on every run, and
`system_instruction_appends_the_brief_to_the_safety_manual` in `src-tauri/src/assistant_ai.rs` pins
them, so a figure written here that contradicts either is stale by definition.
