import { test } from "node:test";
import assert from "node:assert/strict";
import { createDefaultJob } from "../domain.ts";
import type { Pane } from "../store.ts";
import { emptyProject, revise, area } from "../architect/model.ts";
import { createAppTools, type AppToolPort } from "./appTools.ts";
import { prepareArchitectElements } from "./architectBridge.ts";
import { assistantToolAllowed } from "./skills.ts";
import { WORKBENCH_STRUCTURE, loadCatalogScene, sourceBuildingQuerySchema, summariseSourceBuilding } from "./workbenchStructure.ts";

const rect = (w: number, d: number): [number, number][] => [[0, 0], [w, 0], [w, d], [0, d]];
const draw = (project: ReturnType<typeof emptyProject>, operations: unknown[]) =>
  prepareArchitectElements(project, { expectedJobId: project.id, expectedRevision: project.revision, operations });

test("level, footprint, slab and roof operations produce validated storey geometry with resolvable refs", () => {
  const p = emptyProject("wire"), before = JSON.stringify(p);
  const result = draw(p, [
    { kind: "level", ref: "first", name: "First floor", elevationMm: 3000, heightMm: 2700 },
    { kind: "footprint", levelId: "first", points: rect(20000, 12000), name: "First floor wall" },
    { kind: "slab", ref: "deck", levelId: "first", points: rect(20000, 12000), thicknessMm: 200 },
    { kind: "roof", ref: "top", levelId: "first", points: rect(20000, 12000), pitchDeg: 25, gableEdges: [1, 3] },
    { kind: "room", levelId: "first", point: [10000, 6000], name: "OPEN PLAN" },
  ]);
  assert.equal(JSON.stringify(p), before);
  assert.equal(result.draft.levels.length, 2);
  const level = result.draft.levels[1];
  assert.equal(level.name, "First floor"); assert.equal(level.elevation, 3000);
  assert.equal(result.draft.walls.length, 4);
  assert.ok(result.draft.walls.every(wall => wall.levelId === level.id && wall.height === 2700));
  assert.deepEqual(result.draft.walls.map(wall => wall.name), ["First floor wall 1", "First floor wall 2", "First floor wall 3", "First floor wall 4"]);
  assert.equal(result.draft.slabs[0].levelId, level.id); assert.equal(result.draft.slabs[0].thickness, 200); assert.equal(area(result.draft.slabs[0].points), 240e6);
  const roof = result.draft.roofs[0];
  assert.equal(roof.offset, 2700); assert.equal(roof.eaves, 450);
  assert.deepEqual(roof.edges.map(edge => edge.gable), [false, true, false, true]);
  assert.ok(roof.edges.every(edge => edge.pitch === 25));
  assert.equal(result.draft.roomTags[0].levelId, level.id);
  assert.deepEqual(result.created.map(row => row.kind), ["level", "wall", "wall", "wall", "wall", "slab", "roof", "room"]);
  assert.equal(result.created.find(row => row.ref === "top")!.id, roof.id);
  assert.equal(result.notices.length, 4);
  assert.equal(revise(p, result.draft).revision, p.revision + 1);
});

test("extrude draws a three-storey 20 m by 12 m wireframe: new levels, walls per storey, slabs and one top roof", () => {
  const p = emptyProject("wire"), ground = p.levels[0];
  const result = draw(p, [{ kind: "extrude", points: rect(20000, 12000), storeys: 3, storeyHeightMm: 3200, baseLevelId: ground.id, slabs: true, roof: { pitchDeg: 20, eavesMm: 600 } }]);
  assert.equal(result.draft.levels.length, 3);
  assert.deepEqual(result.draft.levels.map(level => level.elevation), [0, 3200, 6400]);
  assert.deepEqual(result.draft.levels.slice(1).map(level => level.name), ["Level 2", "Level 3"]);
  assert.equal(result.draft.walls.length, 12);
  for (const level of result.draft.levels) assert.equal(result.draft.walls.filter(wall => wall.levelId === level.id).length, 4);
  assert.ok(result.draft.walls.filter(wall => wall.levelId !== ground.id).every(wall => wall.height === 3200));
  assert.equal(result.draft.slabs.length, 3);
  assert.equal(result.draft.roofs.length, 1);
  assert.equal(result.draft.roofs[0].levelId, result.draft.levels[2].id); assert.equal(result.draft.roofs[0].offset, 3200); assert.equal(result.draft.roofs[0].eaves, 600);
  assert.equal(result.created.filter(row => row.kind === "level").length, 2);
  assert.equal(result.created.filter(row => row.kind === "wall").length, 12);
  assert.match(result.notices.at(-1)!, /Extruded 3 storey/);
  const stacked = draw(p, [{ kind: "extrude", points: rect(8000, 8000), storeys: 2, roof: false }]);
  assert.deepEqual(stacked.draft.levels.slice(1).map(level => level.elevation), [2700, 5700]);
  assert.equal(stacked.draft.roofs.length, 0); assert.equal(stacked.draft.slabs.length, 0); assert.equal(stacked.draft.walls.length, 8);
});

test("wireframe operations reject bad geometry and unknown levels without touching the project", () => {
  const p = emptyProject("wire"), before = JSON.stringify(p), levelId = p.levels[0].id;
  assert.throws(() => draw(p, [{ kind: "footprint", levelId: "missing", points: rect(5000, 5000) }]), /existing design level/);
  assert.throws(() => draw(p, [{ kind: "slab", levelId, points: [[0, 0], [8000, 0], [8000, 5000], [2000, -1000], [0, 5000]], thicknessMm: 150 }]), /crosses itself/);
  assert.throws(() => draw(p, [{ kind: "roof", levelId, points: [[0, 0], [8000, 0], [8000, 6000], [4000, 2000], [0, 6000]] }]), /convex/);
  assert.throws(() => draw(p, [{ kind: "roof", levelId, points: rect(5000, 5000), gableEdges: [0, 1, 2, 3] }]), /pitched or flat edge/);
  assert.throws(() => draw(p, [{ kind: "roof", levelId, points: rect(5000, 5000), gableEdges: [7] }]), /exceeds the roof outline/);
  assert.throws(() => draw(p, [{ kind: "extrude", points: rect(5000, 5000), storeys: 0 }]));
  assert.throws(() => draw(p, [{ kind: "level", ref: "a", name: "A", elevationMm: 0, heightMm: 3000 }, { kind: "level", ref: "a", name: "B", elevationMm: 3000, heightMm: 3000 }]), /unique/);
  assert.throws(() => draw(p, [{ kind: "wall", levelId, a: [0, 0], b: [0, 0] }]), /1 mm/);
  assert.equal(JSON.stringify(p), before);
});

function fixture() {
  const job = createDefaultJob();
  const state = { job, pane: "model" as Pane, sheet: 0, hydrationStatus: "ready", persistenceHydrated: true, persistenceRecoveryBlocked: false, persistenceError: null as string | null, lastSavedJobRevision: job.revision as number | null,
    setPane(pane: Pane) { state.pane = pane; }, saveCurrentProject() { return { ok: true, error: null as string | null }; } };
  const queries: unknown[] = [];
  const port: AppToolPort = {
    getState: () => state, architect: async () => ({}), architectAvailable: () => false, capture: async () => ({ content: [] }),
    sourceBuilding: async query => { queries.push(query); return { building: query.building, parts: [] }; },
  };
  const tools = createAppTools(port);
  return { state, port, queries, tools, execute: (name: string, args: unknown) => tools.find(tool => tool.name === name)!.execute(args) };
}
const message = (result: { content: Array<{ type: string; text?: string }> }) => result.content.filter(row => row.type === "text").map(row => row.text).join("\n");

test("structure tool is a static, permission-free reference that lists wireframe operations and what is not available", async () => {
  const f = fixture();
  const value = JSON.parse(message(await f.execute("read_workbench_structure", {})));
  assert.equal(value.units.architecturalDesign, "mm"); assert.equal(value.units.sourceBuilding, "m");
  assert.ok(value.architecturalDesign.wireframeOperations.draw_architect_elements.some((op: string) => op.startsWith("extrude")));
  assert.ok(value.notAvailableThroughTools.some((item: string) => /restoring or deleting backups/.test(item))); assert.ok(value.workbenchTools.editWithPermission.some((item: string) => /^edit_architect_elements/.test(item)));
  assert.deepEqual(value.evidence.states, ["traced", "dimensioned", "inferred"]);
  assert.ok(value.sourceBuilding.catalog.find((item: { id: string }) => item.id === "ruffles").sample);
  assert.equal((await f.execute("read_workbench_structure", { extra: 1 })).isError, true);
  assert.equal(assistantToolAllowed("read_workbench_structure", false), true);
  assert.equal(assistantToolAllowed("read_source_building", false), true);
  assert.equal(assistantToolAllowed("draw_architect_elements", false), false);
  const draw = f.tools.find(tool => tool.name === "draw_architect_elements")!;
  const kinds = (draw.inputSchema.properties as { operations: { items: { oneOf: Array<{ properties: { kind: { const: string } } }> } } }).operations.items.oneOf.map(item => item.properties.kind.const);
  assert.deepEqual(kinds, ["wall", "door", "window", "line", "room", "level", "slab", "roof", "footprint", "extrude"]);
  assert.match(draw.description, /multi-storey wireframe/);
});

test("source building tool validates its query, binds to the project and forwards to the reader", async () => {
  const f = fixture(), id = f.state.job.id;
  assert.equal((await f.execute("read_source_building", { expectedJobId: id, building: "not-in-catalog" })).isError, true);
  assert.equal((await f.execute("read_source_building", { expectedJobId: "other", building: "redburn" })).isError, true);
  assert.equal(f.queries.length, 0);
  const result = await f.execute("read_source_building", { expectedJobId: id, building: "redburn", floor: "ground", category: "wall", limit: 5 });
  assert.equal(result.isError, undefined); assert.deepEqual(f.queries[0], { expectedJobId: id, building: "redburn", floor: "ground", category: "wall", limit: 5 });
  f.port.sourceBuilding = async () => { f.state.job = createDefaultJob(); return { leaked: true }; };
  assert.equal((await f.execute("read_source_building", { expectedJobId: id, building: "redburn" })).isError, true);
  delete f.port.sourceBuilding;
  assert.match(message(await f.execute("read_source_building", { expectedJobId: f.state.job.id, building: "redburn" })), /unavailable/);
});

const scene = {
  schema: "xray.source-building/v1", source: { name: "fixture.pdf", sha256: "a".repeat(64), pageCount: 2 }, units: "m", coordinateSystem: "x east, y up, z south",
  bounds: { min: [0, 0, 0], max: [10, 7, 8] }, floorElevations: { ground: 0, upper: 3 },
  materials: { brick: { color: "#aa5533" } },
  objects: [
    { level: "ground", id: "w1", category: "wall", label: "North wall", positions: [0, 0, 0, 10, 0, 0, 10, 3, 0], indices: [0, 1, 2], material: "brick", sourceRefs: [{ page: 1, region: [0, 0, 10, 10], evidenceState: "traced", note: "" }], evidenceState: "traced" },
    { level: "upper", id: "w2", category: "wall", label: "Upper wall", positions: [0, 3, 0, 10, 3, 0, 10, 6, 0], indices: [0, 1, 2], material: "brick", sourceRefs: [{ page: 2, region: [0, 0, 10, 10], evidenceState: "inferred", note: "" }], evidenceState: "inferred" },
    { level: "roof", id: "r1", category: "roof", label: "Roof", positions: [0, 6, 0, 10, 6, 0, 5, 7, 4], indices: [0, 1, 2], material: "brick", sourceRefs: [{ page: 1, region: [0, 0, 10, 10], evidenceState: "dimensioned", note: "" }], evidenceState: "dimensioned" },
  ],
  assumptions: ["Fixture only"],
  sourceSheets: [{ page: 1, title: "Plan", image: "/models/fixture/source-page-1.png", width: 100, height: 100, role: "plan" }, { page: 2, title: "Upper", image: "/models/fixture/source-page-2.png", width: 100, height: 100, role: "plan" }],
  summary: { wallRuns: 2, openings: 0, roofFaces: 1, objects: 3, visibleNamedRooms: 0, method: "fixture", status: "sample" },
};

test("source building summary filters by storey and category, omits meshes and keeps evidence states per part", async () => {
  let fetched = 0;
  const fetcher = (async () => { fetched++; return new Response(JSON.stringify(scene), { status: 200 }); }) as unknown as typeof fetch;
  const loaded = await loadCatalogScene("ruffles", fetcher);
  assert.equal(await loadCatalogScene("ruffles", fetcher), loaded); assert.equal(fetched, 1);
  const all = summariseSourceBuilding(loaded, { building: "ruffles" });
  assert.equal(all.sample, true); assert.equal(all.units, "m"); assert.equal(all.matched, 3); assert.deepEqual(all.evidence, { traced: 1, dimensioned: 1, inferred: 1 });
  assert.deepEqual(all.parts.map(part => part.id), ["w1", "w2", "r1"]);
  assert.ok(all.parts.every(part => !("positions" in part) && !("indices" in part)));
  assert.deepEqual(all.parts[0].boundsM, { min: [0, 0, 0], max: [10, 3, 0] }); assert.deepEqual(all.parts[1].sourcePages, [2]);
  const ground = summariseSourceBuilding(loaded, { building: "ruffles", floor: "ground", category: "wall" });
  assert.deepEqual(ground.parts.map(part => part.id), ["w1"]); assert.equal(ground.matched, 1);
  const limited = summariseSourceBuilding(loaded, { building: "ruffles", limit: 1 });
  assert.equal(limited.returned, 1); assert.equal(limited.matched, 3);
  assert.throws(() => summariseSourceBuilding(loaded, { building: "ruffles", floor: "penthouse" }), /Unknown storey/);
  assert.throws(() => sourceBuildingQuerySchema.parse({ expectedJobId: "j", building: "ruffles", limit: 0 }));
  assert.equal(WORKBENCH_STRUCTURE.sourceBuilding.catalog.length, 4);
});
