## [MP-DOCK-01] Magic Pencil control dock: compact two-row layout, draggable left/right

**Date:** 2026-09-09  
**Branch:** `feat/architect-cad-engine`  
**Commit / working state:** uncommitted (shared dirty tree; files below only, nothing staged)  

### Scope

The Magic Pencil / Architectural Draftsman control dock shrinks from a ~780 px wide, 261–335 px tall multi-row panel to a 520 x 95 px two-row dock (primary controls in one dense row, compact phase tabs in the second, secondary tools behind a collapsible third strip) and becomes draggable along the bottom edge of the stage with a grip (pointer drag with pointer capture, keyboard arrows/Home/End), clamped to the stage, persisted in `localStorage` (`xray:draftsman-dock:v1`) and re-clamped on resize. Every control keeps a 44 x 44 px hit area with a 26–30 px visible face and a visible focus ring. The old bottom-left/center toggle is replaced by the grip; the assistant's preset command still jumps the dock.

### Checklist

- [x] `MP-DOCK-01a` — Compact dock: roughly half the height (335 → 95 desktop, 261 → 95 tablet) and narrower (780 → 520 tablet); one dense primary row (mode chip, play/pause, replay, scrubber, percent, speed, finish, close), phase tabs as a compact second row, tools strip collapsible
- [x] `MP-DOCK-01b` — Draggable horizontally: grip `aria-label="Move drafting controls"`, pointerdown/move/up with `setPointerCapture`, clamped to the stage (8 px margins), ArrowLeft/ArrowRight 16 px, Home/End, persisted under `xray:draftsman-dock:v1`, re-clamped on resize; maths in a pure helper with unit tests
- [x] Evidence / provenance impact reviewed — none: UI chrome only; no document, calibration, evidence or BOM data touched
- [x] Desktop proof captured (1280x800)
- [x] Tablet proof captured (1024x768)
- [x] Logic proof captured (17/17 tests incl. 10 new helper tests; typecheck exit 0; eslint exit 0)

### Files changed

- `src/studio/DraftsmanControlDock.tsx`
- `src/studio/draftsman.css`
- `src/studio/draftsmanDockPosition.ts` (new)
- `src/studio/draftsmanDockPosition.test.ts` (new)
- `proof/growth/2026-09-09-draftsman-dock/**` (README, code.diff, tests.log, typecheck.log, four scenario files, generator, this entry)
- `screenshots/growth/2026-09-09-draftsman-dock/**` (2 before, 11 after)

### Exact diff summary

`DraftsmanControlDock.tsx` is rebuilt as a two-row dock with a collapsible third strip; it gains a grip button wired to `draftsmanDockPosition.ts` (`resolveDockX` on mount, `dragDockX` during pointer capture, `stepDockX` on keydown, `clampDockX` from a `ResizeObserver` on the stage plus `window.resize`, `writeStoredDockX` on pointer-up / keyboard), exposes `data-dock-x`, `data-dock-dragging`, `data-dock-tools`, keeps the legacy `status.dockPosition` preset as a jump target and keeps the `onDockPositionChange` / `onPencilColor` props for the untouched `SourceBuildingViewer.tsx`. The speed group becomes a single cycle button; phase tabs keep `role="tab"`/`aria-selected`. `draftsman.css` is rewritten: 520 px max width, 2 px/6 px padding, 44 px transparent hit areas with 26–30 px faces, teal `:focus-visible` ring, `overflow-x: hidden`, dragging state. Resumed from an interrupted attempt: its AFTER dock overflowed (Finish/Close clipped) — fixed this round by dropping the chip's storey sub-label, letting the scrubber flex and shrinking the speed face; its reload step timed out — fixed by waiting for hydration after reload. The BEFORE artefacts from that attempt were kept (mtimes precede every source edit).

### Evidence and data status

- **Document source:** `sample` (curated Redburn BR250157 reconstruction via Model → Explore & Draw 3D Model → Magic Pencil, the route from `proof/magic-pencil-redburn-cdp.scenario.json`)
- **SHA-256 status:** `not applicable` (no document bytes read or written)
- **Calibration status:** `not applicable`
- **Affected evidence states:** none
- **Quote / BOM status:** `not applicable`
- **Limitations:** the shared dev server 0.0.0.0:8080 (PID 44196) had already exited and was neither stopped nor restarted by this slice; the AFTER proof ran on an agent-owned Vite instance of the same tree at 127.0.0.1:8090 (started 01:23, stopped 01:26, port confirmed free). BEFORE measurements are from the interrupted attempt's run on 8080. Drags were synthesised with agent-browser mouse opcodes; touch/pen not exercised. Vertical position stays on the bottom edge. Phones out of scope.

### Verification executed

```text
node --experimental-strip-types --test src/studio/draftsmanDockPosition.test.ts src/studio/MagicPencilDraftsman.test.ts src/studio/assistant/draftsmanBridge.test.ts
tests 17, pass 17, fail 0, exit 0 (proof/growth/2026-09-09-draftsman-dock/tests.log)
```

```text
node node_modules/typescript/bin/tsc --noEmit
exit 0 (proof/growth/2026-09-09-draftsman-dock/typecheck.log)
```

```text
node scripts/fast-cdp-test.mjs dock-measure       proof/growth/2026-09-09-draftsman-dock/after-measure.scenario.json   exit 0  (proof/growth/runner/2026-09-08T15-24-39-768Z-dock-measure.json)
node scripts/fast-cdp-test.mjs dock-after-desktop proof/growth/2026-09-09-draftsman-dock/after-desktop.scenario.json   exit 0  (proof/growth/runner/2026-09-08T15-24-56-423Z-dock-after-desktop.json)
node scripts/fast-cdp-test.mjs dock-after-tablet  proof/growth/2026-09-09-draftsman-dock/after-tablet.scenario.json    exit 0  (proof/growth/runner/2026-09-08T15-25-01-214Z-dock-after-tablet.json)
Desktop: dock 520x95 (rows 44+45), 12 controls all >= 44 px, no dock/page/stage horizontal overflow; drag +300 -> x 92 (clamped, 8 px from the stage edge), drag -600 -> x 8; ArrowRight 24/40, ArrowLeft 24, End 92, Home 8; reload -> x 40 restored; 1024 End -> 496 then 1280 -> re-clamped 92; tools strip 520x194, 19 controls all >= 44 px; errors: none.
Tablet: drag +300 -> 308, +300 -> 496 (clamped), -600 -> 8; ArrowRight 24, End 496, Home 8, x3 -> 56; reload -> 56 restored; tools strip 520x194; errors: none.
Before (interrupted attempt, 8080): desktop 580x335 with 23 controls under 44 px; tablet 780x261.
```

### Visual proof

- Desktop: `screenshots/growth/2026-09-09-draftsman-dock/after-desktop-1280x800.png` (before: `before-desktop-1280x800.png`)
- Tablet 1024x768: `screenshots/growth/2026-09-09-draftsman-dock/after-tablet-1024x768.png` (before: `before-tablet-1024x768.png`)
- Interaction state: `after-desktop-drag-right-clamped.png`, `after-desktop-grip-focus-x40.png`, `after-desktop-tools-open.png`, `after-desktop-reload-persisted-x40.png`, `after-tablet-drag-right-clamped.png`, `after-tablet-drag-left-clamped.png`, `after-tablet-grip-focus-x56.png`, `after-tablet-tools-open.png`

### Result

The screenshots show the dock reduced to two dense rows with every primary control visible inside the panel, the grip's teal focus ring, the dock pinned against the stage's right edge after the clamped drag, and the tools strip expanding on demand; the runner logs prove the clamped positions, keyboard steps, localStorage persistence across reload, resize re-clamp, 44 px hit areas, absence of horizontal overflow and zero browser errors; the unit tests prove the clamp/persist maths in isolation.

### Remaining work

- Re-run `after-*.scenario.json` against the shared 8080 server once it is back (pass `http://127.0.0.1:8080/` to `generate-scenarios.mjs`) if proof on that exact instance is required.
- Touch/pen drag on a physical tablet is unproven (synthetic mouse events only).
- Optional: vertical drag or snapping presets were not requested and are not implemented.
