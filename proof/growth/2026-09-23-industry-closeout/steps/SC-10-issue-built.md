# SC-10 — frozen quote issue on built output

DANS1 built `c56ad63e9ee7`: [58/58](../closeout-quote-issue-c56ad63e9ee7/browser-results.json), no browser errors and completed [cleanup](../closeout-quote-issue-c56ad63e9ee7/launcher-results.json). Draft review/issue, quantity revision, second issue and restoring the original issue are exercised through actual controls. Original [source tests and exact product diff](../../2026-09-23-fencing-v1/steps/SC-10-quote-issue.md).

Root inspected [first issue](../closeout-quote-issue-c56ad63e9ee7/captures/quote-issued-desktop.png), [revised landscape](../closeout-quote-issue-c56ad63e9ee7/captures/quote-issued-tablet-landscape.png), [portrait](../closeout-quote-issue-c56ad63e9ee7/captures/quote-issued-tablet-portrait.png) and [original restored after revision](../closeout-quote-issue-c56ad63e9ee7/captures/quote-original-issue-after-revision.png). First issue remains AUD 2,750.55 including GST while the revised issue is AUD 3,361.05; prior lines, issue identity/time and price-book revision remain frozen.

Actual issued PDF/ZIP behavior is separately [built-qualified](SC-07-stock-built.md). [Proof diff](../fencing-proof.diff), [ledger diff](../fencing-ledger.diff), [audit](../fencing-audit.json). Synthetic test quantities/rates only. No quote was sent. Native issue UI, shared final package and real-job revision/issue/handover remain open.
