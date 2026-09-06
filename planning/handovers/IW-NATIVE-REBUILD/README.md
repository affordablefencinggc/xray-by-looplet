# Native rebuild handover

Start here without relying on chat history. User deleted both installed desktop apps and requested a rebuild after Git cleanup. Root approved this bounded repair at clean `3a16e98d6b28cdcb391fc753fe849ddee2dd9ffe`, branch `feat/model-wireframe-navigation`. No branch was created. Do not execute the older retained engine executable or claim browser localhost tests verify this desktop package.

## Scope and current status

- SC-01: Desktop entry/build repair implemented; root reviewed four source files; typecheck and diff whitespace checks passed.
- SC-02: Fresh Windows x64 NSIS build completed successfully from current shared Studio source. No database migration, dependency installation, or network dependency download was performed; Cargo ran offline.
- SC-03: Independent actual native WebView verification belongs to `/root/native_app_qa` and is pending in this handover. No completion or installation claim follows from the build alone.
- SC-04: Root review, explicit file staging and checkpoint remain pending. Do not commit or push without root direction.

Owned product files: `index.html`, `src/desktop.tsx`, `package.json`, `src-tauri/tauri.conf.json`. The desktop entry mounts the existing Studio inside a small TanStack Router adapter, with AuthProvider, PreviewHostBridge, AgentationOverlay and AppErrorComponent. It uses a memory route because the packaged document URL ends in `index.html`. The browser SSR routes and product implementation are unchanged. The missing entry previously prevented the SPA/Tauri build.

The new `build:desktop` npm script uses the existing `scripts/with-app-env.mjs` wrapper. Tauri invokes that script before packaging. There is one Tauri configuration: product `X-Ray by Looplet`, version `0.1.0`, identifier `com.looplet.xray`.

## Executed build and immutable evidence

Output directory: `proof/audit/IW-NATIVE-REBUILD/build-2026-09-05T12-53-14-813Z/` (ignored generated output).

- `typecheck.log`: `npm.cmd run typecheck`, exit 0.
- `tauri-build.log`: `npm.cmd run tauri:build -- --bundles nsis`, exit 0; Vite transformed 1866 modules, Rust release compilation completed, one NSIS bundle finished.
- `source-manifest.json`: 300 source/config/resource inputs, captured during build and rehashed after completion with zero mismatches. SHA-256 `d1a01d449e15e7deae3d461ef6aea9c932211062d136a8b5f3af1fdeba7469d1`.
- `build-result.json`: exact artifact paths, byte counts, hashes and UTC timestamps.

The build child added the existing `C:/Users/danie/.cargo/bin` to PATH, removed `DATABASE_URL`, and set `CARGO_NET_OFFLINE=true`. Existing Rust 1.98, Visual Studio C++ BuildTools, NSIS and WebView2 were used. Build warnings report the existing shell-wrapper deprecation, large JS chunk, slow Tailwind transform and home-path canonicalization; they did not fail the build.

Fresh executable: `src-tauri/target/release/xray-by-looplet.exe`, 34,641,920 bytes, SHA-256 `d934290e23a39f454f710ee7da97462821a11cfcf08a972ee7895b768059a71a`, written `2026-09-05T12:52:52.1099266Z`.

Fresh installer: `src-tauri/target/release/bundle/nsis/X-Ray by Looplet_0.1.0_x64-setup.exe`, 27,364,262 bytes, SHA-256 `368069d7f42e8bc335c80f53cd0f224fef6c8d8ee2099f766d287d92d648714d`, written `2026-09-05T12:52:52.0557703Z`.

## Native verification contract and remaining boundaries

The builder has not launched or installed the app. Independent QA must bind its owned process to the fresh EXE hash, attach to that process's actual WebView2 using temporary child-only CDP settings, and preserve user data with an isolated QA profile. Exercise the real native Open plan dialog and import contract; never substitute an injected job/payload or browser localhost screenshot. Capture native WebView before/after, actual route/tab interactions, errors and source identity. A WebView screenshot does not include the operating-system window border.

Temporary WebView2 CDP is documented at https://playwright.dev/docs/webview2. No persistent registry debugging changes or packaged debugging configuration were introduced.

The Rust host still requires an explicit `XRAY_ENGINE_PATH` for its calculation runner; this package does not configure a bundled `externalBin`. Existing engine unavailability must remain explicit. Source resources alone do not establish a working bundled Python executable. Native rebuild does not create arbitrary PDF/IFC-to-BIM reconstruction, verified quantities, or image rendering.

User high-rise inputs are under repository-relative `downloads/high_rise_plans`; preserve originals. The similarly named Windows Downloads location was the wrong inventory location. No original plan or user profile data was touched by this builder.
