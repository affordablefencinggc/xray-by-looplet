# Isolated native status smoke

Preparation only. Do not launch until root has verified the final r2 artifacts. The failed `d0d468747f41` candidate and all of its proof remain preserved. These helpers take the replacement run ID explicitly.

`launch-native.mjs <run ID>` requires matching transfer, artifact-verification, build-identity and native-completion records with all seven gates passing. It verifies the extracted EXE hash again before launching. It uses a new `.temp/assistant-native-<run ID>` profile and refuses to reuse an existing profile or occupied CDP port **9273**. It does not install an application, copy user data, close other processes, configure credentials or invoke a provider.

After artifact signoff and launch, prepare the exact candidate scenario:

```text
node proof/growth/2026-09-08-assistant-mcp-r2/prepare-native-status-smoke.mjs <run ID>
node scripts/fast-cdp-test.mjs growth-assistant-native-r2 proof/growth/2026-09-08-assistant-mcp-r2/native-status-<run ID>.json --cdp 9273
```

The scenario requires native bridge presence, completed project hydration, the exact visible build badge, structured credential-free assistant status, model agreement with the existing materials provider, native rejection of malformed requests, and harmless cancellation of a nonexistent request. It opens the assistant and checks local MCP tool connection, usable input, disabled empty send and panel bounds. It captures workspace and assistant screenshots. No valid provider generation request, credential configuration, paid search, drawing import or user project write is performed by the scenario. Fresh application startup may initialize its own isolated QA storage.

Inspect both screenshots and the browser error output after execution. A passing status/validation smoke does not establish live Gemini output, real provider credentials, external MCP servers, every tool action, interrupted in-flight network cancellation, original-profile migration or macOS/Linux native support. Those require separate authorized evidence.

After QA, root should close this isolated process normally and record its exit using the PID from `qa-launch.json`. Do not kill a process by name or touch the installed app.
