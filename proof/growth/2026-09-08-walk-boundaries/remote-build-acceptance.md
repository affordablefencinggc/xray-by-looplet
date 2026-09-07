# Remote build acceptance — 197ab630793e

All five sequential DANS1 gates passed: scripts-disabled dependency restore (12.371 s), typecheck (7.549 s), focused tests (1.742 s; **140 passed, zero failed/skipped/cancelled**), web production build (4.414 s), and native executable/NSIS build (143.681 s). Gate records observed High priority, 16 Rayon workers and 16 Cargo jobs. The verified worker loaded the existing DANS1 job-object policy applying High priority to the process tree. No additional live-process snapshot was captured before the build ended; gate observations and worker policy are the available process evidence.

Parent freeze scope `47df19d2548b7bcb0d3d3afaba25d0904eb2bccb74d9335293ca49558ce5110c` passed the 15-file prepackage guard. Full snapshot: 524 web + 101 native files. Canonical `release-197ab630793e/source-drift.json` is an exact copy of the final successful timestamped check, with status pass and drift empty.

| Identity | SHA256 |
| --- | --- |
| Web/source archive | `197ab630793e7604fde06b80e8b27e20ac82e84c145ff93ef58ced9829da205b` |
| Native/source archive | `9e85e6501cbe8e92b7f504ba1b9b41b3be8268059955e065a852a1f032b2f6d7` |
| Native/artifact archive | `19828b73b547f9c7fbebdc7cfaccc140f9678852f7434c14204286e46df31572` |
| Web/artifact archive | `ac44c6b59848e4765584acd1724b48cc489256befc24b8f2d39c7dae494b12c8` |
| Application EXE | `da08ac88876200e8291e91abb37b3e2c73ffc941f4cb9a88fb66f43bd65db899` |
| NSIS setup EXE | `472575e567e48dcbca2816dc8661787da0225d8e0881364e76c53387afeb9823` |

Copied archives, safe exact entry lists, byte sizes and every extracted file hash passed verification: 10 native/sidecar files and 200 web files. `build-identity-verified.json` additionally matches all 11 web asset hashes and both native executable hashes to original build-completion records. The native cache was copied into a new isolated target; logs show the current engine host and application were compiled and a new EXE produced.

Exact manifests and gate logs are in `release-197ab630793e/`. `artifacts-verified.json` records status, source/native-source identity and verified extracted destinations. Preview8090 is healthy through held loopback-only SSH session57354; prior8088/8089 previews remain untouched. Parent handles actual production/native UI acceptance. No local full build, installation, deployment, or git push occurred in this release task.

The first remote invocation was blocked before building by PowerShell script execution policy. Only the launcher was corrected to use process-scoped permission for the verified authorized scripts; permanent machine policy was unchanged. See `remote-launch-notes.md` for that retained failure.
