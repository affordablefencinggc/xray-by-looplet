# Dans1 build with the qualified calculation engine — 23 September 2026

Goal: fence material counts (BOM) working in the desktop app. Local builds cannot do this because the qualified engine is staged only on DANS1.

- Frozen working tree (HEAD 6e283f03 + uncommitted changes incl. recovery-journal fix and desktop MiniMax): web 987 files, native 107 files; run id `dfc1941c8ba1` (`transfer.json`, `transfer/*-manifest.json`, `transfer-record.json`). Local engine/python matched the qualified package's 62-entry manifest before transfer.
- Attempt 1 failed at engine staging because the orchestrator passed a path whose backslashes had been eaten (`build-console-attempt1.log`); the partial DANS1 run was preserved as `runs\dfc1941c8ba1-failed-engine-path`.
- Attempt 2 (`build-console.log`, `build-dfc1941c8ba1/`): engine staged, SHA-256 e4693d8f… (`bundled-engine.json`); dependencies, typecheck, focused tests, web build and native NSIS build all exit 0 (native 325 s, cold cargo). Exe 26136fd1…, installer a9bbed36….
- Native QA (isolated profile, CDP 9294): Redburn sheet 12 at 1:250, 51.59 m timber paling run with 2 m double gate, assumptions accepted and run/gate approved as "QA test estimator (Claude)", **Generate BOM → CURRENT, 11 lines, 0 blocking** (`shots/e3-bom-generated.png`). Engine quantities identical to the app's TypeScript reference rules for the same job (`parity.json`): 561 palings, 20 line + 2 end + 2 gate posts, 44 rail cuts, 99.176 lm rail, gate leaves 2, hinge sets 2, latch 1, drop bolt 1. `xray_bom_status` available, ruleset fencing-v1@1; MiniMax status configured.
- Installed over the user's app (installer exit 0); installed engine hash e4693d8f…; installed exe differs from the tested exe only in the 3-byte bundle marker.

Not changed: `LATEST-VERIFIED-BUILD.md` (no full release QA campaign or native graceful-shutdown gate was run for this build).
