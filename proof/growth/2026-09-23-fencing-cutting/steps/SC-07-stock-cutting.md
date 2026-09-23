# SC-07 — level rail/post cutting and purchase mapping

Requirement: reviewed stock lengths, kerf, reusable offcuts, finished rail/post lengths and priced purchase quantities. [Exact source/test diff](../source.diff), [final source identities](../source-hashes-05.json).

The saved rule binds to a recipe revision and component. Rail cuts use actual full/terminal/equal bay lengths and declared adjustment; posts need an explicit finished length. Different components never share stock. Invalid, stale or unsupported rules withhold the estimate. The best-fit heuristic is labelled as such, without an optimality claim. Purchase lines replace separate charges for their raw cut/linear quantities. The common roofing geometry handles exact stock-end cuts without inventing a trailing full kerf.

Executed on DANS1: [1,964 source tests](../fencing-checks-04/source-tests.log), [typecheck/lint](../fencing-checks-04/result.json), [157/157 browser operations](../v1-stock-dev05/browser-results.json). The 5 m level fixture produces six rail cuts in five 2.4 m lengths: 10 m cuts, 0.010 m kerf, 1.990 m reusable offcut. Two 2.4 m end posts remain separate. Tests cover exact fit, adjustments, invalid inputs, unsupported slope/overrides, recipe changes, rebuilt quantities and removal of duplicate raw-material charges. [Actual CSV and export hash checks](../exports/export-verdict.json), [cut list](../exports/fencing-cuts-register-1.csv).

Inspected screenshots: [desktop cuts](../v1-stock-dev05/captures/stock-cuts-desktop.png), [tablet after reload](../v1-stock-dev05/captures/stock-restored-after-reload.png), [issued tablet portrait](../v1-stock-dev05/captures/stock-issued-tablet-portrait.png), [issued tablet landscape](../v1-stock-dev05/captures/stock-issued-tablet-landscape.png), [actual PDF](../exports/quote-page-1.png).

Status: source/development verified; full slice remains open for the final built/native qualification. Current stock rules support level runs only; raked/stepped cutting needs a reviewed per-bay schedule. QA rates and zero rail adjustment are declared fixture operands, not supplier or installation approval.
