import { z } from "zod";
import { ARCHITECT_BATCH_LIMIT } from './architectBridge.ts';
import { WORKFLOWS, WORKFLOW_VERSION } from './workflowRouting.ts';
import { BUILDING_CATALOG, buildingPartOnFloor, parseSourceBuilding, type SourceBuilding } from "../sourceBuilding.ts";
import { DESIGNED_SCENE_ID, DESIGNED_SCENE_TITLE } from "../architect/designedScene.ts";

/** Model mode: the designed scene is not a catalog entry; it is read under this identity and is never a sample nor verified. */
export const DESIGNED_SCENE_ENTRY = { id: DESIGNED_SCENE_ID, title: DESIGNED_SCENE_TITLE, sample: false, origin: "designed" } as const;
type SceneOrigin = { title: string; sample: boolean; origin?: "catalog" | "designed" };

/** Static description of X-Ray's data model so the assistant can reason about what it may draw or read. Nothing here is project data. */
export const WORKBENCH_STRUCTURE = {
  workflowRouting: { version: WORKFLOW_VERSION, tool: 'read_workflow_route', workflows: WORKFLOWS },
  units: { architecturalDesign: "mm", sourceBuilding: "m", sourceSheets: "PDF page pixels" },
  panes: ["overview", "sheets", "measure", "sketch", "components", "model", "render", "review", "cost", "proof"],
  architecturalDesign: {
    schema: "xray.architect/v1",
    description: "Authored design owned by Sketch → Architectural workspace. Every entity has a stable id and revision; the project revision increments on each saved change.",
    entities: {
      level: "storey with elevation (mm) and height (mm); walls, slabs, roofs, lines and room tags belong to exactly one level",
      wall: "segment a→b on a level with height and 1–12 layers (assembly); openings are hosted on walls by offset along the wall",
      opening: "door or window hosted on a wall: offset, width, height, sill (doors sill 0), unique tag",
      slab: "closed polygon (3–200 points) on a level with thickness, vertical offset and material",
      roof: "closed convex polygon on a level with per-edge pitch or gable flags, eaves, fascia and gutter dimensions; offset is height above the level",
      line: "reference line", room: "room label point", circle: "reference circle", arc: "reference arc", grid: "grid axis", dimension: "wall dimension string",
    },
    wireframeOperations: {
      draw_architect_elements: ["wall", "door", "window", "line", "room", "level", "slab", "roof", "footprint (closed wall loop on one level)", "extrude (footprint repeated over N storeys with new levels, optional slabs and top roof)"],
      renderedBy: "Architectural workspace plan view and its live 3D model (Live 3D, all levels in 3D); capture_workspace_image target 'architect' returns its pixels",
      limits: `≤${ARCHITECT_BATCH_LIMIT} operations per batch, ≤100 levels, ≤3000 walls, convex roof zones; draw is append-only, edit_architect_elements supports moves and removals`,
    },
  },
  sourceBuilding: {
    schema: "xray.source-building/v1",
    description: "Read-only reconstruction of a source drawing set shown in Model. Parts carry evidenceState traced | dimensioned | inferred and source page references; sample buildings are labelled sample and never become verified evidence.",
    catalog: BUILDING_CATALOG.map(item => ({ id: item.id, title: item.title, sample: item.sample, sourceSha256: item.sha256 })),
    designed: `Model mode: show_design_in_model turns the current architectural design into a '${DESIGNED_SCENE_TITLE}' scene (building id '${DESIGNED_SCENE_ID}', every part inferred, never verified) shown in the Model viewer for the Magic Pencil, captures and renders; hide_designed_model returns the viewer to the catalog. read_source_building accepts building '${DESIGNED_SCENE_ID}' while it is mounted.`,
    partCategories: ["wall", "room", "roof", "roof-trim", "slab", "column", "window", "door", "fixture", "solar", "skylight", "trim", "fence", "stair"],
  },
  evidence: {
    states: ["traced", "dimensioned", "inferred"],
    verifiedTakeoffRequires: "matching source SHA-256 identity and valid ground-truth two-point calibration; counts, lengths, areas and volumes stay separate",
    sampleFirewall: "sample, inferred and unverified data stay visibly separate from verified source measurements; never promote sample data to verified results",
  },
  workbenchTools: {
    read: ["read_project_context", "read_architect_design", "read_workbench_structure", "read_source_building", "read_source_sheets", "read_takeoff_evidence", "read_price_books", "read_draftsman_status", "generate_render_visualisation (web only; AI illustration of the captured 3D view shown on the Render pane)",
      "show_design_in_model (Model mode: shows the current design in the Model viewer as inferred designed geometry; changes what is on screen, not the project)", "hide_designed_model (returns the Model viewer to its catalogued reconstructions)"],
    editWithPermission: [
      "draw_architect_elements", "edit_architect_elements (move, re-parameterise or remove entities by ID; rename the design)", "undo_architect_change", "save_project",
      "manage_source_sheet (rename/archive/recover a source sheet)", "capture_project_backup",
      "calibrate_source_sheet (two-point manual calibration on an imported page; locked pages only with the user's explicit replaceLocked)", "trace_takeoff_run (length trace on a locked page)",
      "review_takeoff_item (currently blocked by the internal-draft authority gate; a name alone is not verified authority)", "remove_takeoff_trace", "import_price_book (CSV text from the user)", "export_design_file (dxf, ifc, drawing-pdf, material-pdf, sheet-register as a browser download)",
    ],
  },
  notAvailableThroughTools: [
    "changing source identity, hashes or source classes", "placing located items (gates) or editing trace vertices one by one",
    "issuing quotes or price approvals", "publishing or contacting third parties", "restoring or deleting backups (the product itself does not apply snapshots yet)",
    "rendering in the native app (web only)", "drawing directly into the Model viewer (it renders source reconstructions or the designed model; authored geometry lives in the Architectural workspace and reaches Model through show_design_in_model)",
  ],
} as const;

export const sourceBuildingQuerySchema = z.object({
  expectedJobId: z.string().min(1).max(100),
  building: z.enum([DESIGNED_SCENE_ENTRY.id, ...BUILDING_CATALOG.map(item => item.id)]),
  floor: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/).optional(),
  category: z.enum(["wall", "room", "roof", "roof-trim", "slab", "column", "window", "door", "fixture", "solar", "skylight", "trim", "fence", "stair"]).optional(),
  limit: z.number().int().min(1).max(200).optional(),
}).strict();
export type SourceBuildingQuery = z.infer<typeof sourceBuildingQuerySchema>;

const scenes = new Map<string, Promise<SourceBuilding>>();
/** Loads the catalogued scene JSON once (browser fetch); the viewer component is not touched. */
export function loadCatalogScene(building: string, fetcher: typeof fetch = fetch): Promise<SourceBuilding> {
  const entry = BUILDING_CATALOG.find(item => item.id === building);
  if (!entry) throw Error("Unknown source building.");
  let pending = scenes.get(building);
  if (!pending) {
    pending = fetcher(entry.sceneUrl).then(async response => {
      if (!response.ok) throw Error(`Source building scene could not be loaded (${response.status}).`);
      return parseSourceBuilding(await response.json());
    });
    pending.catch(() => scenes.delete(building));
    scenes.set(building, pending);
  }
  return pending;
}

/** Summarises parts without their triangle meshes: identity, category, storey, evidence state, bounds in metres and source pages. */
export function summariseSourceBuilding(scene: SourceBuilding, query: Omit<SourceBuildingQuery, "expectedJobId">, catalogEntry: SceneOrigin | undefined = BUILDING_CATALOG.find(item => item.id === query.building)) {
  const floor = query.floor ?? "all";
  if (floor !== "all" && floor !== "ground" && floor !== "upper" && !scene.storeys?.some(item => item.id === floor)) throw Error("Unknown storey for this building.");
  const matches = scene.objects.filter(part => buildingPartOnFloor(part, floor) && (!query.category || part.category === query.category));
  const limit = query.limit ?? 50;
  const parts = matches.slice(0, limit).map(part => {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let index = 0; index < part.positions.length; index++) {
      const axis = index % 3, value = part.positions[index];
      if (value < min[axis]) min[axis] = value;
      if (value > max[axis]) max[axis] = value;
    }
    return { id: part.id, category: part.category, label: part.label, storey: part.storey ?? part.level ?? null, material: part.material, evidenceState: part.evidenceState,
      boundsM: { min, max }, triangles: part.indices.length / 3, sourcePages: [...new Set(part.sourceRefs.map(ref => ref.page))], note: part.note ?? null };
  });
  const evidence = { traced: 0, dimensioned: 0, inferred: 0 };
  for (const part of matches) evidence[part.evidenceState]++;
  return {
    building: query.building, title: catalogEntry?.title ?? scene.source.name, sample: catalogEntry?.sample ?? true, origin: catalogEntry?.origin ?? (catalogEntry ? "catalog" : "uncatalogued"), sourceSha256: scene.source.sha256, units: scene.units,
    boundsM: scene.bounds, storeys: scene.storeys ?? (scene.floorElevations ? [{ id: "ground", label: "Ground", elevation: scene.floorElevations.ground }, { id: "upper", label: "Upper", elevation: scene.floorElevations.upper }] : []),
    floor, category: query.category ?? "all", matched: matches.length, returned: parts.length, evidence, parts,
    summary: scene.summary, assumptions: scene.assumptions.slice(0, 10),
    scope: "Read-only reconstruction summary in metres; meshes omitted. Evidence states are per part; sample buildings are not verified evidence.",
  };
}
