# Roofing assistant adapter

2026-09-13, IND-29 T-1. Files: `src/studio/industries/roofing/assistantTool.ts` and `assistantTool.test.ts`.

Exports `name = calculate_draft_roof_area`, `description`, `inputSchema` and synchronous `execute(input)`. Schema comes from `z.toJSONSchema(roofAreaInputSchema)`, using installed Zod4.5.4. Runtime execution delegates to the helper, so cross-field refinements additionally enforce IDs/deductions. No project lookup or mutation; root's wrapper must strip/validate its own expectedJobId before calling this strict domain boundary.

On DANS1, the actual adapter was called with explicitly named `qa-roof-3-4-5` fixture: horizontal gross80m², atan(3/4) pitch, horizontal opening4m² and references explicitly labelled QA/user fixture rather than source measurement. Computed gross100m², opening5m², net95m². The output stays draft-calculation with verifiedQuoteEligible:false and retains supplied source-reference strings, which are not source/calibration verification.

Three adapter tests passed (`adapter-tests.txt`). Scoped TypeScript check exited0 (`adapter-typecheck.txt`, no diagnostics). Initial test-only schema narrowing error is preserved in `adapter-initial-typecheck.txt`; it was fixed before the final checks. Runtime tests and typecheck ran only on DANS1 under `C:/Users/danie/XRayBuilds/industry-visible-20260913/roofing/adapter/`, with an owned node_modules junction to the existing concurrency-source dependencies. No dependency install, background process, browser reload or model request was performed.

Exact source diff is `adapter.patch`. App integration and visible assistant execution remain root-owned and pending; no whole-roofing-workflow completion is claimed.
