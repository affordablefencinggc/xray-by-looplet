# Fencing cutting and coverage checkpoint — 23 September 2026

Baseline `9512f8b0`, branch `feat/closeout-sc09-remainder`. Automatic scope freeze at 100 pending files; this is a WIP source/development checkpoint. Final shared web/native qualification, slope schedules and the real-job journey remain open.

On DANS1, [full source regression](fencing-checks-04/source-tests.log) passes **1,964/1,964**; [typecheck, changed-file lint and fixture generation](fencing-checks-04/result.json) exit 0. Lint retains 11 existing warnings. [Final source identities](source-hashes-05.json) and [checkpoint audit](checkpoint-audit.json) bind the product and evidence files. The last generator change only corrects the CDP init-script context; product sources are identical to checks-04.

- [SC-07: level rail/post cutting and purchase mapping](steps/SC-07-stock-cutting.md).
- [SC-09: material coverage and generic gate allowances](steps/SC-09-pricing-coverage.md).

[Development browser journey](v1-stock-dev05/browser-results.json): **157/157 operations**, zero unexpected browser errors. It imports both the dated Bunnings allowance book and separately labelled synthetic stock rates, saves reviewed rail/post schedules, verifies cutting quantities, prices stock without charging the raw rails twice, blocks an unreviewed issue, saves no-rate reasons, issues STOCK-Q1 for AUD 87.00 including GST, exports PDF/ZIP/CSV, checks both tablet orientations and preserves the exact issued record on reload. [Launcher cleanup](v1-stock-dev05/launcher-results.json) confirms the owned browser and preview stopped.

[Actual export verification](exports/export-verdict.json) checks captured byte lengths and SHA-256 hashes, issued JSON arithmetic and coverage, the separate material coverage CSV, and PDF text. Root inspected the [rendered PDF page](exports/quote-page-1.png), desktop cutting/import/review screenshots and both tablet issue/reload screenshots linked in the step records. The PDF is readable and includes every no-rate reason. These are synthetic geometry and arithmetic checks, not a site-approved job or customer delivery.

Failures retained: checks-02 had one assertion wording mismatch for a correctly rejected nonpositive cut; the product now gives a specific message and checks-04 passes. Dev01 failed on a test predicate reading the price library before its first save. Dev02 failed before browser launch because a relative scenario path resolved against the SSH home. Dev04 rejected an init-script opcode without its required context. Dev03 passed 105/105; dev05 adds actual export capture and passes 157/157. The export verifier initially expected a tax-exclusive total field for an inclusive quote, then called a PDF proxy cleanup method absent from this installed version; both verifier assumptions were corrected. No product changes were needed for those export-verifier errors.

The checkpoint auditor initially expected TAP summary prefixes; this Node version emits the spec reporter's information symbol. Its count parser now accepts both formats and reports the six actual batch totals.

The campaign's Git attributes preserve captured bytes. [Disk/index hash checks](index-byte-check.json) verify the actual PDF, ZIP, CSV, scenario, receipt and exact diffs before commit. This is a local Git-only check; the product execution and PDF rendering were on DANS1. The rendered PDF above shows the artifact protected by this rule.

Exact changes: [product/tests](source.diff), [scenario and export verifier](proof-tools.diff), [ledgers](ledger.diff). Every formal slice remains tagged/open for its outstanding acceptance. Read-only Boundaries v3 discovery identified a six-run/two-gate mixed fence job; private source coordinates and address remain outside Git. It contains no measured falls or slope snapshots. The generic two-leaf price allowance does not establish fit for its gate openings.
