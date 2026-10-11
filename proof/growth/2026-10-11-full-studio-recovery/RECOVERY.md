# Full studio recovery — integration in progress

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

- Early Caroline-based mismatch runs (`full9`–`full12`, `built-cdp2`) ended `FAIL` solely from the runner's expected-cancellation accounting: Caroline's wireframe SVGs load as image-type, which the reviewed exact GET-Fetch cancellation gate does not recognize, so the abort was booked as a browser error before the safeguard op ran. The final Crown Wharf-based scenario removes that noise and PASSes 83/83 on dev and built output. Zero console/HTTP/product errors were observed in any run.
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
