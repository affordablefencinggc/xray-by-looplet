// Authored Redburn presentation geometry. Never a BOM or engineering input.
import fs from "node:fs";
import crypto from "node:crypto";
import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import polygonClipping from "polygon-clipping";
import { parseSourceBuilding } from "../src/studio/sourceBuilding.ts";
const root = "public/models/redburn",
  sha256 = crypto
    .createHash("sha256")
    .update(fs.readFileSync(root + "/source.pdf"))
    .digest("hex");
if (sha256 !== "b57956f76b5dc893ac2b28a021f3f92e345807e326d6b1f8313e373f9145ad38")
  throw Error("Source changed; re-review geometry");
const objects = [],
  P = (a, y, b) => new T.Vector3(a - 5.655, y, 3.325 - b),
  box = (a, b, da, db, y, h) =>
    new T.BoxGeometry(da, h, db).translate(...P(a + da / 2, y + h / 2, b + db / 2).toArray());
function rod(a, b, r = 0.016) {
  const v = b.clone().sub(a),
    g = new T.CylinderGeometry(r, r, v.length(), 6);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize()));
  return g.translate(...a.clone().add(b).multiplyScalar(0.5).toArray());
}
function plate(outline, y, h) {
  const g = new T.ExtrudeGeometry(
    new T.Shape(outline.map(([a, b]) => new T.Vector2(a - 5.655, 3.325 - b))),
    { depth: h, bevelEnabled: false },
  );
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getY(i),
      d = p.getZ(i);
    p.setXYZ(i, x, y - d, z);
  }
  return g;
}
const note =
  "Written dimensions anchor this presentation reconstruction. Placement and un-dimensioned details are approximate. Preliminary drawings state do not scale. Not a quantity or engineering model.";
const ref = (page, extra = note, region) => [
  {
    page,
    region: region ?? (page <= 4 ? [228, 235, 710, 610] : [220, 90, 718, 390]),
    evidenceState: "inferred",
    note: extra,
  },
];
function add(id, label, category, material, level, geometry, refs) {
  const gs = (Array.isArray(geometry) ? geometry : [geometry])
    .filter(Boolean)
    .map((g) => (g.index ? g.toNonIndexed() : g));
  if (!gs.length) return;
  for (const g of gs) {
    g.deleteAttribute("normal");
    g.deleteAttribute("uv");
  }
  const g = mergeGeometries(gs),
    positions = Array.from(g.getAttribute("position").array, (v) => Math.round(v * 1e5) / 1e5);
  objects.push({
    id,
    label,
    category,
    material,
    level,
    positions,
    indices: Array.from({ length: positions.length / 3 }, (_, i) => i),
    sourceRefs: refs ?? ref(level === "ground" ? 3 : 4),
    evidenceState: "inferred",
    note,
  });
  g.dispose();
  for (const g of gs) g.dispose();
}
const materials = {
  plaster: { color: "#edeae1", roughness: 0.87 },
  cladding: { color: "#b9bebd", roughness: 0.76 },
  claddingShade: { color: "#adb3b3", roughness: 0.8 },
  architrave: { color: "#e3e5df", roughness: 0.48 },
  frame: { color: "#788581", metalness: 0.55, roughness: 0.28 },
  glass: { color: "#a5bcb4", metalness: 0.24, roughness: 0.16, opacity: 0.69 },
  obscure: { color: "#c2d2cb", roughness: 0.48, opacity: 0.88 },
  metal: { color: "#303939", metalness: 0.6, roughness: 0.36 },
  roof: { color: "#394242", metalness: 0.52, roughness: 0.5 },
  concrete: { color: "#a8a79e", roughness: 0.98 },
  tile: { color: "#bab9ac", roughness: 0.82 },
  grout: { color: "#7d8079", roughness: 0.97 },
  wood: { color: "#b2926e", roughness: 0.78 },
  walnut: { color: "#77614b", roughness: 0.75 },
  stone: { color: "#e4dfd2", roughness: 0.64 },
  white: { color: "#f3f0e8", roughness: 0.32 },
  black: { color: "#242b2b", roughness: 0.35 },
  steel: { color: "#aab4b2", metalness: 0.78, roughness: 0.22 },
  grass: { color: "#84927b", roughness: 1 },
  soil: { color: "#827a6d", roughness: 1 },
  green: { color: "#596e4b", roughness: 1 },
};
add(
  "slab-lower",
  "Lower living slab / FFL19.35",
  "slab",
  "concrete",
  "ground",
  box(0, 0, 11.31, 6.65, -0.2, 0.2),
  ref(3, "Lower FFL19.35. Slab thickness illustrative."),
);
add(
  "slab-upper",
  "Upper floor / FFL22.47",
  "slab",
  "concrete",
  "upper",
  box(0, 0, 11.31, 6.65, 2.74, 0.38),
  ref(4, "Upper FFL22.47; 380 mm floor zone in elevations; 3120 mm floor-to-floor."),
);
const storage = [
  [-1.21, 6.65],
  [-1.21, 10.11],
  [3.98, 10.11],
  [3.98, 11.11],
  [11.31, 11.11],
  [11.31, 6.65],
];
add(
  "storage-floor",
  "Storage / 70 mm stepdown",
  "room",
  "concrete",
  "ground",
  plate(storage, -0.07, 0.17),
);
add(
  "terrace-floor",
  "Terrace / tiles / 2900 mm wide",
  "room",
  "tile",
  "ground",
  box(-1.21, -2.9, 12.52, 2.9, -0.27, 0.2),
  ref(3, "2900 mm terrace width; 70 mm stepdown."),
);
const joints = [];
for (let a = -1.21; a < 11.31; a += 0.6) joints.push(box(a, -2.9, 0.005, 2.9, -0.07, 0.003));
for (let b = -2.9; b < 0; b += 0.6) joints.push(box(-1.21, b, 12.52, 0.005, -0.07, 0.003));
add(
  "terrace-joints",
  "Terrace tile joints / illustrative module",
  "fixture",
  "grout",
  "ground",
  joints,
  ref(7, "Tiles specified; module size and grout pattern inferred."),
);
function floor(id, label, level, a, b, da, db, mat) {
  const y = level === "ground" ? 0 : 3.12;
  add(id, label, "room", mat, level, box(a, b, da, db, y, 0.015));
  if (mat === "wood") {
    const gs = [];
    for (let k = b; k < b + db; k += 0.18) gs.push(box(a, k, da, 0.003, y + 0.015, 0.001));
    add(id + "-joints", label + " / board seams", "fixture", "walnut", level, gs);
  }
}
floor("lounge", "Lounge / hybrid floor", "ground", 2.9, 0.09, 5.45, 6.14, "wood");
floor("kitchen", "Kitchen", "ground", 8.35, 0.09, 2.87, 4.72, "wood");
floor("bath2", "Laundry / Bath 2", "ground", 0.09, 0.09, 2.61, 3.72, "tile");
floor("linen", "WIL / linen", "ground", 0.09, 3.9, 1.15, 2.33, "stone");
floor("pantry", "Pantry", "ground", 9.22, 4.9, 2, 1.42, "wood");
floor("bed1", "Bed 1 / tongue-and-groove floor", "upper", 4.56, 0.09, 6.66, 6.47, "wood");
floor("bath1", "Bath 1", "upper", 0.09, 0.09, 2.34, 4.84, "tile");
floor("wir", "Walk-in robe", "upper", 2.52, 0.09, 1.95, 4.84, "wood");
floor("entry", "Upper entry", "upper", 0.09, 5.31, 4.38, 1.25, "wood");
function windowAssembly(
  id,
  label,
  level,
  axis,
  fixed,
  s,
  w,
  sill,
  h,
  door = false,
  obscure = false,
) {
  const y = (level === "ground" ? 0 : 3.12) + sill,
    rect = (p, v, l, hh, t = 0.075, out = 0) =>
      axis === "a"
        ? box(p, fixed - t / 2 + out, l, t, y + v, hh)
        : box(fixed - t / 2 + out, p, t, l, y + v, hh),
    f = 0.045,
    fr = [rect(s, 0, w, f), rect(s, h - f, w, f), rect(s, 0, f, h), rect(s + w - f, 0, f, h)],
    panes = [],
    arch = [
      rect(s - 0.038, -0.038, w + 0.076, 0.038, 0.11, -0.025),
      rect(s - 0.038, h, w + 0.076, 0.038, 0.11, -0.025),
      rect(s - 0.038, 0, 0.038, h, 0.11, -0.025),
      rect(s + w, 0, 0.038, h, 0.11, -0.025),
    ],
    n = door ? Math.max(2, Math.round(w / 0.77)) : Math.max(1, Math.round(w / 0.8));
  for (let j = 0; j < n; j++) {
    const u = s + (j * w) / n;
    if (j) fr.push(rect(u - f / 2, 0, f, h));
    if (door) {
      panes.push(rect(u + f, f, w / n - 2 * f, h - 2 * f, 0.014));
      if (j === n - 1) fr.push(rect(u + w / n - 0.1, h * 0.48, 0.025, 0.18, 0.035, -0.065));
    } else {
      const rows = Math.max(2, Math.round(h / 0.22));
      for (let k = 0; k < rows; k++) {
        panes.push(rect(u + f, (k * h) / rows + 0.014, w / n - 2 * f, h / rows - 0.018, 0.012));
        fr.push(rect(u + f, (k * h) / rows, w / n - 2 * f, 0.015, 0.024, -0.011));
      }
    }
  }
  add(
    id,
    label,
    door ? "door" : "window",
    obscure ? "obscure" : door && !/glazed|bifold|sliding/i.test(label) ? "architrave" : "glass",
    level,
    panes,
    ref(
      level === "ground" ? 3 : 4,
      `${label}: ${w} m wide x ${h} m high. Blade counts and profiles illustrative.`,
    ),
  );
  add(id + "-frame", label + " / aluminium frame", door ? "door" : "window", "frame", level, fr);
  add(
    id + "-architrave",
    label + " / 45 x 38 architrave",
    "trim",
    "architrave",
    level,
    arch,
    ref(6, "45 x 38 mm Hardies Axent architraves specified."),
  );
}
function wall(
  id,
  label,
  level,
  axis,
  fixed,
  start,
  len,
  thick,
  openings = [],
  clad = false,
  out = -1,
) {
  const y = level === "ground" ? 0 : 3.12,
    H = 2.74,
    rect = (s, v, l, h, offset = 0, t = thick) =>
      axis === "a"
        ? box(s, fixed - t / 2 + offset, l, t, y + v, h)
        : box(fixed - t / 2 + offset, s, t, l, y + v, h),
    breaks = [start, start + len, ...openings.flatMap((o) => [o.s, o.s + o.w])]
      .filter((s) => s >= start && s <= start + len)
      .sort((a, b) => a - b),
    core = [];
  for (let i = 0; i < breaks.length - 1; i++) {
    const s = breaks[i],
      l = breaks[i + 1] - s;
    if (l < 0.001) continue;
    const o = openings.find((o) => s >= o.s - 0.001 && s + l <= o.s + o.w + 0.001);
    if (o) {
      if (o.sill > 0) core.push(rect(s, 0, l, o.sill));
      if (H > o.sill + o.h) core.push(rect(s, o.sill + o.h, l, H - o.sill - o.h));
    } else core.push(rect(s, 0, l, H));
  }
  add(id, label, "wall", "plaster", level, core);
  if (clad) {
    const courses = [[], []];
    for (let v = 0; v < H; v += 0.18) {
      const h = Math.min(0.175, H - v);
      let spans = [[start, start + len]];
      for (const o of openings)
        if (v < o.sill + o.h && v + h > o.sill)
          spans = spans.flatMap(([s, e]) =>
            e <= o.s || s >= o.s + o.w
              ? [[s, e]]
              : [
                  [s, Math.max(s, o.s)],
                  [Math.min(e, o.s + o.w), e],
                ].filter(([u, w]) => w - u > 0.001),
          );
      for (const [s, e] of spans)
        courses[Math.round(v / 0.18) % 2].push(
          rect(s, v, e - s, h, out * (thick / 2 + 0.012), 0.025),
        );
    }
    for (let i = 0; i < 2; i++)
      add(
        id + "-linea-" + i,
        label + " / 180 mm Linea cladding",
        "trim",
        i ? "claddingShade" : "cladding",
        level,
        courses[i],
        ref(6, "180 mm SCYON LINEA cladding specified. Course/corner detailing inferred."),
      );
  }
  for (const [i, o] of openings.entries())
    windowAssembly(
      id + "-opening-" + i,
      o.label ?? "Internal door",
      level,
      axis,
      fixed,
      o.s,
      o.w,
      o.sill,
      o.h,
      o.door,
      o.obscure,
    );
}
const lowerWindows = [
    { s: 0.48, w: 0.9, sill: 0.3, h: 2.1, obscure: true, label: "21-09LV / Bath 2 louvre" },
    { s: 3.74, w: 3.1, sill: 0, h: 2.4, door: true, label: "24-31BF / Lounge bifold" },
    { s: 7.55, w: 3.1, sill: 0, h: 2.4, door: true, label: "24-31BF / Kitchen bifold" },
  ],
  upperWindows = [
    { s: 1.61, w: 2.4, sill: 1.02, h: 1.6, obscure: true, label: "16-24LV / Bath 1 louvres" },
    { s: 4.65, w: 2.4, sill: 1.02, h: 1.6, label: "16-24LV / Bed 1 louvres A" },
    { s: 7.8, w: 2.4, sill: 1.02, h: 1.6, label: "16-24LV / Bed 1 louvres B" },
  ];
wall(
  "lower-terrace-wall",
  "Lower terrace facade",
  "ground",
  "a",
  0,
  0,
  11.31,
  0.09,
  lowerWindows,
  true,
);
wall(
  "upper-terrace-wall",
  "Upper terrace facade",
  "upper",
  "a",
  0,
  0,
  11.31,
  0.09,
  upperWindows,
  true,
);
wall("lower-front", "Lower stair-side wall", "ground", "b", 0, 0, 6.65, 0.2, [], true);
wall(
  "upper-front",
  "Upper stair-side wall",
  "upper",
  "b",
  0,
  0,
  6.65,
  0.09,
  [{ s: 1.25, w: 2.4, sill: 2.1, h: 0.3, obscure: true, label: "03-24LV / Bath 1 high louvres" }],
  true,
);
wall(
  "lower-end",
  "Kitchen end wall",
  "ground",
  "b",
  11.31,
  0,
  6.65,
  0.2,
  [{ s: 1.95, w: 1.8, sill: 1.6, h: 0.5, label: "05-18FG / Kitchen fixed glazing" }],
  true,
  1,
);
wall(
  "upper-end",
  "Bedroom end wall",
  "upper",
  "b",
  11.31,
  0,
  6.65,
  0.09,
  [{ s: 2.4, w: 1.8, sill: 0.9, h: 1.5, label: "15-18LV / Bed 1 end louvres" }],
  true,
  1,
);
wall("lower-storage-wall", "Living / storage retaining wall", "ground", "a", 6.48, 0, 11.31, 0.33, [
  { s: 7.35, w: 0.87, sill: 0, h: 2.34, door: true, label: "870 storage access door" },
]);
wall("upper-east-wall", "Upper entry / carport wall", "upper", "a", 6.605, 0, 11.31, 0.09, [
  { s: 0.28, w: 0.87, sill: 0, h: 2.34, door: true, label: "870 glazed entry door" },
  { s: 4.65, w: 1.8, sill: 0, h: 2.4, door: true, label: "24-18SD / Carport sliding door" },
]);
wall("bath2-partition", "Bath 2 / lounge partition", "ground", "b", 2.79, 0, 5.2, 0.09, [
  { s: 0.1, w: 0.87, sill: 0, h: 2.34, door: true },
]);
wall("bath2-linen", "Bath 2 / linen partition", "ground", "a", 3.81, 0, 2.79, 0.09);
wall("lift-lower-back", "Lift / linen wall", "ground", "b", 1.28, 3.81, 1.5, 0.09);
wall("lift-lower-right", "Lift / corridor wall", "ground", "a", 5.31, 1.28, 1.51, 0.09);
wall("pantry-divider", "Pantry / kitchen partition", "ground", "a", 4.85, 9.19, 2.12, 0.09, [
  { s: 9.24, w: 0.87, sill: 0, h: 2.34, door: true },
]);
wall("pantry-top", "Pantry / cupboard wall", "ground", "b", 9.19, 4.85, 1.55, 0.09);
wall("bath1-partition", "Bath 1 / robe partition", "upper", "b", 2.52, 0, 3.81, 0.09, [
  { s: 0.15, w: 0.82, sill: 0, h: 2.34, door: true },
]);
wall("bath1-entry", "Bath 1 / entry partition", "upper", "a", 4.93, 0, 1.35, 0.09);
wall("lift-upper-back", "Upper lift shaft back", "upper", "b", 1.35, 3.81, 1.5, 0.09);
wall("lift-upper-left", "Upper lift shaft side", "upper", "a", 3.81, 1.35, 1.42, 0.09);
wall("lift-upper-right", "Upper lift / entry wall", "upper", "a", 5.31, 1.35, 1.42, 0.09);
wall("robe-screen", "Robe / feature wall", "upper", "b", 4.56, 1.1, 4.21, 0.22);
for (const level of ["ground", "upper"]) {
  const y = level === "ground" ? 0 : 3.12;
  add("lift-" + level, "Lift / final design unresolved", "fixture", "steel", level, [
    box(1.35, 3.9, 1.32, 1.32, y, 0.04),
    box(2.75, 3.91, 0.035, 1.3, y, 2.34),
  ]);
}
wall(
  "bbq-end-wall",
  "Terrace BBQ end wall",
  "ground",
  "b",
  11.31,
  -2.9,
  2.9,
  0.09,
  [{ s: -2.4, w: 1.8, sill: 1.5, h: 0.9, label: "09-18LV / Outdoor kitchen louvres" }],
  true,
  1,
);
const storageWalls = [];
for (let i = 0; i < storage.length; i++) {
  const [a, b] = storage[i],
    [c, d] = storage[(i + 1) % storage.length];
  if (b === 6.65 && d === 6.65) continue;
  if (a === c) storageWalls.push(box(a - 0.1, Math.min(b, d), 0.2, Math.abs(d - b), -0.07, 3.19));
  else storageWalls.push(box(Math.min(a, c), b - 0.1, Math.abs(c - a), 0.2, -0.07, 3.19));
}
add(
  "storage-retaining",
  "Storage / stepped retaining walls",
  "wall",
  "concrete",
  "ground",
  storageWalls,
);
const outdoor = [
  [-1.21, 6.65],
  [-1.21, 13.64],
  [9.3, 13.64],
  [11.31, 11.44],
  [11.31, 6.65],
];
add(
  "upper-outdoor",
  "Upper walkway, carport and court slab",
  "slab",
  "concrete",
  "upper",
  // Leave an actual recess for the written 100 mm carport stepdown.
  polygonClipping.difference([outdoor], [[[1.39, 6.65], [7.11, 6.65], [7.11, 13.64], [1.39, 13.64]]])
    .flatMap((rings) => {
      const vectors = rings.map((ring) => ring.slice(0, -1).map((p) => new T.Vector2(...p)));
      const points = vectors.flat();
      return T.ShapeUtils.triangulateShape(vectors[0], vectors.slice(1)).map((triangle) =>
        plate(triangle.map((i) => points[i].toArray()), 3.12, 0.2));
    }),
  ref(
    4,
    "Outdoor RL22.50 conflicts with the written 100 mm stepdown relative to FFL22.47. Walkway remains at upper datum; carport follows the explicit 100 mm stepdown. Datum conflict requires clarification.",
  ),
);
add(
  "carport-zone",
  "Carport / 6790 x 5620",
  "room",
  "concrete",
  "upper",
  box(1.39, 6.65, 5.72, 6.99, 2.82, 0.2),
  ref(4, "Carport slab at 100 mm below upper FFL, following the written stepdown. RL22.50 annotation conflicts; not resolved survey levels."),
);
add(
  "walkway",
  "Upper tiled walkway",
  "room",
  "tile",
  "upper",
  box(-1.21, 6.65, 2.38, 6.79, 3.12, 0.025),
);
add("court", "Upper courtyard", "room", "tile", "upper", box(7.3, 6.75, 3.91, 4.29, 3.12, 0.025));
add("carport-walls", "Carport walls and walkway retaining wall", "wall", "concrete", "upper", [
  box(-1.31, 1.05, 0.2, 12.59, 3.12, 1.15),
  box(1.19, 6.65, 0.2, 6.99, 3.12, 2.74),
  box(7.11, 6.65, 0.2, 6.99, 3.12, 2.74),
]);
add("carport-door-returns", "Carport door jamb wall returns", "wall", "concrete", "upper", [
  box(1.19, 13.44, 0.5, 0.2, 3.02, 2.84),
  box(6.81, 13.44, 0.5, 0.2, 3.02, 2.84),
], ref(4, "Wall returns close the plan's 5120 mm door opening to the carport side walls. Return depths inferred."));
// Integer panel count avoids a ninth panel from accumulated floating-point error.
// A continuous inner leaf closes the shallow panel rebates instead of leaving holes.
const garage = [box(1.69, 13.54, 5.12, 0.035, 3.02, 2.84)];
for (let panel = 0; panel < 8; panel++) {
  const bottom = panel * 2.84 / 8;
  garage.push(box(1.69, 13.575, 5.12, 0.055, 3.02 + bottom, 2.84 / 8 - 0.015));
}
add("garage-door", "2840 h x 5120 w sectional steel door", "door", "architrave", "upper", garage,
  ref(4, "2840 x 5120 door; the written 100 mm carport stepdown places its head at the 2740 mm upper ceiling datum. Panel count/profile inferred."));
const slats = [];
for (let a = 7.43; a < 11.15; a += 0.095) slats.push(box(a, 6.73, 0.035, 0.045, 3.12, 1.65));
add("court-screen", "Courtyard aluminium privacy screen", "fence", "metal", "upper", slats);
const stairs = [];
for (let i = 0; i < 18; i++)
  stairs.push(box(-1.06, 1.05 + (i * 4.68) / 18, 1.01, 4.68 / 18, (i * 3.12) / 18, 3.12 / 18));
add(
  "external-stairs",
  "External stairs / 18 treads / 4680 run",
  "stair",
  "concrete",
  "ground",
  stairs,
  ref(
    4,
    "18 numbered treads and 4680 mm run. Rise interpolated between FFL19.35 and22.47. Riser detailing inferred.",
  ),
);
add(
  "stair-landing",
  "Stair foot landing",
  "slab",
  "tile",
  "ground",
  box(-1.21, -2.9, 1.21, 3.95, -0.27, 0.2),
);
const sr = [];
for (const a of [-1.12, -0.02]) {
  sr.push(rod(P(a, 1.02, 1.05), P(a, 4.14, 5.73), 0.038));
  for (let i = 0; i <= 18; i += 3)
    sr.push(
      rod(
        P(a, (i * 3.12) / 18, 1.05 + (i * 4.68) / 18),
        P(a, (i * 3.12) / 18 + 1.02, 1.05 + (i * 4.68) / 18),
        0.024,
      ),
    );
}
add(
  "stair-handrail",
  "Painted timber stair handrails",
  "fence",
  "architrave",
  "ground",
  sr,
  ref(6),
);
add(
  "terrace-posts",
  "112 x 112 painted verandah posts",
  "column",
  "architrave",
  "ground",
  [0.04, 3.956, 7.876, 10.64].map((a) => box(a - 0.056, -2.844, 0.112, 0.112, -0.07, 2.81)),
  ref(6, "112 x 112 mm painted posts. Positions approximate terrace dimension chain."),
);
const rail = [];
for (let a = -1.17; a <= 11.25; a += 1.035)
  rail.push(rod(P(a, -0.07, -2.84), P(a, 0.95, -2.84), 0.022));
rail.push(rod(P(-1.17, 0.95, -2.84), P(11.25, 0.95, -2.84), 0.028));
for (let h = 0.1; h < 0.93; h += 0.12)
  rail.push(rod(P(-1.17, h, -2.84), P(11.25, h, -2.84), 0.004));
for (let b = -2.84; b < 0.9; b += 0.9) rail.push(rod(P(-1.17, -0.07, b), P(-1.17, 0.95, b), 0.022));
rail.push(rod(P(-1.17, 0.95, -2.84), P(-1.17, 0.95, 0.9), 0.028));
for (let h = 0.1; h < 0.93; h += 0.12) rail.push(rod(P(-1.17, h, -2.84), P(-1.17, h, 0.9), 0.004));
add(
  "terrace-balustrade",
  "1020 mm stainless rail and wire balustrade",
  "fence",
  "steel",
  "ground",
  rail,
  ref(6, "1020 mm top rail and stainless wire specified. Cable spacing and profiles inferred."),
);
const base = [],
  gaps = [
    [1.2, 2.7],
    [5.1, 6.6],
    [9, 10.5],
  ];
let cursor = -1.21;
for (const [s, e] of gaps) {
  base.push(box(cursor, -2.9, s - cursor, 0.2, -1.5, 1.25), box(s, -2.9, e - s, 0.2, -0.42, 0.17));
  cursor = e;
}
base.push(
  box(cursor, -2.9, 11.31 - cursor, 0.2, -1.5, 1.25),
  box(11.21, -2.9, 0.2, 9.55, -1.5, 1.25),
);
add(
  "subfloor",
  "Concrete subfloor / three access openings",
  "wall",
  "concrete",
  "ground",
  base,
  ref(
    6,
    "Three openings visible in rear elevation. Depths and opening sizes inferred; not foundation design.",
  ),
);
function polygon(points) {
  const pos = [];
  for (let i = 1; i < points.length - 1; i++)
    for (const v of [points[0], points[i], points[i + 1]]) pos.push(...P(...v).toArray());
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  return g;
}
const mainRoofBounds = [-0.48, 11.79, -0.48, 7.05];
const carportRoofBounds = [0.95, 7.57, 6.15, 13.78];
const roofPitch = Math.tan((22.5 * Math.PI) / 180);
const gables = [
  { id: "terrace-gable", axis: "a", c: 8.05, fixed: -0.22, width: 4.4, inward: 1 },
  { id: "stair-gable", axis: "b", c: 3.15, fixed: -0.27, width: 4.8, inward: 1 },
  { id: "carport-gable", axis: "a", c: 4.26, fixed: 13.78, width: 6.62, inward: -1 },
].map((g) => {
  const r = g.width / 2;
  const y = g.id === "carport-gable" ? 5.86 : 5.86 + (g.fixed - mainRoofBounds[g.axis === "a" ? 2 : 0]) * roofPitch;
  const point = (across, height, inward = 0) =>
    g.axis === "a" ? [across, height, g.fixed + inward * g.inward] : [g.fixed + inward * g.inward, height, across];
  const left = point(g.c - r, y),
    right = point(g.c + r, y);
  const peak = point(g.c, y + r * roofPitch),
    join = point(g.c, y + r * roofPitch, r);
  return {
    ...g,
    y,
    left,
    right,
    peak,
    join,
    footprint: [left, right, join].map((p) => [p[0], p[2]]),
  };
});
// Split host sheet ribs at every gable footprint edge; no hidden duplicate roof
// sheet or rib is left underneath the new intersecting roof slopes.
function exposedRib(start, end, openings) {
  const breaks = [0, 1],
    dx = end[0] - start[0],
    dz = end[2] - start[2];
  const cross = (x, z, u, v) => x * v - z * u;
  for (const g of openings)
    for (let i = 0; i < 3; i++) {
      const a = g.footprint[i],
        b = g.footprint[(i + 1) % 3];
      const ex = b[0] - a[0],
        ez = b[1] - a[1],
        det = cross(dx, dz, ex, ez);
      if (Math.abs(det) < 1e-10) continue;
      const ax = a[0] - start[0],
        az = a[1] - start[2];
      const t = cross(ax, az, ex, ez) / det,
        u = cross(ax, az, dx, dz) / det;
      if (t > 0 && t < 1 && u >= 0 && u <= 1) breaks.push(t);
    }
  const at = (t) => start.map((v, i) => v + (end[i] - v) * t);
  const inside = (p, ring) => {
    const signs = ring.map((a, i) => {
      const b = ring[(i + 1) % ring.length];
      return cross(b[0] - a[0], b[1] - a[1], p[0] - a[0], p[2] - a[1]);
    });
    return signs.every((v) => v >= -1e-9) || signs.every((v) => v <= 1e-9);
  };
  breaks.sort((a, b) => a - b);
  return breaks.slice(1).flatMap((endT, i) => {
    const startT = breaks[i];
    if (endT - startT < 1e-8 || openings.some((g) => inside(at((startT + endT) / 2), g.footprint)))
      return [];
    return [rod(P(...at(startT)), P(...at(endT)), 0.007)];
  });
}
function roof(id, label, a0, a1, b0, b1, eave, pitch, openings = []) {
  const k = Math.tan((pitch * Math.PI) / 180),
    r = Math.min((a1 - a0) / 2, (b1 - b0) / 2),
    rise = r * k,
    c = [
      [a0, eave, b0],
      [a1, eave, b0],
      [a1, eave, b1],
      [a0, eave, b1],
    ];
  let faces;
  if (a1 - a0 >= b1 - b0) {
    const p = [a0 + r, eave + rise, (b0 + b1) / 2],
      q = [a1 - r, eave + rise, (b0 + b1) / 2];
    faces = [
      [c[0], c[1], q, p],
      [c[1], c[2], q],
      [c[2], c[3], p, q],
      [c[3], c[0], p],
    ];
  } else {
    const p = [(a0 + a1) / 2, eave + rise, b0 + r],
      q = [(a0 + a1) / 2, eave + rise, b1 - r];
    faces = [
      [c[0], c[1], p],
      [c[1], c[2], q, p],
      [c[2], c[3], q],
      [c[3], c[0], p, q],
    ];
  }
  const ribs = [],
    caps = [];
  for (const f of faces)
    for (let i = 0; i < f.length; i++)
      caps.push(rod(P(...f[i]), P(...f[(i + 1) % f.length]), 0.026));
  for (let a = a0 + 0.065; a < a1; a += 0.12) {
    const run = Math.min(a - a0, a1 - a, (b1 - b0) / 2);
    for (const side of [0, 1]) {
      const b = side ? b1 : b0,
        d = side ? -run : run;
      ribs.push(...exposedRib([a, eave + 0.012, b], [a, eave + run * k + 0.012, b + d], openings));
    }
  }
  for (let b = b0 + 0.065; b < b1; b += 0.12) {
    const run = Math.min(b - b0, b1 - b, (a1 - a0) / 2);
    for (const side of [0, 1]) {
      const a = side ? a1 : a0,
        d = side ? -run : run;
      ribs.push(...exposedRib([a, eave + 0.012, b], [a + d, eave + run * k + 0.012, b], openings));
    }
  }
  add(
    id,
    label,
    "roof",
    "roof",
    "roof",
    faces.flatMap((f) => {
      if (!openings.length) return [polygon(f)];
      const clipped = polygonClipping.difference(
        [f.map((p) => [p[0], p[2]])],
        ...openings.map((g) => [g.footprint]),
      );
      return clipped.map((rings) => {
        const vectors = rings.map((r) => r.slice(0, -1).map((p) => new T.Vector2(...p)));
        const triangles = T.ShapeUtils.triangulateShape(vectors[0], vectors.slice(1));
        const points = vectors.flat();
        const positions = triangles.flatMap((t) =>
          t.flatMap((i) => {
            const { x: a, y: b } = points[i];
            return P(a, eave + Math.min(a - a0, a1 - a, b - b0, b1 - b) * k, b).toArray();
          }),
        );
        const geometry = new T.BufferGeometry();
        geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
        return geometry;
      });
    }),
    ref(
      6,
      `${pitch} degree metal roof specified. Hip/ridge intersections inferred from elevations and cover; no roof framing plan.`,
    ),
  );
  add(
    id + "-ribs",
    label + " / sheet ribs",
    "roof-trim",
    "metal",
    "roof",
    ribs,
    ref(6, "Metal sheet profile and rib spacing illustrative."),
  );
  add(id + "-caps", label + " / hip and ridge caps", "roof-trim", "metal", "roof", caps, ref(6));
  add(
    id + "-fascia",
    label + " / fascia and gutter",
    "roof-trim",
    "metal",
    "roof",
    [
      box(a0, b0 - 0.03, a1 - a0, 0.09, eave - 0.16, 0.16),
      box(a0, b1 - 0.06, a1 - a0, 0.09, eave - 0.16, 0.16),
      box(a0 - 0.03, b0, 0.09, b1 - b0, eave - 0.16, 0.16),
      box(a1 - 0.06, b0, 0.09, b1 - b0, eave - 0.16, 0.16),
    ],
    ref(6),
  );
}
roof("main-roof", "Main residence / 22.5 degree hip roof", ...mainRoofBounds, 5.86, 22.5, gables.filter(g => g.id !== "carport-gable"));
roof("carport-roof", "Carport / 22.5 degree roof", ...carportRoofBounds, 5.86, 22.5, gables.filter(g => g.id === "carport-gable"));
const a0 = -0.32,
  a1 = 11.67,
  b0 = -3.13,
  b1 = -0.01,
  y = 2.74,
  k = Math.tan((15 * Math.PI) / 180),
  r = 1.5,
  vp = [
    [a0, y, b0],
    [a1, y, b0],
    [a1, y, b1],
    [a0, y, b1],
    [a0 + r, y + 3.12 * k, b1],
    [a1 - r, y + 3.12 * k, b1],
  ],
  vr = [];
for (let a = a0 + 0.06; a < a1; a += 0.12) {
  const run = Math.min(3.12, ((a - a0) * 3.12) / r, ((a1 - a) * 3.12) / r);
  vr.push(rod(P(a, y + 0.01, b0), P(a, y + run * k + 0.01, b0 + run), 0.007));
}
add(
  "verandah-roof",
  "Terrace / 15 degree verandah roof",
  "roof",
  "roof",
  "roof",
  [
    [0, 1, 5, 4],
    [1, 2, 5],
    [3, 0, 4],
  ].map((f) => polygon(f.map((i) => vp[i]))),
  ref(6, "15 degree verandah roof. Hips inferred from cover perspective."),
);
add("verandah-ribs", "Terrace roof / sheet ribs", "roof-trim", "metal", "roof", vr, ref(6));
add(
  "verandah-fascia",
  "Terrace roof fascia and gutter",
  "roof-trim",
  "metal",
  "roof",
  [
    box(a0, b0 - 0.045, a1 - a0, 0.1, y - 0.13, 0.13),
    box(a0 - 0.03, b0, 0.08, 3.12, y - 0.13, 0.13),
    box(a1 - 0.05, b0, 0.08, 3.12, y - 0.13, 0.13),
  ],
  ref(6),
);
function gable({ id, axis, c, fixed, width, y, left, right, peak, join, inward = 1 }) {
  const page = id === "carport-gable" ? 5 : 6;
  const r = width / 2,
    h = r * Math.tan((22.5 * Math.PI) / 180),
    p =
      axis === "a"
        ? [
            [c - r, y, fixed],
            [c + r, y, fixed],
            [c, y + h, fixed],
          ]
        : [
            [fixed, y, c - r],
            [fixed, y, c + r],
            [fixed, y + h, c],
          ];
  add(
    id,
    "Decorative gable / Hardieflex and battens",
    "roof-trim",
    "cladding",
    "roof",
    polygon(p),
    ref(
      page,
      "Decorative gable shown. Width, ridge and batten spacing inferred from elevation/cover.",
    ),
  );
  const bars = [rod(P(...p[0]), P(...p[2]), 0.04), rod(P(...p[2]), P(...p[1]), 0.04)];
  for (let t = -r + 0.3; t < r; t += 0.55) {
    const hh = (r - Math.abs(t)) * Math.tan((22.5 * Math.PI) / 180);
    bars.push(
      axis === "a"
        ? rod(P(c + t, y, fixed - inward * 0.012), P(c + t, y + hh, fixed - inward * 0.012), 0.02)
        : rod(P(fixed - inward * 0.012, y, c + t), P(fixed - inward * 0.012, y + hh, c + t), 0.02),
    );
  }
  add(
    id + "-battens",
    "Decorative gable / painted battens",
    "roof-trim",
    "architrave",
    "roof",
    bars,
    ref(page),
  );
  add(
    id + "-roof",
    "Decorative gable / intersecting roof slopes",
    "roof",
    "roof",
    "roof",
    [polygon([left, peak, join]), polygon([peak, right, join])],
    ref(
      page,
      "Gable roof joins the host hip at two valleys; aligned to the decorative face shown on the cover and elevations. Undimensioned depth inferred.",
    ),
  );
  const ribs = [];
  for (let depth = 0.06; depth < r; depth += 0.12) {
    const length = r - depth;
    const ridge =
      axis === "a"
        ? [c, y + r * roofPitch + 0.012, fixed + inward * depth]
        : [fixed + inward * depth, y + r * roofPitch + 0.012, c];
    for (const sign of [-1, 1]) {
      const valley =
        axis === "a"
          ? [c + sign * length, y + depth * roofPitch + 0.012, fixed + inward * depth]
          : [fixed + inward * depth, y + depth * roofPitch + 0.012, c + sign * length];
      ribs.push(rod(P(...ridge), P(...valley), 0.007));
    }
  }
  add(
    id + "-roof-ribs",
    "Decorative gable / roof sheet ribs",
    "roof-trim",
    "metal",
    "roof",
    ribs,
    ref(page),
  );
  add(
    id + "-roof-caps",
    "Decorative gable / ridge, valleys and barge flashing",
    "roof-trim",
    "metal",
    "roof",
    [
      [left, peak],
      [right, peak],
      [peak, join],
      [left, join],
      [right, join],
    ].map(([a, b]) => rod(P(...a), P(...b), 0.035)),
    ref(page),
  );
}
for (const spec of gables) gable(spec);
add(
  "flue",
  "Fireplace flue / indicative termination",
  "roof-trim",
  "steel",
  "roof",
  [rod(P(2.92, 5.4, 2.45), P(2.92, 8.42, 2.45), 0.095), box(2.8, 2.33, 0.24, 0.24, 8.42, 0.06)],
  ref(6, "Flue location shown. Final manufacturer/clearance coordination required."),
);
function cabinet(id, label, level, a, b, da, db, h = 0.9) {
  const y = level === "upper" ? 3.12 : 0;
  add(id, label, "fixture", "architrave", level, box(a, b, da, db, y, h - 0.035));
  add(
    id + "-top",
    label + " / benchtop",
    "fixture",
    "stone",
    level,
    box(a - 0.015, b - 0.015, da + 0.03, db + 0.03, y + h - 0.035, 0.035),
  );
  const gs = [];
  for (let k = b + 0.6; k < b + db; k += 0.6)
    gs.push(box(a - 0.005, k, 0.009, 0.005, y + 0.08, h - 0.14));
  add(id + "-joinery", label + " / divisions", "fixture", "frame", level, gs);
}
cabinet("island", "Kitchen / 2700 x 900 breakfast bar", "ground", 8.47, 1.05, 0.9, 2.7);
cabinet("kitchen-bench", "Kitchen perimeter cabinets", "ground", 10.65, 0.1, 0.57, 4.55);
cabinet("bbq", "Terrace / outdoor BBQ and sink", "ground", 10.66, -2.81, 0.57, 2.72);
cabinet("bath2-vanity", "Bath 2 / 1200 vanity", "ground", 2.12, 1.52, 0.52, 1.2, 0.86);
cabinet("laundry-bench", "Laundry bench", "ground", 0.12, 0.14, 0.55, 2.52);
cabinet("bath1-vanity", "Bath 1 / 1800 vanity", "upper", 0.12, 1.34, 0.52, 1.8, 0.86);
cabinet("bed1-bench", "Bed 1 / wall-hung bench", "upper", 10.75, 0.12, 0.43, 2.25, 0.82);
function basin(id, level, a, b, y) {
  const f = level === "upper" ? 3.12 : 0;
  add(id, "Inset basin", "fixture", "white", level, box(a, b, 0.36, 0.5, f + y, 0.035));
  add(id + "-tap", "Mixer tap", "fixture", "steel", level, [
    rod(P(a + 0.36, f + y, b + 0.25), P(a + 0.36, f + y + 0.22, b + 0.25), 0.014),
    rod(P(a + 0.36, f + y + 0.22, b + 0.25), P(a + 0.2, f + y + 0.22, b + 0.25), 0.013),
  ]);
}
basin("island-sink", "ground", 8.69, 2.67, 0.905);
basin("bbq-sink", "ground", 10.79, -0.65, 0.905);
basin("bath2-basin", "ground", 2.2, 1.85, 0.865);
basin("bath1-basin", "upper", 0.2, 1.9, 0.865);
const cooktop = [box(10.73, 2.03, 0.44, 0.65, 0.905, 0.025)];
for (const a of [10.83, 11.04])
  for (const b of [2.18, 2.53]) {
    const g = new T.TorusGeometry(0.074, 0.006, 6, 20);
    g.rotateX(Math.PI / 2);
    g.translate(...P(a, 0.933, b).toArray());
    cooktop.push(g);
  }
add("cooktop", "Kitchen / induction cooktop", "fixture", "black", "ground", cooktop);
add("bbq-grill", "Outdoor BBQ grill", "fixture", "metal", "ground", [
  box(10.73, -2.65, 0.43, 0.94, 0.905, 0.045),
  ...Array.from({ length: 13 }, (_, i) => box(10.75, -2.6 + i * 0.062, 0.39, 0.009, 0.952, 0.006)),
]);
for (const [level, a, b] of [
  ["ground", 1.75, 3.24],
  ["upper", 2.03, 1.56],
]) {
  const y = level === "upper" ? 3.12 : 0,
    g = new T.SphereGeometry(0.22, 16, 10);
  g.scale(1.25, 0.6, 1);
  g.translate(...P(a, y + 0.34, b).toArray());
  add("toilet-" + level, "WC / plan fixture", "fixture", "white", level, [
    box(a - 0.26, b - 0.17, 0.22, 0.34, y, 0.7),
    g,
  ]);
}
for (const [level, a, b] of [
  ["ground", 0.82, 0.2],
  ["upper", 1.35, 3.85],
]) {
  const y = level === "upper" ? 3.12 : 0;
  add("shower-" + level, "Shower / glazed screen", "fixture", "glass", level, [
    box(a, b, 0.016, 0.95, y, 2.02),
    box(a, b, 1.05, 0.016, y, 2.02),
  ]);
  add(
    "shower-tray-" + level,
    "Shower tile base",
    "fixture",
    "tile",
    level,
    box(a, b, 1.05, 0.95, y, 0.018),
  );
}
for (const [id, level, a, b, da, db] of [
  ["linen-cabinets", "ground", 0.13, 4, 0.44, 2.22],
  ["robe-upper-a", "upper", 2.61, 1.13, 0.48, 2.74],
  ["robe-upper-b", "upper", 3.9, 1.13, 0.48, 4],
]) {
  const y = level === "upper" ? 3.12 : 0,
    gs = [];
  for (let h = 0; h <= 2.3; h += 0.46) gs.push(box(a, b, da, db, y + h, 0.028));
  for (let j = b; j < b + db; j += 0.8) gs.push(box(a, j, da, 0.025, y, 2.3));
  add(id, "Cabinet-made shelving and drawers", "fixture", "wood", level, gs);
}
add(
  "fireplace",
  "Lounge / fireplace and TV recess",
  "fixture",
  "black",
  "ground",
  [box(2.81, 2.135, 0.16, 2, 0.32, 0.9), box(2.83, 1.27, 0.035, 3.73, 1.5, 0.04)],
  ref(
    3,
    "2000 mm fireplace width on lower plan; finish and depth indicative.",
    [31, 642, 192, 804],
  ),
);
add("court-steps", "Courtyard / three path steps", "stair", "concrete", "upper", [
  box(7.49, 11.22, 0.52, 0.26, 2.67, 0.45),
  box(7.49, 11.48, 0.52, 0.26, 2.67, 0.3),
  box(7.49, 11.74, 0.52, 0.26, 2.67, 0.15),
]);
add(
  "garden-bed",
  "Courtyard / garden planting by owner",
  "fixture",
  "soil",
  "upper",
  box(8.5, 11.17, 2.6, 0.72, 3.1, 0.14),
);
const shrubs = [];
for (let a = 8.6; a < 11; a += 0.4) {
  const g = new T.IcosahedronGeometry(0.24, 1);
  g.scale(1, 1.5, 1);
  g.translate(...P(a, 3.55, 11.53).toArray());
  shrubs.push(g);
}
add(
  "garden-planting",
  "Garden / illustrative planting",
  "fixture",
  "green",
  "upper",
  shrubs,
  ref(4, "Planting by owner. Species, density and height illustrative."),
);
for (let i = 0; i < 2; i++) {
  const b = 7.08 + i * 2.05;
  add(
    "ac-" + i,
    "Wall-mounted external A/C " + (i + 1),
    "fixture",
    "architrave",
    "upper",
    box(11.33, b, 0.27, 1.02, 2.3, 0.74),
    ref(6),
  );
  add(
    "ac-grille-" + i,
    "A/C condenser grille",
    "fixture",
    "frame",
    "upper",
    Array.from({ length: 9 }, (_, j) => box(11.61, b + 0.14, 0.016, 0.65, 2.39 + j * 0.068, 0.012)),
    ref(6),
  );
}
add(
  "site-base",
  "Site / illustrative cropped plinth",
  "slab",
  "soil",
  "ground",
  plate(
    [
      [-1.65, -3.45],
      [11.8, -3.45],
      [11.8, 14.05],
      [-1.65, 14.05],
    ],
    -1.51,
    0.13,
  ),
  ref(
    2,
    "Illustrative cropped site plinth, not the legal boundary or survey surface.",
    [90, 100, 820, 665],
  ),
);
const strips = [];
for (const a of [-1.65, 11.5])
  strips.push(
    polygon([
      [a, -1.45, -3.45],
      [a + 0.3, -1.45, -3.45],
      [a + 0.3, 2.95, 14.05],
      [a, 2.95, 14.05],
    ]),
  );
add(
  "site-slope",
  "Site / hillside edge strips",
  "slab",
  "grass",
  "ground",
  strips,
  ref(6, "Simplified slope envelope from elevation. Not triangulated survey data."),
);
add(
  "downpipes",
  "Rainwater downpipes / indicative profiles",
  "trim",
  "cladding",
  "ground",
  [
    [0.05, -0.08],
    [11.25, -0.08],
    [11.25, 6.7],
    [0.05, 6.7],
  ].map(([a, b]) => rod(P(a, 0, b), P(a, 5.75, b), 0.04)),
  ref(3, "DP positions shown. Diameter and connections inferred."),
);
const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
for (const o of objects)
  for (let i = 0; i < o.positions.length; i++) {
    const j = i % 3;
    bounds.min[j] = Math.min(bounds.min[j], o.positions[i]);
    bounds.max[j] = Math.max(bounds.max[j], o.positions[i]);
  }
const titles = [
  "Cover perspective",
  "Site plan",
  "Lower / ground plan",
  "Upper floor plan",
  "Front and right elevations",
  "Rear and left elevations",
  "Lower floor coverings",
  "Upper floor coverings",
  "Lower electrical",
  "Upper electrical",
  "Health and safety",
  "Survey 1",
  "Survey 2",
];
const scene = {
  schema: "xray.source-building/v1",
  source: {
    name: "21-08-26_Redburn_BR250157_Prelim_Council (1).pdf",
    sha256,
    pageCount: 13,
    title: "Redburn BR250157 / Preliminary Council",
    author: "Integrity New Homes",
  },
  units: "m",
  coordinateSystem:
    "Y up. X follows the floor plan from stair end to kitchen end; +Z faces the terrace. Y=0 is lower FFL RL19.35. Positions approximate; written dimensions govern.",
  presentation: { cameraDirection: [-0.6, 0.38, 1.35], planUp: [-1, 0, 0], edgeOpacity: 0.09 },
  bounds,
  floorElevations: { ground: 0, upper: 3.12 },
  materials,
  objects,
  sourceSheets: titles.map((title, i) => ({
    page: i + 1,
    title,
    image: `/models/redburn/source-page-${i + 1}.png`,
    width: 1190.55,
    height: 841.89,
    role: i === 2 ? "ground" : i === 3 ? "upper" : i === 0 ? "perspective" : "reference",
  })),
  assumptions: [
    "Presentation reconstruction from the original 13-page preliminary council PDF. Not coordinated CAD/BIM, fabrication drawings, structural analysis or a verified bill of materials.",
    "Lower FFL19.35 and upper FFL22.47 give 3.12 m separation. Ceiling heights2740 mm and upper floor zone380 mm are shown in elevations.",
    "Outdoor RL22.50 and 100 mm stepdown annotations conflict with upper FFL22.47. Carport follows the written 100 mm stepdown; walkway/court remain at upper datum pending clarification.",
    "Written dimensions anchor the layout. Un-dimensioned positions, roof intersections, subfloor depths and aperture locations are visually approximated. Source states do not scale.",
    "Main/carport roof pitch22.5 degrees; verandah15 degrees. Gable geometry inferred from cover and elevations. Roof framing is not supplied.",
    "Cladding180 mm, verandah posts112 x112 mm and terrace balustrade1020 mm are specified. Rib/cable spacing, tile module, joinery profiles and glass blade counts are illustrative.",
    "Fixtures shown where identified on plans. Hidden framing, reinforcement, fasteners and service routes are not reconstructed or counted.",
    "Source area schedule (not validated mesh quantities): lower living77.33, upper76.41, storage51.65, carport42.08, terrace33.32 m2; total280.79 m2.",
    "Terrain is a cropped illustrative hillside envelope. Colours/material finishes are presentation choices; source colour scheme marked N/A.",
  ],
  summary: {
    floors: 2,
    wallRuns: objects.filter((o) => o.category === "wall").length,
    openings: objects.filter((o) => /opening-\d+$/.test(o.id)).length,
    roofFaces: 15,
    objects: objects.length,
    visibleNamedRooms: 13,
    method:
      "Authored Three.js geometry anchored to dimensions, plans, elevations and cover. Inferred details identified.",
    status: "Preliminary reconstruction / review required",
  },
};
parseSourceBuilding(scene);
fs.writeFileSync(root + "/source-building.json", JSON.stringify(scene));
console.log(
  JSON.stringify(
    {
      ok: true,
      sha256,
      objects: objects.length,
      coordinates: objects.reduce((n, o) => n + o.positions.length, 0),
      bytes: fs.statSync(root + "/source-building.json").size,
      bounds,
    },
    null,
    2,
  ),
);
