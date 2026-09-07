# Dans1 growth-wave build: a8a8c4946d93

Frozen standalone Xray source was built on verified DANS1. All five worker steps passed: dependency restore, source-wide typecheck, 95 focused tests in 9 suites, web production build and sequential native NSIS build. Every step records an observed High child priority and 16 Rayon/Cargo workers. Live native-packaging descendants were independently observed at High priority in `release-a8a8c4946d93/priority-observed.json`.

Source SHA-256: `a8a8c4946d93cafa283a7875b97337719f4c1bce8884b5b4097ab30fc5b29b84` (510 files).

Native source SHA-256: `9e85e6501cbe8e92b7f504ba1b9b41b3be8268059955e065a852a1f032b2f6d7` (101 files).

Exact native source identity matched the prior successful `44c9a5bdd386` run. Its verified Cargo target was copied into the absent new target directory; no target was shared or moved. Cache and previous executable checks are recorded in `cargo-cache.json`. The native application was rebuilt against this wave's source; build duration was 146.95 seconds. Web build duration was 4.37 seconds; these are measured for this cached dedicated machine/run, not general performance guarantees.

Executable SHA-256: `1a6486a3af6425e61996b1641f5ffdeade546df9fa549e4dcafe43209899aa8b` (271,049,216 bytes).

NSIS SHA-256: `5ff5dc3c35aba4a3c3e57fbb175c6f9c295aac1286cad9e80f260a301560eb6e` (263,120,405 bytes).

Native artifact archive SHA-256: `02b93df0a162b84b8035b72bb4aa677279c50281bbfd1b1b6185a67253b611f6` (535,892,992 bytes). Local archive verification, safe extraction and all 10 individual artifact hash checks passed, recorded in `release-a8a8c4946d93/artifacts-verified.json`. No installation or application launch was performed by this worker.

Production output is served on Dans1 loopback8086 and forwarded to local loopback8086. The preview helper refuses existing listeners and retains its owning SSH session. Prior previews and user profiles are preserved. Root owns production browser and native functional/visual proof; an HTTP200 alone is not a smoke-test pass.

The run's `native-completion.json`, `results.json`, focused test log, web/native logs, source manifests and post-build `source-drift.json` provide the executed evidence. Post-build local verification matched all 611 frozen source files with zero drift. Read-only restore review remains bounded to B-10; no complete restore/apply or protected stale-writer milestone is claimed by these build results.
