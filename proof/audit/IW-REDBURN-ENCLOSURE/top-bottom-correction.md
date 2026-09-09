# Top options and separate bottom navigation — 2026-09-07

User clarified that existing top settings were correct and missing bottom controls should be restored separately. This delta moves the existing option groups back to the original top `.building-toolbar` within the model stage; `role=toolbar`, accessible name `3D view controls`. Solid/Wireframe, Orbit/Fly/Walk-through, Plan, building level, Roof, Wall cutaway, Explode, Fit and PNG retain their existing handlers. Scope and Visual settings were untouched.

The reserved bottom dock now contains only Zoom out model, Zoom in model, Reset model view, Front and Rear, with accessible toolbar name `Model navigation`. Reset uses the existing fit action; top Fit remains present and distinct. No artificial snapping/vector controls were introduced into the prepared 3D reconstruction.

Changed product files: `src/studio/SourceBuildingViewer.tsx` and `src/studio/sourceBuilding.css`. No geometry, model assets or persistent settings changed.

Executed `npm.cmd run typecheck`: passed. `top-bottom-controls.json` and `top-bottom-controls.log` record the isolated agent-browser scenario in session `xray-sheet-wave`: ready198-part Redburn reconstruction, distinct toolbar contents/order, Front/Zoom/Reset, Solid/Wireframe, visible bottom bounds at1600×1000 and1280×720,390×844 no horizontal overflow and44px lower controls. The initial assertion accidentally used browser-global `top` as a variable and was corrected before the logged passing rerun; no product failure was involved.

Visually inspected:

- `screenshots/redburn-enclosure/top-bottom-desktop.png`
- `screenshots/redburn-enclosure/top-bottom-short.png`
- `screenshots/redburn-enclosure/top-bottom-mobile.png`

Top settings remain visibly at the top and the five navigation controls remain at the bottom. The user may still mean the older PDF-style bottom toolbar; this delta does not claim that page navigation/Snap/Vectors/Manual belong in the 3D model. Parent owns final production/native build and install verification.
