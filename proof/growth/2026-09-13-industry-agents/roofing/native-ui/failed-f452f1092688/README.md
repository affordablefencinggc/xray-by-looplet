# Failed native build f452f1092688

Read-only copies of native-build stdout/stderr, results.json, completion.json, cargo-cache.json and incoming source/native manifests. The native step exited1 after84.4948144s. Web/typecheck/worker focused steps passed, but completion.json is web completion and is not evidence of a native artifact.

native-build.stderr.log states the Tauri custom build script was never executed and Windows Application Control blocked it (OS error4551). A bounded read-only CodeIntegrity query is now preserved in codeintegrity-events.json: event3077 record138 and correlated3118 record140 at2026-09-13T11:17:04Z identify the exact failed-run Tauri helper. SHA25605BE294AC335AF3C9718FDBBB7659179B3121ADF5D9B0F663497BF7F434D6E33. Only two events matched the13-minute window; full XML and correlation are retained. No Windows security settings were changed. No blocked executable was launched, security configuration changed or build retried by this worker.

The previous successful isolated fixture/profile from2f08ad4c8ef1-ui1 remains closed and preserved. Pending run3c9aafaf58a4 is not native acceptance until root supplies successful native completion and exact executable hash. Continuation preparation does not execute it.
