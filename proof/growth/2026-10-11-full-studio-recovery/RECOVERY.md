# Full studio recovery — restored; CI/package build accepted; runtime/deployment open

## Current continuation — October 12, 2026

Earlier status paragraphs below are historical campaign snapshots. `main` remains at `be29918a`; continuation work is on `recovery/full-studio-20261011` only. **The complete CI/distribution matrix is green** for exact tested code `c93ae1e7354e7d295196ab5db0d363ed9e1a34eb`, run `38150581911`, completed `2026-10-11T15:38:33Z` (October 12 local continuation date). Web, SC-07, Windows and Ubuntu jobs all succeeded. This closes CI/package-build acceptance only; installed launch, qualified native runtime, macOS and deployment remain unaccepted. [Final separate step proof](steps/ci-matrix-final.md).

- [x] Repair/preflight the native CI build path: [separate step proof](steps/ci-native-build-preflight.md); subsequent remote acceptance is in the final proof.
- [x] Obtain a green CI run for the exact tested branch commit: run `38150581911`, `c93ae1e7`, all four jobs successful.
- [x] Verify produced Windows/Linux package identities through CI logs and artifact metadata; independently download/hash/content-check Windows installers, web output and SC-07 proof. Linux ZIP/tar/member verification is now separately complete. No qualified frozen runtime is staged in this CI path. [Exact verification levels](steps/ci-matrix-final.md).
- [x] Independently download/hash/check the Linux archive: [separate step proof](steps/linux-artifact-integrity.md). All three package hashes recorded; AppImage and staged application/launcher modes are `0755`. No package installation or execution.
- [ ] Native launch/runtime acceptance, macOS package evidence and actual deployment acceptance.
- [x] Prepare and locally test fresh Windows engine qualification tooling and source/reference inputs: nine helper tests and six TypeScript reference cases passed. [Separate preflight proof](steps/frozen-engine-qualification-preflight.md).
- [ ] Execute fresh Windows engine qualification on DANS1. User authorized engine-only qualification, stopping before app installation; attempt `1a9f4e6c8202` was blocked by the effective PowerShell `Restricted` policy before the worker/build ran. No new executable or qualification; no policy bypass. Inputs preserved, task-owned processes gone, old engine pin and `main` unchanged. [Block and exact limits](steps/frozen-engine-qualification-preflight.md).
- [x] AI review of selected saved desktop/tablet screenshots: [separate step proof](steps/saved-screenshot-review.md). Human signoff remains distinct; compact controls and a partly obstructed portrait bottom row remain open.
- [x] Verify CI web/transport artifact digest and content: [separate step proof](steps/ci-artifact-integrity.md), finalized for `c93ae1e7` in the matrix proof.
- [x] Restore shell-free raw status acceptance tests: [separate step proof](steps/hermetic-raw-status-proof.md); local tests/strict clippy and remote Linux/Windows execution passed.
- [x] Characterize the long silent Linux packaging stall and add bounded RPM configuration: [separate step proof](steps/linux-rpm-bounded-packaging.md); configuration/runner tests and actual DEB/RPM/AppImage packaging passed without dropping targets. Root cause is not proven.

### Remote checkpoint after `857d7f3d`

Run `38148677824` independently passed web audit and Linux SC-07 proof including all four raw-status tests (host 36 + 4, Unix descendant proof 1, Tauri 52). Downloaded web artifact `11705551264` SHA-256 `75a101d18cb52ffbc944e540b387d24222fa8cb7f59119d55d962c0a5478fb2a` retains both required Vercel metadata files; proof artifact `11705875983` SHA-256 `1489a1fcc069ae15ee8350ea446aed84027464063dde527f217fe858911d01db` reports 33 verified/2 partial, `completionClaim: false`. Windows build/upload succeeded; Ubuntu remained at RPM and the run was canceled as superseded, so no full green run was claimed for that source. Windows artifact `11706652706`, SHA-256 `9d2ff38b677bd303970af2829be8893016104d99ec8c05249344b8773ec7b948`, was subsequently independently downloaded/hash/content-checked successfully.

Superseded runs `38146549601` and `38148677824` were explicitly canceled, not failed or accepted, to end duplicate work and retrieve their logs. They proved Linux compilation/DEB progress but stalled silently at RPM. The next checkpoint selected supported RPM Zstd level 3, preserved all targets and added a 20-minute child deadline with 30-second progress diagnostics; run `38150581911` then completed all Linux targets in 14m31s. This is successful mitigation evidence, not a proven root-cause diagnosis. Latest local targeted regression suite: 14 passed.

### Acceptance caveats found during independent continuation review

- Review found that the hermetic libtest fixture's wrapped stdout left delayed-success coverage at the bounded-read/substr level and could mask the nonzero-exit boundary. The follow-up `harness = false` compiled-self integration target now proves raw `engine_status_with` success after 2200 ms, compatible-JSON/nonzero-exit rejection, each invalid contract field and malformed/noisy/oversized stdout. Local and remote Linux/Windows tests passed. Production parser and fail-closed transport are unchanged.
- CI's Linux SC-07 proof cannot establish the Windows-only security requirements by itself; matrix test results must be inspected separately. A green proof job is not universal platform acceptance.
- The current CI prepares empty engine directories and runs only the legacy sidecar dry-run. It does not stage the qualified frozen engine or supply `XRAY_BUNDLED_ENGINE_SHA256`. Windows selection therefore stays unavailable without an explicit trusted override; bundled Linux selection is not implemented. Desktop package success must be labeled shell/package evidence, not full native BOM acceptance.
- The earlier Windows matrix placed two cargo commands in one PowerShell step; final-command exit propagation could mask a first-command failure. The final workflow uses independently failing steps, both remotely successful; older executed summaries were also individually inspected.
- Linux upload wraps the bundles in a mode-preserving tarball. Independent download verified the final ZIP digest; two local inspectors agreed on 588 tar entries, and the AppImage plus staged binaries/launcher retain `0755`. Only the inert tar container was unpacked from the ZIP; package bytes were streamed for hashes, never installed or executed. This closes archive identity/mode verification, not installed-launch or native BOM acceptance.
- Reusing the historical native-transfer generator omits the new `tauri.windows.conf.json`. Do not edit historical evidence; future DANS1 transfer must explicitly include all platform overlays in its source manifest. DANS1 is reachable, but no new qualified build was launched in this preflight.
- No Vercel CLI login/token or project linkage was found locally; DANS1 also has no Vercel token/login. No credentials were read or printed, and no deployment was attempted.

## Scope and identities

User authorized proceeding with recovery into a separate worktree. Current main is preserved; no push or deployment is authorized by this campaign.

- Recovery baseline: `69a2b5b907c9e451785b1635e92a6a0b1a7e6b91` (`feat/closeout-sc09-remainder`).
- Main to preserve: `75bd12b5f3447b7ceb0fe742b92b6f46822bb450`.
- Common ancestor: `ee4372e46b650897e6fbb36a9ce56b9eec670a7e`.
- Branch: `recovery/full-studio-20261011`.
- Worktree: `C:\Users\danie\Documents\Codex\2026-10-03\qu\work\az-web-bundle-r2\xray-recovery`.
- Initial merge: 61 changed paths, 12 conflict paths. Full branch history is retained; historical proof is not rewritten.

## Acceptance checklist

- [x] Establish isolated worktree; original main initially clean.
- [x] Verify fuller branch includes source-linked viewer, four model bundles, scope, Render, visual settings, diagnostics and byte-based PDF identity guard.
- [x] Resolve conflicts without reverting evidence-first pricing/provenance safeguards (12 conflicts; engine host kept branch transport, mcp_server unioned with main cache + list_disciplines, engine test files kept branch versions targeting the merged modules).
- [x] Review dependency origins and executable entrypoints; install with lifecycle scripts disabled (`npm ci --ignore-scripts`: 540 packages; npmjs.org + pinned cdn.sheetjs.org xlsx tarball).
- [x] Typecheck and focused/full applicable tests; failures reported, not hidden (tsc exit 0; Python engine 212 passed/1 skipped/223 subtests; source suite exit 0 after runner fix).
- [x] Verify desktop/tablet development UI, controls and PDF mismatch guard (raw-CDP loopback runs; see Verification log and VERIFICATION.md).
- [x] Verify test/dev stages under a genuinely CPU-capped local runner (Windows Job Object Flags=5 CpuRate=2000 = 20% aggregate cap).
- [x] Production web build gate: capped `vite build` **exit 0** (`built-web01`; `db:migrate` intentionally NOT run — no credentials involved); built output served via `scripts/preview-built.mjs` on loopback 8181 and the full scenario **PASS 83/83** (`built-cdp-full3`).
- [x] Record source identity, checks, screenshots and limitations per completed step (VERIFICATION.md; screenshot sha256s in run results JSONs).
- [x] Verify original main unchanged and clean; clean up only campaign-owned processes.

## Reconciliation decisions

- Keep the recovered studio and persistent project/evidence architecture. Restore main's discipline selection in the shared adjustable/collapsible top-row component.
- Preserve main's discipline metadata at the unpriced CRM draft boundary. Never reintroduce fabricated pricing or a successful external push without authenticated transport and durable receipt.
- Keep the broad source-test manifest and Windows-safe batching; add discipline and ModelScope tests plus main's smoke-runner tests.
- Retain the recovered build/preview architecture. Review main's static-dist copy against the actual SSR output rather than copying it blindly.
- Retain main's Recharts 3 dependency upgrade, engine discipline/cache/diagnostic improvements and Windows process fixes.

## Status

Merge resolved and committed on `recovery/full-studio-20261011`; not pushed, not deployed, main untouched. Not a product-completeness declaration: no automatic PDF-to-BIM, no certified quantities, no native/desktop acceptance, no deployment acceptance and no full security assurance is asserted. Passing historical proof or unit tests alone does not establish restored interactive feature parity.

## Verification log

- `tsc --noEmit`: exit 0 (post-merge).
- Python engine + MCP (`pytest engine/python/xray engine/server`): **212 passed, 1 skipped, 223 subtests** (includes merged `test_mcp.py` requiring `list_disciplines`).
- `npm run test:src` via capped runner (`tests02`): **exit 0**, all 6 batches. First run (`tests01`) failed 5 gate-identity tests — runner exported `VITE_AUTH_ENABLED=false` into the test stage; fixed `run-capped.ps1` to set build flags only on web/preview stages (tests assert the default auth-enabled environment).
- Browser verification: raw-CDP (`scripts/fast-cdp.mjs`, loopback only, fail-fast) against the CPU-capped dev server on `127.0.0.1:8180`, campaign-owned Chrome (`--enable-automation`, dedicated profile). Across runs `full3`–`full12` the following product assertions all passed:
  - hydration (`[data-hydration-status=ready]`), no console errors, no uncaught exceptions, no HTTP errors;
  - discipline top-row renders with 7 disciplines; clicking **Structural** flips `aria-pressed` (run `full5+`);
  - **Redburn sample plan loads** through the Project dialog (`__SAMPLE_REDBURN__` select) with no error state;
  - 3D canvas mounts only after the matching source PDF is loaded (`canvas[data-cutaway]`), heading `SOURCE RECONSTRUCTION / REDBURN BR250157`;
  - Drawing-evidence inspector (`building-inspector`) plus `.building-part-picker` select over the model objects; selecting a part shows its label in the inspector;
  - **Wall cutaway** toolbar button flips `canvas[data-cutaway=true]`;
  - **Model scope** overlay (`[data-model-scope]`) mounts; **Visual settings** panel opens (trigger matched by text) exposing `Scope magnification`/`Scope diameter` range inputs; setting magnification to 6x updates its output;
  - **Renders** workspace renders content (screenshot `full-06-render.png`);
  - **Diagnostics drawer** expands via its bar click and exposes tabs **Logs / Console / Errors / Status** (run `full8`);
  - **PDF mismatch safeguard**: with the Redburn binary loaded, switching the prepared model to **Crown Wharf** shows `This plan has no prepared 3D reconstruction`, hides the canvas, and switching back to **Redburn** remounts it — verified as part of the end-to-end PASS runs (screenshots `full-07-mismatch.png`, `full-08-rematch.png`).
- **Final verification: the complete 83-op scenario verdict `PASS` on BOTH dev (`dev-final`, 127.0.0.1:8180) and the built output (`built-cdp-full3`, 127.0.0.1:8181)** — 83/83 ops, zero browser errors, all screenshots taken.
- Correction of an earlier draft of this log: the first `full10`–`full12` runs FAILED at the safeguard-wait op itself (op 76). The Caroline switch loads wireframe SVGs as *image* loads, and the runner's exact-cancellation gate (`matchesExpectedCancellation`) only recognizes `Fetch`-type GET aborts, so that abort was recorded as a browser error before the safeguard assertion ran — those runs did NOT verify the safeguard. The mismatch test was retargeted to Crown Wharf (whose scene fetch aborts are Fetch-type and declared), after which the safeguard verifies cleanly. Zero product failures were ever observed.
- Screenshots written under `dev-cdp-run*`/`dev-cdp-full*`/`built-cdp-full*`/`dev-cdp-final` with sha256 receipts in each run's results JSON. This campaign's model cannot view images, so PNGs were not visually inspected; DOM-state assertions above are the rendered-UI evidence.

### Limitations

- Early Caroline-based mismatch runs (`full9`–`full12`, `built-cdp2`) ended `FAIL` solely from the runner's expected-cancellation accounting: Caroline's wireframe SVGs load as image-type, which the reviewed exact GET-Fetch cancellation gate does not recognize, so the abort was booked as a browser error before the safeguard op ran. The final Crown Wharf-based scenario removes that noise and PASSes 83/83 on dev and built output. Zero console/HTTP/product errors were observed in any run. **Resolved in the follow-up wave below**: the runner now recognizes the HEAD availability probes behind those aborts, and the Caroline mismatch is restored as the canonical test (PASS on dev and built).
- Tablet/mobile viewports and touch interactions were not driven this wave (device scope: tablet/laptop/desktop).
- Native/desktop (Tauri) acceptance and the `py`-host engine contract were not re-run on the recovery branch this wave; `db:migrate` was not executed (no credentials).
- The `tests01` failure and the runner quoting bugs (`C:\Program Files` paths in unquoted `ArgumentList`; scenario-file UTF-8 BOM from a PowerShell write) are recorded in `xray-recovery-evidence` logs; all were fixed within the campaign.

## Tablet/laptop viewport verification (post-promotion branch work, 2026-10-11)

Main was fast-forwarded from `75bd12b5` to `be29918a` (the recovery head) and pushed; development continues on `recovery/full-studio-20261011`, which now diverges from main. Phone viewports stay out of scope (AGENTS.project.md device scope); tablets, laptops and desktops are in scope.

Run `dev-cdp-tablet1` (`scenario-tablet.json`, 32 ops, capped dev server on 127.0.0.1:8180, campaign-owned Chrome, 2026-10-11T09:45Z):

- **All 32 ops completed; `errors` opcode count 0 — zero browser errors.** Verdict `INFRA_FAILURE` came only from the runner's trailing settle (`Runtime.evaluate deadline`): the minimized campaign Chrome throttles `requestAnimationFrame`, so the final double-rAF wait stalls. No product op failed; all 6 planned screenshots were captured with sha256 receipts (`dev-cdp-tablet1/browser-results.json`).
- **No horizontal overflow at any tested viewport** — `scrollWidth == viewport width` on every check:
  - Sheets & files screen: 1180×820, 820×1180, 1280×800 — clean.
  - 3D model screen (Redburn sample loaded): 1180×820, 820×1180, 1280×800 — clean.
- **Touch-target audit (44px recommendation):** on the sheets screens only 0–1 minor offenders ("Collapse assistant" collapsed toggle). On the model screen at 1180/1280 the left-nav model pills (Redburn BR250157, Crown Wharf A4 tower, Caroline, Ruffles sample) measure **32px**, with 32–33 buttons total below 44px; at 820 portrait only 3 minor offenders (the rail collapses). Tablets render and remain usable (no clipping, no overflow), but the 32px model pills are honest touch-target debt on the model pane — recorded, not hidden.
- Viewport screenshots: `tablet-sheets-1180x820.png`, `tablet-sheets-820x1180.png`, `laptop-sheets-1280x800.png`, `tablet-model-1180x820.png`, `tablet-model-820x1180.png`, `laptop-model-1280x800.png`. This campaign's model cannot view images, so PNGs were not visually inspected; receipt numbers and the `errors`-opcode zero are the rendered-state evidence.

## Follow-up wave: 44px touch targets + runner cancellation accounting (2026-10-11)

Both debts recorded above were fixed on `recovery/full-studio-20261011` (branch base `dd1bf565`; `main` untouched at `be29918a`).

### 1. Model left-nav pills now meet the 44px touch-target recommendation

- Root cause: `.building-left-nav button` (`src/studio/sourceBuilding.css`) carried `min-height: 32px` at base widths — the 44px override existed only inside the narrow-viewport media query, so tablet/laptop widths got the small pills.
- Fix: base `min-height: 44px` for `.building-left-nav button`. The narrow-viewport override remains (it also covers the part-picker/evidence selects there). No other selector changed.
- `scenario-tablet.json` now *asserts* it (33 ops): a new op fails the run if any `.building-left-nav` button's min dimension is below 44px, reporting the offending pills.
- Runs (20%-capped stages, campaign-owned Chrome):
  - `dev-cdp-tablet2` (dev 8180, hot-reloaded CSS): **PASS 33/33, errors 0**.
  - `built-cdp-tablet1` (rebuilt output — `built-web02` build, `built-preview02` preview on 8181): **PASS 33/33, errors 0**.
- Remaining honest debt (unchanged this wave): the compact toolbar/view-mode buttons on the model pane still measure below 44px — mouse-first controls; enlarging them is a design decision that needs its own pass, not a silent change.

### 2. Runner now accounts for HEAD availability-probe cancellations (Caroline mismatch restored)

- Reproduction (`dev-cdp-caroline1`, FAIL 19/22): the new `diagnostic` payload on runner browser-error records showed the unbooked abort was `{type: "Fetch", errorText: "net::ERR_ABORTED", canceled: true, requestMethod: "HEAD", requestUrl: "http://127.0.0.1:8180/models/caroline/wireframe-axonometric.svg", initiator: "script"}`. The app's `svgAvailable` probe is `fetch(svgUrl, { method: "HEAD" })` (`SourceBuildingViewer.tsx`), and `matchesExpectedCancellation` recognized only GET.
- Fix (`scripts/fast-cdp.mjs`): the gate recognizes idempotent read cancellations only — **GET and HEAD**; cancelled POST/PUT/DELETE always remain browser errors (fail-closed contract preserved: exact URL match, reviewed reason, bounded count, type Fetch, `net::ERR_ABORTED`, `canceled`). Unit coverage extended in `scripts/fast-cdp.test.mjs` (HEAD positive; POST/PUT/DELETE negative): 6/6 pass.
- `resource-load-failed` browser-error records now carry a `diagnostic` object (type, errorText, canceled, requestId, requestMethod, requestUrl, initiator) so future mismatches are self-explaining instead of requiring re-reproduction.
- The richer Caroline-based mismatch (HEAD SVG probes + manifest + safeguard + canvas-unmount check) is restored as the canonical mismatch test in `scenario-dev-full.json` / `scenario-built-full.json` and now PASSes everywhere:
  - `dev-cdp-caroline2` (dev 8180): **PASS 22/22, errors 0**.
  - `built-cdp-caroline1` (built 8181): **PASS 22/22, errors 0**.
  - `built-cdp-full-recovered1` (83-op full, built 8181): **PASS 83/83, errors 0**.
  - `dev-cdp-full-recovered1` (83-op full, dev 8180): all 83 ops completed with zero browser errors, verdict `INFRA_FAILURE` only from the runner's trailing double-rAF settle on the long-lived minimized campaign Chrome (same runner-side artifact as `dev-cdp-tablet1`); `dev-cdp-full-recovered2` on a fresh Chrome profile: **PASS 83/83, errors 0**.

### Gates re-run after both fixes

- `node --test scripts/fast-cdp.test.mjs`: 6/6 pass.
- Full source suite (`tests03`, 20% CPU-capped, secret-stripped env): 95/95 pass, exit code 0.
- Production rebuild (`built-web02`, `vite build` + nitro prerender): succeeded; only the known non-fatal chunk-size/dynamic-import warnings. No credentials, no `db:migrate`.
- Not re-run this wave (unchanged surfaces): pytest engine suite (212 passed / 1 skipped previously — only CSS/runner/scenario files changed), `tsc --noEmit` (no TS source touched), native/Tauri acceptance, Vercel deployment.

### CI status and repair (2026-10-11, driven via gh as the repo owner)

- Root cause of the silent CI: **Actions was disabled at the repository level** (`gh api repos/affordablefencinggc/xray-by-looplet/actions/permissions` → `{"enabled":false}`). Public repos get free standard runners, so cost was never the blocker — it was simply switched off after the September failures. Re-enabled with `allowed_actions=all` (the workflow uses third-party actions `dtolnay/rust-toolchain` and `swatinem/rust-cache`).
- The 2026-09-03 `main` failures (five runs) and recovery-branch round 1 (run `38140220191`) all died at `npm ci` with the same error class: lockfile↔package.json desync around `lru-cache` (`11.5.2` on the September shas, `11.5.3` on the branch). Cause: the lock was npm-11-canonical (regenerated locally with npm 11.17 / node 24) while the runner uses npm 10.9.8 / node 22, whose ideal-tree placement differs (`node_modules/nitro/node_modules/lru-cache`). Reproduced locally with `npx -y npm@10.9.8 ci --dry-run`.
- Fixes: triggers extended to `recovery/**` + `workflow_dispatch` (`4b86ed27`); lock regenerated with npm 10.9.8 and dual-validated (npm 10.9.8 and npm 11 both pass `ci --dry-run` locally), pushed as `1ee9937c` (12+/15−). Round 2 = run `38140471707`, launched by that push — the first CI in recorded history to pass `npm ci` and reach typecheck/tests/clippy/Tauri.
- The Tauri desktop matrix (ubuntu-latest + windows-latest) is the native acceptance path: the dans1 worker is machine-locked (`COMPUTERNAME -eq 'DANS1'`) and this box has no cargo toolchain.

### CI repair rounds 3-6 (2026-10-11)

Local-first repair loop (verify every fix on this box before pushing — a local Rust toolchain was installed for this: rustup stable + rustfmt + clippy + the `x86_64-unknown-linux-gnu` std for cross-target linting, driven through a 20%-CPU-capped cargo wrapper cloned from `run-capped.ps1`'s Job-Object pattern):

- **Round 3 (`38141724747`)**: Web job **passed end-to-end** (3m25s — npm ci, typecheck, test suite, BOM kernels, TS/Python byte parity, build, engine pytest, Playwright smoke, sidecar), proving the lock regen + PYTHONPATH fixes. SC-07 failed at `cargo fmt --check` (the Rust had never been machine-formatted) — first-ever `cargo fmt` applied (10 files, 1105 lines) plus one real clippy finding (`single_element_loop` in `material_ai.rs`, inlined). Also discovered the tauri build script needs the local-only bundle dirs — `engine/bin` + `engine/cad/bin` prep steps added to CI. Local gates first: fmt clean, clippy `-D warnings` clean on both manifests, `cargo test` green (37/0/1 + 54/0).
- **Round 4 (`38142280019`)**: SC-07 failed at clippy on `dead_code` — `process_tree_error` is called only from `#[cfg(windows)]` blocks, so Linux analysis flags it while Windows (local) clippy never sees it. Fixed with `#[cfg(windows)]` on the function; verified via **cross-target clippy** `--target x86_64-unknown-linux-gnu` (clean on both). Also found in this round: `tauri::generate_context!` panics on Linux when bundle icons lack alpha — all four PNGs were `Format24bppRgb`; redrawn onto `Format32bppArgb` (GDI+), re-verified, committed.
- **Round 5 (`38142628388`)**: SC-07 passed fmt, clippy (both fixes held), TS transport proof, Python contract proof, Rust host transport proof (37 tests on Linux), the BR-013 unix process-group proof, and the Tauri transport tests (54 tests) — then failed at `verify-sc07-transport-proof.mjs`: the **hermetic spawn audit** found `JsonStatusFactory` spawning `powershell.exe`/`/bin/sh` (policy: only `current_exe()` + one pinned `cmd.exe` mklink fixture).
- **Round 6 (fix in flight)**: `JsonStatusFactory` rewritten hermetically — it re-executes the test binary as a new `status-handshake` fixture behavior (env-driven delay + payload + exit), matching every other fixture. Empirical finding en route: libtest always wraps a self-executed fixture's stdout (`running 1 test`/dot/summary), so a pure-JSON end-to-end `available: true` cannot be produced hermetically — the delayed-handshake test now asserts at the bounded-read level (the nonzero and short-deadline paths still cover the full envelope). Local audit replication of the spawn scan: violation_count 0, cmd.exe exactly once. Local gates: fmt clean, clippy clean windows + linux cross-target, `cargo test transport` 37/0/1.
- The round-4 log noise (`could not find Cargo.toml` exit 101) is the `swatinem/rust-cache` action's internal cargo probe — this repo has two independent manifests and no workspace; non-fatal, action step still ✓.

### CI repair rounds 3-6 appendix: local-toolchain resources

- `rustup` stable + rustfmt + clippy installed on DANIELS for this wave (first local cargo toolchain; the box previously had none). A 20%-aggregate-CPU-capped cargo wrapper (`xray-recovery-evidence/capped-cargo.ps1`) clones `run-capped.ps1`'s Job-Object cap (Flags=5, CpuRate=2000) with the same secret-stripping; one wrapper fix was required — PowerShell's `EAP=Stop` turns cargo's stderr progress lines into terminating `NativeCommandError`s, so EAP relaxes to `Continue` around the cargo invocation only.
- `x86_64-unknown-linux-gnu` rust-std was added for cross-target clippy (no linker needed for `cargo clippy`); it catches `#[cfg(unix)]`-only dead code that Windows clippy cannot see. Caveat: cross-linting `src-tauri` locally stops at `aws-lc-sys`/`libdbus-sys` build scripts needing a Linux C cross-compiler — CI's ubuntu runner is the oracle for that manifest.
- CI's linux clippy for `src-tauri` is additionally guarded by `tauri-codegen`: `generate_context!` panics on non-RGBA bundle icons on Linux only — fixed by converting the four icon PNGs to 32bpp ARGB.

### 3. `resolve_python` porting decision: declined by design

- Main@75bd12b5's takeoff host (commit `4e23fa66`) probed `python` / `python3` / `py -3` with a `--version` Python-3 check before falling back to `<py> -m xray run`. The recovery branch replaced that entire path-based architecture with the typed fail-closed BOM transport: `resolve_engine_path` is `ConfiguredRunner::from_environment()` only ("No source-tree, `engine/bin`, or PATH-Python discovery"), `run_takeoff` is a fail-closed stub that rejects legacy path-based commands, and BR test `transport_br_034_035_paths_and_python_fallback_disabled` asserts the fallback stays disabled. The python-side result contract survived (`HOST_RESULT_NAME = "result.json"` in `engine/python/xray/cli.py`).
- Decision: **do not port PATH-python probing into the branch transport** — it belongs to the superseded architecture and would weaken the branch's fail-closed posture (only a configured frozen runtime via `XRAY_ENGINE_PATH`, which the desktop host `src-tauri` configures). The campaign's "porting decision pending" item is closed as declined-by-design, not pending.
