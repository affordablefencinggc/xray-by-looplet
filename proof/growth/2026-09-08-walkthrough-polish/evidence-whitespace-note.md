# Exact evidence preservation

The full evidence `git diff --cached --check` reports trailing CRLF/blank output lines in captured PowerShell JSON and browser logs, and context whitespace inside archived code diffs. These raw records are intentionally preserved byte-for-byte rather than reformatted after capture. Source checkpoint844e091 passed its application diff check. The authored checklist/ledger and new archive-script diff check also passed. This distinction does not waive an application test failure; every failed journey remains recorded separately.

No remote upload was attempted. The evidence archive excludes binary builds, transfer archives, raw downloaded asset archives and unrelated audit files. Its credential-pattern scan reports zero matches; this is a bounded scan, not a claim that arbitrary sensitive content can be ruled out by patterns.
