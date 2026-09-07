# Frozen release 197ab630793e

All five sequential gates passed on DANS1 at High priority, 16 Rayon workers and 16 Cargo jobs. No full build ran locally. No application installation, deployment, git staging, or push was performed by this release task.

| Gate | Seconds | Result |
| --- | ---: | --- |
| Scripts-disabled dependency restore | 12.371 | Pass |
| Typecheck | 7.549 | Pass |
| Focused tests | 1.742 | 140 passed, 0 failed/skipped/cancelled |
| Web production build | 4.414 | Pass |
| Native application and NSIS bundle | 143.681 | Pass |

Parent freeze scope: `47df19d2548b7bcb0d3d3afaba25d0904eb2bccb74d9335293ca49558ce5110c` (15 scoped application files). The guard passed before packaging. The complete transferred source snapshot contains 524 web files and 101 native files; manifest checks before transfer, on extraction, between build gates, after build, and after collection passed. Final local source drift is empty.

- Web/source archive SHA256: `197ab630793e7604fde06b80e8b27e20ac82e84c145ff93ef58ced9829da205b`
- Native/source archive SHA256: `9e85e6501cbe8e92b7f504ba1b9b41b3be8268059955e065a852a1f032b2f6d7`
- Copied native/artifact archive SHA256: `19828b73b547f9c7fbebdc7cfaccc140f9678852f7434c14204286e46df31572`
- Copied web/artifact archive SHA256: `ac44c6b59848e4765584acd1724b48cc489256befc24b8f2d39c7dae494b12c8`
- Application EXE SHA256: `da08ac88876200e8291e91abb37b3e2c73ffc941f4cb9a88fb66f43bd65db899`
- NSIS setup EXE SHA256: `472575e567e48dcbca2816dc8661787da0225d8e0881364e76c53387afeb9823`

Both copied archives passed SHA256, byte-size, safe-path, exact-file-list and every-file checks before handoff. Ten native/sidecar files and 200 web files were extracted into the new release directory. Original build completion asset hashes are cross-checked separately against the extracted artifacts. The older 049 native target was copied into the independent new run as a compiled dependency cache; Cargo then compiled the current application and engine host and produced the new executable identity above.

Evidence lives in `release-197ab630793e/`: `transfer-record.json`, `completion.json`, `native-completion.json`, all gate stdout/stderr logs, `artifact-manifest.json`, `web-artifact-manifest.json`, `artifacts-verified.json`, `build-identity-verified.json`, and timestamped `source-drift-*.json`. Original archives and extracted artifacts remain available there. Parent owns native launch and browser acceptance, which are separate from build success.

Production preview is bound to Dans1 loopback 8090 and forwarded only to local loopback 8090 through the held owning SSH session (tool session 57354). It returned HTTP 200 before handoff. Existing 8088/8089 previews were preserved. Keep the session alive while production QA uses it.

The first launch was refused by the remote PowerShell script policy before any build began. The launcher now uses process-scoped script permission for the verified authorized scripts; no permanent machine policy was changed. Details are retained in `remote-launch-notes.md`.
