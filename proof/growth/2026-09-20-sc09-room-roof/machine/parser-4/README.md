# Parser-4: bounded receipt-reprocessing verification

DANS1 parser-only retry exited **0**. [Derived results](retry-1/results.json) record **PASS**, `originalVerdict: FAIL`, `freshQualification: false`, and `parserCorrection: true`. This is not the separately authorized fresh machine-3 gate and does not substitute for it.

- Executed the actual changed `Complete-OwnedStep` function and aggregate assignments/guard/final-summary statement extracted from the helper AST; did not run the qualification workflow or any product command.
- Reprocessed the preserved seven clean-exit command records and the three real spec logs: **203 + 858 + 971 = 2,032 passed, zero failed**.
- All **11 synthetic parser cases** met their expected outcomes: TAP, spec, absent/clean, absent/nonzero, partial, duplicate, fully duplicated, failing, mismatched totals, malformed TAP and malformed spec.
- Actual aggregate statements accepted complete totals, kept entirely absent and mixed counts null, and rejected an absent-count/nonzero-exit case.
- All **29 original evidence entries** matched before and after; all **31 retrieved retry artifact hashes** also matched their [manifest](retry-1/sha256-manifest.json). Original [machine-2 results](../machine-2/results.json) remain FAIL and unchanged. The derived JSON's `originalResults` reference uses this parent parser-4 location as its base.
- The first invocation's Git-not-on-PATH packaging failure and generated case receipts are [preserved](INITIAL-PACKAGING-FAILURE.md). The retry used a locally generated, transferred and hash-verified diff; no original receipt was overwritten.

| Evidence | SHA-256 |
| --- | --- |
| Changed qualification helper | `d4c874de43964e8b6c3292a122696abc50bc30895f16c7b0db54f34d115d2546` |
| Prior proven spawn-3 helper | `3e257cee8ef65e57688ff2e6d7cd29f428e6ad729ab6ae19467f4e6f31ce472a` |
| [Exact parser correction diff](parser-change.patch) | `6b7bf69fb8ee2ddf579740fb8c014cbe284aa2ceee2f803a61988181fef05d26` |
| Executed parser-only verifier | `74a9d7357391a1d8e64362c4e3665762992e1a4e778bc9ebaabde13f399d9658` |
| [Derived results](retry-1/results.json) | `7981905c85ade816d063ecb3ed1e9cc6835ce6e0b46f80c5c93649a329417530` |
| [Retry manifest](retry-1/sha256-manifest.json) | `0b379e66f6257c64bcd7aa56f23b07ee8e0b2a64318ba4692edc4c31680883fd` |

No product tests, typecheck, lint, build, browser, screenshot, native or deployment gates were rerun by this verification. It does not claim SC-09 or configuration-change completion. The original lint warnings remain, and fresh qualification is recorded separately.
