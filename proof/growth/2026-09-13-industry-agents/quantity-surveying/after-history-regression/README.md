# Full regression after withheld-history changes

Nine root-authorized frozen source/config files staged into DANS1's mutable test snapshot; archive hash and every input hash verified before execution. No product source edit by this agent. No browser activity.

First run at **2026-09-13T19:53:41.194+10:00**: script phase **201 passed**; TypeScript phase **1150 passed / 1 failed**, 1151 total. The sole failure is `contextWiring.test.ts`'s stale mirrored-inline-function assertion: `shortInteraction` moved to its own module and changed deliberately, but that test still reads an inline function from `workPacketRuntime.ts` and runs its own older copy. Root and HVAC owner notified; no test assertion was altered by this agent.

Inputs, exact stdout/stderr and exited process ownership receipt are retained here. The failed run is not called a pass. Root owns integration fix and any subsequent rerun.

## Authorized test integration correction and final pass

Root subsequently assigned only `contextWiring.test.ts` to this agent. It now imports the real pure helper rather than duplicating implementation text. The old source-string comparison is replaced by a meaningful composed-send test: withheld candidates and internal correction text are excluded, the delivered answer/current request/pinned context survive, and the original audit transcript remains unchanged. All other composition checks remain.

Focused suite **8/8 passed**. Full `npm test` at **2026-09-13T19:55:22.885+10:00** exited **0**: scripts **201/201**, TypeScript **1151/1151**, 89 suites, zero failures. Final logs/process receipt use `qs-after-history-final`. The changed test's local/remote SHA-256 matches; exact diff is `context-wiring.patch`; diff whitespace check is clean. No runtime source change or browser action was performed by this agent.

Full mutable-snapshot `tsc --noEmit` after the test edit also exited **0** (`final-typecheck.txt`, no diagnostics). Compared local files against build `2b490c637162`'s incoming source manifest: see `build-parity.json`. This documents whether runtime/package inputs stayed identical while the nonbundled test changed; it does not claim a new build was run.
