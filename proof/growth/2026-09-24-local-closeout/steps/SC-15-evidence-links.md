# SC-15 - evidence-link correction

Checkpoint `14c3e9e4` contains the completed native qualification. Its campaign README had three links written relative to the repository root rather than its own directory. The validation detected this, but a later successful shell command hid the nonzero exit and the checkpoint was pushed. [Failure retained](../stage4-ledger-check-failure.json).

This follow-up corrects those three URLs without rewriting history. [Executed link, open-tag and diff verification](../stage5-ledger-check.json); [exact correction diff](../stage5-changes.diff). The corrected links reach the named stock, hardware and issue proof files. The accompanying previously inspected [native stock screenshot](../native-readback01/native-stock-readable-landscape.png) and [issued quote screenshot](../native-readback01/native-issued-readable-landscape.png) show the underlying application results, not a new application run or visual proof of filesystem-link resolution.

All application source, compiled binaries, test results and export artifacts are unchanged. Full product tests need not be repeated for this documentation correction.
