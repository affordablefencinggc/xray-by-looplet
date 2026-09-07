# E-01 / E-02 executed proof

Pricing source frozen 2026-09-07. This slice adds XLSX worksheet selection and CSV/XLSX header-row plus field mapping. Reviewed imports remain immutable named price-book revisions with supplier, currency, unit, tax basis, effective date, source reference and SHA-256 provenance. No existing takeoff rate is changed.

## Checks

- `tests-final.log`: 18/18 pricing tests passed, including real workbook sheets, physical source rows, array/shared formulas and cached values, unmapped formula notes, padded SKUs, raw numeric prices, merged/date cells, malformed/CRC/macro/oversized archives, old CSV snapshots and immutable applied revisions.
- `typecheck-final.log`: `npm.cmd run typecheck` passed after final source edits. The PowerShell npm.ps1 alias was blocked by execution policy; invoking npm.cmd resolved that environment issue.
- `workbook-flow.log`: actual isolated browser selected Formula rates and refused its cached formula price; selected Civil and electrical/header 3, mapped four fields, reviewed/saved two prices, then really reloaded. Saved project identity and original applied revision remained unchanged.
- `malformed-csv-mobile.log`: truncated workbook produced a visible error and left the exact saved library unchanged. CSV headings at row 3 imported a reviewed price from row 4. Mobile controls meet 44px and the page has no horizontal overflow.
- `detail-proof.log`: final mobile rates remain on one line; formula error and disabled review confirmed; three fixture books and original worksheet revision 1 preserved. Last executed batch took 0.87 seconds in the existing hot session.
- BEFORE screenshot and source snapshots are retained. `implementation.diff` compares this wave against those snapshots, including added parser/worker modules.

## Screenshots inspected

All in `screenshots/growth/2026-09-07-pricing/`:

- `before-csv-only.png`: previous interface.
- `worksheet-mapping-detail.png`: actual worksheet rows, physical row numbers, four mappings, valid prices and review action.
- `formula-error-detail.png`: cell D2 formula error, no saved rates, disabled review action.
- `workbook-review.png`: explicit review before saving with source worksheet/header and commercial metadata.
- `malformed-preserves-library.png`: readable archive error with existing library still present.
- `workbook-mobile-top.png`: touch-sized import and worksheet controls.
- `workbook-mobile-mapping-final.png`: readable full amounts, unit values and review action clear of the assistant.

Earlier mapping/formula screenshots captured the top of the long form. The `*-detail.png` captures supply the actual visual evidence for those controls. Initial fixture/test and HMR/mapping failures are preserved in `tests-initial.log`, `open-workbook-initial.log`, `workbook-flow-initial.log` and `diagnose.log`. A manually selected mapping was being reset by a table-derived effect; changing source controls explicitly reset mapping, resolving the observed defect. A later document HMR reload returned the tab to Sheets; detail proof reopened Cost and reselected the fixture without resaving it.

## Backward-compatible storage contract

Existing library schema and key remain v1. Source adds optional `kind`, `worksheet`, `headerRow`; `delimiter` is optional only for XLSX, where worksheet and header row are required. Old CSV revisions with no kind/header still parse unchanged. New CSV has kind csv, separator and header row; XLSX has kind xlsx, sheet name and header row. Backup uses the same validator; root owns production backup/restore verification. Original workbook/CSV bytes are not embedded in the price library or its portable backup. SHA-256, filename, size, selected headers/mappings and physical source rows are retained. Formula expressions and cached formula results are not copied into reviewed rates.

## Supported bounds and honest limits

CSV/TSV and XLSX only, maximum 2 MiB source, 20 MiB expanded archive, 2,000 ZIP entries, 50 sheets, 5,100 source rows and 40 columns per selectable sheet, header rows 1–100 and at most 5,000 imported rates. Encrypted, macro, split/ZIP64, corrupt, merged mapped cells, date/error/boolean mapped cells and formula mapped cells are refused. Formula notes outside mapped columns may remain in the workbook, but no formula value is used. No XLS/XLSM support, spreadsheet formula execution, inferred quantities, price fetching, currency conversion or unit conversion is claimed. The worker has cancellation and a 20-second deadline; timeout/cancel UI paths are implemented but were not artificially forced in this browser proof.

Fixture rates are invented test data, not current supplier prices. Workbook fixture SHA-256 is `c950510911d6f27407841922a4ae7bd531162fe6e92f08983a4555e827f02244`.

Root owns final production/native gates. `portable-candidate.json` is an adaptable real UI scenario for those gates; it imports CSV then XLSX, checks formula refusal, real reload, exact provenance and preservation of preexisting books/worksheet. Root supplies target URL/session and distinct screenshot prefix. Dev session `xray-pricing-wave2` is released with three fixture books and the original single applied line retained. No normal installed-app profile, CRM code or local full build was used.
