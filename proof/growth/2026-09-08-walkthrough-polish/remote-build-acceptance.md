# Walkthrough polish — remote build acceptance

Frozen candidate **38a64f0b8c2b** passed all five sequential gates on DANS1. The earlier candidate197 remains preserved. This records build/artifact acceptance; parent owns actual production and Windows UI acceptance.

| Gate | Seconds | Result |
| --- | ---: | --- |
| Scripts-disabled dependency restore | 10.945 | Pass |
| Typecheck | 7.647 | Pass |
| Focused tests | 1.975 | 145 passed; zero failed, skipped or cancelled |
| Web production build | 4.372 | Pass |
| Native executable and NSIS bundle | 145.573 | Pass |

Each gate observed High priority with16 Rayon workers/16 Cargo jobs. Live process evidence was also captured while the native build ran: seven Node/shell/Cargo/rustc processes belonging to the isolated run were High priority with affinity65535 (all16 logical processors). Exact observation: `release-38a64f0b8c2b/live-process-policy.json`, recorded16:18:34.844Z. Existing DANS1 job-object policy applies priority across the process tree. No local full build ran.

Parent's21-file freeze scope `420a03c0d9916921e895bed85e855c5df14dda46443dab8a09fb80e09aa78bcd` passed the guard before launch; each scoped hash matched the packaged source. The full snapshot has530 web and101 native files, including both runtime arm assets and the clean-plan/arm source and tests. Archive, transfer and extracted source checks passed; canonical final `source-drift.json` records631 matching files and empty drift.

| Identity | SHA256 |
| --- | --- |
| Web/source archive | `38a64f0b8c2b4a3293386f63845be806805ea58a3e68ff50839f06c735c57ed1` |
| Native/source archive | `9e85e6501cbe8e92b7f504ba1b9b41b3be8268059955e065a852a1f032b2f6d7` |
| Native/artifact archive | `0b1d2b097d7f8d37550b6d353c73cc5f8f17c2e8870f12fb59b48bb0589f77e3` |
| Web/artifact archive | `7ef51b7a8ae7ef2133184ec59fa9f26789dc402d7a1c2a93e6dac53e036e50d5` |
| Application EXE | `14db2b026c8a8aaaf75c54f47be9405db0f5e81a1cb9ee455582d9646bfe72ca` |
| NSIS setup EXE | `b15a235e66a5c358c8b0e13f31662f974b9194fbb0a40b57537a9e2aae7ff0e5` |

Copied archives passed byte-size/SHA256, safe exact entry lists and every-file checks. Ten native/sidecar and202 web files were extracted into the new release directory. `build-identity-verified.json` additionally matches11 web asset hashes and2 native executable hashes against original build-completion records, and verifies the shipped `arms.glb` and `LICENSE.txt` directly against the frozen source identities. The prior049 native dependency cache was copied into an independent target; logs show current engine host/application compilation and a new executable identity.

Exact logs/manifests are under `release-38a64f0b8c2b/`: `transfer-record.json`, `completion.json`, `native-completion.json`, all gate stdout/stderr logs, both artifact manifests, `artifacts-verified.json`, `build-identity-verified.json`, `live-process-policy.json` and canonical/timestamped source-drift records. Source freeze guard is `release-freeze-guard.json` in this folder.

Verified native executable: `release-38a64f0b8c2b/artifacts/src-tauri/target/release/xray-by-looplet.exe` (271,630,848bytes). It was handed to root for the isolated native launcher; no launch or installation was performed by this release task. Preview8091 returnedHTTP200 through held owning SSH/tunnel session22085. Prior8090/8088/8089 previews were preserved. No deployment, application installation, source change, git staging or push occurred during these build gates.
