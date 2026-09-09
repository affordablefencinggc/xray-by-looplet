# Magic Pencil control dock — compact and draggable (2026-09-09)

Daniel: "this thing need shrink right down...! and be draggable left and right" (the Magic Pencil / Architectural Draftsman control dock).

Branch `feat/architect-cad-engine`, uncommitted shared working tree. Development-server proof only; no production build, no native run. Device scope: desktop 1280x800 and tablet 1024x768. `src/studio/SourceBuildingViewer.tsx` was **not** edited (another chat owns it); the component's props stay backward compatible — the viewer's existing `onPencilScale`, `onPencilColor` and `onDockPositionChange` props still typecheck against the new interface.

## Resumed from an interrupted attempt

An earlier attempt was interrupted after it had already rewritten `DraftsmanControlDock.tsx`, `draftsman.css` and the helper, captured the BEFORE screenshots/measurements, and run the AFTER scenarios once (both of which **failed** at the reload step: `✗ Wait timed out after 25000ms` in `proof/growth/runner/2026-09-08T15-14-44-992Z-dock-after-desktop.log` and `…15-15-13-637Z-dock-after-tablet.log`). This round reviewed that work rather than trusting its logs:

- Kept: the helper (`draftsmanDockPosition.ts`), its test file, the two-row dock structure, the grip/drag/keyboard/persist wiring, the BEFORE artefacts (their file mtimes 01:05:50–01:05:51 precede every source edit: helper 01:08, TSX 01:10, CSS 01:11).
- Refuted and fixed: the interrupted AFTER screenshots showed the **primary row overflowing the 520 px dock** — the Finish and Close buttons were clipped on both desktop and tablet (visible in the old `after-desktop-1280x800.png` / `after-tablet-1024x768.png`, since overwritten). The old in-browser check only tested clipping against the viewport, so it passed. Fix: the storey sub-label was removed from the mode chip (the storey is still in the chip tooltip and in the tools strip), the scrubber became `flex: 1 1 96px; min-width: 64px`, the speed face shrank to 48 px, the dock got `overflow-x: hidden`, rows got `min-width: 0`. The check closure now also asserts every control lies inside the dock box and `dock.scrollWidth <= clientWidth`.
- Fixed the scenario: after `["reload"]` the re-navigation now waits for `data-hydration-status="ready"` before clicking (the interrupted run clicked "Model" before hydration and timed out).
- Re-ran every check (tests, typecheck, eslint, three Fast CDP scenarios) in this round; logs below are from this round only.

## What changed

- `src/studio/DraftsmanControlDock.tsx` — rebuilt as a compact two-row dock. Row 1: grip (`aria-label="Move drafting controls"`), PENCIL mode chip, play/pause, replay, progress scrubber, percent, speed cycle button (0.5x → 1x → 2x → 5x), finish-to-solid, close. Row 2: four compact phase tabs (`role="tab"`) + a "Show/Hide drafting tools" toggle (`aria-expanded`, `aria-controls`). Row 3 (collapsed by default): storey picker / storey badge, category, parts count, Pencil Test, Tour, Blueprint, Model sheets PDF, pencil-size stepper. The old bottom-left/center toggle is replaced by the grip; the legacy `status.dockPosition` preset still works as a jump target (assistant `set_dock_position`). Drag: `onPointerDown` captures the pointer (`setPointerCapture`), `onPointerMove` commits `dragDockX(...)`, `onPointerUp/Cancel` releases and persists. Keyboard on the grip: ArrowLeft/ArrowRight 16 px, Home/End to the edges (persisted immediately). Initial x = stored value re-clamped, else preset. A `ResizeObserver` on the stage + `window.resize` re-clamps. Every hit area is a transparent 44x44 button with a 26–30 px visible face inside (`.draftsman-face`), teal `:focus-visible` ring.
- `src/studio/draftsman.css` — rewritten for the compact dock: `width: min(520px, calc(100% - 16px))`, `padding: 2px 6px`, `--draftsman-hit: 44px`, `--draftsman-face: 30px`, dark slate container, white/teal/Facebook-blue faces, phone/tablet/reduced-motion rules kept.
- `src/studio/draftsmanDockPosition.ts` (new, pure, DOM-free) — `dockRange`, `clampDockX`, `presetDockX`, `resolveDockX`, `dragDockX`, `stepDockX`, `serializeDockX`/`parseStoredDockX`, `readStoredDockX`/`writeStoredDockX`; key `xray:draftsman-dock:v1`, envelope `{"v":1,"x":<int>}`, edge margin 8, key step 16.
- `src/studio/draftsmanDockPosition.test.ts` (new) — 10 tests: clamping at both edges, dock wider than container, resize re-clamp, non-finite input, presets, drag deltas (+300 then +600 clamps right, -900 clamps left), keyboard steps (arrows, Home/End, other keys ignored, custom step), storage round-trip, 19 invalid stored values ignored, throwing storage swallowed.

Exact diff: `code.diff` (git diff of the two tracked files plus `git diff --no-index /dev/null` for the two new files; 1838 lines).

## Before / after sizes (measured in the browser, `getBoundingClientRect`)

| Device | Before (interrupted attempt, 01:05, shared 8080 server) | After (this round) |
|---|---|---|
| Desktop 1280x800 (stage 620 px wide) | **580 x 335 px** (rows: header 154, adjusters 44, timeline 40, phases 41; 23 controls, **23 under 44 px**, e.g. Pause 32x32, Close 28x32, scrubber 254x20) | **520 x 95 px** collapsed (rows 44 + 45), 520 x 194 with the tools strip open; 12 controls collapsed / 19 open, **min hit 44 px**, faces 26–30 px, scrubber 107 px, `scrollWidth 518 = clientWidth 518` |
| Tablet 1024x768 (stage 1024 px wide) | **780 x 261 px**, 23 controls, 23 under 44 px | **520 x 95 px** collapsed, 520 x 194 open, same invariants |

Height 335 → 95 (28 %) on desktop and 261 → 95 (36 %) on tablet; width 780 → 520 on tablet, 580 → 520 on desktop (the desktop stage is only 620 px wide so the old dock was already stage-limited there).

## Executed commands and results

```text
$ node --experimental-strip-types --test src/studio/draftsmanDockPosition.test.ts src/studio/MagicPencilDraftsman.test.ts src/studio/assistant/draftsmanBridge.test.ts
tests 17, suites 1, pass 17, fail 0, exit 0            (tests.log)

$ node node_modules/typescript/bin/tsc --noEmit
exit 0                                                   (typecheck.log)

$ node node_modules/eslint/bin/eslint.js src/studio/DraftsmanControlDock.tsx src/studio/draftsmanDockPosition.ts src/studio/draftsmanDockPosition.test.ts
exit 0
$ git diff --check -- src/studio/DraftsmanControlDock.tsx src/studio/draftsman.css
exit 0

$ node proof/growth/2026-09-09-draftsman-dock/generate-scenarios.mjs
$ node scripts/fast-cdp-test.mjs dock-measure       proof/growth/2026-09-09-draftsman-dock/after-measure.scenario.json   exit 0 (1.7 s)
$ node scripts/fast-cdp-test.mjs dock-after-desktop proof/growth/2026-09-09-draftsman-dock/after-desktop.scenario.json   exit 0 (4.7 s, 77 steps)
$ node scripts/fast-cdp-test.mjs dock-after-tablet  proof/growth/2026-09-09-draftsman-dock/after-tablet.scenario.json    exit 0 (4.7 s, 69 steps)
```

## Dev server note (limitation)

The shared dev server `0.0.0.0:8080` (PID 44196) had **already exited** before this round started (no listener on 8080, PID absent, `Invoke-WebRequest` refused). I did not stop it and, per the rules, did not restart it. Port 5173 is the Looplet CRM, not X-Ray. The AFTER proof therefore ran against an agent-owned Vite instance of the same working tree: `node scripts/with-app-env.mjs node node_modules/vite/bin/vite.js dev --host 127.0.0.1 --port 8090 --strictPort` (wrapper PID 70972), started 01:23 and stopped with its whole process tree at 01:26 (port 8090 confirmed free). The BEFORE artefacts came from the shared 8080 server before it went away. The first `open` against 8090 timed out on the cold SSR start (16 s first response): `proof/growth/runner/2026-09-08T15-23-42-057Z-dock-measure.json`, exit 1; the identical scenario passed on the warm server.

## Fast CDP runner reports

| Run | Scenario | Runner report | Result |
|---|---|---|---|
| BEFORE (interrupted attempt, 8080) | `before-dock.scenario.json` | `proof/growth/runner/2026-09-08T15-05-48-177Z-dock-before.json` | exit 0 |
| AFTER measure (cold start, failed) | `after-measure.scenario.json` | `proof/growth/runner/2026-09-08T15-23-42-057Z-dock-measure.json` | exit 1 (open timed out) |
| AFTER measure | `after-measure.scenario.json` | `proof/growth/runner/2026-09-08T15-24-39-768Z-dock-measure.json` | exit 0 |
| AFTER desktop | `after-desktop.scenario.json` | `proof/growth/runner/2026-09-08T15-24-56-423Z-dock-after-desktop.json` | exit 0 |
| AFTER tablet | `after-tablet.scenario.json` | `proof/growth/runner/2026-09-08T15-25-01-214Z-dock-after-tablet.json` | exit 0 |

Key eval outputs (verbatim from the runner logs, this round):

- Desktop invariants: `dock {left:268, top:617, width:520, height:95}, rows [44,45], controls 12, minHit 44, faceHeights [28,30], scrubberWidth 107, dockScroll [518,518], docScrollWidth 1280`.
- Desktop pointer drag +300 px on the grip (mouse move/down/move x3/up): `dockX 92, renderedLeft 92, gapToStageRight 8, stored {"v":1,"x":92}` — clamped at the right edge of the 620 px stage (max = 620 − 520 − 8).
- Desktop drag −600 px: `dockX 8, renderedLeft 8, gapToStageRight 92, stored {"v":1,"x":8}` — clamped at the left margin; `data-dock-dragging` absent after release (pointer capture released).
- Desktop keyboard on the focused grip: ArrowRight → 24, ArrowRight → 40, ArrowLeft → 24, End → 92, Home → 8, ArrowRight x2 → 40 (each persisted: `stored {"v":1,"x":40}`).
- Desktop tools strip open: `height 194, rows [44,45,99], controls 19, minHit 44, faceHeights [26,30]`.
- Desktop reload persistence: after `reload` + re-entering Magic Pencil, `dockX 40, renderedLeft 40, stored {"v":1,"x":40}`.
- Resize re-clamp: viewport 1024x768 → End → `dockX 496`; viewport back to 1280x800 (stage 620) → `dockX 92, renderedLeft 92, gapToStageRight 8` while `stored` still reads 496 (re-clamp is not persisted, by design — restoring a wider window restores the wider position).
- Tablet: drag +300 → `dockX 308` (tracks the pointer 1:1), another +300 → `496` (clamped, gap 8), drag −600 → `8`; ArrowRight → 24, End → 496, Home → 8, ArrowRight x3 → 56; reload → `dockX 56, stored {"v":1,"x":56}`; tools strip open `height 194, controls 19, minHit 44`.
- `["errors"]` was the last opcode of every AFTER scenario: no uncaught browser errors.

## Screenshots (all opened and inspected)

- `screenshots/growth/2026-09-09-draftsman-dock/before-desktop-1280x800.png` — old dock at bottom-left of the 620 px stage: MAGIC PENCIL / ARCHITECTURAL DRAFTSMAN header, storey select, GRID AXIS badge, a row of Pencil Test / Tour / Blueprint / Model sheets PDF / Solid Finish pills, a "Bottom-Left" position toggle and close, PENCIL SIZE and SPEED steppers, a timeline row with pause/replay/scrubber/1 %/0.5x–5x buttons, and four wide phase pills. Four to five rows; 335 px tall.
- `before-tablet-1024x768.png` — same dock at 780 px wide across the full stage, 261 px tall.
- `after-desktop-1280x800.png` — compact two-row dock at the stage's bottom-left: grip, PENCIL chip, blue pause, replay, scrubber, 1 %, "1x" speed, green-tick finish, × close; second row 1 Datum (active, blue) / 2 Wireframe / 3 Ink / 4 Wash + chevron. All controls visible inside the dark slate panel.
- `after-desktop-drag-right-clamped.png` — the dock sits against the stage's right edge (8 px gap, left edge at stage x 92) after the +300 px pointer drag.
- `after-desktop-grip-focus-x40.png` — dock at x 40 with the teal focus ring on the grip after the keyboard moves.
- `after-desktop-tools-open.png` — third row expanded: Ground (−1.6 m) storey select, GRID AXIS, 0 / 198 parts, Pencil Test (blue), Tour, Blueprint, Model sheets PDF, SIZE − 1.00x +; chevron now points down and is teal.
- `after-desktop-reload-persisted-x40.png` — after reload and re-entering Magic Pencil the dock is again at x 40.
- `after-tablet-1024x768.png`, `after-measure-tablet-1024x768.png` — compact dock at the bottom-left of the full-width stage, 520 px wide.
- `after-tablet-drag-right-clamped.png` — dock against the right edge of the 1024 px stage (left edge 496).
- `after-tablet-drag-left-clamped.png` — dock back at the left margin after the −600 px drag.
- `after-tablet-grip-focus-x56.png` — dock at x 56, grip focused (teal ring).
- `after-tablet-tools-open.png` — tools strip open on tablet, same content as desktop.

## Limitations

- Proof ran on an agent-owned Vite instance (127.0.0.1:8090) of the same tree because the shared 8080 server had already exited; no production build, no Tauri/native run.
- The BEFORE measurements come from the interrupted attempt's run (verified by file mtimes to precede the source edits); they were not re-captured because the pre-change component no longer exists in the tree and stashing/checkout is forbidden.
- Pointer drags were driven with agent-browser `mouse` opcodes (Chromium synthesises the matching pointer events); touch-pen drags were not exercised. `touch-action: none` is set on the grip.
- Vertical position is fixed to the stage's bottom edge (Daniel asked for left/right only).
- Phones are out of scope; the `max-width: 640px` rules were kept but not proven.
- `git status`, no commits: this slice stages nothing.
