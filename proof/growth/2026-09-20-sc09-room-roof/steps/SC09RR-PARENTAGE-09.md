# SC09RR-PARENTAGE-09 — reject stale Windows parent PIDs

## Change and incident

The qualification helper and Fast CDP launcher now require a child creation time at or after its actual live parent. The qualifier also requires creation during this task; the launcher rejects missing root/child creation identities. Existing executable, command and creation-time checks remain in place.

The original machine run incorrectly counted OneDrive.Sync.Service.exe PID 15512, created before its alleged Node parent PID 9048, as an owned descendant. Its receipt records stopping that service. That run remains FAIL. This was a harness ownership bug, not a product-test failure. The service was restarted using its exact recorded executable and `/silentConfig` argument; the [restoration receipt](../machine/onedrive-restoration.json) identifies the new process and explicitly excludes it from task cleanup. This does not certify OneDrive synchronization health.

- [Exact helper and runner diff](../source/process-parentage.patch).
- [Five executed synthetic parentage checks](../machine/process-parentage-results.json): **5/5 PASS on DANS1**. Includes stale ancestry at two levels, excluded descendants of stale parents, missing root, reused root and missing child creation time. No processes are terminated by these synthetic tests.
- [Inspected screenshot of actual test results](../campaigns/sc09rr-1388723caf33-parentage-proof1/output/captures/process-parentage-proof.png).
- [Result-page browser check](../campaigns/sc09rr-1388723caf33-parentage-proof1/output/browser-results.json): 5/5 PASS. Screenshot displays test results; the JSON test receipt is the executable ownership evidence.
- [Original failed machine run](../machine/webgl-machine1/results.json), preserved with its actual cleanup action.
- [Fresh machine run with corrected helper](../machine/machine-safe2/results.json): **2,032/2,032 PASS**, TypeScript exit 0, scoped lint exit 0 (16 existing warnings), no erroneous residual-child cleanup.

Subsequent recovery and normal-production browser campaigns also completed their owned-process cleanup using the corrected launcher. This fixes the observed PID-reuse ownership defect; it is not universal process-supervision certification.
Follow-up: the original OneDrive helper command launched successfully, but a later PID/executable check did not confirm it remained running. Ongoing OneDrive synchronization is unverified; no additional user services were started or stopped.
