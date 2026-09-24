# SC-00 — authorized local source and build qualification

Source `e74e67d4`; host DANIEL, as explicitly requested on 24 September. [1,153 input hashes](../source-identity.json) match before and after both builds. [Audit](../stage1-audit.json) confirms source tests **1,964/1,964**, typecheck exit 0, web build exit 0 and native NSIS packaging exit 0. [Source results](../source-gates02/results.json), [web results](../web-build01/results.json), [native results](../native-build01/results.json).

Each build worker joins a Windows Job Object with a 20% hard cap before spawning children; both the worker's applied settings and each child's membership are checked. [Web resource receipt](../web-build01/resources.json), [native resource receipt](../native-build01/resources.json). Builds ran sequentially. The native input is the already-qualified engine hash `e4693d8f…`, with all 62 current engine source hashes checked and its contract executed locally. [Staging and preserved old build input](../engine-staging.json).

The first full test run failed five authentication tests because this campaign's launcher incorrectly applied the standalone build flag to source tests. The launcher was corrected to leave that flag unset for source tests; product code did not change. [Failed run retained](../source-gates01/results.json). Separate initial CLI/calibration-preflight mistakes are recorded in [setup failures](../setup-failures.json).

Fresh built-browser [35/35 operations](../explanations-built01/browser-results.json) and [inspected desktop screenshot](../explanations-built01/captures/roofing-review-desktop.png) demonstrate the web output renders and uses current guidance. The screenshot does not prove CPU allocation or native runtime; those claims are limited to executed resource/build receipts. [Exact campaign and ledger diff](../stage1-changes.diff).

No installation, deployment, native runtime acceptance, physical-tablet test or native macOS/Linux claim is made here.
