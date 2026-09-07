# Local Windows build responsiveness — 7 September 2026

Observed Xray Vite SPA build PID 25476 peak at approximately 95.99% total CPU. This is evidence of local CPU contention, not proof of every reported browser delay. A subsequent sample after that build exited measured 8.4% total process CPU.

Added scripts/build-resources.mjs and integrated it into scripts/with-app-env.mjs. Local Windows Vite builds use at most six Rayon workers by default (half available processors on small machines) and below-normal process priority. Explicit RAYON_NUM_THREADS values are retained. CI, non-Windows runs, development, preview and other commands retain their previous behaviour. Direct Vite invocations bypassing the wrapper are not covered. This controls the Rayon pool, not every thread in the process.

Verification: four resource-policy tests and twelve existing environment-wrapper tests passed. A real child inherited Windows below-normal priority. A Vite SPA build to a unique temporary output folder reported success in 21.72 seconds. The monitored Vite PID 37984 peaked at 18.86% CPU and averaged 12.71%; all its observed priority readings were BelowNormal. Its peak total thread count was 69. These are separate live samples, not a controlled benchmark on identical machine load.

The PowerShell Start-Process handle did not retain an exit-code value in this measurement. The build log records successful completion and emitted artifacts; wrapper exit-code propagation is separately covered by passing existing tests. No claim of independently captured build exit code is made.

Vite reported Tailwind's generate:build hook at 21.2 seconds (98% of elapsed plugin-hook time). Hook timings include waits and overlapping work; they do not establish exclusive CPU cost. Existing chunk-size and shell-spawn deprecation warnings remain.

User subsequently redirected development work to another PC over SSH. No further local build was started. The local limit remains a fallback; no remote machine was configured. No production release, app installation, merge or push was performed. Browser tab latency improvement still requires confirmation during actual use.

Recovery: this directory contains measurements and source copies; changes are uncommitted on feat/architect-cad-engine. See recovery.json for the baseline and hashes.
