# DANS1 build e173b12b942c

Current web source archive: `a06a716f734b9e886fbed8080ae799f5b221115dfab8f4b28196b3c95f8a3b24` (836 files). Native archive: `2b399465892ec7467125cfc41bc68bc796204efb49c7f02726a529c38acd8faf` (104 files). Worker SHA-256: `1514e1c43dbcaf68db8c914a2b9fd1b8c07f3d5862d1f135b5158f28dc659144`.

PowerShell orchestrated this immutable run using explicit verified dependency cache a8a4f707ac43. Windows security settings were unchanged. The copied local application packages were invalidated with package-scoped Cargo clean, which removed 216 files. The previous application executable was confirmed absent before ordinary Cargo compilation. Native logs explicitly record compilation of both current local crates.

Dependency installation, type checking, focused tests and web build passed. The production Vercel output passed 19 raw-CDP operations across desktop and tablet, including all five primary workspace tabs, with no runtime errors and successful context cleanup. Root inspected both screenshots. The owned production preview PID5668 was identity-checked and stopped after verification; the existing user-facing preview was preserved.

Native build completed successfully in 200.52 seconds. Its log records current-source compilation and creation of the expected NSIS installer. The new app SHA-256 is `1c93cdfe96e270a66f25e1db226192b01a3bc44b42cdc3cb8122392a296892d4`; the expected installer SHA-256 is `c2c03ad6e3400933b1b91eb41051201326a1b2e785c96fc6189f19ac267b4f05`. Both differ from the cached app and installer (`f34586aff3970801645cad794ee2ceb0c989ef5e5a55d4b353613f0c8fec1822` and `59814d50cd44efc0c7e86b02f91da79975e057ff3f73db38069ffd4f905489a7`). No prior bundle is presented as newly generated.

This resolves the observed dependency-helper build block through ordinary verified cache reuse. It does not establish signed distribution, installation, default-engine packaging, native generation or whole-industry acceptance. Native UI continuation is tracked separately under roofing/native-ui.
