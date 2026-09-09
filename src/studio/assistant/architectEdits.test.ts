import { test } from "node:test";
import assert from "node:assert/strict";
import { demonstration, emptyProject, revise, validateProject, wallThickness, type ArchitectProject } from "../architect/model.ts";
import { architectEditSchema, prepareArchitectEdits, registerArchitectController, requestArchitectTool } from "./architectBridge.ts";

const fixture = () => {
  const p = demonstration("edit");
  return { p, before: JSON.stringify(p), args: { expectedJobId: p.id, expectedRevision: p.revision } };
};
const untouched = (p: ArchitectProject, before: string) => assert.equal(JSON.stringify(p), before, "original project must not be mutated");
const saved = (p: ArchitectProject, draft: ArchitectProject) => {
  const next = revise(p, draft);
  assert.equal(next.revision, p.revision + 1);
  assert.equal(next.id, p.id);
  return next;
};

test("removing a wall cascades its hosted openings and dimensions and leaves the original untouched", () => {
  const { p, before, args } = fixture();
  const wall = p.walls[2], door = p.openings.find(o => o.wallId === wall.id)!, dimension = p.dimensions.find(d => d.wallId === wall.id)!;
  const result = prepareArchitectEdits(p, { ...args, operations: [{ kind: "remove", id: wall.id }] });
  assert.deepEqual(result.removed, [{ kind: "wall", id: wall.id }, { kind: "opening", id: door.id }, { kind: "dimension", id: dimension.id }]);
  assert.deepEqual(result.changed, []);
  assert.equal(result.draft.walls.length, p.walls.length - 1);
  assert.ok(!result.draft.openings.some(o => o.id === door.id));
  assert.ok(!result.draft.dimensions.some(d => d.id === dimension.id));
  assert.equal(result.draft.openings.length, p.openings.length - 1);
  assert.match(result.notices.join("\n"), /also removed 1 hosted opening\(s\) and 1 dimension\(s\)/);
  untouched(p, before);
  const next = saved(p, result.draft);
  assert.equal(next.walls.length, p.walls.length - 1);
  // Untouched entities keep their revisions: only the removals changed the design.
  assert.ok(next.walls.every(w => w.revision === p.walls.find(o => o.id === w.id)!.revision));
});

test("removing a level is refused while entities remain on it, and the last level can never go", () => {
  const { p, before, args } = fixture();
  assert.throws(() => prepareArchitectEdits(p, { ...args, operations: [{ kind: "remove", id: p.levels[0].id }] }), /still hosts \d+ entit/);
  untouched(p, before);
  const empty = emptyProject("edit"), emptyArgs = { expectedJobId: empty.id, expectedRevision: empty.revision };
  assert.throws(() => prepareArchitectEdits(empty, { ...emptyArgs, operations: [{ kind: "remove", id: empty.levels[0].id }] }), /at least one level/);
  const spare = structuredClone(p);
  spare.levels.push({ id: "upper", name: "Upper", elevation: 2700, height: 2700 });
  const result = prepareArchitectEdits(spare, { ...args, operations: [{ kind: "remove", id: "upper" }] });
  assert.deepEqual(result.removed, [{ kind: "level", id: "upper" }]);
  assert.equal(result.draft.levels.length, 1);
  saved(spare, result.draft);
});

test("moving a wall keeps a hosted door valid when it still fits", () => {
  const { p, before, args } = fixture();
  const wall = p.walls[2], door = p.openings.find(o => o.wallId === wall.id)!;
  const result = prepareArchitectEdits(p, { ...args, operations: [{ kind: "move-wall", id: wall.id, b: [-1500, 6000] }] });
  const moved = result.draft.walls.find(w => w.id === wall.id)!;
  assert.deepEqual(moved.b, [-1500, 6000]);
  assert.deepEqual(moved.a, wall.a);
  assert.deepEqual(result.draft.openings.find(o => o.id === door.id), door);
  assert.deepEqual(result.changed, [{ kind: "wall", id: wall.id }]);
  assert.match(result.notices.join("\n"), /hosted opening offsets are measured from its start point/);
  untouched(p, before);
  const next = saved(p, result.draft);
  assert.equal(next.walls.find(w => w.id === wall.id)!.revision, wall.revision + 1);
  assert.equal(next.openings.find(o => o.id === door.id)!.revision, door.revision);
});

test("moving a wall so its door no longer fits rejects the whole batch unless the batch re-offsets the door", () => {
  const { p, before, args } = fixture();
  const wall = p.walls[2], door = p.openings.find(o => o.wallId === wall.id)!, other = p.walls[0];
  assert.throws(() => prepareArchitectEdits(p, { ...args, operations: [
    { kind: "set-wall", id: other.id, name: "Renamed first" },
    { kind: "move-wall", id: wall.id, b: [5000, 6000] },
  ] }), /Opening must fit within its host wall\./);
  untouched(p, before);
  const result = prepareArchitectEdits(p, { ...args, operations: [
    { kind: "move-wall", id: wall.id, b: [5000, 6000] },
    { kind: "set-opening", id: door.id, offsetMm: 2000 },
  ] });
  assert.equal(result.draft.openings.find(o => o.id === door.id)!.offset, 2000);
  assert.deepEqual(result.changed, [{ kind: "wall", id: wall.id }, { kind: "opening", id: door.id }]);
  saved(p, result.draft);
});

test("moving or renaming requires at least one field and an existing wall of that kind", () => {
  const { p, before, args } = fixture();
  assert.throws(() => prepareArchitectEdits(p, { ...args, operations: [{ kind: "move-wall", id: p.walls[0].id }] }), /at least one field/);
  assert.throws(() => prepareArchitectEdits(p, { ...args, operations: [{ kind: "move-wall", id: p.openings[0].id, a: [0, 0] }] }), /is not a wall/);
  assert.throws(() => prepareArchitectEdits(p, { ...args, operations: [{ kind: "rename-design" }] }), /at least one field/);
  untouched(p, before);
});

test("set-level changes the storey without touching existing wall heights", () => {
  const { p, before, args } = fixture();
  const level = p.levels[0];
  const result = prepareArchitectEdits(p, { ...args, operations: [{ kind: "set-level", id: level.id, name: "Ground floor", heightMm: 3300, elevationMm: 150 }] });
  assert.deepEqual(result.draft.levels[0], { id: level.id, name: "Ground floor", elevation: 150, height: 3300 });
  assert.ok(result.draft.walls.every(w => w.height === p.walls.find(o => o.id === w.id)!.height));
  assert.deepEqual(result.changed, [{ kind: "level", id: level.id }]);
  assert.match(result.notices.join("\n"), /existing walls keep their own heights/);
  untouched(p, before);
  const next = saved(p, result.draft);
  assert.ok(next.walls.every(w => w.revision === p.walls.find(o => o.id === w.id)!.revision));
});

test("set-wall replaces the assembly from a template and enforces hosted opening heights", () => {
  const { p, before, args } = fixture();
  const wall = p.walls[0], template = p.walls[4];
  const result = prepareArchitectEdits(p, { ...args, operations: [{ kind: "set-wall", id: wall.id, templateWallId: template.id, name: "Lined wall", heightMm: 2600 }] }, () => `layer-${Math.random()}`);
  const changed = result.draft.walls.find(w => w.id === wall.id)!;
  assert.equal(changed.name, "Lined wall");
  assert.equal(changed.height, 2600);
  assert.equal(wallThickness(changed), wallThickness(template));
  assert.ok(changed.layers.every(layer => !template.layers.some(source => source.id === layer.id)), "template layers get independent identities");
  untouched(p, before);
  saved(p, result.draft);
  // The window on wall 0 sits at sill 1000 + height 1400: a 2000 mm wall cannot host it.
  assert.throws(() => prepareArchitectEdits(p, { ...args, operations: [{ kind: "set-wall", id: wall.id, heightMm: 2000 }] }), /Opening must fit within its host wall\./);
  assert.throws(() => prepareArchitectEdits(p, { ...args, operations: [{ kind: "set-wall", id: wall.id, templateWallId: wall.id }] }), /cannot use itself/);
  assert.throws(() => prepareArchitectEdits(p, { ...args, operations: [{ kind: "set-wall", id: wall.id, templateWallId: "nope" }] }), /template was not found/);
  untouched(p, before);
});

test("set-roof applies gable edges and pitch, rebuilds edges for a new outline and fails closed on bad gables", () => {
  const { p, before, args } = fixture();
  const roof = p.roofs[0];
  const result = prepareArchitectEdits(p, { ...args, operations: [{ kind: "set-roof", id: roof.id, gableEdges: [1, 3], pitchDeg: 30, eavesMm: 600 }] });
  const changed = result.draft.roofs.find(r => r.id === roof.id)!;
  assert.deepEqual(changed.edges, [{ pitch: 30, gable: false }, { pitch: 30, gable: true }, { pitch: 30, gable: false }, { pitch: 30, gable: true }]);
  assert.equal(changed.eaves, 600);
  assert.deepEqual(result.changed, [{ kind: "roof", id: roof.id }]);
  untouched(p, before);
  const next = saved(p, result.draft);
  assert.equal(next.roofs[0].revision, roof.revision + 1);
  const outline = prepareArchitectEdits(p, { ...args, operations: [{ kind: "set-roof", id: roof.id, points: [[0, 0], [9000, 0], [9000, 6000], [4500, 8000], [0, 6000]], gableEdges: [4] }] });
  assert.equal(outline.draft.roofs[0].edges.length, 5);
  assert.deepEqual(outline.draft.roofs[0].edges[4], { pitch: 22.5, gable: true });
  assert.throws(() => prepareArchitectEdits(p, { ...args, operations: [{ kind: "set-roof", id: roof.id, gableEdges: [4] }] }), /Gable edge index exceeds the roof outline\./);
  assert.throws(() => prepareArchitectEdits(p, { ...args, operations: [{ kind: "set-roof", id: roof.id, gableEdges: [0, 1, 2, 3] }] }), /at least one pitched or flat edge/);
  untouched(p, before);
});

test("set-slab and set-opening edit in place with stable identities", () => {
  const { p, before, args } = fixture();
  const slab = p.slabs[0], window = p.openings.find(o => o.kind === "window")!;
  const result = prepareArchitectEdits(p, { ...args, operations: [
    { kind: "set-slab", id: slab.id, thicknessMm: 200, material: "Reinforced concrete" },
    { kind: "set-opening", id: window.id, sillMm: 900, tag: "W02", hinge: "right" },
  ] });
  assert.equal(result.draft.slabs[0].thickness, 200);
  assert.equal(result.draft.slabs[0].material, "Reinforced concrete");
  const changedWindow = result.draft.openings.find(o => o.id === window.id)!;
  assert.equal(changedWindow.sill, 900);
  assert.equal(changedWindow.tag, "W02");
  assert.equal(changedWindow.hinge, "right");
  assert.deepEqual(result.changed, [{ kind: "slab", id: slab.id }, { kind: "opening", id: window.id }]);
  untouched(p, before);
  const next = saved(p, result.draft);
  assert.equal(next.slabs[0].revision, slab.revision + 1);
  assert.equal(next.openings.find(o => o.id === window.id)!.revision, window.revision + 1);
  // Validator rules still bind: a door cannot get a sill and tags stay unique.
  const door = p.openings.find(o => o.kind === "door")!;
  assert.throws(() => prepareArchitectEdits(p, { ...args, operations: [{ kind: "set-opening", id: door.id, sillMm: 100 }] }), /Door sill must be zero\./);
  assert.throws(() => prepareArchitectEdits(p, { ...args, operations: [{ kind: "set-opening", id: window.id, tag: "d01" }] }), /tags must be unique/);
  untouched(p, before);
});

test("rename-design changes only the design header and keeps the identity", () => {
  const { p, before, args } = fixture();
  const result = prepareArchitectEdits(p, { ...args, operations: [{ kind: "rename-design", name: "Courtyard studio", address: "1 Example Street", designRevision: "B", notes: "Client review" }] });
  assert.equal(result.draft.name, "Courtyard studio / demonstration"); assert.ok(result.notices.some(n => /demonstration marker/.test(n)));
  assert.equal(result.draft.address, "1 Example Street");
  assert.equal(result.draft.designRevision, "B");
  assert.equal(result.draft.notes, "Client review");
  assert.equal(result.draft.id, p.id);
  assert.deepEqual(result.changed, [{ kind: "design", id: p.id }]);
  untouched(p, before);
  const next = saved(p, result.draft);
  assert.ok(next.walls.every(w => w.revision === p.walls.find(o => o.id === w.id)!.revision));
});

test("unknown ids fail closed, including a duplicate remove in one batch", () => {
  const { p, before, args } = fixture();
  assert.throws(() => prepareArchitectEdits(p, { ...args, operations: [{ kind: "remove", id: "missing" }] }), /Entity missing was not found in the design\./);
  assert.throws(() => prepareArchitectEdits(p, { ...args, operations: [{ kind: "set-level", id: "missing", name: "X" }] }), /Entity missing was not found/);
  assert.throws(() => prepareArchitectEdits(p, { ...args, operations: [{ kind: "remove", id: "section" }] }), /was not found/);
  const wall = p.walls[1];
  assert.throws(() => prepareArchitectEdits(p, { ...args, operations: [{ kind: "remove", id: wall.id }, { kind: "remove", id: wall.id }] }), /was not found/);
  assert.throws(() => prepareArchitectEdits(p, { ...args, operations: [{ kind: "remove", id: wall.id }, { kind: "set-wall", id: wall.id, name: "Ghost" }] }), /was not found/);
  untouched(p, before);
});

test("revision and project binding and batch limits reject before any edit is applied", () => {
  const { p, before, args } = fixture();
  const operations = [{ kind: "rename-design", name: "X" }];
  assert.throws(() => prepareArchitectEdits(p, { ...args, expectedRevision: p.revision + 1, operations }), /The design revision changed\. Read the design again before editing\./);
  assert.throws(() => prepareArchitectEdits(p, { ...args, expectedJobId: "other", operations }), /The active project changed/);
  assert.throws(() => prepareArchitectEdits(p, { ...args, operations: [] }));
  assert.throws(() => prepareArchitectEdits(p, { ...args, operations: Array.from({ length: 201 }, () => operations[0]) }));
  assert.throws(() => prepareArchitectEdits(p, { ...args, operations: [{ kind: "delete", id: p.walls[0].id }] }));
  assert.throws(() => prepareArchitectEdits(p, { ...args, operations: [{ kind: "set-wall", id: p.walls[0].id, name: "X", extra: 1 }] }));
  assert.equal(architectEditSchema.safeParse({ ...args, operations }).success, true);
  untouched(p, before);
  assert.doesNotThrow(() => validateProject(p));
});

test("requestArchitectTool dispatches edits to the mounted controller and fails closed without edit support", async () => {
  const { args } = fixture();
  const operations = [{ kind: "rename-design", name: "Dispatched" }];
  const legacy = registerArchitectController({ read: () => "read", draw: () => "draw", undo: () => "undo" });
  await assert.rejects(requestArchitectTool("edit", { ...args, operations }), /does not support edits/);
  legacy();
  const received: unknown[] = [];
  const release = registerArchitectController({ read: () => "read", draw: () => "draw", undo: () => "undo", edit: input => { received.push(input); return "edited"; } });
  assert.equal(await requestArchitectTool("edit", { ...args, operations }), "edited");
  assert.deepEqual(received, [{ ...args, operations }]);
  await assert.rejects(requestArchitectTool("edit", { ...args, operations: [{ kind: "remove" }] }));
  assert.equal(received.length, 1);
  release();
  await assert.rejects(requestArchitectTool("edit", { ...args, operations }), /Open Sketch/);
});
