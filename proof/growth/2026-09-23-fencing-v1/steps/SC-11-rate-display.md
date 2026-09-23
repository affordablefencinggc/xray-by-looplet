# SC-11 — two-place rates without loss of supplier precision

Exact changes: [quote diff](../quote-source.diff), [source hashes](../source-hashes-03.json). Rates display/export with at least two decimal places in the price-book UI, worksheet/revision CSV, quote PDF and handover CSV. Extra supplier precision remains intact. A line's tax basis is retained in handover JSON/CSV, avoiding incorrect labels when the same currency includes different tax bases. The quote summary explicitly identifies tax included in the total.

Executed: [1,958 passing source tests](../source-tests-03.log), [typecheck](../checks-03.json). Rate tests cover 3 → 3.00, 18.5 → 18.50 and six-place rates; PDF extraction checks values and the AUD 2,750.55 total. Mixed-tax CSV tests retain the correct declaration for each line. [58/58 browser operations](../v1-quote-issue-dev03/browser-results.json) verify both displayed rates and revised amounts.

Inspected screenshots: [desktop 3.00 / 18.50 and tax total](../v1-quote-issue-dev03/captures/quote-issued-desktop.png), [portrait worksheet rate and frozen issue](../v1-quote-issue-dev03/captures/quote-issued-tablet-portrait.png).

Status: source/development verified; final built/native export qualification remains open. No supplier prices are rounded to two places by this formatting change; it only pads missing decimal places.
