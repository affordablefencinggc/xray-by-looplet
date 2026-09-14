import test from "node:test";
import assert from "node:assert/strict";
import { demonstration, emptyProject, revise, validateProject } from "./model.ts";
import { alterationSchedule, alterationScheduleCsv, setElementLifecycle, type LifecycleRecord } from "./lifecycle.ts";
import { loadArchitect, saveArchitect } from "./persistence.ts";

test("legacy projects remain unassigned without inferred new work", () => {
  const p = demonstration("legacy");
  const schedule = alterationSchedule(p);
  assert.equal(schedule.rows.length, 10);
  assert.deepEqual(schedule.counts, { unassigned: 10, existing: 0, new: 0, demolished: 0, repaired: 0 });
  assert.ok(schedule.rows.every((row) => row.status === "unassigned" && row.reference === ""));
  assert.equal(schedule.draftOnly, true);
  assert.equal(schedule.quoteEligible, false);
  assert.deepEqual(schedule.warnings, []);
  assert.ok(p.walls.every((wall) => !("lifecycle" in wall)));
});

test("explicit transitions retain exact geometry, identity, metadata and revisions", () => {
  const original = demonstration("transitions");
  original.notes = "Survey A; all dimensions require review.";
  let p = original;
  for (const status of ["existing", "new", "demolished", "repaired"] as const) {
    const before = structuredClone(p);
    const next = setElementLifecycle(p, p.walls[0].id, { status, reference: "  Survey A, page 2  " });
    assert.deepEqual(p, before);
    assert.notEqual(next, p);
    assert.deepEqual(next.walls[0].lifecycle, { status, reference: "Survey A, page 2" });
    const withoutLifecycle = structuredClone(next);
    delete withoutLifecycle.walls[0].lifecycle;
    assert.deepEqual(withoutLifecycle, original);
    p = next;
  }
});

test("all four supported entity kinds can be classified and explicitly cleared", () => {
  let p = demonstration("kinds");
  const ids = [p.walls[0].id, p.openings[0].id, p.slabs[0].id, p.roofs[0].id];
  const original = structuredClone(p);
  for (const id of ids) p = setElementLifecycle(p, id, { status: "existing", reference: "Survey A" });
  assert.equal(alterationSchedule(p).counts.existing, 4);
  for (const id of ids) p = setElementLifecycle(p, id, null);
  assert.deepEqual(p, original);
});

test("runtime malformed classifications fail closed without mutating the input", () => {
  const p = demonstration("invalid"), before = structuredClone(p);
  for (const value of [
    undefined, {}, { status: "unassigned", reference: "A" },
    { status: "new", reference: " \t\n" }, { status: "new", reference: "x".repeat(501) },
    { status: "new", reference: 1 }, { status: "NEW", reference: "A" },
    { status: "new", reference: "A", verified: true },
  ]) assert.throws(() => setElementLifecycle(p, p.walls[0].id, value as LifecycleRecord));
  assert.deepEqual(p, before);
  const boundary = setElementLifecycle(p, p.walls[0].id, { status: "new", reference: "x".repeat(500) });
  assert.equal(boundary.walls[0].lifecycle?.reference.length, 500);
});

test("unknown and unsupported identities cannot acquire lifecycle records", () => {
  const p = demonstration("ids");
  for (const id of ["absent", "", p.levels[0].id, p.roomTags[0].id, p.dimensions[0].id]) {
    assert.throws(() => setElementLifecycle(p, id, { status: "new", reference: "Brief" }), /identity/);
    assert.throws(() => setElementLifecycle(p, id, null), /identity/);
  }
});

test("schedule counts only explicit classifications and resolves opening host levels", () => {
  let p = demonstration("schedule");
  for (const [id, status] of [
    [p.walls[0].id, "existing"], [p.openings[0].id, "new"],
    [p.slabs[0].id, "demolished"], [p.roofs[0].id, "repaired"],
  ] as const) p = setElementLifecycle(p, id, { status, reference: `Reference ${status}` });
  const result = alterationSchedule(p);
  assert.deepEqual(result.counts, { unassigned: 6, existing: 1, new: 1, demolished: 1, repaired: 1 });
  assert.deepEqual(result.rows.find((row) => row.id === p.openings[0].id), {
    id: p.openings[0].id, kind: "opening", name: p.openings[0].tag,
    levelId: p.walls.find((wall) => wall.id === p.openings[0].wallId)!.levelId,
    status: "new", reference: "Reference new",
  });
  assert.deepEqual(result.rows.map((row) => row.kind), ["wall", "wall", "wall", "wall", "wall", "opening", "opening", "opening", "slab", "roof"]);
  assert.equal(Object.values(result.counts).reduce((sum, count) => sum + count, 0), result.rows.length);
  assert.equal(alterationSchedule(emptyProject("empty")).rows.length, 0);
});

test("new openings on demolished hosts produce warnings without geometry changes", () => {
  let p = demonstration("conflict");
  const opening = p.openings[0];
  p = setElementLifecycle(p, opening.wallId, { status: "demolished", reference: "Demolition plan A" });
  p = setElementLifecycle(p, opening.id, { status: "new", reference: "New work plan A" });
  const schedule = alterationSchedule(p);
  assert.equal(schedule.warnings.length, 1);
  assert.equal(schedule.warnings[0].elementId, opening.id);
  assert.equal(schedule.warnings[0].hostId, opening.wallId);
  assert.equal(schedule.warnings[0].code, "new-opening-demolished-host");
  assert.equal(p.openings[0].wallId, opening.wallId);
  p = setElementLifecycle(p, opening.id, { status: "demolished", reference: "Reviewed demolition A" });
  assert.deepEqual(alterationSchedule(p).warnings, []);
});

test("workspace revision and JSON persistence preserve lifecycle with project isolation", () => {
  const original = demonstration("saved");
  const changed = revise(original, setElementLifecycle(original, original.roofs[0].id, { status: "repaired", reference: "Roof survey A" }));
  assert.equal(changed.revision, original.revision + 1);
  assert.equal(changed.roofs[0].revision, original.roofs[0].revision + 1);
  assert.deepEqual(changed.walls, original.walls);
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(changed))), changed);
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const saved = saveArchitect(loadArchitect("saved", storage), changed, storage);
  assert.equal(saved.blocked, false);
  assert.equal(saved.error, null);
  assert.deepEqual(loadArchitect("saved", storage).value, changed);
  assert.deepEqual(alterationSchedule(loadArchitect("other", storage).value).rows, []);
});

test("model and schedule reject malformed persisted lifecycle without accepting a verified flag", () => {
  const p = demonstration("persisted-invalid");
  const malformed = { ...p, walls: [{ ...p.walls[0], lifecycle: { status: "existing", reference: "" } }, ...p.walls.slice(1)] };
  assert.throws(() => validateProject(malformed));
  assert.throws(() => alterationSchedule(malformed as typeof p));
  malformed.walls[0].lifecycle = { status: "existing", reference: "Survey A", verified: true } as typeof malformed.walls[0]["lifecycle"];
  assert.throws(() => validateProject(malformed));
});

test("CSV includes every exact schedule row, identity and draft evidence flags", () => {
  const p = demonstration("csv-project");
  const classified = setElementLifecycle(p, p.walls[0].id, { status: "demolished", reference: "Survey A" });
  const csv = alterationScheduleCsv(classified);
  const lines = csv.trimEnd().split("\r\n");
  // RES-01 adds explicit changed-repair before-state columns beside the existing
  // demolition disposition columns; every prior column keeps its position.
  assert.equal(lines[0], '"projectId","revision","id","kind","name","levelId","status","reference","draftOnly","quoteEligible","demolitionDisposition","dispositionReference","repairBasisReference","repairBasisHeight"');
  const rows = alterationSchedule(classified).rows;
  assert.equal(lines.length, rows.length + 1);
  rows.forEach((row, i) => {
    const expected = [classified.id, classified.revision, row.id, row.kind, row.name, row.levelId, row.status, row.reference, true, false, "", "", "", ""];
    assert.equal(lines[i + 1], expected.map((value) => `"${value}"`).join(","));
  });
  assert.equal(alterationScheduleCsv(emptyProject("none")), lines[0] + "\r\n");
});

test("CSV quotes commas, embedded quotes and multiline references without altering stored values", () => {
  const p = demonstration("csv-escaping");
  p.walls[0].name = 'Wall "A", retained';
  const reference = 'Survey "A", page 2\nClient brief';
  const classified = setElementLifecycle(p, p.walls[0].id, { status: "existing", reference });
  const before = structuredClone(classified);
  const csv = alterationScheduleCsv(classified);
  assert.ok(csv.includes('"Wall ""A"", retained"'));
  assert.ok(csv.includes('"Survey ""A"", page 2\nClient brief"'));
  assert.deepEqual(classified, before);
});

test("CSV neutralizes formula prefixes behind whitespace and control characters", () => {
  for (const name of ['=1+1', '+SUM(1)', '-1+1', '@SUM(1)', '  =1+1', '\t+1', '\u0001\r\n-1', '\u0085@SUM(1)']) {
    const p = demonstration("csv-safe");
    p.walls[0].name = name;
    const classified = setElementLifecycle(p, p.walls[0].id, { status: "new", reference: "=SUM(1)" });
    const csv = alterationScheduleCsv(classified);
    assert.ok(csv.includes('"\'' + name + '"'), JSON.stringify(name));
    assert.ok(csv.includes('"\'=SUM(1)"'));
    assert.equal(classified.walls[0].name, name);
    assert.equal(classified.walls[0].lifecycle?.reference, "=SUM(1)");
  }
});
