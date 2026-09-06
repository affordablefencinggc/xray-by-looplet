# How the Ruffles 3D Model Was Built

Prepared for Daniel on 5 September 2026  
X-Ray by Looplet implementation explanation

## What you are seeing

The building in your screenshot is an interactive 3D reconstruction of `residential-ruffles-seeka.pdf`. The application draws actual triangle meshes that you can orbit, inspect, hide and select. Each building part carries references to the original drawing sheets, which is why selecting the roof can show a highlighted region of the roof plan in the right panel.

The central implementation decision is to separate **preparing the geometry** from **displaying and verifying it**. A curated drawing trace and a Python geometry builder prepare this particular building. The React application loads the resulting model and uses Three.js to render it. Opening an arbitrary PDF does not automatically produce an equivalent model.

This explanation is based on the current source code, trace file and generated model inspected for this document. It describes the existing implementation rather than claiming that the model was created during the current screen adjustment.

## The process from PDF to model

### 1 Preserve and identify the original drawing

The source is a 24-page PDF. Its SHA-256 fingerprint is recorded in both the curated trace and the generated model. The Python builder checks the input PDF against that fingerprint before generating geometry. The viewer also hashes the imported PDF bytes and checks them before displaying the matching model.

This prevents the Ruffles building from being presented as the reconstruction of a different uploaded drawing. A matching fingerprint proves file identity; it does not prove that every modelled dimension is accurate.

### 2 Trace the relevant drawing information

The prepared trace is stored in `engine/fixtures/ruffles-source-trace.json`. It contains the footprint, wall runs, openings, room regions and registration information needed to relate the different sheets.

The model references ground plans on pages 11 and 13, roof plans on pages 15 and 16, and elevations on pages 17 to 19. Plan views locate elements horizontally; elevations supply height and roof information. The trace is explicitly curated. The builder does not classify arbitrary PDF lines as walls.

### 3 Convert page coordinates into metres

The trace uses displayed page coordinates on a 1191 by 842 page space. Its approximate calibration comes from a 6510 mm garage dimension spanning about 186 page points, giving 28.57 page points per metre.

With the recorded origin at page position `(32, 156)`, the builder converts a page point into a model position:

```text
X = (page horizontal coordinate - 32) / 28.57
Y = height in metres
Z = (page vertical coordinate - 156) / 28.57
```

X runs right across the drawing, Y runs upward in the building, and Z follows the drawing downward. Separate registration offsets align the roof and carport references with the main floor plan. The source describes dimensions as approximate and subject to confirmation, so this calibration retains that limitation.

### 4 Build solid geometry from the trace

`engine/python/xray/source_building.py` converts the prepared information into vertices and triangle indices. It triangulates footprint polygons, gives slabs thickness, and builds wall solids along traced runs. At doors and windows, it splits the wall into the remaining solid sections, including the portions above openings and below window sills.

The builder adds frames, doors, glazing, columns, steps, fixtures, solar panels and skylights. Materials distinguish roof surfaces, walls, glass, metal and flooring. Some presentation details, including undimensioned opening heights and frames, are inferred.

Roof shapes combine the roof plan outlines with elevation information. The assumptions record an approximately 22.5-degree main roof pitch and a 2.720 m ceiling height. Hip intersections and roof junction heights are inferred. The flyover roof uses a 6.9-degree pitch with elevation references of 3.230 m and 2.560 m; its registration and edge thickness remain approximate.

### 5 Save a model with evidence attached

The output is `public/models/ruffles/source-building.json`, using the `xray.source-building/v1` format. It stores geometry, materials, bounds, source identity, sheet references and assumptions.

The current model reports:

| Measure | Recorded value |
| --- | ---: |
| Original PDF pages | 24 |
| Traced wall runs | 33 |
| Wall openings | 18 |
| Roof objects | 22 |
| Total model objects | 272 |
| Objects labelled traced | 74 |
| Objects labelled inferred | 198 |

Wall runs and rendered objects are different counts: a wall with openings becomes several meshes, and its frames and glazing create additional objects. Evidence labels are provenance classifications, not confidence percentages. Individual references can also identify dimensioned evidence even when the overall object remains inferred.

### 6 Render the building interactively

`src/studio/SourceBuildingViewer.tsx` creates a Three.js WebGL scene. For each object it loads the vertex positions into `BufferGeometry`, applies triangle indices, computes normals and creates a mesh with a material.

Perspective and orthographic cameras provide the orbit and plan views. OrbitControls supplies rotation, zoom and pan. Hemisphere lighting, directional lighting, shadows and edge lines make the building legible. The viewer renders on demand and continues updating while camera damping settles.

The controls change the live scene: wireframe exposes edges, roof visibility hides roof-related categories, wall cutaway uses clipping, and exploded view separates parts. PNG export captures the rendered view with source and reconstruction context.

### 7 Connect a selected part back to the PDF

Clicking the building casts a ray from the camera through the pointer into the meshes. The intersected mesh supplies a part identifier. The inspector uses that part's source references to display a sheet image, highlight the recorded region, and show its evidence state and notes.

In your screenshot, the selected part is **main south roof plane**. Its page 15 reference identifies the roof-plan region highlighted in orange. Its overall evidence state is **inferred**, and its note explains that the hip intersections come from the approximate pitch rather than surveyed geometry. It also carries a page 18 elevation reference.

## What this implementation establishes

The application has a working way to display a detailed building, navigate its geometry and inspect its drawing provenance. The Ruffles model contains the disclosed Media, Garage, WC, Bath, Linen, Robe and Bed 2 partitions. The remainder of the existing dwelling is intentionally left unpartitioned because the renovation drawings do not disclose its full layout.

This is a preliminary visual reconstruction. It does not establish a general automatic PDF-to-BIM pipeline, construction-ready geometry or verified takeoff quantities. The builder explicitly produces no takeoff quantities. A convincing render and a matching source fingerprint should therefore be interpreted separately from measurement verification.

## How another drawing can use the same approach

The viewer and scene format are reusable. To prepare another building using the current method, identify its original PDF, establish scale and sheet registration, curate its geometry and evidence references, build and validate the scene, and connect it to the viewer through the matching source fingerprint. Accuracy review must cover both geometry and provenance before making stronger claims about measurements or quantities.

Automating the preparation stage would be additional engineering: extracting and interpreting drawing information, resolving cross-sheet relationships, handling ambiguous details, and providing review and correction tools. That automation is not demonstrated by this prepared sample alone.

## Implementation references

These are repository-relative paths to the implementation inspected for this explanation.

| File | Responsibility |
| --- | --- |
| `engine/fixtures/ruffles-source-trace.json` | Prepared trace, scale and sheet registration |
| `engine/python/xray/source_building.py` | Geometry construction and source hash check |
| `public/models/ruffles/source-building.json` | Generated model, object evidence and assumptions |
| `public/models/ruffles/source.pdf` | Original drawing asset used by the model |
| `src/studio/sourceBuilding.ts` | Scene validation, model catalogue and PDF byte matching |
| `src/studio/SourceBuildingViewer.tsx` | Rendering, interaction, selection and evidence inspector |

The recorded builder invocation, with the engine package available on the Python path, is:

```text
python -m xray.source_building engine/fixtures/residential-ruffles-seeka.pdf
  --trace engine/fixtures/ruffles-source-trace.json
  --out public/models/ruffles/source-building.json
```

The command is wrapped above for readability. This document was verified against the stored implementation and generated output; the geometry builder was not rerun for this explanation.
