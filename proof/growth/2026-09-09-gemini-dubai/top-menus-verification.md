# Adjustable top menus — 2026-09-09

The app header, page navigation and workspace information line are separate AdjustableTopRow components. Each has a small collapse arrow on the right, a draggable bottom edge, keyboard height controls and double-click reset. Saved height/collapse state uses a separate versioned localStorage key per row. Collapsing keeps row content mounted but hidden. The workspace and assistant remeasure below the rows.

Source: src/studio/AdjustableTopRow.tsx, src/studio/adjustableTopRow.css, integration in src/studio/Studio.tsx. The rest of Studio.tsx already had unrelated working changes.

Validation: typecheck exit 0; new component lint exit 0. Local development Fast CDP per project local-first instruction: 45 commands passed for individual keyboard resizing/collapse, assistant alignment, reload persistence and desktop/tablet arrows. A separate 9-command test passed actual pointer dragging and double-click reset. Browser errors empty. Visually inspected desktop, tablet and all-collapsed screenshots.

Runs:
- proof/growth/runner/2026-09-09T09-19-28-404Z-top-menus.json
- proof/growth/runner/2026-09-09T09-20-20-649Z-top-menus.json

Screenshots: screenshots/gemini-dubai-capacity/top-menus-{desktop,tablet,collapsed}.png.

Only top-menu behavior is covered. No production build or overall canvas/Gemini completion claimed. Task-owned top-menus browser closed after verification; user app/server retained.
