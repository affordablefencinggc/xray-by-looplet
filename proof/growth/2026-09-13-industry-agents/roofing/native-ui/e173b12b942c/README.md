# Native e173b12b942c — actual UI attempt

- Verified native executable SHA256 `1c93cdfe96e270a66f25e1db226192b01a3bc44b42cdc3cb8122392a296892d4`; qualified engine `6e234005e046ebd8969896b5ace7decca42cc6bf3fe45cffd7ad5fec2cc4ab21`.
- Copied prior closed isolated profile using launcher inventory/hash verification. Saved synthetic 5m calibrated/traced project restored: job-232f950e-c8d6-4c0e-9528-0b002ad9a2af, revision15. No direct project state injection.
- Native host marker and engine status available=true on initial readback and generation preflight. Earlier cold-start issue did not recur in this attempt.
- Accepted five visible Colorbond assumptions through UI using QA automation — synthetic fixture only. This records a synthetic test reviewer, not human engineering approval.
- Actual Generate BOM returned domain rejection at 2026-09-13T11:50:12.865Z, requestId2b9aa332-fbf1-41b6-815b-7e327208fd1e: Every referenced assumption must be accepted. Entity tp-material, path recipeSet.recipes.1.assumptions.
- Active single run selects recipe-colorbond-good-neighbour, all five assumptions accepted. Unused timber and chainwire candidate recipes each retain four unresolved assumptions. No unused assumptions accepted to bypass the issue.
- `derived-request.json` is a clearly labelled replay fixture compiled on DANS1 from the actual persisted readback using the exact e173 source compiler, with a new request ID. It is not an intercepted original transport request. `derived-replay.json` records provenance. The first helper invocation failed due Windows ESM import syntax; corrected to file URL and compilation succeeded.
- `equal-native-result.png` visually inspected: equal layout/reviewer and Not built sidebar visible; issue text is captured in DOM JSON but lies outside screenshot viewport.
- Graceful close succeeded at11:54:41Z; profile preserved for next engine attempt. No successful quantities, full-layout generation, final reload/tablet result, or assistant receipt review claimed yet.
