# Production default-engine packaging gap — proposed contract

Read-only proposal. No native/package source changes in this slice. The qualified real executable and canonical schema asset are proven in fixed/; production installation still needs explicit resource resolution.

## Smallest integration

1. scripts/build-sidecar.py and scripts/build-sidecar.mjs: converge on the same real CLI build definition. Use console-enabled executable, include contracts/xray-job-bom-v1.schema.json at bundled contracts/, pin/record build dependencies, and fail nonzero for missing build Python/PyInstaller, build failure, missing output or failed copy. Remove success-on-missing-Python branch and machine-specific runtime fallback. Build-time interpreter should be explicitly configured; this is separate from runtime engine resolution. Never generate a placeholder.
2. src-tauri/tauri.conf.json: bundle the qualified engine at a fixed resource destination engine/bin/xray-engine.exe on Windows (platform-specific name elsewhere). Source Python resources alone do not satisfy the host executable contract. Require qualification before packaging; no silent optional resource.
3. Build artifact manifest: record target triple, executable SHA256, canonical contract SHA256, schema IDs/ruleset and source-manifest identity. The executable SHA expectation should be embedded into the native build from the verified build manifest; reading a mutable adjacent manifest alone does not prevent replacing both manifest and executable. Hash final artifact bytes after any signing step that changes bytes. Record exact bundled bytes.
4. src-tauri/src/lib.rs setup/native adapter: resolve app.path().resource_dir() plus fixed engine resource path, canonicalize and reject escape/nonregular files, verify the expected binary digest, construct ConfiguredRunner, and store the selected runner in managed state. The native BOM adapter and status command must share that runner. Do not set process-global XRAY_ENGINE_PATH to manufacture a default.
5. engine/host/src/lib.rs: retain ConfiguredRunner::new(absolute_path) validation and existing run_bom_with execution seam. Extract engine_status_with(&dyn CommandFactory, bounded status limits) from engine_status so the managed resource runner is tested and used consistently. Keep source binding, process-tree kill, input/result limits and schema handshake unchanged.

## Explicit override semantics

XRAY_ENGINE_PATH remains an intentional explicit override for a new test/developer process, with the existing absolute regular-file validation and contract handshake. If supplied but invalid, report unavailable; never silently fall back to the packaged engine. If absent, use only the verified fixed bundled resource. No PATH search, engine/bin discovery, repository Python or current-working-directory fallback. No persistent environment settings. The override is not evidence that an installed default engine works.

## Console executable and first launch

The Python build's --windowed option is incompatible with stdin/stdout transport. Use --console, and set Windows CREATE_NO_WINDOW on actual engine Command construction so the CLI retains pipes without flashing a console. A source search found no creation_flags/CREATE_NO_WINDOW in the current host; the earlier assumption that hiding was already configured was incorrect.

Current bounded_status_output uses a2-second timeout. A PyInstaller onefile executable must extract/load its runtime on each process start; first launch may also encounter antivirus inspection. A healthy engine can therefore be labelled unavailable before its handshake. Run status off the UI thread (Tauri async plus spawn_blocking), expose a checking state, and use a bounded cold-start allowance such as10seconds, retaining4KB output cap, child-tree termination and cancellation. Measure cold and warm timings before fixing the release budget. Never reinterpret timeout as success. A verified per-process/path+digest handshake cache may reduce repeated status probes, but must be invalidated if executable identity changes; BOM execution must still validate its response. If cold-start measurements remain unstable, consider an onedir bundle as a later packaging decision rather than an unbounded timeout.

## Minimal proof before acceptance

- Packaging command tests: missing interpreter/dependency/output/copy all fail; console flag and frozen schema inclusion are required; target/resource manifest paths match.
- Resolver tests: absent override chooses only bundled verified resource; valid explicit override selected; invalid override never falls back; missing/tampered/wrong-target resource and path escape rejected.
- Status tests: delayed valid handshake inside allowance succeeds; timeout, oversized output, wrong schema/ruleset and nonzero exit fail and terminate descendants. No UI blocking.
- Real installed-layout executable: environment override absent, PATH without Python, launch from unrelated working directory, cold status and actual four frozen stdin/result fixtures. Compare exact response JSON and source bindings; inspect no console flash.
- Native UI: fresh disposable project/verified fixture, actual host BOM IPC receipt and displayed lines match real engine; cancel/failed status preserve prior project/evidence. Record selected resource path/digest as developer diagnostics, not user success text.

These steps establish packaged default-engine behavior only. The already-qualified CLI does not prove full PDF/CAD features or a default installed native path.
