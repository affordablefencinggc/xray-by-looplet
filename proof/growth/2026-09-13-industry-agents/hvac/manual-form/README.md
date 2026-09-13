# HVAC controlled manual draft form

Files: HvacDraftPanel.tsx, ductForm.ts and ductForm.test.ts in src/studio/industries/hvac. Panel consumes the shared controlled value/onChange/disabled contract and has no project-store access or storage. Root owns host, persistence and CSS integration.

Starts with zero sections and empty measurement/reference fields. Add multiple rectangular or round straight sections; every used operand requires an explicit value and reference. Optional sheet mass is kg/m² (not volumetric density); no gauge/material defaults. Hidden shape fields and unchecked mass fields do not enter the calculation. Draft conversion invokes the existing straight-duct helper and retains its exclusions and quote-ineligible status. Editing clears calculated output; externally changed values invalidate the stored calculation key immediately. Semantic labelled fields, fieldsets, result table and live/error announcements use only shared classes.

DANS1: 16/16 focused form+domain tests passed; scoped TypeScript exit 0. Recorded logs are tests.txt/typecheck.txt. Tests cover empty input, explicit 16 m²/64 kg fixture, round-shape conversion, omitted optional mass, mixed missing mass totals, malformed/nonpositive/nonfinite values, missing references, duplicate names, strict schema, JSON round-trip and input immutability.

Browser integration is deliberately pending root freeze. No UI execution, persistence or whole-industry readiness claimed from these checks. Next proof must enter actual fields, calculate, change an input and confirm stale output disappears, switch project/reload and verify independent drafts.
