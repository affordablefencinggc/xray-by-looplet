# DEV-RELOAD-19 — development reload investigation (WIP)

Requirement: reopen saved work after a full development reload, retaining styling and persisted HVAC/SC-09 data. **Incomplete: the candidate fix has not executed.** No slice status changes.

Baseline: `ba489abbbc1c26357033edc73fb0ac4865ac3902`; product bytes from DANS1 `hvac4-0b65b5559448`.

## Executed observations

- [Full workflow reproduction](../campaigns/hvac4-reload-current-dev1/output/browser-results.json): FAIL, 66/75 operations. Navigation returns, hydration then times out; failure screenshot also times out. All preceding fitting edits and exports execute.
- [Early HTTP diagnostic](../campaigns/hvac4-reload-http1/output/browser-results.json): 14/14 operations. Static HTML, Vite client and root each return HTTP 200 in under 8 ms.
- [Post-workflow HTTP diagnostic](../campaigns/hvac4-reload-post-http1/output/browser-results.json): 68/68 operations. After editing/exporting, root requests with both generic and HTML Accept headers return 200 in under 7 ms. This is diagnostic success, not reload acceptance.
- [Minimal reload](../campaigns/hvac4-reload-minimal1/output/browser-results.json): FAIL, 15/17 operations; no fitting edits or exports are needed to reproduce.
- [Live raw-CDP/HTTP observation](../source/reload-live-state.log), captured using [bounded DANS1 probe](../source/reload-cdp-probe.cjs): document remains `loading` on the server-rendered workspace skeleton, with the synthetic TanStack development stylesheet present. Subsequent static, Vite-client and root requests all time out. This narrows the suspected failure to development asset serving; it does not establish the internal root cause.

## Screenshots and exact candidate

Inspected [desktop before reload](../campaigns/hvac4-reload-http1/output/captures/reload-http-diagnostic.png) and [tablet after exports, before reload](../campaigns/hvac4-reload-post-http1/output/captures/post-workflow-http.png). These show working baseline states only. There is **no successful after-fix screenshot**.

[Exact candidate diff](../source/reload-candidate.patch) disables only Start's synthetic development SSR stylesheet collection. Existing side-effect CSS imports and production asset discovery remain configured. The installed Start schema supports `dev.ssrStyles.enabled`; [official CSS documentation](https://tanstack.com/start/latest/docs/framework/react/guide/css-styling) describes the existing production side-effect import behavior.

[Candidate freeze](../source/reload-candidate-freeze.json): `hvac4-11862358151f`. Packaged locally, but SSH stopped responding during remote setup. A bounded reconnect [timed out during SSH key exchange](../source/reload-ssh-timeout.log). No machine tests, browser checks or build ran for this candidate. Do not reuse the baseline 2097 passing tests as candidate acceptance.

## Integrity, cleanup and next execution

[Integrity check](../source/reload-evidence-check.json): 69 returned artifact hashes match; all four completed campaigns record stopped/already-exited browser and preview cleanup. [Diagnostic SSH cleanup](../source/reload-diagnostic-cleanup.json) and [snapshot SSH cleanup](../source/reload-snapshot-cleanup.json) stop only verified local clients. Remote setup status is unknown; inspect the frozen run directory before resuming and preserve any existing artifacts.

Next: restore DANS1 connectivity, finish qualification of the candidate, rerun the failing HVAC reload and SC-09 room/roof journey, inspect styled desktop/tablet screenshots, then run the required sequential build and production verification. If the candidate does not fix the failure, retain its result and continue diagnosis. The automatic 100-file scope freeze / 150-file ceiling remains in force.

Connectivity briefly recovered (hostname DANS1; candidate directory absent), then the resumed setup and read-only query again stopped returning output. [Resumed-client cleanup](../source/reload-resumed-cleanup.json) preserves the uncertain remote state. No candidate test was observed. The local source package remains available for resumption.

