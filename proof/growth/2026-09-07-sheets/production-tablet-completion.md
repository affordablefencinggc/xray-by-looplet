# Tablet viewport verification — production candidate a8a8c4946d93

User target scope now excludes phones; earlier narrow-screen screenshots remain historical evidence only.

Executed `production-tablet.json` in the isolated production browser session `growth-production`, against the existing built app at8086.27commands completed in1.423seconds,exit0. No application/source edits.

## Verified at1024×768 landscape and768×1024 portrait

- Sheet register renders custom Civil/Structural groups, renamed sheets and original page identities without horizontal page overflow.
- Saved Release drainage detail opens original page2. Readiness waits include actual rendered geometry; normalized source centre matches saved view within0.002, including after the landscape→portrait resize.
- Source drawing and all8lower navigation/layer controls are visible after scrolling to the drawing. Every control rectangle is within the viewport and its centre hit-test reaches that button, without another panel covering it.
- Landscape retains the inspector beside the drawing; portrait places calibration below the drawing in the same scroll workflow.
- Six screenshots were visually inspected.

## Reported gap

The five icon controls measure24×24pixels, and the three layer toggles are24.5pixels high at both tablet widths. They are reachable using the automated pointer, but this evidence does **not** establish comfortable touch targets. The44pixel CSS rule currently applies only at widths<=760px, excluding both tested tablet widths. Reported to root before any source change; source remained frozen during this run.

This is browser viewport testing, not real tablet hardware, touchscreen input, native Mac or native Linux verification. No claims about those platforms follow from this run.

## Artifacts

- Scenario: `proof/growth/2026-09-07-sheets/production-tablet.json`
- Log: `proof/growth/runner/2026-09-07T13-24-58-027Z-growth-production.log`
- Screenshots under `screenshots/growth/2026-09-07-sheets/`:
  - `production-tablet-landscape-sheets.png`
  - `production-tablet-landscape-bookmark.png`
  - `production-tablet-landscape-canvas.png`
  - `production-tablet-portrait-sheets.png`
  - `production-tablet-portrait-bookmark.png`
  - `production-tablet-portrait-canvas.png`

Session ends on Sheets at768×1024. Production session ownership is returned to root after this report.
