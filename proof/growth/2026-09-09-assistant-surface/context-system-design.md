# Assistant context system — architecture decision (SC-22)

Chosen after a 20-agent workflow (`wf_c298dccd-d7b`): five parallel readers mapped the constraints, three architectures were written from different angles (static-first, runtime-tool, compaction-first), and twelve judges scored each on correctness, token economy, usefulness and buildability. **No proposal won.** Scores clustered at 4.0–6.5 out of 10 and every one was falsified on a load-bearing claim. The design below is the synthesis the judges' salvage lists converge on.

## What the judges proved (and it changed the design)

| Finding | Consequence |
|---|---|
| `contents.length > 38` is checked at the top of **every round**, and each round adds 2 entries (`conversation.ts:23`, `:28`, `:72`) | Compaction must reduce **entry count**, not tokens. A token-based trigger does nothing. |
| The system instruction is injected **out of band** (`src/lib/assistantAi.server.ts:58`, `src-tauri/src/assistant_ai.rs:283`) and is never in `contents` | Static text there costs nothing against the 38-entry cap and is not counted by `measureContext` — but it is re-sent on all 8 rounds, so it must stay small. |
| `contents` is passed whole to `turn()` **inside** the round loop (`conversation.ts:24`) | Anything placed in `contents` is re-sent up to 8 times per send. A digest there is 8× more expensive than it looks. |
| The `full` gate throws at `useAssistantChat.ts:37` **before** any compaction could run | A compactor placed after that gate is dead exactly when needed. It must run before the check. |
| `checkpoint` writes `structuredClone(history)` back (`useAssistantChat.ts:55`) | A digest living inside `contents` nests into itself and grows without bound. |
| "Last 3 user messages verbatim" is unbounded: 3 × (1 + 16) = 51 entries at 8 rounds each | Must be `min(3 user messages, entry budget)`, never `max()` of two retention rules. |
| Dropping a `functionResponse` removes its id from the replay guard seeded at `conversation.ts:15-19`, re-enabling a duplicate mutation `:53` would block | Executed call ids must be carried forward as **structured data**, never parsed back out of prose. |
| Runtime-only atlases are **probabilistic** — they reach the model only if it chooses to call for them, and each call burns one of 8 rounds | The atlases must be injected, not fetched. |
| `measureContext` counts neither the system instruction nor the declarations (~7,867 tokens measured) | The meter under-reports; the fixed cost must be published rather than hidden. |

## The design

**Two channels, split the way the code already splits them.**

1. **Static → system instruction (out of band).** The guardrails, the router, the app atlas, the skills atlas and the budgets are human-authored Markdown, composed at build time into the existing manual string. Native and web stay byte-identical and the parity test still guards them. Cost is fixed and published, not hidden.
2. **Dynamic → one pinned pair at `contents[0]`, upserted in place.** The KYC block and the last ~30 lines of the rolling log live in a single user/model pair rewritten on every send — constant 2 entries against the 38-cap forever, idempotent, and it preserves the "array ends with role user" invariant.

**The compactor** runs in `send()` before the `full` gate, triggers on entry count above ~18 (short chats pay nothing), and obeys, in order:
1. Never compact past the last checkpoint (the "Not executed" batch is the only record of what actually landed).
2. Evict **images first**, part-wise, replacing `inlineData` with a text marker.
3. Cut only at entries where `role === 'user'` **and** a part has text — tool receipts are user-role entries made only of `functionResponse` parts, so this keeps call/response pairs together.
4. Keep `min(3 user messages, 30 entries)`.
5. Carry executed `functionResponse` ids forward as structured data to re-seed the replay guard.
6. Verify its own output (no orphaned response, no dangling call, ends on role user) and **fall back to not compacting** if the postcondition fails.
7. Return a **new array**, because `update()` re-measures only on array identity change.

**The log** lives in a new IndexedDB database, not the job record (every save re-serialises and CAS-compares the whole record) and not localStorage (one shared ~5 MB origin budget already under pressure). Entries are append-only with a `evidence: 'stated' | 'tool-receipt' | 'inferred'` field, so compression can never launder an inferred number into a verified one. Topic slugs are derived from `isStateChangingTool`, so the index is greppable and stable rather than model-invented.

**KYC** is filled only from explicit user statements, in the user's own words, with a date — model-proposed changes arrive as an Accept/Discard diff, never a silent rewrite, and never a wholesale document replacement.

## Folder shape (the owner's constraint: squeaky clean, depth 2, one hop)

    src/studio/assistant/context/
      README.md          guardrails, purpose, goal loop, clear-context rule, routing table
      app-atlas.md       intent -> pane -> tool -> preconditions
      skills-atlas.md    skills by category, traps, references
      budgets.md         8 rounds, 24 tools, 38 entries, output cap
      user.md            KYC template

Runtime data (the rolling log, the index, cached references) lives in IndexedDB, not in folders. Nothing nests deeper than one level; categories are headings inside a file, never sub-folders.

## How the Markdown reaches the model (proven by execution, not assumed)

- **`?raw` and `import ... with { type: 'text' }` are both unusable.** Executed under Node v24.20.0 with `--experimental-strip-types`, each throws `ERR_UNKNOWN_FILE_EXTENSION` for `.md`. Five modules import `skills.ts` under bare Node (`contextBudget.ts:3`, `permissions.ts:2`, `skills.test.ts:4`, `wireframe.test.ts:8`, `workbenchTools.test.ts:9`), so a `?raw` import would typecheck and bundle yet break four unrelated suites the moment `skills.ts` pulled it in.
- **Web: code generation.** A build script composes the Markdown into a generated TypeScript constant that `skills.ts` re-exports. This is the only mechanism that works in both Vite and bare Node.
- **Native: `include_str!`.** Already an established pattern in this crate (`src-tauri/src/material_ai.rs:54,59`), so no new dependency and no `build.rs` logic. A prototype confirmed byte-exact output: Markdown 2,646 chars in, joined string 2,646 chars out.
- **The parity test must be rewritten.** Its regex `/const SYSTEM_INSTRUCTION: &str = (".*");/` (`skills.test.ts:11`) matches none of `include_str!`, `concat!` or a raw string. It fails loudly rather than silently, which is the safe direction, but it has to be updated in the same commit and must assert that the JS and Rust normalisers produce byte-identical output.
- **The manual is ASCII-only** (2,646 chars, zero non-ASCII), so no encoding hazards in any transport. Its one literal triple-backtick sequence must never start a line in a Markdown source, or it opens a code fence.

## Sequencing

1. ~~Add `skills.test.ts` to `npm test`~~ — **already done this session** (11 suites were missing; the full suite now runs 816 tests, 0 failures). Three proposals built their plan on this being absent; that premise is now stale.
2. `.gitattributes` (`*.md text eol=lf`) and `.prettierignore` for the context folder, so a CRLF checkout or `npm run format` cannot break byte parity.
3. The build step that composes the Markdown into the manual, plus a ceiling test on the compiled length.
4. The compactor with its postcondition test.
5. The log store, index and pinned-pair upsert.
6. The KYC card.

## Honest costs

- The system instruction grows from ~662 tokens to roughly 1,600, charged on all 8 rounds of every send, on both platforms.
- The pinned block adds up to ~1,000 tokens inside `contents`, also re-sent per round.
- The context meter does not count either, so it under-reports; the panel should say so rather than imply the number is complete.
