# Project price books and reviewed priced worksheet

Scope: neutral supplier pricing for architecture, engineering, construction, trades and services. No fencing defaults. All sample prices in the QA fixture are invented test inputs, not supplier quotes.

## Integration

- `PriceBookPanel({jobId})` in `src/studio/pricing/PriceBookPanel.tsx` is the project-local UI.
- `priceBookKey(jobId)` identifies its local storage record. It never reads/writes the existing global `xray.price-sheet.v1` rates.
- `priceBookLibrarySchema` and `parsePriceBookLibrary(raw, jobId)` validate the complete library and worksheet for portable project backup integration.
- `readBrowserPriceBooks(jobId)` safely handles inaccessible storage getters, corrupt JSON and wrong project identity.
- `savePriceBooks` uses a Web Lock plus stale-raw/revision checks; quota and unavailable storage errors preserve previous data. Existing revision history cannot be rewritten through this persistence API.

## Implemented behavior

CSV supports explicit comma/semicolon/tab separators, quoted multiline fields, escaped quotes and UTF-8 BOM. Header mapping is user editable. Supplier, currency, tax basis, effective date and source reference are reviewed before save. Original file SHA-256, filename, byte count, physical source line and chosen mapping persist with each immutable revision. Blank rates, negative/nonfinite prices, ambiguous numeric formatting, duplicate stock codes, malformed rows and invalid dates block import. Rates and quantities support six decimal places; limits are stated in the interface.

Named books can be renamed, archived and restored. Imports can append a new revision without replacing earlier rates. Revision CSV export carries provenance and protects spreadsheet formula cells. A saved rate can be explicitly selected and applied to a manually entered quantity in its stated unit. The priced worksheet retains its exact book revision and source line. Later imports flag older applied rates without silently repricing them. Removing a priced line requires expanding its removal review and confirming.

Line amounts use BigInt fixed-decimal intermediates and half-up rounding at the explicitly selected 0–4 decimal amount precision. Subtotals sum rounded line amounts and remain separated by currency, tax basis, tax percentage and precision. Worksheet CSV export retains calculation inputs and provenance. No currency/unit conversions, tax additions, inferred takeoff quantities, freight, waste or markup are performed. Existing takeoff/quote fields are not mutated.

## Verification

`node --experimental-strip-types --test src/studio/pricing/priceBooks.test.ts`: 10/10 passing; see `tests.log`.

Focused tests cover parsing/physical provenance, invalid input, metadata, immutable revision history, stale applied rates, exact decimal rounding including large values, job-scoped/stale writes, corrupt/quota-failed persistence, formula-safe exports and separate subtotals.

Browser proof is recorded separately in this directory as executed. No capability is marked visually verified merely from these unit tests.

## Limits

This is a local project pricing worksheet, not a procurement order, shared live catalogue, automatic takeoff binding or final quote. Source CSV bytes are not stored inside the library; their hash and source references are. Firecrawl/live supplier discovery, expiry rules, workbook/XLSX input, supplier variants/quantity breaks, price comparison, approval routing and automatic reconciliation are future slices.

The UI writes up to 100 books, 50 revisions per book, 5,000 rows per import and 25,000 rate records total within a 4 MB serialized-library limit. Storage quota can be lower depending on other local application records, and failures remain visible.
