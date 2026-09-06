import clipping from "polygon-clipping";
import {
  add,
  sub,
  mul,
  unit,
  cross,
  distance,
  intersection,
  area,
  perimeter,
  pointInPolygon,
  wallThickness,
  type Point,
  type Wall,
  type ArchitectProject,
  type Roof,
} from "./model.ts";
export type Polygon = Point[][];
export type MultiPolygon = Polygon[];
const close = (ring: Point[]): Point[] =>
  distance(ring[0], ring[ring.length - 1]) < 0.001 ? ring : [...ring, ring[0]];
export function union(...polygons: MultiPolygon[]): MultiPolygon {
  const nonempty = polygons.filter((p) => p.length);
  return nonempty.length ? (clipping.union(nonempty[0], ...nonempty.slice(1)) as MultiPolygon) : [];
}
export function difference(a: MultiPolygon, b: MultiPolygon): MultiPolygon {
  return !a.length ? [] : !b.length ? a : (clipping.difference(a, b) as MultiPolygon);
}
export const polygonArea = (p: MultiPolygon) =>
  p.reduce((s, r) => s + area(r[0]) - r.slice(1).reduce((a, h) => a + area(h), 0), 0);
export function rectangle(a: Point, b: Point, lo: number, hi: number): MultiPolygon {
  const d = unit(a, b),
    n: Point = [-d[1], d[0]];
  return [
    [close([add(a, mul(n, lo)), add(b, mul(n, lo)), add(b, mul(n, hi)), add(a, mul(n, hi))])],
  ];
}
export function wallOutline(
  w: Wall,
  p: ArchitectProject,
  lo = -wallThickness(w) / 2,
  hi = wallThickness(w) / 2,
): MultiPolygon {
  const d = unit(w.a, w.b),
    n: Point = [-d[1], d[0]],
    corner = (at: Point, offset: number, isEnd: boolean): Point => {
      let pt = add(at, mul(n, offset));
      const neighbours = p.walls.filter(
        (o) =>
          o.id !== w.id &&
          o.levelId === w.levelId &&
          Math.abs(wallThickness(o) - wallThickness(w)) < 0.001 &&
          (distance(o.a, at) < 0.001 || distance(o.b, at) < 0.001),
      );
      if (neighbours.length !== 1) return pt;
      const o = neighbours[0],
        on = unit(o.a, o.b),
        normal: Point = [-on[1], on[0]],
        sameDirection = isEnd ? distance(o.a, at) < 0.001 : distance(o.b, at) < 0.001,
        off = offset * (sameDirection ? 1 : -1),
        hit = intersection(
          add(w.a, mul(n, offset)),
          add(w.b, mul(n, offset)),
          add(o.a, mul(normal, off)),
          add(o.b, mul(normal, off)),
          false,
        );
      if (hit && distance(hit, at) < wallThickness(w) * 8) pt = hit;
      return pt;
    };
  return [
    [
      close([
        corner(w.a, lo, false),
        corner(w.b, lo, true),
        corner(w.b, hi, true),
        corner(w.a, hi, false),
      ]),
    ],
  ];
}
export function wallAtHeight(
  w: Wall,
  p: ArchitectProject,
  h: number,
  lo = -wallThickness(w) / 2,
  hi = wallThickness(w) / 2,
) {
  let polygon = wallOutline(w, p, lo, hi);
  const d = unit(w.a, w.b);
  for (const o of p.openings.filter(
    (o) => o.wallId === w.id && h > o.sill - 0.001 && h < o.sill + o.height - 0.001,
  ))
    polygon = difference(
      polygon,
      rectangle(
        add(w.a, mul(d, o.offset - o.width / 2)),
        add(w.a, mul(d, o.offset + o.width / 2)),
        lo - 1,
        hi + 1,
      ),
    );
  return polygon;
}
export type WallSolid = {
  wallId: string;
  layerId: string;
  name: string;
  kind: "solid" | "assembly" | "void";
  hatch: string;
  levelId: string;
  polygons: MultiPolygon;
  bottom: number;
  top: number;
  volumeM3: number;
};
export function wallSolids(p: ArchitectProject): WallSolid[] {
  const solids: WallSolid[] = [];
  for (const level of p.levels) {
    const walls = p.walls
        .filter((w) => w.levelId === level.id)
        .sort((a, b) => a.id.localeCompare(b.id)),
      cuts = [
        0,
        ...walls.map((w) => w.height),
        ...p.openings
          .filter((o) => walls.some((w) => w.id === o.wallId))
          .flatMap((o) => [o.sill, o.sill + o.height]),
      ]
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) {
      const bottom = cuts[i],
        top = cuts[i + 1],
        mid = (bottom + top) / 2;
      let occupied: MultiPolygon = [];
      for (const w of walls.filter((w) => w.height >= top - 0.001)) {
        let offset = -wallThickness(w) / 2;
        for (const layer of w.layers) {
          const raw = wallAtHeight(w, p, mid, offset, offset + layer.thickness),
            polygons = difference(raw, occupied);
          occupied = union(occupied, raw);
          offset += layer.thickness;
          if (polygons.length)
            solids.push({
              wallId: w.id,
              layerId: layer.id,
              name: layer.name,
              kind: layer.kind,
              hatch: layer.hatch,
              levelId: level.id,
              polygons,
              bottom: bottom + level.elevation,
              top: top + level.elevation,
              volumeM3: (polygonArea(polygons) * (top - bottom)) / 1e9,
            });
        }
      }
    }
  }
  return solids;
}
export function rooms(p: ArchitectProject, levelId: string) {
  const joined = union(
      ...p.walls.filter((w) => w.levelId === levelId).map((w) => wallOutline(w, p)),
    ),
    result = [];
  for (const poly of joined)
    for (const closed of poly.slice(1)) {
      const ring = closed.slice(0, -1),
        center: Point = [
          ring.reduce((s, p) => s + p[0], 0) / ring.length,
          ring.reduce((s, p) => s + p[1], 0) / ring.length,
        ],
        tag = p.roomTags.find((t) => t.levelId === levelId && pointInPolygon(t.point, ring));
      result.push({
        id:
          tag?.id ??
          "room-" +
            ring
              .map((p) => p.map((v) => Math.round(v)).join(","))
              .sort()
              .join(";"),
        name: tag?.name ?? "ROOM " + (result.length + 1),
        point: tag?.point ?? center,
        ring,
        areaM2: area(ring) / 1e6,
        perimeterM: perimeter(ring) / 1000,
        height: p.levels.find((l) => l.id === levelId)!.height,
      });
    }
  return result;
}
export type RoofFace = { points: Point[]; heights: number[]; edge: number };
function clipHalfPlane(poly: Point[], fn: (p: Point) => number) {
  const out: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      va = fn(a),
      vb = fn(b);
    if (va <= 0.001) out.push(a);
    if (va < 0 !== vb < 0) {
      const t = va / (va - vb);
      out.push(add(a, mul(sub(b, a), t)));
    }
  }
  return out.filter((pt, i) => distance(pt, out[(i + out.length - 1) % out.length]) > 0.001);
}
export function roofFaces(r: Roof): RoofFace[] {
  const orientation = Math.sign(
      r.points.reduce((s, a, i) => s + cross(a, r.points[(i + 1) % r.points.length]), 0),
    ),
    normals = r.points.map((a, i) => {
      const d = unit(a, r.points[(i + 1) % r.points.length]);
      return mul([-d[1], d[0]], orientation);
    }),
    foot = r.points.map((a, i) => {
      const prev = (i + r.points.length - 1) % r.points.length;
      return (
        intersection(
          add(r.points[prev], mul(normals[prev], -r.eaves)),
          add(a, mul(normals[prev], -r.eaves)),
          add(a, mul(normals[i], -r.eaves)),
          add(r.points[(i + 1) % r.points.length], mul(normals[i], -r.eaves)),
          false,
        ) ?? a
      );
    }),
    planes = r.edges
      .map((e, i) => {
        const k = Math.tan((e.pitch * Math.PI) / 180);
        return {
          edge: i,
          gable: e.gable,
          fn: (p: Point) =>
            ((p[0] - r.points[i][0]) * normals[i][0] + (p[1] - r.points[i][1]) * normals[i][1]) * k,
        };
      })
      .filter((p) => !p.gable),
    result: RoofFace[] = [];
  for (const pl of planes) {
    let poly = foot;
    for (const other of planes)
      if (other !== pl) {
        const same = [
          [0, 0],
          [1000, 0],
          [0, 1000],
        ].every((pt) => Math.abs(pl.fn(pt as Point) - other.fn(pt as Point)) < 1e-8);
        if (same) {
          if (pl.edge > other.edge) {
            poly = [];
            break;
          }
        } else poly = clipHalfPlane(poly, (p) => pl.fn(p) - other.fn(p));
      }
    if (poly.length >= 3 && area(poly) > 1)
      result.push({ points: poly, heights: poly.map(pl.fn), edge: pl.edge });
  }
  return result;
}
export function designQuantities(p: ArchitectProject) {
  const solids = wallSolids(p),
    rows = p.walls.flatMap((w) =>
      w.layers
        .filter((l) => l.kind !== "void")
        .map((l) => {
          const pieces = solids.filter((s) => s.wallId === w.id && s.layerId === l.id),
            envelope = pieces.reduce((s, v) => s + v.volumeM3, 0),
            areaM2 = envelope / (l.thickness / 1000),
            materialVolumeM3 = l.kind === "solid" ? envelope : null,
            weightKg =
              materialVolumeM3 !== null && l.densityKgM3 !== null
                ? materialVolumeM3 * l.densityKgM3
                : null;
          return {
            id: `${w.id}/${l.id}`,
            wallId: w.id,
            layerId: l.id,
            name: `${w.name} / ${l.name}`,
            areaM2,
            materialVolumeM3,
            weightKg,
            allowancePercent: l.wastePercent,
            orderAreaM2: areaM2 * (1 + l.wastePercent / 100),
            cost: l.rateM2 === null ? null : areaM2 * (1 + l.wastePercent / 100) * l.rateM2,
            supplierReference: l.supplierReference,
            rateRevision: l.rateRevision,
          };
        }),
    );
  for (const slab of p.slabs) {
    const areaM2 = area(slab.points) / 1e6;
    rows.push({
      id: slab.id,
      wallId: slab.id,
      layerId: "slab",
      name: slab.name + " / " + slab.material,
      areaM2,
      materialVolumeM3: (areaM2 * slab.thickness) / 1000,
      weightKg: null,
      allowancePercent: 0,
      orderAreaM2: areaM2,
      cost: null,
      supplierReference: "",
      rateRevision: "",
    });
  }
  for (const roof of p.roofs) {
    let areaM2 = 0;
    for (const face of roofFaces(roof))
      for (let i = 1; i < face.points.length - 1; i++) {
        const a = [
            face.points[i][0] - face.points[0][0],
            face.points[i][1] - face.points[0][1],
            face.heights[i] - face.heights[0],
          ],
          b = [
            face.points[i + 1][0] - face.points[0][0],
            face.points[i + 1][1] - face.points[0][1],
            face.heights[i + 1] - face.heights[0],
          ];
        areaM2 +=
          Math.hypot(
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0],
          ) / 2e6;
      }
    rows.push({
      id: roof.id,
      wallId: roof.id,
      layerId: "roof",
      name: roof.name + " / covering build-up unspecified",
      areaM2,
      materialVolumeM3: null,
      weightKg: null,
      allowancePercent: 0,
      orderAreaM2: areaM2,
      cost: null,
      supplierReference: "",
      rateRevision: "",
    });
  }
  for (const roof of p.roofs)
    for (const kind of ["fascia", "gutter"] as const) {
      const parts = roofTrims(roof).filter((t) => t.kind === kind);
      if (!parts.length) continue;
      const areaM2 = parts.reduce((s, t) => s + t.areaM2, 0),
        volume = parts.reduce((s, t) => s + t.volumeM3, 0);
      rows.push({
        id: roof.id + "/" + kind,
        wallId: roof.id,
        layerId: kind,
        name: roof.name + " / " + kind + " authored profile",
        areaM2,
        materialVolumeM3: volume,
        weightKg: null,
        allowancePercent: 0,
        orderAreaM2: areaM2,
        cost: null,
        supplierReference: "",
        rateRevision: "",
      });
    }
  return {
    rows,
    knownVolumeM3: rows.reduce((s, r) => s + (r.materialVolumeM3 ?? 0), 0),
    unknownVolume: rows.filter((r) => r.materialVolumeM3 === null).length,
    knownWeightKg: rows.reduce((s, r) => s + (r.weightKg ?? 0), 0),
    unknownWeight: rows.filter((r) => r.weightKg === null).length,
    knownCost: rows.reduce((s, r) => s + (r.cost ?? 0), 0),
    unpriced: rows.filter((r) => r.cost === null).length,
  };
}
export type RoofTrim = {
  kind: "fascia" | "gutter";
  faces: [number, number, number][][];
  areaM2: number;
  volumeM3: number;
};
// Profiles are authored nominal dimensions, not inferred supplier specifications.
export function roofTrims(r: Roof): RoofTrim[] {
  const out: RoofTrim[] = [],
    seen = new Set<string>(),
    orientation = Math.sign(
      r.points.reduce((s, a, i) => s + cross(a, r.points[(i + 1) % r.points.length]), 0),
    );
  for (const f of roofFaces(r))
    for (let i = 0; i < f.points.length; i++) {
      const j = (i + 1) % f.points.length,
        a = f.points[i],
        b = f.points[j];
      if (distance(a, b) < 0.01) continue;
      let edge = -1,
        normal: Point = [0, 0];
      for (let k = 0; k < r.points.length; k++) {
        const u = unit(r.points[k], r.points[(k + 1) % r.points.length]),
          n = mul([-u[1], u[0]], orientation),
          d = (p: Point) => (p[0] - r.points[k][0]) * n[0] + (p[1] - r.points[k][1]) * n[1];
        if (Math.abs(d(a) + r.eaves) < 0.01 && Math.abs(d(b) + r.eaves) < 0.01) {
          edge = k;
          normal = mul(n, -1);
          break;
        }
      }
      if (edge < 0) continue;
      const key = [a, b]
        .map((p) => p.map((n) => n.toFixed(3)).join(","))
        .sort()
        .join("/");
      if (seen.has(key)) continue;
      seen.add(key);
      const ha = f.heights[i],
        hb = f.heights[j],
        length = distance(a, b),
        prism = (
          lo: number,
          hi: number,
          bottom: number,
          top: number,
          kind: "fascia" | "gutter",
        ) => {
          const corner = (
              p: Point,
              h: number,
              off: number,
              y: number,
            ): [number, number, number] => {
              let shifted = add(p, mul(normal, off));
              for (let k = 0; k < r.points.length; k++) {
                if (k === edge) continue;
                const c = r.points[k],
                  d = r.points[(k + 1) % r.points.length],
                  u = unit(c, d),
                  n = mul([u[1], -u[0]], orientation),
                  signed = (p[0] - c[0]) * n[0] + (p[1] - c[1]) * n[1];
                if (Math.abs(signed - r.eaves) < 0.01) {
                  const hit = intersection(
                    add(a, mul(normal, off)),
                    add(b, mul(normal, off)),
                    add(c, mul(n, r.eaves + off)),
                    add(d, mul(n, r.eaves + off)),
                    false,
                  );
                  if (hit && distance(hit, p) < Math.max(r.gutterWidth, r.fasciaThickness) * 8)
                    shifted = hit;
                }
              }
              return [shifted[0], h + y, shifted[1]];
            },
            v = [
              corner(a, ha, lo, bottom),
              corner(a, ha, hi, bottom),
              corner(a, ha, hi, top),
              corner(a, ha, lo, top),
              corner(b, hb, lo, bottom),
              corner(b, hb, hi, bottom),
              corner(b, hb, hi, top),
              corner(b, hb, lo, top),
            ],
            faces = [
              [0, 3, 2, 1],
              [4, 5, 6, 7],
              [0, 1, 5, 4],
              [3, 7, 6, 2],
              [0, 4, 7, 3],
              [1, 2, 6, 5],
            ].map((indices) => indices.map((i) => v[i]));
          let volume = 0;
          for (const face of faces)
            for (let i = 1; i < face.length - 1; i++) {
              const a = face[0],
                b = face[i],
                c = face[i + 1];
              volume +=
                (a[0] * (b[1] * c[2] - b[2] * c[1]) +
                  a[1] * (b[2] * c[0] - b[0] * c[2]) +
                  a[2] * (b[0] * c[1] - b[1] * c[0])) /
                6;
            }
          const volumeM3 = Math.abs(volume) / 1e9;
          out.push({
            kind,
            faces,
            areaM2: volumeM3 / ((kind === "fascia" ? r.fasciaThickness : r.gutterThickness) / 1000),
            volumeM3,
          });
        };
      if (r.fasciaHeight > 0)
        prism(-r.fasciaThickness / 2, r.fasciaThickness / 2, -r.fasciaHeight, 0, "fascia");
      if (r.gutterEnabled && !r.edges[edge].gable) {
        const off = r.fasciaThickness / 2,
          t = r.gutterThickness,
          w = r.gutterWidth,
          d = r.gutterDepth;
        prism(off, off + w, -d, -d + t, "gutter");
        prism(off, off + t, -d + t, 0, "gutter");
        prism(off + w - t, off + w, -d + t, 0, "gutter");
      }
    }
  return out;
}
