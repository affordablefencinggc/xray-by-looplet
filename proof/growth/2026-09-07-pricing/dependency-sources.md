# Workbook parser decision

Checked official sources on 2026-09-07. Root approved and installed exact SheetJS CE 0.20.3 from the official tarball and fflate 0.8.3 with install scripts disabled. This agent did not change package files.

- [SheetJS installation](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/) identifies the official 0.20.3 tarball and explains the older public npm package. Dependency: `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`.
- [SheetJS formula cells](https://docs.sheetjs.com/docs/csf/features/formulae/) documents `f` and array `F` formula metadata. The importer rejects mapped formula cells, including cached results. It never passes expressions to a calculation engine.
- [SheetJS parse options](https://docs.sheetjs.com/docs/api/parse-options/) supports the bounded sheet-row and explicit cell/formula options used here.
- [fflate official repository](https://github.com/101arrowz/fflate) documents streaming Unzip. The application additionally validates the ZIP directory, declared and actual sizes, CRCs and entry counts before passing verified content to SheetJS.

The heavy parser runs in a dedicated module worker. This avoids loading the parser into the ordinary Cost pane and provides cancellation/termination. Numeric display text is retained for identifiers such as padded SKUs; mapped rates use the original numeric value without currency or unit conversion.
