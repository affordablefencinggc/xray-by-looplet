# Local build responsiveness — 7 September 2026

- [x] Capture CPU-heavy process: Xray Vite SPA build, PID 25476, peak approximately 96% total CPU.
- [x] Confirm load fell after the build exited (subsequent measured process total 8.4%).
- [x] Add local Windows Vite-build defaults: at most six Rayon workers and below-normal launcher priority. Preserve explicit worker settings and CI behaviour.
- [x] Verify environment scoping, inherited priority, exit status and a build to an isolated output directory.
- [x] Record measured results and recovery paths. Browser latency improvement still needs confirmation during actual use.

User moved ongoing build work to another PC over SSH. No more local builds launched. Evidence: proof/audit/IW-BUILD-RESPONSIVENESS/completion.md.
