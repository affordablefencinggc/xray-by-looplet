# SC09 room/roof — build succeeds, built-browser asset gate fails

Status: **built-browser FAIL**. Do not treat a successful build command as production-browser acceptance.

Source: frozen `sc09rr-bf09e36e3100`, digest `bf09e36e3100a5cfa9ef4565892edc8e28fdb791a3ec9341375af7fd91394e55`, base HEAD `6477356316abcaee229b572dd5fc79d381b565cb` plus the [exact source patch](../source/sc09-room-roof.patch) and [file manifest](../source/sc09-room-roof.manifest.json). No source files changed between the dev4 campaign, build-1 and corrected machine-3 gate.

## Executed build

On DANS1, the existing owned-process functions launched the frozen runtime's `node_modules/npm/bin/npm-cli.js run build` in the frozen `source/` directory, after dev4 passed. Resource policy: High priority and all 16 logical processors. Source hashes were checked before and after. Only the web build ran; no dependency installation, typecheck or test rerun was part of this build step.

- [Build result](../machine/build-1/results.json): **PASS**, SSH exit 0.
- [Command receipt](../machine/build-1/serial/web-build/receipt.json), [stdout](../machine/build-1/serial/web-build/stdout.log), [stderr](../machine/build-1/serial/web-build/stderr.log).
- Preview build environment: `VITE_AUTH_ENABLED=false`, `VITE_XRAY_BUILD_ID=sc09rr-bf09e36e3100`, `DATABASE_URL` unset. The normal migration command explicitly skipped external database migrations; no deployment/database acceptance is claimed.
- The first SSH orchestration attempt exceeded Windows' command-line limit before launching the build. Sending the same command over SSH standard input then launched this single recorded build. No output was overwritten.

## Built-browser failure

[Original built1 receipt](../campaigns/sc09rr-bf09e36e3100-room-roof-built1/output/browser-results.json): **FAIL**, 6/135 completed operations, failing operation index 6. Exact error:

```text
resource-http-error in default: Stylesheet: HTTP 404
http://127.0.0.1:8091/assets/styles-BRNbTYdU.css
```

[Failure screenshot](../campaigns/sc09rr-bf09e36e3100-room-roof-built1/output/failure-op-6-default.png) was inspected. The page has rendered content, but that does not waive the recorded resource error or prove the remaining journey. [Launcher result](../campaigns/sc09rr-bf09e36e3100-room-roof-built1/output/launcher-results.json) records owned-process cleanup; the failure and captures are retained.

The build's asset inventory contains `assets/styles-B9B94adg.css` (141,827 bytes), not the requested `styles-BRNbTYdU.css`. Read-only inspection found the old reference in the generated server router while the current client references the existing stylesheet. The originating cache/manifest cause is not yet established by this record. No bundle/reference was patched, no missing request was exempted, and no cache was deleted.

## What remains proven

- [Dev4](../campaigns/sc09rr-bf09e36e3100-room-roof-dev4/output/browser-results.json): **135/135 PASS**, zero unexpected browser errors. Root inspected all 16 desktop/tablet captures, including real room/roof edits, independent stale withholding, explicit rebind, readable full provenance and reload. Some tablet captures show a scrollable card rather than every field simultaneously; executed assertions and complementary desktop captures identify the relevant states.
- [Corrected machine-3](../machine/machine-3/results.json): **2,032/2,032 PASS**, fail 0, all seven command exits 0. It uses the same frozen source; machine-2 remains unchanged.

Limits: built-browser room/roof acceptance remains open. No native package, deployment, live-device, arbitrary project certification or inferred-geometry verification claim. SC-09 is not promoted by this failed built campaign.
