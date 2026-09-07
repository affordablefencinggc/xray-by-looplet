import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyProject,
  demonstration,
  newWall,
  validateProject,
  revise,
  removeEntity,
  distance,
  area,
} from "./model.ts";
import {
  wallSolids,
  rooms,
  roofFaces,
  designQuantities,
  polygonArea,
  wallAtHeight,
} from "./geometry.ts";
import {
  snapPoint,
  constrainPoint,
  fillet,
  trimSegment,
  extendSegment,
  mirrorPoint,
  offsetSegment,
} from "./precision.ts";
import { loadArchitect, saveArchitect, architectKey } from "./persistence.ts";
import { exportDxf, importDxf, csv } from "./exchange.ts";
import { exportIfc } from "./ifc.ts";
import { primitives } from "./drawing.ts";
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`),
  single = () => {
    const p = emptyProject("job");
    p.walls = [
      newWall(
        p,
        p.levels[0].id,
        [0, 0],
        [4000, 0],
        [
          {
            id: "solid",
            name: "Concrete",
            thickness: 200,
            kind: "solid",
            hatch: "concrete",
            densityKgM3: 2400,
            rateM2: 100,
            supplierReference: "Supplier quote 42",
            rateRevision: "A",
            wastePercent: 10,
          },
        ],
      ),
    ];
    return p;
  };
const storage = () => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
};
test("hosted opening removes exact material volume; deletion heals wall; unrelated IDs survive", () => {
  const p = single(),
    w = p.walls[0],
    base = wallSolids(p).reduce((s, v) => s + v.volumeM3, 0);
  close(base, 2.16);
  p.openings.push({
    id: "door",
    revision: 1,
    wallId: w.id,
    tag: "D01",
    kind: "door",
    offset: 2000,
    width: 1000,
    height: 2100,
    sill: 0,
    hinge: "left",
    swing: "in",
  });
  validateProject(p);
  close(
    wallSolids(p).reduce((s, v) => s + v.volumeM3, 0),
    1.74,
  );
  const healed = removeEntity(p, "door");
  close(
    wallSolids(healed).reduce((s, v) => s + v.volumeM3, 0),
    base,
  );
  assert.equal(healed.walls[0].id, w.id);
});
test("invalid or overlapping hosted openings and duplicate physical identity rejected", () => {
  const p = demonstration("j");
  p.openings.push({ ...p.openings[0], id: "new", tag: "NEW" });
  assert.throws(() => validateProject(p), /overlap/);
  p.openings.pop();
  p.openings[0].width = 99999;
  assert.throws(() => validateProject(p), /fit/);
  const q = single();
  q.walls.push({ ...q.walls[0] });
  assert.throws(() => validateProject(q), /Duplicate/);
});
test("layer and geometry changes increment entity revision; no-op keeps revision", () => {
  const p = single(),
    q = structuredClone(p);
  q.walls[0].layers[0].thickness = 250;
  const r = revise(p, q);
  assert.equal(r.walls[0].revision, 2);
  assert.equal(revise(r, r).walls[0].revision, 2);
  assert.equal(r.walls[0].id, p.walls[0].id);
});
test("joined rectangular room has exact internal net area and no double-counted corner volume", () => {
  const p = emptyProject("j"),
    pts: [[number, number], [number, number], [number, number], [number, number]] = [
      [0, 0],
      [4000, 0],
      [4000, 3000],
      [0, 3000],
    ],
    layer = single().walls[0].layers;
  for (let i = 0; i < 4; i++)
    p.walls.push(newWall(p, p.levels[0].id, pts[i], pts[(i + 1) % 4], layer));
  const rs = rooms(p, p.levels[0].id);
  assert.equal(rs.length, 1);
  close(rs[0].areaM2, 3.8 * 2.8);
  close(
    wallSolids(p).reduce((a, s) => a + s.volumeM3, 0),
    (4.2 * 3.2 - 3.8 * 2.8) * 2.7,
  );
  p.walls.pop();
  assert.equal(rooms(p, p.levels[0].id).length, 0);
});
test("T intersection volume is union, not sum", () => {
  const p = single();
  p.walls.push(newWall(p, p.levels[0].id, [2000, 0], [2000, 2000], p.walls[0].layers));
  close(
    wallSolids(p).reduce((a, s) => a + s.volumeM3, 0),
    (4 * 0.2 + 2 * 0.2 - 0.2 * 0.1) * 2.7,
  );
});
test("roof planes cover footprint exactly and bear at the wall elevation", () => {
  const p = demonstration("j"),
    r = p.roofs[0];
  r.eaves = 0;
  const faces = roofFaces(r);
  close(
    faces.reduce((s, f) => s + area(f.points), 0),
    54e6,
  );
  close(Math.max(...faces.flatMap((f) => f.heights)), 3000 * Math.tan((22.5 * Math.PI) / 180));
  r.edges = r.edges.map((e) => ({ ...e, pitch: 0 }));
  assert.equal(roofFaces(r).length, 1);
  close(roofFaces(r)[0].heights[0], 0);
});
test("quantity and cost use net geometry, explicit density, rate revision and waste", () => {
  const p = single(),
    q = designQuantities(p);
  close(q.knownVolumeM3, 2.16);
  close(q.knownWeightKg, 5184);
  close(q.knownCost, 1188);
  p.walls[0].layers[0].kind = "assembly";
  assert.equal(designQuantities(p).rows[0].materialVolumeM3, null);
  p.walls[0].layers[0].rateRevision = "";
  assert.throws(() => validateProject(p), /revision/);
});
test("future schema restore cannot be bypassed by ordinary edits; explicit recovery preserves original", () => {
  const s = storage(),
    raw = '{"schema":"xray.architect/v99"}';
  s.map.set(architectKey("j"), raw);
  const session = loadArchitect("j", s);
  assert.equal(session.blocked, true);
  const rejected = saveArchitect(session, demonstration("j"), s);
  assert.equal(rejected.blocked, true);
  assert.equal(s.getItem(architectKey("j")), raw);
  const recovered = saveArchitect(session, demonstration("j"), s, true);
  assert.equal(recovered.error, null);
  assert.ok([...s.map.entries()].some(([k, v]) => k.includes(":recovery:") && v === raw));
});
test("failed writes preserve prior design and concurrent updates block stale overwrites", () => {
  const s = storage(),
    a = loadArchitect("j", s),
    b = saveArchitect(a, demonstration("j"), s),
    raw = b.raw;
  const fail = saveArchitect(b, b.value, {
    getItem: s.getItem,
    setItem: () => {
      throw Error("quota");
    },
  });
  assert.equal(fail.raw, raw);
  assert.equal(s.getItem(architectKey("j")), raw);
  s.map.set(architectKey("j"), "changed");
  assert.equal(saveArchitect(b, b.value, s).blocked, true);
  assert.equal(s.getItem(architectKey("j")), "changed");
});
test("precision exact length, mirror, offset, trim, extend and tangential fillet", () => {
  close(distance([0, 0], constrainPoint([0, 0], [3, 2], "polar", 30, 4500)), 4500);
  assert.deepEqual(mirrorPoint([3, 4], [0, 0], [0, 1]), [-3, 4]);
  assert.deepEqual(offsetSegment([0, 0], [10, 0], 2), { a: [0, 2], b: [10, 2] });
  assert.deepEqual(trimSegment([0, 0], [10, 0], [6, -1], [6, 1], [0, 0]).b, [6, 0]);
  assert.deepEqual(extendSegment([0, 0], [10, 0], [12, -1], [12, 1]).b, [12, 0]);
  const f = fillet([0, 0], [1000, 0], [0, 0], [0, 1000], 100);
  close(distance(f.center, f.b), 100);
  close(distance(f.center, f.c), 100);
  close(f.center[0], 100);
  close(f.center[1], 100);
});
test("snap candidates resolve endpoint, midpoint, intersection, perpendicular, extension, centre and tangent", () => {
  const p = single(),
    l = p.levels[0].id;
  p.lines.push({ id: "line", revision: 1, levelId: l, a: [2000, -2000], b: [2000, 2000] });
  p.circles.push({ id: "circle", revision: 1, levelId: l, center: [0, 3000], radius: 1000 });
  for (const [pt, kind, anchor] of [
    [[1, 0], "endpoint", null],
    [[2001, 0], "midpoint", null],
    [[2000, 1], "intersection", null],
    [[1000, 1], "perpendicular", [1000, 1000]],
    [[4500, 1], "extension", null],
    [[1, 3000], "center", null],
    [[500, 3866.0254], "tangent", [2000, 3000]],
  ] as const)
    assert.equal(snapPoint([...pt], p, l, 5, [kind], anchor ? [...anchor] : null).kind, kind);
});
test("plan, elevations, sections and associative dimensions regenerate after editing", () => {
  const p = single(),
    l = p.levels[0].id;
  p.dimensions.push({ id: "dim", revision: 1, wallId: p.walls[0].id, offset: 600 });
  assert.ok(primitives(p, l).some((i) => i.text === "4000"));
  p.walls[0].b = [5000, 0];
  assert.ok(primitives(p, l).some((i) => i.text === "5000"));
  assert.ok(primitives(p, l, "south").some((i) => i.kind === "path"));
  p.section = { a: [2500, -1000], b: [2500, 1000] };
  assert.ok(primitives(p, l, "section").some((i) => i.kind === "path"));
});
test("DXF parametric round trip preserves stable IDs and manual properties", async () => {
  const p = demonstration("j"),
    dxf = await exportDxf(p),
    result = await importDxf(dxf, "j");
  assert.equal(result.parametric, true);
  assert.deepEqual(result.project, p);
});
test("edited DXF never restores stale embedded design and undeclared units rejected", async () => {
  const p = single(),
    dxf = await exportDxf(p),
    edited = dxf.replace(
      "2\nENTITIES\n",
      "2\nENTITIES\n0\nLINE\n8\nNEW\n10\n100\n20\n100\n11\n200\n21\n100\n",
    ),
    result = await importDxf(edited, "j");
  assert.equal(result.parametric, false);
  assert.equal(result.project.walls.length, 0);
  assert.ok(result.project.lines.length > 0);
  await assert.rejects(
    () => importDxf(edited.replace("9\n$INSUNITS\n70\n4", "9\n$INSUNITS\n70\n0"), "j"),
    /declare/,
  );
});
test("IFC exports semantic void/fill and spatial containment; CSV prevents formula execution", () => {
  const p = demonstration("j"),
    ifc = exportIfc(p);
  assert.equal((ifc.match(/=IFCRELVOIDSELEMENT\(/g) ?? []).length, 3);
  assert.equal((ifc.match(/=IFCRELFILLSELEMENT\(/g) ?? []).length, 3);
  assert.ok(ifc.includes("IFCMATERIALLAYERSETUSAGE"));
  assert.ok(csv([['=HYPERLINK("bad")']]).startsWith("\"'"));
});
import { layoutRequestSchema, validateLayoutProposal } from "./layoutAi.ts";
import { createProjectMaterials } from "../construction/projectMaterials.ts";
import { syncDesignMaterials, designSyncSummary } from "./materialBridge.ts";
test("design material sync is idempotent, preserves physical rows, invalidates changed review and retires deletions", () => {
  const p = single(),
    source = {
      sha256: "a".repeat(64),
      name: "Authored design.pdf",
      pageCount: 2,
      discipline: "Architectural" as const,
    };
  let r = syncDesignMaterials(p, createProjectMaterials(p.id), source);
  assert.equal(r.materials.length, 1);
  assert.equal(r.materials[0].stock.quantity, 10.8);
  const originalId = r.materials[0].stock.id;
  r.materials[0].review = "reviewed";
  r.materials[0].reviewNote = "Checked";
  assert.deepEqual(designSyncSummary(p, r), { add: 0, update: 0, retire: 0 });
  r = syncDesignMaterials(p, r, source);
  assert.equal(r.materials[0].review, "reviewed");
  const q = structuredClone(p);
  q.walls[0].height = 3000;
  const changed = revise(p, q);
  r = syncDesignMaterials(changed, r, source);
  assert.equal(r.materials[0].stock.id, originalId);
  assert.equal(r.materials[0].review, "pending");
  close(r.materials[0].stock.quantity!, 12);
  r = syncDesignMaterials(removeEntity(changed, changed.walls[0].id), r, source);
  assert.equal(r.materials[0].stock.quantity, 0);
});
const aiFixture = () => {
  const p = emptyProject("j"),
    request = {
      schema: "xray.architect-ai-request/v1" as const,
      requestId: crypto.randomUUID(),
      projectId: "j",
      designRevision: 1,
      levelId: p.levels[0].id,
      width: 6000,
      depth: 4000,
      height: 2700,
      brief: "A single studio with an entrance.",
    },
    result = {
      name: "Studio proposal",
      assumptions: ["Review egress"],
      walls: [
        { a: [0, 0], b: [6000, 0] },
        { a: [6000, 0], b: [6000, 4000] },
        { a: [6000, 4000], b: [0, 4000] },
        { a: [0, 4000], b: [0, 0] },
      ],
      openings: [{ wallIndex: 0, kind: "door", offset: 3000, width: 900, height: 2100, sill: 0 }],
      rooms: [{ name: "Studio", point: [3000, 2000] }],
    };
  return { p, request, result };
};
test("AI proposal requires review-time revision binding and validates bounds, room closure and hosted doors", () => {
  const { p, request, result } = aiFixture(),
    valid = validateLayoutProposal(p, request, result);
  assert.equal(valid.project.walls.length, 4);
  assert.equal(p.walls.length, 0);
  assert.throws(() => validateLayoutProposal({ ...p, revision: 2 }, request, result), /changed/);
  const bad = structuredClone(result);
  bad.walls[0].a = [-100, 0];
  assert.throws(() => validateLayoutProposal(p, request, bad), /footprint/);
  bad.walls = result.walls.slice(0, 3);
  assert.throws(() => validateLayoutProposal(p, request, bad));
  const opening = structuredClone(result);
  opening.openings[0].width = 10000;
  assert.throws(() => validateLayoutProposal(p, request, opening), /fit/);
});
import { roofTrims } from "./geometry.ts";
test("fascia and gutter profiles share real mitered geometry with finite volume; disabled gutters disappear", () => {
  const p = demonstration("j"),
    roof = p.roofs[0],
    trims = roofTrims(roof);
  assert.equal(trims.filter((t) => t.kind === "fascia").length, 4);
  assert.equal(trims.filter((t) => t.kind === "gutter").length, 12);
  const fascia = trims.filter((t) => t.kind === "fascia").reduce((s, t) => s + t.volumeM3, 0);
  close(fascia, 2 * (9.9 + 6.9) * 0.14 * 0.02);
  assert.ok(trims.every((t) => t.volumeM3 > 0 && t.faces.flat(2).every(Number.isFinite)));
  roof.gutterEnabled = false;
  assert.equal(roofTrims(roof).filter((t) => t.kind === "gutter").length, 0);
  assert.ok(!designQuantities(p).rows.some((r) => r.layerId === "gutter"));
});
test("design sync preserves user stock names and supplied unit weights when no design density is specified", () => {
  const p = single();
  p.walls[0].layers[0].kind = "assembly";
  const source = {
    sha256: "b".repeat(64),
    name: "Design.pdf",
    pageCount: 2,
    discipline: "Architectural" as const,
  };
  let r = syncDesignMaterials(p, createProjectMaterials(p.id), source);
  r.materials[0].stock.description = "My custom stock name";
  r.materials[0].stock.specifiedWeightKg = 12;
  r.materials[0].specification = "Supplier unit weight";
  const q = structuredClone(p);
  q.walls[0].height = 3000;
  r = syncDesignMaterials(revise(p, q), r, source);
  assert.equal(r.materials[0].stock.description, "My custom stock name");
  assert.equal(r.materials[0].stock.specifiedWeightKg, 12);
  assert.equal(r.materials[0].review, "pending");
});

test('near-aligned layered walls remain closed and subtract hosted openings without clipping crashes', () => {
  for (const drift of [0.001, -0.001, 0.002, 0.017]) {
    for (const order of [[0,1,2,3], [1,2,3,0], [2,3,0,1], [3,0,1,2], [1,0,3,2], [3,2,1,0]]) {
      const p = emptyProject('near-aligned'), level = p.levels[0].id;
      const points: [number, number][] = [[0, drift], [4500, drift], [4500, 3000], [0, 3000]];
      p.walls = points.map((a, i) => ({ ...newWall(p, level, a, points[(i + 1) % 4]), id: 'wall-' + order[i] }));
      p.openings = [{ ...demonstration('fixture').openings[0], wallId: p.walls[0].id, offset: 2250, width: 900, height: 2100 }];
      const solids = wallSolids(p), net = solids.reduce((sum, solid) => sum + solid.volumeM3, 0);
      assert.ok(solids.length > 0 && solids.every(s => Number.isFinite(s.volumeM3) && s.volumeM3 > 0));
      const interior = rooms(p, level);
      assert.equal(interior.length, 1);
      assert.ok(Math.abs(interior[0].areaM2 - 4.24 * 2.74) < 0.001);
      p.openings = [];
      const healed = wallSolids(p).reduce((sum, solid) => sum + solid.volumeM3, 0);
      assert.ok(Math.abs(healed - net - .9 * 2.1 * .26) < 1e-6);
    }
  }
});
