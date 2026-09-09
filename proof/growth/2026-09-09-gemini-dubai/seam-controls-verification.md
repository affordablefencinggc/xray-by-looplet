# Right rail seam controls — 2026-09-09

Implemented the screenshot request: assistant button and collapse/resize handle share the assistant's white/grey palette and stay centred on the measured right-column seam. Docked assistant stacking no longer covers the controls; floating corner resize targets are hidden in full-height docked layout. Restored the Model sidebar grid at tablet widths so the controls do not follow a stacked inspector below the canvas.

Changed source: `src/studio/assistantPanel.css`, `src/studio/assistantRail.css`, `src/studio/canvasFocus.css`. These files already include earlier unfinished canvas/layout work; this record approves only the seam controls.

Executed local development verification per AGENTS.project.md local-first instruction (not DANS1 evidence): 77 Fast CDP commands, exit 0, all ten pages at 1440×900 and 1024×768. Assertions check both controls' measured centres, gradient colours, and hit testing above the open panel. Assistant collapse/restore exercised at both sizes. Browser errors output empty. Visually inspected four screenshots covering open assistant and regular inspector at both sizes.

Run: `proof/growth/runner/2026-09-09T09-16-05-910Z-dubai-canvas.json` and matching `.log` / `.scenario.json`.
Screenshots: `screenshots/gemini-dubai-capacity/seam-controls-{open,closed}-{1440,1024}.png`.

Cleanup: task-owned `dubai-canvas` browser session closed successfully. User browser and development server retained. No production build or full Gemini building-completion claim. Earlier canvas expansion alignment failure remains outside this verification.
