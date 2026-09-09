# CAD, 3D Draftsman, and Procedural WebGL Engine

## Scope

This document governs the visual, interactive, and rendering behaviour of the X-Ray
Three.js architectural drafting environment.

Primary implementation surfaces include:

- `src/studio/SourceBuildingViewer.tsx`
- `src/studio/MagicPencilDraftsman.ts`
- Three.js scene creation and disposal utilities
- Custom GLSL shaders
- Camera controls
- Raycasting and object selection
- Blueprint export

## Technology boundary

Use:

- React for application and UI state.
- Vanilla Three.js for scene graph, geometry, cameras, raycasting, WebGL rendering.
- Custom vertex and fragment shaders only where they clearly improve the drafting or
  visual language.
- Typed contracts between React state and Three.js imperative scene state.

Do not allow React reconciliation to directly and repeatedly recreate the entire Three.js
scene on every state update.

Dispose of Three.js resources on unmount:

- Geometry.
- Materials.
- Textures.
- Render targets.
- Post-processing passes.
- Event listeners.
- Animation frames.

## Coordinate convention

Use a documented consistent coordinate convention:

```text
X = drawing horizontal direction
Y = vertical building elevation
Z = drawing vertical direction / depth axis
```

All model units must be metres unless a field explicitly declares another unit.

## Storeys

Each model object that belongs to the building must carry:

```ts
type StoreyReference = {
  storeyId: string;
  storeyName: string;
  elevationM: number;
};
```

Do not infer a storey solely from world-space Y position if a source-backed storey record
exists.

## Magic Pencil drafting states

The drafting engine uses these canonical stages:

```ts
type DraftingStage =
  | "datum_grid"
  | "ascending_wireframe"
  | "ink_strengthening"
  | "material_wash"
  | "solid";
```

### `datum_grid`

Display:

- Ground plane.
- Datum crosshairs.
- Metric grid.
- Primary axes.
- Origin marker.
- Optional scale/reference labels.

The datum grid is a technical orientation state, not a decorative loading screen.

### `ascending_wireframe`

Display:

- Building wireframe or sliced mesh frontier.
- Vertical progression as storeys rise.
- Storey transitions.
- Animated drafting front.
- Source/evidence-safe geometry only.

The upward frontier must be driven by a deterministic normalized progress value in `[0, 1]`.

### `ink_strengthening`

Display:

- Stronger edge contrast.
- Technical line weights.
- Darkened outlines.
- Clear hierarchy between primary envelope edges and minor detail edges.

Do not render a generic “video game outline.” The result should read as architectural ink.

### `material_wash`

Display:

- Controlled material fill.
- Architectural material palette.
- Optional texture mapping.
- Restrained, readable shading.
- Preserved technical edge legibility.

Material wash must not conceal uncertain/inferred objects.

### `solid`

Display:

- Full solid 3D model.
- Complete raycasting.
- Part selection.
- Evidence inspector compatibility.
- Roof visibility, cutaway, and exploded-view support.

## Interactive control contracts

### Pencil scale

```ts
pencilScale: number // valid range 0.5 to 2.5
```

Rules:

- Clamp all external and UI values to `[0.5, 2.5]`.
- Display the current multiplier.
- Persist the value in project/session state where appropriate.
- Ensure the rendered stylus cursor updates without scene recreation.

### Animation speed

```ts
speed: number // positive finite multiplier
```

Rules:

- Reject `NaN`, infinity, zero, and negative values.
- Use a bounded range in the UI.
- Keep the animation deterministic where testing is needed.

### Cinematic orbit

```ts
cinematicOrbit: boolean
```

Rules:

- Orbit must not fight manual camera controls.
- Manual interaction pauses or overrides the tour.
- The user can stop the tour instantly.
- Preserve camera near/far planes and avoid clipping through geometry.

### Dock position

```ts
dockPosition: "bottom-left" | "bottom-center"
```

Default:

```css
bottom: 20px;
left: 20px;
```

Rules:

- Bottom-left is default.
- Bottom-center remains reachable on iOS.
- The dock must not cover essential controls without a collapse option.
- The dock must avoid browser safe-area issues.

## Visual design language

### Main surfaces

```text
Container slate: #1e293b
Primary pill buttons: #ffffff
Status badges: dark slate
Magic Pencil launch/test accent only: #1877F2
Blueprint canvas: #0b1d33
```

### Design rules

- Use white pill controls for primary neutral interactions.
- Use dark slate badges for technical metadata and status.
- Reserve Facebook Blue only for Magic Pencil launch/test actions.
- Use semantic colours for evidence states, with labels.
- Maintain strong text contrast.
- Ensure each touch target is at least 44 px high and wide where feasible.
- Avoid horizontal overflow at `390x844`.

## Selection and provenance

Raycasted selections must return stable object IDs.

Every selectable object must retain:

- Object ID.
- Category.
- Storey.
- Evidence record.
- Source references.
- Bounds.
- Material.
- Any related takeoff component identifier.

When an object is selected:

1. Highlight the object.
2. Preserve material identity where possible.
3. Display evidence text, not colour only.
4. Show sheet/page references.
5. If a region exists, display or request its PDF highlight.
6. Never claim a selected object is source-measured if it is inferred.

## Blueprint compositor

Technical blueprint export must use authentic Prussian Blue:

```text
#0b1d33
```

Every blueprint export should include where applicable:

- Metric grid.
- Datum ruler.
- Scale or explicit “not calibrated” label.
- Sheet title.
- Project title.
- Model reference.
- Export timestamp.
- Evidence legend.
- Source hash prefix.
- View name and orientation.
- Title block.

Do not present an uncalibrated blueprint as dimensionally authoritative.

## Rendering performance

For repeat components, use:

- InstancedMesh.
- Shared geometries.
- Shared materials where practical.
- Level of detail for large scenes.
- On-demand render loops where the scene is static.

Avoid:

- Allocating geometry every animation frame.
- Updating React state at frame rate unless essential.
- Creating new materials in render loops.
- Leaving renderer and texture resources undisposed.
