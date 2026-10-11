# Final CI/package-build acceptance — October 12, 2026

## Requirement and boundary

Reach a genuinely green complete distribution matrix for an exact recovery-branch code identity, preserve hardened fail-closed transport, record package identities and remaining limits, and leave `main` untouched.

**CI and package-build milestone accepted. Installed runtime and actual deployment are not accepted.**

## Exact identity and terminal result

- Repository: `affordablefencinggc/xray-by-looplet`.
- Branch: `recovery/full-studio-20261011`.
- Tested code: `c93ae1e7354e7d295196ab5db0d363ed9e1a34eb`.
- CI run: `38150581911`, **completed / success**; independently checked through `gh run view`, GitHub Actions API, job logs and public run summary.
- Final job completion: `2026-10-11T15:38:33Z`; this is October 12 on the local host. UTC timestamps below retain GitHub's original event dates, not a falsely shifted October 12 UTC date.
- Final evidence-only commit is a descendant of this tested code; no product/workflow/test changes are included in that documentation checkpoint. CI is attributed to `c93ae1e7`, not retroactively to its docs-only successor.
- `main` local and origin remain `be29918ad5aa466ec0f67a0d5742af23634483a9`.

| Job | GitHub job ID | Conclusion | Completed UTC |
| --- | --- | --- | --- |
| SC-07 Transport Contract Proof | `114503020827` | success | `2026-10-11T15:18:25Z` |
| Web Studio & Vector Engine Audit | `114503020885` | success | `2026-10-11T15:19:48Z` |
| Tauri Desktop Build (Windows) | `114503720571` | success | `2026-10-11T15:30:01Z` |
| Tauri Desktop Build (Ubuntu) | `114503720609` | success | `2026-10-11T15:38:33Z` |

## Executed proof

- Web job passed dependency install, TypeScript typecheck/full tests, deterministic BOM/order kernels and Python/TypeScript parity, production web build, engine/MCP suites, actual built-output browser smoke and sidecar **dry-run** validation.
- SC-07 passed rustfmt, host/Tauri strict clippy, TypeScript/Python contract tests, host fixture suite, Unix process-group descendant termination, Tauri injected-runner suite, current-test-name proof parsing and hermetic spawn audit.
- Linux host: 36 library tests plus 4 raw-status integration checks passed; separate Unix descendant test passed; Tauri 52 passed. The raw-status source is included in the proof source hashes/inventory. The downloaded proof's host, raw-status, Windows-security source and Tauri hashes match the exact current Git blobs (using Git blobs avoids Windows CRLF checkout differences).
- Windows host: 37 library tests plus 4 raw-status integration checks passed, 1 ignored harmless fixture. Windows junction/protected-DACL tests actually executed successfully. Tauri 54 passed; Windows CAD compilation verified all 5 pinned dependency checksums.
- Local verification: Job Object-capped host suite and warnings-denied clippy; host/Tauri formatting; 14 configuration/log-parser regressions; Bash syntax and live runner exit propagation 0/7/124. Filters/list/ignored integration-runner behavior checked without executing an unrelated fixture.

## Linux packaging evidence

The Zstd-overlay/diagnostic checkpoint preserved all target types and succeeded before its 20-minute child timeout:

- Build step: `15:22:33Z` to `15:37:04Z` (14m31s), `NATIVE_BUILD_EXIT=0`.
- DEB: `bundle/deb/X-Ray by Looplet_0.1.0_amd64.deb` (logged size 266023752 bytes).
- RPM: `bundle/rpm/X-Ray by Looplet-0.1.0-1.x86_64.rpm` (logged size 265620572 bytes).
- AppImage: `bundle/appimage/X-Ray by Looplet_0.1.0_amd64.AppImage`.
- Tauri reported all three finished bundles; tar archive step succeeded at `15:37:42Z`, upload at `15:38:18Z`.
- Last heartbeat (`15:36:34Z`) showed active AppImage/linuxdeploy work, including `dpkg-query` at 80% CPU and the CLI node process at 69.1% lifetime CPU. This is current progress evidence, not proof of the old gzip-stall root cause.
- Superseded runs `38146549601` (`738445d3`) and `38148677824` (`857d7f3d`) were explicitly canceled, not accepted. Their Windows/web/transport successes remain scoped to those source identities. Their Linux logs reached RPM after successful compilation/DEB, with no further progress before cancellation.

## Final artifact identities and verification levels

All five artifacts are bound by GitHub to the tested run, and were unexpired when checked. Digests below are the **uploaded ZIP digest**, not an individual executable/package digest.

| Artifact | ID | ZIP SHA-256 | Verification |
| --- | --- | --- | --- |
| `xray-web-release` | `11706169518` | `eaef663fa3fb15c75bb8f737e351500362fc5d2fedddaf2a0a1db8ccdc66775e` | Independently downloaded/hash-checked; 244 entries, 277676711 bytes. `config.json` and `functions/__server.func/.vc-config.json` present/parseable. No extracted or executed content. |
| `sc07-transport-proof` | `11706513884` | `52e2adeacddd3a37acf105c0523ae7589cdf0d84444ef98154c928bfc3c1c35e` | Independently downloaded/hash-checked; 8 entries. Manifest `ok: true`, 33 verified/2 partial BR rows and `completionClaim: false`; the two Windows-only rows are not claimed complete by this Linux manifest. |
| `xray-desktop-windows` | `11707205379` | `951018398185bacca19564c5dbacb6b2d3284b0ba636a54c8fff1b0dfdcc049d` | Independently downloaded/hash-checked; 2 entries, 532289208 ZIP bytes. MSI `X-Ray by Looplet_0.1.0_x64_en-US.msi` (266276864 bytes), NSIS `X-Ray by Looplet_0.1.0_x64-setup.exe` (266156781 bytes). No installation/execution. |
| `xray-desktop-linux` | `11705864872` | `80b24ef0f680e07123e95b7bc755d0e55c5d7cb070c6f7ac2b80ab8c12fc786a` | Remote artifact metadata and successful three-package/tar/upload logs checked; ZIP 1759929030 bytes. **Not independently downloaded, hash-checked or unpacked**; large archive includes bundle staging output. |
| `sc07-bom-convergence` | `11706279243` | `bce1e3c1ebd0828dd9814494d7ef578d105afa7eb3565fa61dec536446c807fd` | Remote metadata and successful job checks only; ZIP 2853 bytes. |

Downloaded artifacts are stored only in the sibling `xray-recovery-evidence` directory, not committed. Download/hash inspections ran one at a time under verified 20% aggregate CPU caps. No credential contents were read or published.

## Cleanup and finalization

- All local capped test/download helpers exited; no task-owned Cargo, Rust compiler, artifact-download, preview or CDP helper was retained.
- All continuation reviewer/monitor teammates stopped; no schedules created.
- Current CI completed; earlier duplicate runs canceled with logs preserved.
- Final checkpoint stages only reviewed proof Markdown; no merge/push to `main`, force push, deployment or installer execution.

## Visual evidence and remaining gates

Nonvisual CI step; no new screenshots. [Separate saved-image review](saved-screenshot-review.md) records the AI-inspected desktop/tablet states and original hashes; it is not human signoff or new native display evidence.

1. **Qualified bundled calculation runtime:** this CI prepares empty engine directories and never runs the source/hash-gated qualified DANS1 engine stage or supplies `XRAY_BUNDLED_ENGINE_SHA256`. Windows remains fail-closed without an explicitly selected trusted runtime; bundled Linux selection is not implemented. Package success is shell/package evidence, not a working native BOM claim.
2. **Installed launch/platform acceptance:** Windows/Linux install, launch, WebView rendering and real-engine execution not performed. macOS packaging/signing not in this matrix. Linux archive independent digest/mode/content verification remains open.
3. **Deployment:** no Vercel CLI token/login/project linkage was found locally or on DANS1. No deployment, DNS change or external-account action attempted.
4. **Visual/accessibility:** human signoff, compact toolbar touch targets and portrait bottom-bar obstruction remain open; not part of this nonvisual repair.
5. **Reproducibility:** observed bundler downloads include upstream AppImage tooling; unsigned artifacts are build evidence, not a signed release/security certification. Runner/action deprecation warnings are nonfatal in this run, not a promise future runner changes will pass unchanged.