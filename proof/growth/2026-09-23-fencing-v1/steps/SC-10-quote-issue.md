# SC-10 — frozen quote issue history

Exact changes: [quote diff](../quote-source.diff), [source hashes](../source-hashes-03.json). Review current worksheet/details, then explicitly mark issued. The project price library stores quantities, rates, customer details, issue ID/time, material-register revision and used price-book revisions with full source hashes. Storage guards prevent removal or rewriting of previous issue snapshots. Issued references are unique case-insensitively; stale BOM-linked lines cannot issue. Issuing sends nothing.

Executed: [1,958 source tests](../source-tests-03.log), [typecheck exit 0](../checks-03.json), [58/58 development browser operations](../v1-quote-issue-dev03/browser-results.json). Browser issue Q1 totals AUD 2,750.55; revised quantity produces a separate Q1-R2 of AUD 3,361.05. Reload and selection of Q1 compare the saved snapshot byte-for-byte. Issued PDF and ZIP downloads are exercised. Unit checks read PDF text, reject duplicate references, preserve source revisions after rate changes, reject tampering/removal, and exercise stale concurrent writes.

Inspected: [desktop issue](../v1-quote-issue-dev03/captures/quote-issued-desktop.png), [landscape revision](../v1-quote-issue-dev03/captures/quote-issued-tablet-landscape.png), [portrait revision](../v1-quote-issue-dev03/captures/quote-issued-tablet-portrait.png), [original after revision](../v1-quote-issue-dev03/captures/quote-original-issue-after-revision.png).

Status: source/development verified; final build/native issue flow remains open. These synthetic rates establish arithmetic and snapshot behavior, not supplier pricing, actual customer delivery or the Boundaries real-job journey.
