import { Earcut } from "three/src/extras/Earcut.js";
import { SURFACE_APPEARANCES, surfaceMaterialKey } from './surfaceAppearance.ts';
import { parseSourceBuilding, type SourceBuilding } from "../sourceBuilding.ts";
import { roofFaces, roofTrims, wallSolids } from "./geometry.ts";
import { add, cross, distance, mul, unit, wallThickness, type ArchitectProject, type Point } from "./model.ts";

/**
 * Model mode: turns the authored Architectural design into a Model-viewer scene ("Designed model").
 * Pure and framework-free apart from three's Earcut triangulator (the same one ExtrudeGeometry uses in
 * Architect3D). Nothing here is measured from a source drawing, so every part and every source reference
 * is labelled `inferred` and the source identity is a synthetic digest that can never match a catalog sha256.
 */
export const DESIGNED_SCENE_ID = "designed";
export const DESIGNED_SCENE_TITLE = "Designed model";
export const DESIGNED_SOURCE_NAME = "Designed model (no source drawing)";
export const DESIGNED_SOURCE_NOTE = "Designed in the X-Ray Architectural workspace; no source drawing.";
const SHEET_WIDTH = 841, SHEET_HEIGHT = 594;
const STOREY_ID = /^[a-zA-Z0-9_-]{1,80}$/, RESERVED_STOREYS = new Set(["all", "ground", "upper"]);

/** Display colours for the authored hatches (parity with Architect3D), never supplier specifications. */
export const DESIGNED_MATERIALS: SourceBuilding["materials"] = {
  brick: { color: "#bba58c", roughness: 0.7 },
  timber: { color: "#bba581", roughness: 0.7 },
  concrete: { color: "#dedbd1", roughness: 0.7 },
  insulation: { color: "#dedbd1", roughness: 0.7 },
  plaster: { color: "#dedbd1", roughness: 0.7 },
  ...SURFACE_APPEARANCES,
  frame: { color: "#717e81", roughness: 0.6 },
  glass: { color: "#aac6c9", opacity: 0.5, roughness: 0.2, metalness: 0.1 },
  leaf: { color: "#c6c1b6", roughness: 0.6 },
  roof: { color: "#677175", roughness: 0.7 },
  fascia: { color: "#b4b8af", roughness: 0.6 },
  gutter: { color: "#617073", roughness: 0.5 },
};
const HATCH_MATERIAL: Record<string, string> = { brick: "brick", timber: "timber", concrete: "concrete", insulation: "insulation", none: "plaster" };

type Mesh = { positions: number[]; indices: number[] };
const MM = 1 / 1000;
const round = (value: number) => Math.round(value * 1e4) / 1e4;
/** Plan (x, y) millimetres at height h millimetres → viewer metres (x, h, y), Y up, exactly like Architect3D. */
const vertex = (m: Mesh, x: number, h: number, y: number) => {
  m.positions.push(round(x * MM), round(h * MM), round(y * MM));
  return m.positions.length / 3 - 1;
};
const signedArea = (ring: Point[]) => ring.reduce((s, a, i) => s + cross(a, ring[(i + 1) % ring.length]), 0) / 2;
const openRing = (ring: Point[]) => (ring.length > 1 && distance(ring[0], ring[ring.length - 1]) < 0.001 ? ring.slice(0, -1) : ring);
const oriented = (ring: Point[], counterClockwise: boolean) => (signedArea(ring) > 0) === counterClockwise ? ring : [...ring].reverse();
const planCross = (flat: number[], a: number, b: number, c: number) =>
  (flat[b * 2] - flat[a * 2]) * (flat[c * 2 + 1] - flat[a * 2 + 1]) - (flat[b * 2 + 1] - flat[a * 2 + 1]) * (flat[c * 2] - flat[a * 2]);

/** Vertical prism between two heights from a polygon with optional holes (outer ring first). Caps face ±Y, sides face outward. */
function extrude(m: Mesh, polygon: Point[][], bottom: number, top: number) {
  const rings = polygon.map((ring, index) => oriented(openRing(ring), index === 0)).filter((ring) => ring.length >= 3);
  if (!rings.length || top - bottom <= 0) return;
  const flat: number[] = [], holes: number[] = [];
  rings.forEach((ring, index) => {
    if (index) holes.push(flat.length / 2);
    for (const [x, y] of ring) flat.push(x, y);
  });
  const count = flat.length / 2, topBase = m.positions.length / 3;
  for (let i = 0; i < count; i++) vertex(m, flat[i * 2], top, flat[i * 2 + 1]);
  const bottomBase = m.positions.length / 3;
  for (let i = 0; i < count; i++) vertex(m, flat[i * 2], bottom, flat[i * 2 + 1]);
  const triangles = Earcut.triangulate(flat, holes.length ? holes : undefined, 2);
  for (let i = 0; i < triangles.length; i += 3) {
    const [a, b, c] = [triangles[i], triangles[i + 1], triangles[i + 2]];
    // Plan y maps to viewer z, so a plan-counter-clockwise triangle faces -Y; flip it for the top cap.
    const up = planCross(flat, a, b, c) < 0;
    m.indices.push(topBase + a, topBase + (up ? b : c), topBase + (up ? c : b));
    m.indices.push(bottomBase + a, bottomBase + (up ? c : b), bottomBase + (up ? b : c));
  }
  let offset = 0;
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = offset + i, b = offset + ((i + 1) % ring.length);
      m.indices.push(bottomBase + a, topBase + b, bottomBase + b, bottomBase + a, topBase + a, topBase + b);
    }
    offset += ring.length;
  }
}
/** Box centred on plan segment a→b (Architect3D `beam`): length along the segment, `thickness` across it, `height` above `bottom`. */
function beam(m: Mesh, a: Point, b: Point, bottom: number, height: number, thickness: number) {
  if (height <= 0 || thickness <= 0 || distance(a, b) < 0.001) return;
  const d = unit(a, b), n = mul([-d[1], d[0]], thickness / 2);
  extrude(m, [[add(a, mul(n, -1)), add(b, mul(n, -1)), add(b, n), add(a, n)]], bottom, bottom + height);
}
/** Planar face given as viewer-space points; oriented so its normal points away from `inside` when given, else upward. */
function face(m: Mesh, points: [number, number, number][], inside?: [number, number, number]) {
  if (points.length < 3) return;
  const base = m.positions.length / 3;
  for (const [x, y, z] of points) m.positions.push(round(x), round(y), round(z));
  const [p0, p1, p2] = points,
    u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], v = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]],
    normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]],
    reference = inside ? [p0[0] - inside[0], p0[1] - inside[1], p0[2] - inside[2]] : [0, 1, 0],
    flip = normal[0] * reference[0] + normal[1] * reference[1] + normal[2] * reference[2] < 0;
  for (let i = 1; i < points.length - 1; i++) m.indices.push(base, base + (flip ? i + 1 : i), base + (flip ? i : i + 1));
}

/** Synchronous SHA-256 of a UTF-8 string as lowercase hex (FIPS 180-4); the browser's subtle.digest is async only. */
export function sha256Hex(text: string): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const bytes = new TextEncoder().encode(text), padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6), view = new DataView(padded.buffer);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  view.setUint32(padded.length - 8, Math.floor((bytes.length * 8) / 0x100000000));
  view.setUint32(padded.length - 4, (bytes.length * 8) >>> 0);
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, hh].forEach((value, i) => { h[i] = (h[i] + value) >>> 0; });
  }
  return h.map((value) => value.toString(16).padStart(8, "0")).join("");
}

type DesignedObject = SourceBuilding["objects"][number];
type Category = DesignedObject["category"];
type Level = DesignedObject["level"];

/** Deterministic Model-viewer scene for the design; throws when the design has nothing to show. Returns the parsed (validated) scene. */
export function buildDesignedScene(p: ArchitectProject): SourceBuilding {
  if (!p.walls.length && !p.slabs.length && !p.roofs.length) throw Error("The design has no walls, slabs or roofs to show in Model yet. Draw in Sketch first.");
  const levels = [...p.levels].sort((a, b) => a.elevation - b.elevation || a.id.localeCompare(b.id)),
    levelById = new Map(p.levels.map((level) => [level.id, level])),
    lowest = levels[0].elevation,
    storeyIds = new Map(levels.map((level, index) => [level.id, STOREY_ID.test(level.id) && !RESERVED_STOREYS.has(level.id) ? level.id : `designed-level-${index + 1}`])),
    storeysValid = new Set(storeyIds.values()).size === levels.length && levels.every((level, index) => !index || level.elevation > levels[index - 1].elevation),
    storeys = storeysValid ? levels.map((level) => ({ id: storeyIds.get(level.id)!, label: level.name.slice(0, 100), elevation: round(level.elevation * MM) })) : undefined,
    levelOf = (levelId: string): Level => ((levelById.get(levelId)?.elevation ?? lowest) > lowest ? "upper" : "ground"),
    sourceRef: DesignedObject["sourceRefs"][number] = { page: 1, region: [0, 0, SHEET_WIDTH, SHEET_HEIGHT], evidenceState: "inferred", note: DESIGNED_SOURCE_NOTE },
    objects: DesignedObject[] = [];
  const part = (id: string, category: Category, label: string, material: string, levelId: string, level: Level, m: Mesh, note: string) => {
    if (m.indices.length < 3) return;
    objects.push({
      id, category, label: label.slice(0, 300), positions: m.positions, indices: m.indices, material, level,
      ...(storeys ? { storey: storeyIds.get(levelId) } : {}),
      sourceRefs: [{ ...sourceRef }], evidenceState: "inferred", note,
    });
  };
  // Walls: one part per wall and hatch, all height slices of every non-void layer merged (openings already subtracted).
  const wallMeshes = new Map<string, { mesh: Mesh; wallId: string; hatch: string; levelId: string; layers: Set<string> }>();
  for (const solid of wallSolids(p)) {
    if (solid.kind === "void") continue;
    const key = `${solid.wallId}/${solid.hatch}`;
    let entry = wallMeshes.get(key);
    if (!entry) wallMeshes.set(key, (entry = { mesh: { positions: [], indices: [] }, wallId: solid.wallId, hatch: solid.hatch, levelId: solid.levelId, layers: new Set() }));
    entry.layers.add(solid.name);
    for (const polygon of solid.polygons) extrude(entry.mesh, polygon, solid.bottom, solid.top);
  }
  for (const [key, entry] of wallMeshes) {
    const wall = p.walls.find((w) => w.id === entry.wallId);
    part(`wall-${key.replace("/", "-")}`, "wall", `${wall?.name ?? "Wall"} — ${[...entry.layers].join(", ")}`, HATCH_MATERIAL[entry.hatch] ?? "plaster", entry.levelId, levelOf(entry.levelId), entry.mesh,
      `Authored wall assembly layer(s) hatched ${entry.hatch}; ${wall ? `${Math.round(distance(wall.a, wall.b))} mm long, ${Math.round(wall.height)} mm high` : "host wall removed"}.`);
  }
  for (const slab of p.slabs) {
    const elevation = (levelById.get(slab.levelId)?.elevation ?? lowest) + slab.offset, m: Mesh = { positions: [], indices: [] };
    extrude(m, [slab.points], elevation - slab.thickness, elevation);
    part(`slab-${slab.id}`, "slab", slab.name, surfaceMaterialKey(slab.material), slab.levelId, levelOf(slab.levelId), m, `Authored slab ${slab.thickness} mm thick${slab.material ? `, ${slab.material}` : ""}.`);
  }
  for (const o of p.openings) {
    if (o.kind === "void") continue; // Apertures are already cut from wall geometry; never invent a fixture.
    const w = p.walls.find((wall) => wall.id === o.wallId);
    if (!w) continue;
    const y = (levelById.get(w.levelId)?.elevation ?? lowest) + o.sill, d = unit(w.a, w.b), t = wallThickness(w),
      a = add(w.a, mul(d, o.offset - o.width / 2)), b = add(a, mul(d, o.width)),
      frame: Mesh = { positions: [], indices: [] }, leaf: Mesh = { positions: [], indices: [] },
      jamb = Math.min(40, o.width / 2), head = Math.min(40, o.height), kind = o.kind === "door" ? "Door" : "Window";
    beam(frame, a, add(a, mul(d, jamb)), y, o.height, t);
    beam(frame, add(b, mul(d, -jamb)), b, y, o.height, t);
    beam(frame, a, b, y + o.height - head, head, t);
    if (o.kind === "window") {
      beam(frame, a, b, y, head, t);
      beam(leaf, a, b, y + head, o.height - head * 2, 12);
    } else beam(leaf, add(a, mul(d, jamb)), add(b, mul(d, -jamb)), y + 5, o.height - 45, 40);
    const level = levelOf(w.levelId);
    part(`${o.id}-frame`, o.kind, `${kind} ${o.tag} frame`, "frame", w.levelId, level, frame, `Authored ${o.kind} ${o.width} × ${o.height} mm in ${w.name}; nominal 40 mm frame.`);
    part(o.id, o.kind, `${kind} ${o.tag}`, o.kind === "window" ? "glass" : "leaf", w.levelId, level, leaf,
      o.kind === "window" ? "Nominal 12 mm glazing panel; no glass assembly is specified." : `Nominal 40 mm leaf hinged ${o.hinge}, swinging ${o.swing}.`);
  }
  let roofFaceCount = 0;
  for (const r of p.roofs) {
    const y = (levelById.get(r.levelId)?.elevation ?? lowest) + r.offset, m: Mesh = { positions: [], indices: [] }, faces = roofFaces(r);
    for (const f of faces) face(m, f.points.map(([x, z], i) => [x * MM, (y + f.heights[i]) * MM, z * MM]));
    roofFaceCount += faces.length;
    part(`roof-${r.id}`, "roof", r.name, "roof", r.levelId, "roof", m, `Authored roof over ${faces.length} pitched face(s); covering build-up unspecified.`);
    const trims = { fascia: { positions: [], indices: [] } as Mesh, gutter: { positions: [], indices: [] } as Mesh };
    for (const trim of roofTrims(r)) {
      const corners = trim.faces.flat(), centre = corners.reduce((s, c) => [s[0] + c[0], s[1] + c[1], s[2] + c[2]], [0, 0, 0]).map((v) => (v / corners.length) * MM) as [number, number, number];
      centre[1] += y * MM;
      for (const quad of trim.faces) face(trims[trim.kind], quad.map(([x, h, z]) => [x * MM, (y + h) * MM, z * MM]), centre);
    }
    part(`roof-${r.id}-fascia`, "roof-trim", `${r.name} fascia`, "fascia", r.levelId, "roof", trims.fascia, `Authored fascia profile ${r.fasciaHeight} × ${r.fasciaThickness} mm.`);
    part(`roof-${r.id}-gutter`, "roof-trim", `${r.name} gutter`, "gutter", r.levelId, "roof", trims.gutter, `Authored gutter profile ${r.gutterWidth} × ${r.gutterDepth} mm.`);
  }
  if (!objects.length) throw Error("The design produced no solid geometry to show in Model.");
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const object of objects)
    for (let i = 0; i < object.positions.length; i++) {
      const axis = i % 3, value = object.positions[i];
      if (value < min[axis]) min[axis] = value;
      if (value > max[axis]) max[axis] = value;
    }
  for (const level of levels) {
    min[1] = Math.min(min[1], level.elevation * MM);
    max[1] = Math.max(max[1], level.elevation * MM);
  }
  const bounds = { min: [0, 0, 0] as [number, number, number], max: [0, 0, 0] as [number, number, number] };
  for (const axis of [0, 1, 2]) {
    const pad = Math.max(0.5, (1 - (max[axis] - min[axis])) / 2);
    bounds.min[axis] = round(min[axis] - pad);
    bounds.max[axis] = round(max[axis] + pad);
  }
  const elevations = [...new Set(levels.map((level) => level.elevation))],
    floorElevations = elevations.length > 1 ? { ground: round(elevations[0] * MM), upper: round(elevations[1] * MM) } : undefined;
  const scene = {
    schema: "xray.source-building/v1",
    source: { name: DESIGNED_SOURCE_NAME, sha256: sha256Hex(`xray.designed/${p.id}/${p.revision}`), pageCount: 1, title: p.name.slice(0, 300) },
    units: "m",
    coordinateSystem: "Designed project metres, Y up, origin at project origin.",
    presentation: { cameraDirection: [0.85, 0.85, 1.15], edgeOpacity: 0.55 },
    bounds,
    ...(floorElevations ? { floorElevations } : {}),
    ...(storeys ? { storeys } : {}),
    materials: DESIGNED_MATERIALS,
    objects,
    assumptions: [
      "Designed geometry authored in the X-Ray Architectural workspace; there is no source drawing and nothing here is measured from one.",
      "Every part is labelled inferred: wall assemblies, openings, slabs and roof profiles are the authored nominal dimensions, not surveyed, verified or certified.",
      "Materials are display colours for the hatch of each authored layer, not supplier specifications; glass, reinforcement and finishes are unspecified.",
      `Levels follow the design: ${levels.slice(0, 20).map((level) => `${level.name} at ${round(level.elevation * MM)} m`).join("; ")}${levels.length > 20 ? "; …" : ""}.`,
    ],
    sourceSheets: [{ page: 1, title: DESIGNED_SCENE_TITLE, image: `/models/${DESIGNED_SCENE_ID}/source-page-1.png`, width: SHEET_WIDTH, height: SHEET_HEIGHT, role: "designed" }],
    summary: {
      floors: p.levels.length, wallRuns: p.walls.length, openings: p.openings.filter(o => o.kind !== "void").length, roofFaces: roofFaceCount, objects: objects.length,
      ...(p.openings.some(o => o.kind === "void") ? { apertures: p.openings.filter(o => o.kind === "void").length } : {}),
      visibleNamedRooms: p.roomTags.length, method: "Designed geometry from the Architectural workspace.", status: "designed",
    },
  };
  return parseSourceBuilding(scene);
}
