# IW-PY-WIREFRAME completion submission

2026-09-05. Status: **awaiting-verification**, with parent-reported independent approval of bounded PDF, DXF and MCP repairs. This is not full ENG-033, all-CAD, semantic reconstruction, native packaging or industry-wide feature approval. Reused-thread exception and initial source inspection are recorded in startup.md. Parent orchestrated; no further agents were spawned. No commits, staging, dependencies in project manifests, global installations, auth, database or external API calls.

Branch: `feat/v1-production-ready`; baseline HEAD `1bf54983bb3ff168358f4987c8481e8cc23fb760`. Shared dirty files outside this packet belong to other agents. The user explicitly prioritized actual Python output and desktop-only evidence; IW002 crosswalk was stopped at its separately recorded checkpoint.

## Result and ownership

Actual existing residential (24 pages) and shed (5 pages) PDFs now produce bounded, source-bound **partial 2D path viewers**, independently of unchanged legacy takeoff quantities. Residential emits 131,566 paths / 391,870 segments; shed emits 1,239 paths / 23,144 segments. The small synthetic electrical schedule has no paths and explicitly rejects wireframe generation. PDF text, images, shading and explicitly clipped objects are counted as omissions; no wall, column, height or calibrated quantity is inferred from these paths.

The synthetic native DXF fixture contains 480 actual nested block placements, five types, reused assemblies, base points, rotations and reflections. The baseline adapter misplaced 192 symbols; cumulative affine positions now match all expected coordinates. Orthogonal transform metadata is derived from the cumulative axes; nested shear and non-default OCS fail explicitly. CAD scene height is an assumed presentation height. `kind: symbol-extrusion` replaces the misleading generic `column` label in scene version 0.2.

Exactly eight application source/test files were changed:

- `engine/python/xray/wireframe.py`: reject empty or malformed input, validate identifiers/coordinates/heights, compare source identity and coordinates on roundtrip, escape inline JSON, safe prototype keys, height-only canvas resize.
- `engine/python/xray/sources/dxf.py`: cumulative library affine matrices and block base points; orthogonal metadata; explicit cycle/depth/shear/OCS rejection.
- `engine/python/xray/source_wireframe.py` (new): additive bounded PDF path extractor, CLI, SVG and selected-page viewer.
- `engine/python/xray/test_wireframe.py` (new): empty/forged/nonfinite/source-coordinate and safe viewer regressions.
- `engine/python/xray/test_source_wireframe.py` (new): exact nested forms, crop/rotation, curves, closed paths, clipping and limits, including nested global object budget and bounded captured-byte reads.
- `engine/python/xray/test_wireframe_dxf.py` (new): combined translation/rotation/nonuniform scale/reflection/base-point positions, orthogonal metadata and unsupported shear/OCS cases.
- `engine/server/mcp_server.py`: strict calibration bounds, validated atomic no-overwrite marked-PDF publication, native CAD import before stdio worker threads.
- `engine/server/test_mcp_boundaries.py` (new): strict calibration and preserved output target regressions.

Full exact eight-file diff: `proof/audit/IW-PY-WIREFRAME/code.patch` (SHA-256 `1591d9bd64c404a6c028780a3c194d7e59018624e14c5087ec4739ec3acaf40f`). Per-file SHA-256 and sizes are in `source-hashes.json`. No existing frozen BOM protocol, job kernel, Studio, runtime or canonical ledger source was changed in this task.

## Integration API and source authority

`xray.source_wireframe` exports `extract_pdf`, `compose`, `transform`, `page_matrix`, `render_svg`, `render_viewer`, `main`, and `WireframeError`. Run `python -m xray.source_wireframe INPUT.pdf --out ABSENT_DIRECTORY [--pages 1,2]`. Output schema is `xray.source-wireframe/v1`; it records immutable captured source SHA-256, byte/page counts and per-page paths/omissions in **PDF page points**. Coordinates use effective MediaBox/CropBox intersection, display rotation and cumulative form transforms. M/L/C/Z commands preserve curves and closure. Explicit clips are omitted, not approximately reconstructed.

Limits are 30 MiB captured input, 100 pages, 250,000 objects, 200,000 paths, 600,000 segments, form depth 16 and 80 MiB aggregate output. Input is read with a bounded MAX+1 capture and rechecked before hash/parse. Limits fail, never silently truncate. The caller supplies an absent output directory; `complete.json` is written last with all artifact hashes. A directory without this final manifest is a failed output and must not be presented as successful. Source page points must never feed trade measurement quantities without a separate verified calibration contract.

`xray.wireframe` retains `build_scene`, `roundtrip_check`, `render_html` and CLI. Scene 0.2 is an explicit additive presentation boundary change: consumers expecting `column` must handle `symbol-extrusion`. The separate product Model presentation is not connected to this Python viewer. Future integration must select the correct 2D-source or assumed-symbol presentation mode and preserve unsupported/partial labels.

## Executed proof

All paths below are relative to `proof/audit/IW-PY-WIREFRAME/` unless stated otherwise.

- `baseline/results.json` and source-specific raw files preserve actual PDF extraction producing zero symbols and old wireframe exit 0 / empty roundtrip success. Those failures were executed before repair. Baseline PDFium was the preinstalled 5.13.0; subsequent pinned runs use 5.12.1.
- `cli-attempt-01/results.json` preserves the native 192/480 bad positions. `cli-attempt-02/results.json` records actual `python -m xray run INPUT --out OUTPUT --report` on all three PDFs and the synthetic DXF, actual marked PDFs/reports and zero CAD position mismatches.
- `takeoff-parity.json`: full three-PDF takeoff JSON parity; CAD quantities unchanged. `final-cad-recheck.json`: current final source produces identical captured viewer HTML, identical quantities, 480 symbols. Presentation check must use the actual CLI float height 8.0; a diagnostic integer 8 caused harmless JSON byte-format mismatch before the final successful check.
- `final-tests.log`: **115 passed, 1 skipped, 220 subtests passed in 13.40 seconds**. The skip is Windows symlink privilege availability. This includes existing Python engine/frozen BOM/CLI tests plus source-wireframe, DXF and MCP boundary regressions.
- `mcp-stdio-attempt-05/summary.json`, per-request response JSON, `stdout.jsonl` and `stderr.log`: actual initialized JSON-RPC stdio, all six registered tools, 480 and 5 symbol successes, valid and rejected calibration, existing marked-file preservation and fresh validated PDF publication, PDF wireframe rejection, unknown-tool rejection. Process exit 0. The 480-symbol response is approximately 174,400 bytes and 0.03 seconds.
- Earlier `mcp-stdio*` directories preserve real failures: invalid calibration silently accepted, existing target overwritten, both large and small CAD timeouts, diagnostic stack in NumPy native initialization after AnyIO threads, and Windows read-only fsync error. Startup import and writable staged fsync resolved those bounded issues. Timeout was investigated, not hidden with an unlimited wait.
- `protocol-final-attempt-02/summary.json` and seven sets of raw logs freshly exercise NEW-009: frozen status, four exact golden stdin responses, malformed/future request rejection without result or success stdout. `protocol-final/` preserves the first harness mistake: attempting output outside the host working directory was correctly rejected. The corrected harness uses the caller output directory as cwd. No protocol source changed.
- `path-inventory-attempt-02.json` corrects the exploratory inventory script's initial PDFium -1 sentinel truthiness mistake; original `path-inventory.json` is retained and superseded. Correct residential source inventory: 131,604 paths / 392,121 segments, 38 clipped paths. Extraction omits those paths. Shed has zero clipped paths.
- `final-extraction-recheck.json` and `seal-attempt-02.log`: current extractor reproduces stored scenes, every SVG, viewer HTML and completion-manifest hashes for both complex real sources. `seal.log` retains an initial dependency-report text-decoding harness failure, corrected by reading JSON bytes.
- `feature-probes.json` / `feature-probes.log` exercise individual real pipeline function calls and safe synthetic/adversarial cases; the suite alone is not used as feature coverage.

Trusted executable: `C:/Users/danie/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe` (3.12.14). Declared requirements were installed into isolated ignored `python-deps/` and `mcp-deps/`, with parent authorization and ordinary tool escalation; no global environment or requirements changes. `dependency-provenance.json` contains exact resolved versions, wheel URLs and SHA-256 hashes. Source engine pins include PDFium 5.12.1, pikepdf 10.10.0, ezdxf 1.4.4, jsonschema 4.26.0 and pytest 9.1.1; declared MCP ranges resolved MCP 1.29.1. On Windows, `site.addsitedir(absolute_mcp_deps)` is required for installed pywin32 .pth processing. PYTHONPATH alone does not process it.

Final suite environment: absolute PYTHONPATH to isolated `python-deps`, `engine/python`, `engine`; PYTHONDONTWRITEBYTECODE=1, PYTHONIOENCODING=utf-8 and PYTEST_DISABLE_PLUGIN_AUTOLOAD=1. Bootstrap `site.addsitedir(absolute_mcp_deps)`, then `pytest.main(['engine/python/xray','engine/server/test_mcp.py','engine/server/test_mcp_boundaries.py','-q','-p','no:cacheprovider'])`. Supporting scripts `scenarios.py`, `mcp_stdio.py`, `feature_probes.py`, `protocol_recheck.py`, `seal.py` record actual commands and outputs. Artifact-producing scripts require new attempt directories on rerun; do not overwrite history.

Parent independently reported 18 passing tests in 0.99 seconds across `test_mcp_boundaries.py`, `test_mcp.py`, `test_wireframe_dxf.py`, read actual stdio attempt 05 and confirmed final source hashes. This handover records that as parent-reported review; it does not invent an independent raw log path. Parent also inspected before/after plan and CAD screenshots and the embedded report.

## Desktop visual proof and retained viewers

`browser-results-attempt-02.json` is the screenshot manifest: seven captures with URL, UTC time, 1440x1000 desktop viewport, scenario, image dimensions, SHA-256 and result. Original images are in `screenshots/industry-wireframe/`; byte-identical copies in this proof folder support the canonical writer's existing image allowlist. Residential page 5 and shed page 3 were selected for rich readable geometry. Actual viewer navigation, zoom, CAD orbit/plan, prototype type handling, safe inline scene data and height-only resize were exercised; zero browser errors. Pixel alignment within two pixels was 95.77% residential and 99.35% shed, supporting coordinate alignment only, not completeness or semantics.

`report.html` embeds all seven actual images and contains all **46** feature rows. `report-browser-attempt-02.json` proves seven decoded images, 46 details rows and zero errors; latest report capture is `screenshots/industry-wireframe/report-final-attempt-02.png`, visually inspected. CUA initialization had failed once with missing @oai/sky in the preceding packet; installed Playwright with Edge was the documented fallback. No mobile tests were run.

Owned loopback server remains running at `http://127.0.0.1:8098` (exec session 47902). It serves only explicitly allowlisted intended viewer artifacts, GET and exact loopback Host; dependencies/repository files are not exposed. Exact links:

- `/report.html`
- `/residential-source.html` and `/residential-final/index.html`
- `/shed-source.html` and `/shed-final/index.html`
- `/cli-attempt-02/synthetic-nested-plan/synthetic-nested-plan.wireframe.html`

Canonical writer `audit_engine_release` owns the 8097 dashboard and already embedded the seven screenshots. `writer-packet.json` provides final source and evidence hashes; this task did not edit canonical statuses.

## All 46 outcomes and next bounded work

`feature-audit.json` maps ENG-001..036, MCP-001..008, NEW-009 and NEW-010 without omission/duplicate. Historical rows preserve exact source text, line and hash; each has an executed scenario or explicitly demonstrated absent capability. Totals: **14 bounded-pass, 23 partial, 7 failed, 2 absent-capability**. No historical checks are promoted to implementation-verified.

Seven observed existing defects remain deliberately unfixed and need separately owned regression/repair slices:

1. ENG-011: fence post floor rounding gives three posts for a 5m run at 2.4m maximum spacing; four are required by the spacing calculation.
2. ENG-015: legacy pricing hook imports missing `pricing.costing`.
3. ENG-018: open polyline with no enclosed area is counted as a reconciled structural member from its layer name.
4. ENG-020: survey elevations 1000 to 2000 mm report 1000 m fall instead of 1 m.
5. ENG-023: nested SVG scale(2) is ignored, retaining length 10 instead of 20.
6. ENG-024: minimal IFC lacking units and placement evidence yields origin coordinates and verified metres.
7. ENG-035: negative floors yield negative height/area instead of rejection.

Absent capabilities: real OCR backend (stub plumbing only) and claimed HTTP worker entrypoint (actual service is stdio). Other partial outcomes retain explicit representative-corpus, semantic, domain, deterministic markup, draft pricing and integration limits. Native sidecar schema bundling/package proof remains separate IW-PACKAGE-SCHEMA work; actual Studio import to Python integration remains NEW-011. No paid API or external service dependency blocked this bounded task.
