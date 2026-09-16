import { z } from "zod";
import { sheetLayoutSchema, authoredSheetSetSchema, validateAuthoredSheets } from "./authoredSheetSet.ts";
import { issueRecordSchema, type IssueRecord, type IssuedSheetRecord } from "./issueHistory.ts";
import { alterationDraftRecordSchema } from "./alterationDraftSchema.ts";
import { validateAlterationDrafts } from "./alterationDrafts.ts";
import { alterationIssueRecordSchema } from "./alterationIssueSchema.ts";
import { validateAlterationIssues } from "./alterationIssues.ts";
export type Point = [number, number];
const n = z.number().finite().min(-1e6).max(1e6),
  positive = z.number().finite().positive().max(1e6),
  id = z.string().min(1).max(100),
  point = z.tuple([n, n]);
const entity = { id, revision: z.number().int().positive() };
const lifecycle = z.object({
  status: z.enum(["existing", "new", "demolished", "repaired"]),
  reference: z.string().trim().min(1).max(500),
}).strict().optional();
export const layerSchema = z
  .object({
    id,
    name: z.string().min(1).max(120),
    thickness: positive,
    kind: z.enum(["solid", "assembly", "void"]),
    hatch: z.enum(["brick", "concrete", "timber", "insulation", "none"]),
    densityKgM3: positive.nullable(),
    rateM2: z.number().finite().nonnegative().max(1e7).nullable(),
    supplierReference: z.string().max(500),
    rateRevision: z.string().max(100),
    wastePercent: z.number().min(0).max(100),
  })
  .strict();
/** Authored before-alteration shape for a repair whose geometry changes.
 * It records only the earlier dimensions of this same authored wall; it never
 * reconstructs a survey, rewrites frozen issue history or invents an assembly.
 * Absent, a repaired element keeps its unchanged-across-stages meaning.
 */
export const repairBasisSchema = z
  .object({
    reference: z.string().trim().min(1).max(500),
    height: positive,
  })
  .strict();
const wallSchema = z
  .object({
    ...entity,
    lifecycle,
    repairBasis: repairBasisSchema.optional(),
    levelId: id,
    name: z.string().min(1).max(120),
    a: point,
    b: point,
    height: positive,
    layers: z.array(layerSchema).min(1).max(12),
  })
  .strict();
const openingSchema = z
  .object({
    ...entity,
    lifecycle,
    // Explicit authored intent for a demolished door/window in a retained wall.
    // retain-void keeps the authored cut; infill closes it using only the host
    // wall's own authored layers. Neither is ever inferred by a resolver.
    demolitionDisposition: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("retain-void"), reference: z.string().trim().min(1).max(500) }).strict(),
      z.object({ kind: z.literal("infill"), reference: z.string().trim().min(1).max(500) }).strict(),
      z.object({
        kind: z.literal("partial-infill"),
        reference: z.string().trim().min(1).max(500),
        remainingVoid: z.object({
          offset: n,
          width: positive,
          height: positive,
          sill: z.number().finite().nonnegative().max(1e6),
        }).strict(),
      }).strict(),
    ]).optional(),
    wallId: id,
    tag: z.string().min(1).max(30),
    kind: z.enum(["door", "window", "void"]),
    offset: n,
    width: positive,
    height: positive,
    sill: z.number().finite().nonnegative().max(1e6),
    hinge: z.enum(["left", "right"]),
    swing: z.enum(["in", "out"]),
  })
  .strict();
const boundarySchema = {
  ...entity,
  lifecycle,
  levelId: id,
  name: z.string().min(1).max(120),
  points: z.array(point).min(3).max(200),
};
const schema = z
  .object({
    schema: z.literal("xray.architect/v1"),
    id,
    revision: z.number().int().positive(),
    name: z.string().min(1).max(200),
    address: z.string().max(500),
    designRevision: z.string().max(40),
    units: z.literal("mm"),
    levels: z
      .array(
        z.object({ id, name: z.string().min(1).max(100), elevation: n, height: positive }).strict(),
      )
      .min(1)
      .max(100),
    walls: z.array(wallSchema).max(3000),
    openings: z.array(openingSchema).max(3000),
    slabs: z
      .array(
        z
          .object({
            ...boundarySchema,
            thickness: positive,
            offset: n,
            material: z.string().max(100),
          })
          .strict(),
      )
      .max(300),
    roofs: z
      .array(
        z
          .object({
            ...boundarySchema,
            offset: n,
            eaves: z.number().min(0).max(3000),
            fasciaHeight: z.number().min(0).max(1000).default(140),
            fasciaThickness: z.number().min(0.1).max(100).default(20),
            gutterEnabled: z.boolean().default(true),
            gutterWidth: z.number().min(20).max(1000).default(125),
            gutterDepth: z.number().min(20).max(1000).default(90),
            gutterThickness: z.number().min(0.1).max(10).default(1.2),
            edges: z
              .array(z.object({ pitch: z.number().min(0).max(89.9), gable: z.boolean() }).strict())
              .min(3)
              .max(200),
          })
          .strict(),
      )
      .max(300),
    lines: z.array(z.object({ ...entity, a: point, b: point, levelId: id }).strict()).max(3000),
    circles: z
      .array(z.object({ ...entity, center: point, radius: positive, levelId: id }).strict())
      .max(1000),
    arcs: z
      .array(
        z
          .object({
            ...entity,
            levelId: id,
            center: point,
            radius: positive,
            startAngle: n,
            endAngle: n,
            clockwise: z.boolean(),
          })
          .strict(),
      )
      .max(1000),
    grids: z
      .array(
        z
          .object({
            ...entity,
            label: z.string().min(1).max(20),
            axis: z.enum(["x", "y"]),
            position: n,
          })
          .strict(),
      )
      .max(100),
    roomTags: z
      .array(z.object({ ...entity, point, levelId: id, name: z.string().min(1).max(100) }).strict())
      .max(1000),
    dimensions: z.array(z.object({ ...entity, wallId: id, offset: n }).strict()).max(3000),
    section: z.object({ a: point, b: point }).strict(),
    sheet: sheetLayoutSchema,
    sheetSet: authoredSheetSetSchema.optional(),
    issues: z.array(issueRecordSchema).optional(),
    alterationDrafts: z.array(alterationDraftRecordSchema).max(5).optional(),
    alterationIssues: z.array(alterationIssueRecordSchema).max(10).optional(),
    notes: z.string().max(5000),
  })
  .strict();
export type ArchitectProject = z.infer<typeof schema>;
export type { IssueRecord, IssuedSheetRecord };
export type Wall = ArchitectProject["walls"][number];
export type Opening = ArchitectProject["openings"][number];
export type Layer = z.infer<typeof layerSchema>;
export type Roof = ArchitectProject["roofs"][number];
export type Slab = ArchitectProject["slabs"][number];
export const uuid = () => crypto.randomUUID();
export const distance = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1]);
export const cross = (a: Point, b: Point) => a[0] * b[1] - a[1] * b[0];
export const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
export const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
export const mul = (a: Point, s: number): Point => [a[0] * s, a[1] * s];
export const unit = (a: Point, b: Point): Point => mul(sub(b, a), 1 / distance(a, b));
export const area = (p: Point[]) =>
  Math.abs(p.reduce((s, a, i) => s + cross(a, p[(i + 1) % p.length]), 0)) / 2;
export const perimeter = (p: Point[]) =>
  p.reduce((s, a, i) => s + distance(a, p[(i + 1) % p.length]), 0);
export const wallThickness = (w: Wall) => w.layers.reduce((s, l) => s + l.thickness, 0);
export function intersection(
  a: Point,
  b: Point,
  c: Point,
  d: Point,
  segments = true,
): Point | null {
  const r = sub(b, a),
    s = sub(d, c),
    den = cross(r, s);
  if (Math.abs(den) < 1e-8) return null;
  const t = cross(sub(c, a), s) / den,
    u = cross(sub(c, a), r) / den;
  if (segments && (t < -0.000001 || t > 1.000001 || u < -0.000001 || u > 1.000001)) return null;
  return add(a, mul(r, t));
}
export function projectPoint(p: Point, a: Point, b: Point, clamp = true) {
  const v = sub(b, a),
    l = distance(a, b),
    t = ((p[0] - a[0]) * v[0] + (p[1] - a[1]) * v[1]) / (l * l);
  return add(a, mul(v, clamp ? Math.max(0, Math.min(1, t)) : t));
}
export function pointInPolygon(p: Point, ring: Point[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
export function validateProject(value: unknown): ArchitectProject {
  const p = schema.parse(value),
    ids = new Set<string>(),
    levels = new Set(p.levels.map((l) => l.id));
  for (const list of [
    p.levels,
    p.walls,
    p.openings,
    p.slabs,
    p.roofs,
    p.lines,
    p.circles,
    p.arcs,
    p.grids,
    p.roomTags,
    p.dimensions,
  ])
    for (const e of list) {
      if (ids.has(e.id)) throw Error("Duplicate physical identity.");
      ids.add(e.id);
      if ("levelId" in e && !levels.has(e.levelId))
        throw Error("Entity refers to a missing level.");
    }
  for (const w of p.walls) {
    if (distance(w.a, w.b) < 1) throw Error("A wall must be at least 1 mm long.");
    // A before-alteration shape is meaningless unless the wall is authored as
    // repaired; it must never silently survive a later classification change.
    if (w.repairBasis && w.lifecycle?.status !== "repaired")
      throw Error("A changed-repair before state requires a wall classified as repaired.");
    if (new Set(w.layers.map((l) => l.id)).size !== w.layers.length)
      throw Error("Duplicate wall layer.");
    for (const l of w.layers)
      if (l.rateM2 !== null && (!l.supplierReference.trim() || !l.rateRevision.trim()))
        throw Error("A price needs its supplier reference and rate revision.");
  }
  for (const line of p.lines)
    if (distance(line.a, line.b) < 1) throw Error("A line must be at least 1 mm long.");
  const tags = new Set<string>();
  for (const o of p.openings) {
    const w = p.walls.find((w) => w.id === o.wallId);
    if (!w) throw Error("Opening has no host wall.");
    if (
      o.offset - o.width / 2 < -0.001 ||
      o.offset + o.width / 2 > distance(w.a, w.b) + 0.001 ||
      o.sill + o.height > w.height + 0.001
    )
      throw Error("Opening must fit within its host wall.");
    if (o.kind === "door" && o.sill !== 0) throw Error("Door sill must be zero.");
    if (o.demolitionDisposition && (o.lifecycle?.status !== "demolished" || o.kind === "void"))
      throw Error("Retain-void disposition requires a demolished door or window.");
    if (o.demolitionDisposition?.kind === "partial-infill") {
      const rv = o.demolitionDisposition.remainingVoid;
      if (
        rv.offset - rv.width / 2 < o.offset - o.width / 2 - 0.001 ||
        rv.offset + rv.width / 2 > o.offset + o.width / 2 + 0.001 ||
        rv.sill < o.sill - 0.001 ||
        rv.sill + rv.height > o.sill + o.height + 0.001
      )
        throw Error("Partial infill remaining void must fit within the opening.");
    }
    if (tags.has(o.tag.toLowerCase())) throw Error("Door/window tags must be unique.");
    tags.add(o.tag.toLowerCase());
    for (const other of p.openings)
      if (
        other.id < o.id &&
        other.wallId === o.wallId &&
        Math.abs(other.offset - o.offset) < (other.width + o.width) / 2 - 0.001 &&
        other.sill < o.sill + o.height - 0.001 &&
        o.sill < other.sill + other.height - 0.001
      ) {
        const oStatus = o.lifecycle?.status;
        const otherStatus = other.lifecycle?.status;
        const isNonConcurrentReplacement =
          (oStatus === "demolished" && otherStatus === "new") ||
          (oStatus === "new" && otherStatus === "demolished");
        if (!isNonConcurrentReplacement)
          throw Error("Hosted openings overlap.");
      }
  }
  for (const d of p.dimensions)
    if (!p.walls.some((w) => w.id === d.wallId)) throw Error("Dimension refers to a missing wall.");
  for (const b of [...p.slabs, ...p.roofs]) {
    if (area(b.points) < 1) throw Error("Boundary has no area.");
    for (let i = 0; i < b.points.length; i++) {
      if (distance(b.points[i], b.points[(i + 1) % b.points.length]) < 1)
        throw Error("Boundary has duplicate points.");
      for (let j = i + 2; j < b.points.length; j++) {
        if (i === 0 && j === b.points.length - 1) continue;
        if (
          intersection(
            b.points[i],
            b.points[(i + 1) % b.points.length],
            b.points[j],
            b.points[(j + 1) % b.points.length],
          )
        )
          throw Error("Boundary crosses itself.");
      }
    }
  }
  for (const r of p.roofs) {
    if (r.edges.length !== r.points.length) throw Error("Every roof edge needs a pitch setting.");
    const turns = r.points
      .map((a, i) =>
        cross(
          sub(r.points[(i + 1) % r.points.length], a),
          sub(r.points[(i + 2) % r.points.length], r.points[(i + 1) % r.points.length]),
        ),
      )
      .filter((t) => Math.abs(t) > 0.001);
    if (turns.some((t) => Math.sign(t) !== Math.sign(turns[0])))
      throw Error("Split a concave roof into convex roof zones.");
    if (r.edges.every((e) => e.gable))
      throw Error("A roof needs at least one pitched or flat edge.");
  }
  validateAuthoredSheets(p);
  validateAlterationDrafts(p);
  validateAlterationIssues(p);
  if (distance(p.section.a, p.section.b) < 1) throw Error("Section line must have a direction.");
  return p;
}
export function defaultLayers(): Layer[] {
  return [
    {
      id: uuid(),
      name: "Brickwork",
      thickness: 110,
      kind: "solid",
      hatch: "brick",
      densityKgM3: null,
      rateM2: null,
      supplierReference: "",
      rateRevision: "",
      wastePercent: 0,
    },
    {
      id: uuid(),
      name: "Cavity",
      thickness: 50,
      kind: "void",
      hatch: "none",
      densityKgM3: null,
      rateM2: null,
      supplierReference: "",
      rateRevision: "",
      wastePercent: 0,
    },
    {
      id: uuid(),
      name: "Stud assembly",
      thickness: 90,
      kind: "assembly",
      hatch: "timber",
      densityKgM3: null,
      rateM2: null,
      supplierReference: "",
      rateRevision: "",
      wastePercent: 0,
    },
    {
      id: uuid(),
      name: "Plasterboard",
      thickness: 10,
      kind: "solid",
      hatch: "none",
      densityKgM3: null,
      rateM2: null,
      supplierReference: "",
      rateRevision: "",
      wastePercent: 0,
    },
  ];
}
export function emptyProject(projectId: string): ArchitectProject {
  return {
    schema: "xray.architect/v1",
    id: projectId,
    revision: 1,
    name: "Untitled architectural design",
    address: "",
    designRevision: "A",
    units: "mm",
    levels: [{ id: uuid(), name: "Ground", elevation: 0, height: 2700 }],
    walls: [],
    openings: [],
    slabs: [],
    roofs: [],
    lines: [],
    circles: [],
    arcs: [],
    grids: [],
    roomTags: [],
    dimensions: [],
    section: { a: [0, 1800], b: [9000, 1800] },
    sheet: { size: "A3", scale: "50", number: "A-101", northAngle: 0, viewports: [] },
    notes:
      "Authored design. Dimensions and assemblies require design review; no compliance certification.",
  };
}
export function newWall(
  p: ArchitectProject,
  levelId: string,
  a: Point,
  b: Point,
  layers = defaultLayers(),
): Wall {
  return {
    id: uuid(),
    revision: 1,
    levelId,
    name: "Wall " + (p.walls.length + 1),
    a,
    b,
    height: p.levels.find((l) => l.id === levelId)!.height,
    layers: structuredClone(layers),
  };
}
export function revise(previous: ArchitectProject, draft: ArchitectProject) {
  const p = structuredClone(draft);
  p.id = previous.id;
  p.revision = previous.revision + 1;
  for (const key of [
    "walls",
    "openings",
    "slabs",
    "roofs",
    "lines",
    "circles",
    "arcs",
    "grids",
    "roomTags",
    "dimensions",
  ] as const)
    for (const e of p[key]) {
      const old = previous[key].find((o) => o.id === e.id);
      e.revision = old
        ? JSON.stringify({ ...old, revision: 0 }) === JSON.stringify({ ...e, revision: 0 })
          ? old.revision
          : old.revision + 1
        : 1;
    }
  return validateProject(p);
}
export function removeEntity(p: ArchitectProject, id: string) {
  const q = structuredClone(p);
  q.walls = q.walls.filter((w) => w.id !== id);
  q.openings = q.openings.filter((o) => o.id !== id && o.wallId !== id);
  q.dimensions = q.dimensions.filter((d) => d.id !== id && d.wallId !== id);
  for (const k of ["slabs", "roofs", "lines", "circles", "arcs", "grids", "roomTags"] as const)
    (q[k] as { id: string }[]) = (q[k] as { id: string }[]).filter((e) => e.id !== id);
  return revise(p, q);
}
export function demonstration(projectId: string) {
  const p = emptyProject(projectId),
    l = p.levels[0].id;
  p.name = "Courtyard studio / demonstration";
  const points: Point[] = [
    [0, 0],
    [9000, 0],
    [9000, 6000],
    [0, 6000],
  ];
  for (let i = 0; i < 4; i++) p.walls.push(newWall(p, l, points[i], points[(i + 1) % 4]));
  p.walls.push(
    newWall(
      p,
      l,
      [6000, 0],
      [6000, 6000],
      [{ ...defaultLayers()[3], name: "Internal lining", thickness: 90, kind: "assembly" }],
    ),
  );
  p.openings.push(
    {
      id: uuid(),
      revision: 1,
      wallId: p.walls[2].id,
      tag: "D01",
      kind: "door",
      offset: 4500,
      width: 1800,
      height: 2400,
      sill: 0,
      hinge: "left",
      swing: "in",
    },
    {
      id: uuid(),
      revision: 1,
      wallId: p.walls[0].id,
      tag: "W01",
      kind: "window",
      offset: 3000,
      width: 2400,
      height: 1400,
      sill: 1000,
      hinge: "left",
      swing: "in",
    },
    {
      id: uuid(),
      revision: 1,
      wallId: p.walls[4].id,
      tag: "D02",
      kind: "door",
      offset: 3000,
      width: 870,
      height: 2100,
      sill: 0,
      hinge: "right",
      swing: "out",
    },
  );
  p.slabs.push({
    id: uuid(),
    revision: 1,
    levelId: l,
    name: "Ground slab",
    points,
    thickness: 150,
    offset: 0,
    material: "Concrete",
  });
  p.roofs.push({
    id: uuid(),
    revision: 1,
    levelId: l,
    name: "Main roof",
    points,
    offset: 2700,
    eaves: 450,
    fasciaHeight: 140,
    fasciaThickness: 20,
    gutterEnabled: true,
    gutterWidth: 125,
    gutterDepth: 90,
    gutterThickness: 1.2,
    edges: points.map(() => ({ pitch: 22.5, gable: false })),
  });
  p.roomTags.push(
    { id: uuid(), revision: 1, levelId: l, point: [3000, 3000], name: "STUDIO" },
    { id: uuid(), revision: 1, levelId: l, point: [7500, 3000], name: "WORKSHOP" },
  );
  for (const w of p.walls.slice(0, 4))
    p.dimensions.push({ id: uuid(), revision: 1, wallId: w.id, offset: -650 });
  p.grids.push(
    { id: uuid(), revision: 1, label: "A", axis: "x", position: 0 },
    { id: uuid(), revision: 1, label: "B", axis: "x", position: 9000 },
    { id: uuid(), revision: 1, label: "1", axis: "y", position: 0 },
    { id: uuid(), revision: 1, label: "2", axis: "y", position: 6000 },
  );
  return validateProject(p);
}
