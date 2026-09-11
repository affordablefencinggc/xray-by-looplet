# U-03 architect workspace width collapse — 2026-09-12

Fixes the defect found and recorded during the D-07 title block work on 2026-09-11: opening the architectural workspace collapsed its own container to 236 px, so the drawing sheet had a zero-width bounding box and could not be seen or used in the running application at any viewport.

U-03's acceptance is "Layout restores on the user's monitor without hiding actions". A workspace that hides the entire drawing sheet, its export control and its properties panel fails that directly.

## Root cause

Three facts combine:

1. The architectural workspace hides the left rail with `display: none`, but **the rail stays in the DOM**.
2. `src/studio/workspacePanels.css` (line 176 onward, and again at 193) sizes the shared grid with `:has(> .studio-left-rail)`, which therefore still matches, reserving a `--left-menu-width` (260 px) track for an invisible element.
3. `architect.css` tried to override this, but lost. It is imported lazily from `ArchitectWorkspace.tsx`, so its position relative to `workspacePanels.css` is not guaranteed, and both rules carried `!important` at equal specificity — the later stylesheet won.

Measured in the browser before the fix (`grid-before-fix.log`, and the DOM dump in the previous slice):

```
cols: "260px 1420px"
children: studio-left-rail  grid-column 1  display:none  w 0
          studio-main       grid-column 1  display:flex  w 260
```

Both children were assigned column 1 — the 260 px track meant for the hidden rail — and the 1420 px content column was left empty.

## The fix

`src/studio/architect/architect.css`: repeat the class in the selector (`.workspace-rails.workspace-rails[...]`) to raise specificity above the shared rule regardless of stylesheet order, rather than depending on import order or escalating `!important`. Applied to the grid definition, the left-rail hide, and the right-rail column, which needed the same treatment or it would have stayed on the shared rule's `grid-column: 3` in a two-track grid.

The comment in the file records why the repetition is there, so it is not mistaken for a typo and "tidied" away.

## Proof

After the fix (`grid-after-fix.log`):

```
cols: "1280px 400px"
children: studio-left-rail  display:none  w 0
          studio-main       display:flex  w 1280
```

The drawing sheet renders (`sheet-renders.log`):

```
{"paperW":973,"paperH":688,"centralW":1256,"visible":true}
```

Was `0 x 0`. Inspected screenshots at 1680x1050:

- `screenshots/growth/2026-09-12-u03-workspace-width/01-sheet-visible-after-fix.png` — the full workspace: sheet register, paper size and scale controls, **Export vector PDF**, the drawing sheet, and the Drawing sheet properties panel. None of this was reachable in a 236 px column.
- `screenshots/growth/2026-09-12-u03-workspace-width/02-title-block-in-app.png` — the A3 sheet scrolled into view, showing the title block rendered in the running application for the first time: project name, address line, `A-101 / REV A / A3`, model revision, north arrow and scale bar. This is the D-07 work from 2026-09-11 finally visible in situ; that slice could only prove itself by rendering the component's output separately.

No regression in other panes (`other-panes-no-regression.log`):

```
{"Drawings":1656,"Takeoff":1656,"Visualise":1656,"Estimate":1656}
SOURCE_ANNOTATIONS_PANE:1396
```

All four main panes keep their pre-fix width, and the sketch pane's other mode (Source annotations) is unchanged at 1396 px. The change is scoped by `:has(.architect-workspace)` and touches nothing else.

Machine gate: `tsc --noEmit` exit 0; 51/51 architect, title block, export and sheet-set tests.

## Boundary

- CSS specificity fix only. No component, layout structure or markup change.
- Proven at desktop 1680x1050. **No tablet capture at 1024x768**, and the register's tablet scope is not closed by this.
- U-03 stays `partial`: layouts remain per browser profile and no multi-monitor case is covered, which were its existing remaining items.
- The underlying fragility is unaddressed: the shared grid still sizes itself from a `display: none` element's presence in the DOM. A workspace that hides a rail in future will hit the same trap. The durable fix is for the shared rule to stop treating a hidden rail as occupying a track, which belongs to `workspacePanels.css` and the other chat's active area.
