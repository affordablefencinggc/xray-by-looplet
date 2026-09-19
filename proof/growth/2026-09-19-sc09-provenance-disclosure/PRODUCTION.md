# Frozen SC09 production measured journey — 9abf4c807030

Owner `/root/sc09_review`; **DANS1 production-browser PASS, 89/89 operations, 12 screenshots, zero browser errors**. This qualifies the tested wall/construction-run slice only. Room-area/roof-plane coverage is not established; SC09 remains partial against its original family scope. Later SC10 CSS/workflow edits are outside this immutable build.

Source archive SHA-256: `363046a1168bf312022a3d8e3ed23844dd44cf6e4bbc3e658b3bac0da993af4f`. [Preflight](../2026-09-19-sc09-entity-highlight/preflight/9abf4c807030/REPORT.md): 1,951 full-suite tests, 130 focused tests, 13 runner/state tests, TypeScript exit 0, lint 0 errors/9 warnings.

## Build

After explicit root authorization and a no-other-full-build process check, executed the unmodified [original build worker](production-build/9abf4c807030/dans1-build-worker.ps1) with `-RunId 9abf4c807030 -WebOnly` and source/runtime/native SHA-256 parameters from [stage.json](../2026-09-19-sc09-entity-highlight/preflight/9abf4c807030/stage.json). High process-tree priority; 16 workers. Dependency installation, TypeScript, 87 focused tests and production web build all exited 0. [Launch ownership](production-build/9abf4c807030/build-launch.json), [results](production-build/9abf4c807030/results.json), [completion and 27 asset hashes](production-build/9abf4c807030/completion.json), [build stdout](production-build/9abf4c807030/web-build.stdout.log), [warnings](production-build/9abf4c807030/web-build.stderr.log).

No native package, installation or deployment was performed. Build warnings remain recorded: child-process shell deprecation, an ineffective GLTFLoader dynamic import, and large chunks. No database migration ran because DATABASE_URL was absent.

After the browser campaign, all **1,239 web/native source files and 27 built assets** matched their original manifests; the build owner had exited. Twelve build evidence files were retrieved and hash-verified. [Post-build/browser receipt](production-build/9abf4c807030/build-evidence-receipt.json).

## Genuine production path

[Fixture generator](generate-production-fixture.mjs) ran on DANS1 against the frozen source's real SVG inspection, calibration/job/form schemas, draft parser, project persistence and measured-geometry helper. Before/after checks covered all 1,236 web source files. [Fixture](production-fixture/fixture.json), [executed fixture result](production-fixture/fixture-results.json). Fixture SHA-256 `6d364f52e5672a2667147e73a1d67cf7adc0f769349e05e6488e1b48dec56266`; original SVG is 340 bytes with SHA-256 `668ba07cfc41201c37ec87e2b1a151a51ed77b0a9518bd6ca4c424c415881d5c`.

The browser seeds only the exact unbound fixture into localStorage/IndexedDB on the existing static coverage document before loading the product. That carrier has no product module or storage code and an explicit data favicon. After product load there are **no `/src` imports, product store accesses/mutations, hooks or debug bridge**. Tests read persisted data and actual DOM; a test-only observation object records baseline/drag receipts.

Actual UI actions bind both rows and calculate classification. Native pointer input then moves A's first vertex from `(100,120)` to `(100,168)`, changes its revision 1→2 and length 5→5.035871324805669 m, while the full persisted B record remains unchanged. Pointer coordinates come from the rendered source-image rectangle and known source-page-v1 bounds; 99 selected-color canvas pixels verify the start point before dragging. The original exact 2D/3D, A-only stale/B-current, withheld tally, visual contrast/layout, full-hash and expanded-diagnostics assertions remain intact.

Executed command: `scripts/invoke-dans1-fast-cdp.ps1 -Scenario proof/growth/2026-09-19-sc09-provenance-disclosure/production.scenario.json -RemoteWorkspace C:\Users\danie\XRayBuilds\runs\9abf4c807030\source -EvidenceRoot proof/growth/2026-09-19-sc09-provenance-disclosure/campaigns -RunId sc09-9abf4c807030-built2 -CdpPort 9338 -PreviewPort 8081 -PreviewMode built`.

[Scenario](production.scenario.json), [generation receipt](production.source.json), SHA-256 `64f07f445b40123c78ff7173b15845e78e5c1944d1c8d92b20f2b94af3295c70`. [89-operation browser result](campaigns/sc09-9abf4c807030-built2/output/browser-results.json), [launcher and cleanup](campaigns/sc09-9abf4c807030-built2/output/launcher-results.json), [artifact manifest](campaigns/sc09-9abf4c807030-built2/output/sha256-manifest.json). All returned files matched the remote manifest. Launcher interval `2026-09-19T12:58:54.3897292Z`–`12:58:59.8282235Z`; browser context disposed, owned preview/browser exited, ports released.

Named step records with screenshots and exact source diff:

- [Measured binding/edit/stale journey](steps/production-measured-journey.md)
- [Touch-accessible full provenance](steps/full-provenance.md)
- [Diagnostics clipping investigation](steps/diagnostics-containment.md)

The four screenshots linked across those records were visually inspected: real source geometry moves, bound rows remain identifiable, full hashes wrap visibly, and diagnostics tabs/status remain contained. This is Windows Chrome tablet-sized/desktop browser evidence, not physical tablet, native desktop, macOS/Linux or external drawing qualification.

Historical [built1 failure](campaigns/sc09-9abf4c807030-built1/output/browser-results.json) is preserved. Navigating directly to the SVG favicon as a fixture carrier triggered Chrome's implicit `/favicon.ico` 404 before product load; the campaign bailed. The correction changed only the pre-load carrier to an existing static HTML page with its declared icon. No error was ignored, no assertion weakened, no product/build source changed. Failure screenshot was unavailable during navigation and is explicitly recorded in that result.
