# AB-01: real Gemini architectural benchmark

2026-09-09. Development app, real Gemini, isolated test browser. Final project `job-1b0c3d86-4ecf-4be8-9297-cd9f74c616a3`, revision 8.

Gemini created a new two-level, 24 x 18 m U-shaped courtyard building through actual architectural tools. The assistant received a dimensional brief, not precomputed geometry or drawing code. Stage 1 produced the structural wireframe. Stage 2 added six doors, twelve windows, 23 geometric stair treads, a site slab, a pond and two raised planted beds. Final saved totals: 16 walls, 18 openings, 34 slabs, three roofs and two levels; the Model renderer produces 127 preview parts.

## Independent acceptance

The independent checker imports no architectural engine code. It checks the prescribed footprint and wall boundaries, dimensions, storeys, floor unions and overlaps, courtyard and stairwell voids, flat roof coverage/elevation, opening dimensions and hosts, tread continuity and connection to the upper landing, site margins, landscape dimensions/elevations/separation, and actual rendered water/planting material assignment.

- Final: **25/25 checks pass**, including the unchanged saved design after reload. Full deep equality with the pre-renderer-fix geometry passed.
- Stage 1 originally passed 12/12 checks. Four additional checks were added during review across both stages; the final 25-check result includes these.
- Stage 2 initially passed 20/21: the renderer ignored the authored Water and Planting materials. The appearance fix brought the same design to 25/25 under the expanded checker.
- Eight oracle tests include deliberate incorrect geometry mutations, so these checks demonstrably reject errors.
- All three saved work-packet audit journals verified after reload, including the interrupted attempt. Provider tool intents and receipts remain in the raw evidence.

## Defects fixed

1. A concave roof was correctly rejected before mutation, but its error incorrectly left an uncertain-action lock that blocked every subsequent edit. Pure preparation now returns a typed, project/revision-bound rejection receipt through MCP. Confirmed rejection permits correction; generic failures still preserve uncertainty. Inspection is allowed while uncertain and cannot clear it. A real browser regression proved rejected roof followed by a valid wall, and separately proved that a simulated lost acknowledgement still blocks subsequent edits after inspection.
2. The chat input silently truncated messages at 1,500 characters. It now accepts 100,000 and explicitly rejects an oversized paste while retaining the existing draft. The full 1,807-character stage 2 brief was asserted before send and is present in the persisted intake. The stage 1 run predates this fix: its geometry requirements arrived, but its trailing disclosure text was truncated. The original requested and delivered texts are retained.
3. Slab material names did not affect their displayed appearance. Both architectural and Model rendering now share explicit Water, Planting, Grass and Soil appearances. Unknown names retain the ordinary slab appearance; this does not change geometry or evidence status.

## Executed checks

| Check | Result |
| --- | --- |
| Full existing regression suite including new recovery tests | 977 pass, 89 suites, 0 fail |
| Independent benchmark oracle tests | 8 pass |
| Focused designed-scene tests including materials | 8 pass; included in full suite |
| Typecheck after final source changes | exit 0 |
| Scoped ESLint after final source changes | exit 0, no output |
| Desktop 1440 x 900 | Model visible; assistant within right rail, flush bottom |
| Tablet 1024 x 768 | Model visible, no page overflow, assistant within rail; cramped controls remain |
| Browser errors | No recorded uncaught errors in final capture batches |
| Persistence | Exact final design preserved; journals verified |
| Cleanup | Owned browser closed; user development server retained |

One full test-suite run refreshed the development page while Gemini was active and interrupted an early attempt before geometry authoring. It is recorded as a test-harness interruption, not a provider failure. The successful runs were repeated with the suite idle. An immediate post-resize bounds assertion also caught transient layout; a settled-layout wait passed. These failed runs are preserved.

## Visual evidence

![Structural wireframe](../../../screenshots/architect-benchmark-wireframe.png)

![Completed illustrative courtyard](../../../screenshots/architect-benchmark-solid.png)

![Tablet canvas limitation](../../../screenshots/architect-benchmark-tablet-canvas.png)

## Limits and next work

This proves one constrained architectural task, not Gemini's maximum capacity or general design correctness. There is no governing drawing, calibration, engineering review, code compliance or construction approval. The stairs are slab-based geometry, not a native stair object; upper-floor doors are explicitly conceptual without access decks. The pond and planted beds are simple material-bearing geometry, not detailed vegetation or water simulation.

At tablet width, both sidebars leave a narrow Model area and the wrapping toolbar obscures much of it. Open canvas retains the assistant correctly but does not resolve that crowding in this captured layout. Tablet usability therefore remains open. No full production/native build, installation, commit or deployment was performed.

Next priorities: make the tablet canvas genuinely usable with its rail intact, then add native stairs/landings and richer landscape geometry before attempting a larger benchmark.

## Reproducible evidence

- `stage1-brief.txt`, `stage2-brief.txt`: requested briefs.
- `stage1-complete.json`, `stage2-before.json`, `stage2-reloaded.json`: saved geometry, work packets and raw events.
- `independent-final.json`, `reload-proof.json`: acceptance and persistence results.
- `recovery-test.json`: browser recovery/uncertainty regression scenario; runner log at `../runner/2026-09-09T13-11-57-980Z-architect-benchmark.log`.
- `full-tests.txt`, `oracle-tests.txt`, `material-tests.txt`, `typecheck.txt`, `lint.txt`.
- `implementation.diff`: task changes against pre-edit snapshots, plus new implementation/checker files. The one additional assertion in `workPacket.test.ts` allows read-only inspection of an uncertain packet; it is not included in the snapshot diff because that file was not snapshotted.
- `source-manifest.json`: SHA-256 identities for changed implementation/checker files.
- `cleanup.json`: owned process cleanup verification.
- Run the checker tests with `node --test scripts/benchmarks/courtyard.test.mjs`. Live scenarios use `scripts/fast-cdp-test.mjs` and an isolated project; do not run the full suite while the provider is active.
