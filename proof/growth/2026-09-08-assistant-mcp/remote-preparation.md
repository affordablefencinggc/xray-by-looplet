# Stage 11 assistant release preparation

Prepared only. No source snapshot, archive, SSH/SCP, build, preview launch, installation, provider request or normal-profile mutation occurred. This preparation is separate from Stage 10 and preserves all earlier helpers and evidence.

## Supervisory native guard correction

The native response envelope now rejects every `functionCall` whose name is absent from the current request's declarations. Search turns allow no function calls. Validation covers the complete model response before any part is returned, so a mixed known/unknown batch is refused as a whole. The incomplete/undeclared response error explicitly says that previously completed actions remain. Existing frontend checks remain an additional boundary.

`assistant_ai.rs` contains nine tests, including the new known/unknown/empty-declarations/search regression. `material_ai.rs` contains five tests, including the two new assistant credential/page-limit regressions. These are source counts, **not executed test passes**. Rustfmt parse/check and whitespace checks passed; Rust compilation and execution remain pending the authorized Dans1 run.

Latest reviewed source identities (not a release snapshot):

- `src-tauri/src/assistant_ai.rs`: `60723e23c66b05d21def3b2aaccfca07d01e7e20ea4f079c25b3efff35c531af`
- `src-tauri/src/material_ai.rs`: `426b42ecfb1f06a1b0c32a9a4b6c0acdac91c16579848d8e151b2209e4701944`
- `src-tauri/src/lib.rs`: `00d9a3d9e3b25d0071872ff20c605395d66923c89d114c014110f14f5ac3d9ea`

The helper code contains no hardcoded new native archive hash. The final source snapshot must include the corrected file and derive the new archive identity after root's QA/source freeze. No frozen manifest currently exists.

## Gates and identity

- New preview and tunnel: 8093. Run ID is the first 12 hexadecimal characters of the new web source archive SHA256.
- Retains all 20 daily-recovery TypeScript test files; adds `assistant/mcp.test.ts`, `assistant/conversation.test.ts`, `lib/assistantAi.server.test.ts` and `assistant/appTools.test.ts`. All 24 files exist at preparation verification. Test counts and pass claims require actual execution.
- Seven sequential gates: dependencies, typecheck, focused-tests, web-build, native-build, native-assistant-tests, native-material-tests. Rust uses `cargo test --locked --release --manifest-path src-tauri/Cargo.toml --lib <filter>` with `assistant_ai::tests` and `material_ai::tests` separately. Rust runs after the generated desktop assets/resources exist; final native completion is withheld if either fails. No provider calls are made by those unit tests.
- Worker is restricted to Dans1, approved High priority and all 16 workers. Web and native builds are sequential. Existing resource policy is imported and its 16-worker setting asserted.
- Both builds receive `VITE_XRAY_BUILD_ID=$RunId`. Completion records and identity verification require that exact ID, including its presence in production JS. Visible badge equality still needs browser/native QA.
- New `package.json` and `package-lock.json` are included in the web archive. Freeze guard requires both, the three changed Rust files and all four assistant test files. It verifies MCP SDK dependency/lockfile agreement. Worker installs the frozen dependency graph with `npm ci --ignore-scripts`.
- Cache source remains the independent original run `38a64f0b8c2b`. Before copying, its successful native completion must have original native hash `9e85e6501cbe8e92b7f504ba1b9b41b3be8268059955e065a852a1f032b2f6d7` and original executable hash `14db2b026c8a8aaaf75c54f47be9405db0f5e81a1cb9ee455582d9646bfe72ca`. The new native source hash may differ. Both identities are recorded; Cargo rebuilds changed Rust. Original cache and reports are never overwritten or deleted.

## Verification performed

`release-tooling-verification.json` records successful JS syntax, all prior test paths retained, freeze refusal, ordering, identity injection, cache policy and preview isolation checks. `powershell-preparation-check.json` records successful parser checks of all three PowerShell helpers without executing them. `release-tooling-prepared.json` records all copied/adapted helper hashes. These results do not establish compilation or application acceptance.

## Commands after explicit root QA and SOURCE FREEZE

Root must first produce a new source snapshot manifest covering the final assistant/recovery/sheet changes, SDK manifests and changed native files. Do not reuse the Stage 10 spec or old frozen hashes.

```text
node scripts/growth-snapshot.mjs <new explicit source specification>
node proof/growth/2026-09-08-assistant-mcp/release-freeze-guard.mjs <new manifest> <new scope SHA256>
node proof/growth/2026-09-08-assistant-mcp/package-web.mjs
node proof/growth/2026-09-08-assistant-mcp/package-native.mjs
node proof/growth/2026-09-08-assistant-mcp/remote-orchestrator.mjs transfer <new run ID>
node proof/growth/2026-09-08-assistant-mcp/remote-orchestrator.mjs build <new run ID>
```

After `WEB_READY`, an independently held process can run `remote-orchestrator.mjs preview <new run ID>` for production browser QA while the worker continues its native build and Rust tests. After all seven gates pass, run `remote-orchestrator.mjs collect <new run ID>`, `release-verify-artifacts.mjs <new run ID>`, and `release-build-identity.mjs <new run ID>`. Inspect preserved logs, source drift, native/provider status and actual assistant UI separately. No paid provider or MCP endpoint is exercised merely by building.

Binary archives, normal browser/native profiles, user configuration and secrets remain outside source/report scope. Full browser/native assistant acceptance remains outstanding until the final candidate is tested.
