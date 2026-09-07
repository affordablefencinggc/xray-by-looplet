# E-01 / E-02 workbook import slice

Authorized: user requested `/fast-test /ledger` growth wave; parent assigned E-01/E-02.
Branch: `feat/architect-cad-engine`. Scope: `src/studio/pricing/*` and this growth proof/screenshot directory only. Root owns package files, shared integration, root ledgers and remote build gates.

Exact catalogue requirements:
- E-01: Pricing workbook import — XLSX/CSV sheets preview without executing spreadsheet formulas.
- E-02: Column and worksheet mapping — SKU, description, unit and rate map with row-level errors.

- [x] BEFORE: existing CSV-only UI captured and visually inspected (`before.log`, `before-csv-only.png`).
- [x] SC-01: bounded XLSX decoder and selected worksheet/header row adapter; formula cells never evaluated or accepted as cached prices. Evidence: `implementation.diff`, `tests-final.log`, `formula-error-detail.png`.
- [x] SC-02: worksheet/header/column review UI with immutable source provenance and backward-compatible existing CSV revisions. Evidence: `workbook-flow.log`, `malformed-csv-mobile.log`, `worksheet-mapping-detail.png`.
- [x] SC-03: meaningful parser/formula/malformed/revision tests and actual browser XLSX/CSV/formula/reload flows, desktop/mobile screenshots inspected. Evidence: `completion.md`, `tests-final.log`, `detail-proof.log`, `workbook-mobile-mapping-final.png`.
- [ ] Root gates: integration/typecheck/remote production/native verification.

Limits and external dependencies will be recorded explicitly. No full local builds, no user installed profile, no CRM changes, no historical proof edits.
