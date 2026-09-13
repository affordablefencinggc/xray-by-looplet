# QS draft classification assistant adapter

Owned source changes: export `classificationInputSchema` from `classification.ts`; add `assistantTool.ts` and `assistantTool.test.ts`. No shared registry, provider, permission, UI or store file was edited.

The adapter exports `name`, `description`, `inputSchema` and `execute`. Tool name is `classify_draft_quantities`. JSON schema is generated from the actual strict Zod boundary in input mode, preserving ordinary decimal-string inputs before lossless normalisation. Execution validates unknown input then delegates to the existing pure helper. Results remain `draft-classification` and `verifiedQuoteEligible: false`; user-supplied sources, units and evidence classes remain explicit. No rates, currency, project writes or approvals are accepted.

## DANS1 checks

- Existing domain plus adapter: **15 tests passed, 0 failed**.
- Scoped strict TypeScript check for adapter/test: **exit 0**.
- All four source/test SHA-256 hashes match the staged DANS1 inputs.
- Exact source diff in `changes.patch`; command output in `tests.txt` and `typecheck.txt`.

The tests exercise 0.10 + 0.20 = 0.3, direct and ancestor totals, mixed units/evidence, unclassified residue, complete-but-quote-ineligible output, preserved references, immutable inputs, malformed/extra fields, duplicate assignments and cycles. Fixtures are synthetic. These are deterministic adapter tests, not a model execution claim.

Root integration boundary: bind `expectedJobId` in the AppTool wrapper, remove that wrapper field before invoking this strict adapter, register read-only permission, and capture a live tool receipt. Do not save classification results or treat complete classification as a verified cost plan. No provider requests, browser changes or background processes were performed for this slice.
