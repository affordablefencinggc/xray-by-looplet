# Controlled roofing draft form

After pushed checkpointe7c0c4d, root delegated `RoofingDraftPanel.tsx`, `roofForm.ts` and `roofForm.test.ts` in the roofing industry folder. Root owns host, project-scoped persistence, styles and Studio integration.

Exports: `roofFormSchema`, `createEmptyRoofForm`, type `RoofForm`, `RoofingDraftPanel`. Controlled props use the shared `IndustryDraftPanelProps<RoofForm>`. Blank initial numeric/reference/name fields; no invented measurements or example prefill. Users can add/remove multiple planes and openings, enter horizontal areas and each plane's pitch/reference, then explicitly calculate.

Conversion rejects empty/whitespace, hex, unit text, commas and non-finite values instead of coercing them. Existing roofAreaInputSchema validates domain ranges, identities, references and total opening deductions. The actual existing calculateDraftRoofArea performs all arithmetic. No math/readiness contracts changed.

Every input/add/remove action clears calculated state. Results are derived from current form input only and shown as a semantic per-plane gross/opening/net table with totals, draft/quote-ineligible notice and retained helper limitations. Labels, fieldsets and buttons are native accessible controls; shared classes only, no own CSS. No project reads/writes or assistant tool calls inside the panel. Root stores the JSON-serializable strings/arrays/calculated flag.

DANS1 tests:4pass,0fail (`roofForm-tests.txt`): empty form and roundtrip, analytic QA100/5/95, mixed-pitch two-plane totals and invalidation, coercion traps/domain failures. Scoped TypeScript including React panel exits0 (`roofForm-typecheck.txt`). Tests/TS executed in owned remote roofing/adapter directory with existing dependencies; no installs or background processes. `roofForm.patch` is the exact new-file diff.

Not yet integrated or browser-verified: root must mount the controlled host and verify entry, result invalidation, multiple plane/opening actions, disabled state, project switch and reload persistence after source freeze. No whole-industry acceptance or source-backed takeoff claim.
