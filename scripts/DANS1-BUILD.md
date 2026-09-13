# DANS1 native build

`dans1-build-worker.ps1` is the maintained worker. Do not regenerate it from
historical proof scripts: those predate dependency-cache validation and bundled
engine qualification.

Use a new immutable run ID and hash-verified web, native and Node runtime
archives. Full native builds require `-EnginePackageDir` and
`-ExpectedEngineSha256`; web-only builds can omit them. Include
`scripts/stage-bundled-engine.ps1` in the web source manifest, plus the complete
Python source and frozen contract in the native snapshot.

The staging helper accepts the explicitly pinned, tested Windows engine package
only. It compares its recorded source files with the current snapshot, checks
qualification records and executable bytes, then creates
`engine/bin/xray-engine.exe`. The worker sets `XRAY_BUNDLED_ENGINE_SHA256` for its
child build process. Tauri packages the resource; the application verifies its
path and SHA-256 before constructing status or BOM commands. An explicit
`XRAY_ENGINE_PATH` still takes precedence; an invalid override fails closed.

If Python code or its dependencies change, rebuild and requalify the engine,
then deliberately update the helper's pinned identity. Never substitute an
unverified executable or fabricate passing qualification records. The legacy
`build:sidecar` command is not this verified packaging pipeline.

Optional dependency reuse requires both `-DependencyCacheRunId` and
`-ExpectedCacheExeSha256`. The worker verifies successful prior artifacts and
unchanged Cargo dependency inputs, copies them into the new run, and cleans the
application and host packages before compiling current code. Windows execution
security remains enabled. A cache mismatch fails the run; correct the inputs in
a new run instead of changing historical records.

After a successful build, test the extracted installer layout with no engine
override, no Python on PATH and an unrelated working directory. Verify native
status, actual generation, persisted readback, and missing/tampered resource
failure using isolated QA profiles. A passing compile alone is not installation
acceptance.
