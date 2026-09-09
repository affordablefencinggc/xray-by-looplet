# Assistant task history — 2026-09-10

Added a vertically divided square history control at the right of the work-packet bar. Project-scoped local work packets display topic, date and recorded provider tokens; topics expand to objective and next action. Old records explicitly show Not recorded. History is scrollable and does not change the active project or execute tools.

Usage: optional provider totalTokenCount preserved in the web response contract and aggregated into durable packet records. Missing response counts are tracked; partially recorded totals labelled partial. Native response mapping updated but native build not run. Counts cover recorded successful responses, not a billing reconciliation.

Validation: 22 focused Node tests pass (mock provider only), TypeScript exit 0, scoped ESLint exit 0, scoped git diff --check exit 0. Initial tsx invocation unavailable; reran successfully with Node's native TypeScript support. Whole-tree diff check has unrelated pre-existing whitespace errors.

Live Edge: saved Crown Wharf history displayed two topics with dates and Not recorded token labels. Expanded FINISH IT; no horizontal overflow. Screenshot visually inspected. Generic min-width found and overridden for 28px square. No Gemini prompts submitted; no project geometry changed. No task-owned services launched.

Final live check: 28 x 28px history control verified by rendered bounds; two saved topics visible. Escape closes only history and focus remains on Task history (fixed event propagation after initial check also collapsed assistant). Reopened history and visually inspected final screenshot. Left history open for the user. Saved project restoration completed after refresh.
