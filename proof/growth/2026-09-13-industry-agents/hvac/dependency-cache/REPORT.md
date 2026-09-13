# Verified dependency-cache worker validation

Source: scripts/dans1-build-worker.ps1 SHA-256 1514e1c43dbcaf68db8c914a2b9fd1b8c07f3d5862d1f135b5158f28dc659144.

DANS1 ran 10 focused checks (result.json); decision.json records successful source identities, the five exact Cargo dependency input hashes, and dependency-helper hashes. No build or helper was executed. No security settings, registry settings, timestamps, prior run contents, or installed application were changed.

Explicit inputs: DependencyCacheRunId=a8a4f707ac43, ExpectedCacheExeSha256=f34586aff3970801645cad794ee2ceb0c989ef5e5a55d4b353613f0c8fec1822. The prior completion must be successful on DANS1; its incoming archive hashes anchor dependency input manifests. Target reparse points are rejected. Normal default exact-native cache behavior remains unchanged.

Current validation package 3c9aafaf58a4 hashes read back on DANS1: source e2693ab33da3be1b97ec0783eafbcf9e91fef38e6a85118cced4d347c5ab72e3; native 2b399465892ec7467125cfc41bc68bc796204efb49c7f02726a529c38acd8faf. Source files were extracted only into a new disposable validation folder. Changed/additional Cargo manifests fail; application source changes alone may proceed to mandatory compilation.

Before the real native build, the new isolated target undergoes Cargo clean --release --package xray-by-looplet --package xray-engine-host. The copied application executable must be absent afterward. Cargo must then build successfully from verified current source; changed source cannot be accepted with the previous application hash. Full build and actual clean acceptance remain untested in this focused campaign and are assigned to root.

Validation iterations: first attempt stopped because new input archive had not been uploaded; second/third caught PowerShell's automatic $input variable collision in the anchoring loop. Final version uses $dependencyInput, passed against uploaded 3c9 archive. Earlier isolated validation directories remain preserved. The successful script is validate.ps1.

Limitations: verified helper presence does not promise Cargo reuses that helper, nor that Windows permits every new artifact. Windows security remains authoritative. Prior bundle files are copied with target; root must identify the freshly generated installer rather than treating every old bundle file as fresh. No native packaging success is claimed here.
