import {
  add,
  mul,
  sub,
  unit,
  distance,
  wallThickness,
  intersection,
  pointInPolygon,
  type Point,
  type ArchitectProject,
} from "./model.ts";
import {
  wallAtHeight,
  wallOutline,
  wallSolids,
  rooms,
  roofFaces,
  roofTrims,
  type MultiPolygon,
} from "./geometry.ts";
export type View = "plan" | "north" | "south" | "east" | "west" | "section" | "schedule";
export type Primitive = {
  kind: "path" | "line" | "circle" | "text" | "arc";
  id?: string;
  points?: Point[];
  rings?: Point[][];
  center?: Point;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  clockwise?: boolean;
  text?: string;
  fill?: string;
  stroke?: string;
  width?: number;
  dash?: boolean;
  size?: number;
  hatch?: string;
};
export const hatchColors: Record<string, string> = {
  brick: "#d8c7b0",
  concrete: "#b9bdbe",
  timber: "#ceb998",
  insulation: "#d8dac4",
  none: "#e8e6dd",
};
export function projectBounds(p: ArchitectProject) {
  const points = [
    ...p.walls.flatMap((w) => [w.a, w.b]),
    ...p.slabs.flatMap((s) => s.points),
    ...p.roofs.flatMap((r) => r.points),
    ...p.arcs.flatMap(
      (c) =>
        [
          [c.center[0] - c.radius, c.center[1] - c.radius],
          [c.center[0] + c.radius, c.center[1] + c.radius],
        ] as Point[],
    ),
    ...p.lines.flatMap((l) => [l.a, l.b]),
    ...p.circles.flatMap(
      (c) =>
        [
          [c.center[0] - c.radius, c.center[1] - c.radius],
          [c.center[0] + c.radius, c.center[1] + c.radius],
        ] as Point[],
    ),
  ];
  return points.length
    ? {
        min: [Math.min(...points.map((p) => p[0])), Math.min(...points.map((p) => p[1]))] as Point,
        max: [Math.max(...points.map((p) => p[0])), Math.max(...points.map((p) => p[1]))] as Point,
      }
    : { min: [0, 0] as Point, max: [9000, 6000] as Point };
}
export function primitives(p: ArchitectProject, levelId: string, view: View = "plan"): Primitive[] {
  const out: Primitive[] = [],
    level = p.levels.find((l) => l.id === levelId)!,
    bounds = projectBounds(p),
    line = (a: Point, b: Point, id?: string, width = 12, dash = false) =>
      out.push({ kind: "line", points: [a, b], id, width, dash, stroke: "#414952" }),
    text = (at: Point, value: string, size = 150, id?: string) =>
      out.push({ kind: "text", center: at, text: value, size, id, fill: "#26343d" }),
    poly = (rings: Point[][], id: string, fill = "#e8e6dd", width = 12, hatch = "none") => {
      out.push({ kind: "path", rings, id, fill, stroke: "#424952", width, hatch });
      if (hatch !== "none")
        for (const pair of hatchLines(rings, hatch))
          out.push({ kind: "line", points: pair, id, stroke: "#7f8985", width: 4 });
    };
  if (view === "plan") {
    for (const s of p.slabs.filter((s) => s.levelId === levelId)) {
      poly([s.points], s.id, "#f8f6ef", 8);
      text(s.points[0], `${s.name} ${s.offset === 0 ? "" : s.offset + " mm"}`, 125, s.id);
    }
    for (const w of p.walls.filter((w) => w.levelId === levelId)) {
      let offset = -wallThickness(w) / 2;
      for (const l of w.layers) {
        const geometry = wallAtHeight(
          w,
          p,
          Math.min(1200, w.height - 0.01),
          offset,
          offset + l.thickness,
        );
        offset += l.thickness;
        for (const rings of geometry)
          poly(
            rings,
            w.id,
            l.kind === "void" ? "#fffefa" : hatchColors[l.hatch],
            l.kind === "void" ? 5 : 10,
            l.hatch,
          );
      }
    }
    for (const o of p.openings) {
      const w = p.walls.find((w) => w.id === o.wallId)!;
      if (w.levelId !== levelId) continue;
      const d = unit(w.a, w.b),
        n: Point = [-d[1], d[0]],
        a = add(w.a, mul(d, o.offset - o.width / 2)),
        b = add(a, mul(d, o.width)),
        t = wallThickness(w) / 2;
      line(add(a, mul(n, -t)), add(a, mul(n, t)), o.id, 18);
      line(add(b, mul(n, -t)), add(b, mul(n, t)), o.id, 18);
      if (o.kind === "void") {
        text(add(mul(add(a, b), 0.5), mul(n, t + 210)), `VOID ${o.tag}`, 130, o.id);
        continue;
      }
      if (o.kind === "window") {
        for (const off of [-t, 0, t]) line(add(a, mul(n, off)), add(b, mul(n, off)), o.id, 8);
      } else {
        const hinge = o.hinge === "left" ? a : b,
          dir = mul(d, o.hinge === "left" ? 1 : -1),
          swing = mul(n, o.swing === "in" ? 1 : -1),
          end = add(hinge, mul(swing, o.width)),
          startAngle = Math.atan2(dir[1], dir[0]),
          endAngle = Math.atan2(swing[1], swing[0]);
        line(hinge, end, o.id, 16);
        out.push({
          kind: "arc",
          id: o.id,
          center: hinge,
          radius: o.width,
          startAngle,
          endAngle,
          clockwise: dir[0] * swing[1] - dir[1] * swing[0] < 0,
          stroke: "#7c8589",
          width: 8,
        });
      }
      text(add(mul(add(a, b), 0.5), mul(n, t + 210)), o.tag, 130, o.id);
    }
    for (const r of rooms(p, levelId)) {
      text(r.point, r.name, 190, r.id);
      text(
        add(r.point, [0, 210]),
        `${r.areaM2.toFixed(2)} m² | P ${r.perimeterM.toFixed(2)} m`,
        125,
        r.id,
      );
      text(add(r.point, [0, 390]), `CL ${(r.height / 1000).toFixed(3)} m`, 115, r.id);
    }
    for (const d of p.dimensions) {
      const w = p.walls.find((w) => w.id === d.wallId)!;
      if (w.levelId !== levelId) continue;
      const dir = unit(w.a, w.b),
        n: Point = [-dir[1], dir[0]],
        a = add(w.a, mul(n, d.offset)),
        b = add(w.b, mul(n, d.offset));
      line(w.a, add(a, mul(n, 100)), d.id, 6);
      line(w.b, add(b, mul(n, 100)), d.id, 6);
      line(a, b, d.id, 7);
      for (const at of [a, b]) line(add(at, [-60, 60]), add(at, [60, -60]), d.id, 14);
      text(add(mul(add(a, b), 0.5), mul(n, 150)), distance(w.a, w.b).toFixed(0), 130, d.id);
    }
    for (const l of p.lines.filter((l) => l.levelId === levelId)) line(l.a, l.b, l.id, 12);
    for (const c of p.circles.filter((c) => c.levelId === levelId))
      out.push({
        kind: "circle",
        id: c.id,
        center: c.center,
        radius: c.radius,
        stroke: "#586773",
        width: 10,
      });
    for (const a of p.arcs.filter((a) => a.levelId === levelId))
      out.push({
        kind: "arc",
        id: a.id,
        center: a.center,
        radius: a.radius,
        startAngle: a.startAngle,
        endAngle: a.endAngle,
        clockwise: a.clockwise,
        stroke: "#586773",
        width: 12,
      });
    for (const g of p.grids) {
      const a: Point =
          g.axis === "x" ? [g.position, bounds.min[1] - 1000] : [bounds.min[0] - 1000, g.position],
        b: Point =
          g.axis === "x" ? [g.position, bounds.max[1] + 1000] : [bounds.max[0] + 1000, g.position];
      line(a, b, g.id, 5, true);
      out.push({
        kind: "circle",
        id: g.id,
        center: a,
        radius: 160,
        stroke: "#7c868e",
        width: 6,
        fill: "#fffefa",
      });
      text(add(a, [0, 45]), g.label, 140, g.id);
    }
    line(p.section.a, p.section.b, "section", 18, true);
    text(add(p.section.a, [0, -180]), "A", 170, "section");
    text(add(p.section.b, [0, -180]), "A", 170, "section");
    return out;
  }
  if (view === "section") {
    const dir = unit(p.section.a, p.section.b),
      length = distance(p.section.a, p.section.b),
      toS = (pt: Point) => (pt[0] - p.section.a[0]) * dir[0] + (pt[1] - p.section.a[1]) * dir[1],
      intervals = (polys: MultiPolygon) => {
        const cuts = [0, length];
        for (const poly of polys)
          for (const ring of poly)
            for (let i = 0; i < ring.length - 1; i++) {
              const hit = intersection(p.section.a, p.section.b, ring[i], ring[i + 1]);
              if (hit) cuts.push(toS(hit));
            }
        cuts.sort((a, b) => a - b);
        const segments: Point[] = [];
        for (let i = 0; i < cuts.length - 1; i++) {
          const a = cuts[i],
            b = cuts[i + 1],
            mid = add(p.section.a, mul(dir, (a + b) / 2));
          if (
            b - a > 0.001 &&
            polys.some(
              (poly) =>
                pointInPolygon(mid, poly[0]) && !poly.slice(1).some((h) => pointInPolygon(mid, h)),
            )
          )
            segments.push([a, b]);
        }
        return segments;
      };
    for (const s of wallSolids(p).filter((s) => s.kind !== "void"))
      for (const [a, b] of intervals(s.polygons))
        poly(
          [
            [
              [a, -s.top],
              [b, -s.top],
              [b, -s.bottom],
              [a, -s.bottom],
            ],
          ],
          s.wallId,
          hatchColors[s.hatch],
          16,
          s.hatch,
        );
    for (const s of p.slabs) {
      const y = p.levels.find((l) => l.id === s.levelId)!.elevation + s.offset;
      for (const [a, b] of intervals([[s.points.concat([s.points[0]])]]))
        poly(
          [
            [
              [a, -y],
              [b, -y],
              [b, -y + s.thickness],
              [a, -y + s.thickness],
            ],
          ],
          s.id,
          hatchColors.concrete,
          16,
          "concrete",
        );
    }
    for (const r of p.roofs) {
      const base = p.levels.find((l) => l.id === r.levelId)!.elevation + r.offset;
      for (const f of roofFaces(r)) {
        const hits: Point[] = [];
        for (let i = 0; i < f.points.length; i++) {
          const j = (i + 1) % f.points.length,
            h = intersection(p.section.a, p.section.b, f.points[i], f.points[j]);
          if (h) {
            const t = distance(f.points[i], h) / distance(f.points[i], f.points[j]);
            hits.push([toS(h), -base - f.heights[i] - (f.heights[j] - f.heights[i]) * t]);
          }
        }
        if (hits.length >= 2) line(hits[0], hits[hits.length - 1], r.id, 24);
      }
    }
    for (const roof of p.roofs) {
      const base = p.levels.find((l) => l.id === roof.levelId)!.elevation + roof.offset;
      for (const trim of roofTrims(roof)) {
        const hits: Point[] = [],
          signed = (p: [number, number, number]) =>
            (p[0] - pSection[0]) * dir[1] - (p[2] - pSection[1]) * dir[0],
          pSection = p.section.a;
        for (const face of trim.faces)
          for (let i = 0; i < face.length; i++) {
            const a = face[i],
              b = face[(i + 1) % face.length],
              va = signed(a),
              vb = signed(b);
            if (Math.abs(va) < 0.001) hits.push([toS([a[0], a[2]]), -base - a[1]]);
            if (va * vb < 0) {
              const t = va / (va - vb);
              hits.push([
                toS([a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t]),
                -base - a[1] - (b[1] - a[1]) * t,
              ]);
            }
          }
        const ring = convexHull(hits);
        if (ring.length >= 3) poly([ring], roof.id, "#9fa9a5", 5);
      }
    }
    for (const l of p.levels) {
      line([0, -l.elevation], [length, -l.elevation], undefined, 5, true);
      text([length + 150, -l.elevation], `${l.name} FFL ${(l.elevation / 1000).toFixed(3)}`, 140);
      line([0, -l.elevation - l.height], [length, -l.elevation - l.height], undefined, 5, true);
    }
    text([length / 2, 800], "SECTION A–A / modelled assemblies only", 190);
    return out;
  }
  if (view === "schedule") return schedulePrimitives(p, levelId);
  const horizontal = (pt: Point) =>
      view === "north" ? -pt[0] : view === "south" ? pt[0] : view === "east" ? -pt[1] : pt[1],
    depth = (pt: Point) =>
      view === "north" ? pt[1] : view === "south" ? -pt[1] : view === "east" ? -pt[0] : pt[0];
  for (const w of [...p.walls].sort((a, b) => depth(b.a) - depth(a.a))) {
    const y = p.levels.find((l) => l.id === w.levelId)!.elevation,
      x1 = horizontal(w.a),
      x2 = horizontal(w.b);
    if (Math.abs(x2 - x1) < 1) continue;
    poly(
      [
        [
          [x1, -y],
          [x2, -y],
          [x2, -y - w.height],
          [x1, -y - w.height],
        ],
      ],
      w.id,
      "#ece9df",
      10,
    );
    for (const o of p.openings.filter((o) => o.wallId === w.id)) {
      const dir = unit(w.a, w.b),
        a = horizontal(add(w.a, mul(dir, o.offset - o.width / 2))),
        b = horizontal(add(w.a, mul(dir, o.offset + o.width / 2)));
      poly(
        [
          [
            [a, -y - o.sill],
            [b, -y - o.sill],
            [b, -y - o.sill - o.height],
            [a, -y - o.sill - o.height],
          ],
        ],
        o.id,
        o.kind === "void" ? "#ffffff" : o.kind === "window" ? "#b5c6c8" : "#d3d7d2",
        9,
      );
      text([(a + b) / 2, -y - o.sill - o.height / 2], o.kind === "void" ? `VOID ${o.tag}` : o.tag, 130, o.id);
    }
  }
  for (const r of p.roofs) {
    const y = p.levels.find((l) => l.id === r.levelId)!.elevation + r.offset;
    for (const f of roofFaces(r))
      poly(
        [f.points.map((pt, i) => [horizontal(pt), -y - f.heights[i]] as Point)],
        r.id,
        "#adb3b5",
        10,
      );
  }
  for (const roof of p.roofs) {
    const base = p.levels.find((l) => l.id === roof.levelId)!.elevation + roof.offset;
    for (const trim of roofTrims(roof))
      for (const face of trim.faces)
        poly(
          [face.map((pt) => [horizontal([pt[0], pt[2]]), -base - pt[1]] as Point)],
          roof.id,
          "#a5adaa",
          5,
        );
  }
  const min = Math.min(...[bounds.min, bounds.max].map(horizontal)) - 500,
    max = Math.max(...[bounds.min, bounds.max].map(horizontal)) + 500;
  for (const l of p.levels) {
    line([min, -l.elevation], [max, -l.elevation], undefined, 5, true);
    text([max + 450, -l.elevation], `${l.name} +${(l.elevation / 1000).toFixed(3)}`, 140);
  }
  text([(min + max) / 2, 800], view.toUpperCase() + " ELEVATION", 190);
  return out;
}

/**
 * The door and window schedule (SC-02): the table a drawing set carries beside its plans.
 *
 * It is emitted as the primitives it is — a title, a heading rule and one row per opening on the level — so
 * it prints through the same path as every other view and needs no second renderer. Sizes are model units
 * like the rest of a viewport's content, so the viewport's own scale governs how large the table prints;
 * the renderer's 5.5 pt floor keeps a small scale legible rather than silently vanishing.
 */
export function schedulePrimitives(p: ArchitectProject, levelId: string): Primitive[] {
  const out: Primitive[] = [],
    level = p.levels.find((l) => l.id === levelId),
    bounds = projectBounds(p),
    line = (a: Point, b: Point, id?: string, width = 12) =>
      out.push({ kind: "line", points: [a, b], id, width, stroke: "#414952" }),
    text = (at: Point, value: string, size = 150, id?: string) =>
      out.push({ kind: "text", center: at, text: value, size, id, fill: "#26343d" });

  const wallIds = new Set(p.walls.filter((w) => w.levelId === levelId).map((w) => w.id));
  const openings = p.openings.filter((o) => wallIds.has(o.wallId));
  const host = (wallId: string) => p.walls.find((w) => w.id === wallId)?.layers[0]?.name ?? wallId;
  /* The table is laid out for a 1:50 viewport — the scale a schedule is drawn at — and its footprint is
     sized so that the whole of it lands inside an A3 viewport at that scale: 20 000 model units is 400 mm
     on paper there, and a column pair either side of that would be clipped away by the viewport the
     renderer sets, which is exactly the failure this replaced. A viewport at a smaller scale prints the
     same table larger; the emission does not depend on the paper. */
  const columns = [2000, 6500, 11000, 15000, 18000],
    head = ["TAG", "TYPE", "SIZE (mm)", "SILL (mm)", "HOST WALL"],
    rowGap = 260,
    left = bounds.min[0],
    top = bounds.max[1];

  text([left + 10000, top], `DOOR & WINDOW SCHEDULE — ${level?.name ?? levelId}`, 190, "schedule-title");
  head.forEach((value, i) => text([left + columns[i], top - 520], value, 150, `schedule-head-${i}`));
  line([left, top - 620], [left + 20000, top - 620], "schedule-rule", 6);

  if (!openings.length) {
    text([left + 10000, top - 900], "No doors or windows are recorded on this level.", 150, "schedule-empty");
    return out;
  }
  openings.forEach((o, n) => {
    const cells = [o.tag, o.kind.toUpperCase(), `${o.width} × ${o.height}`, String(o.sill), host(o.wallId)];
    cells.forEach((value, i) =>
      text([left + columns[i], top - 900 - n * rowGap], value, 140, `schedule-${o.id}-${i}`),
    );
  });
  return out;
}
export function arcPath(p: Primitive) {
  const c = p.center!,
    r = p.radius!,
    a = p.startAngle!,
    b = p.endAngle!,
    start = add(c, [Math.cos(a) * r, Math.sin(a) * r]),
    end = add(c, [Math.cos(b) * r, Math.sin(b) * r]);
  let delta = p.clockwise ? a - b : b - a;
  while (delta < 0) delta += Math.PI * 2;
  return `M ${start[0]} ${start[1]} A ${r} ${r} 0 ${delta > Math.PI ? 1 : 0} ${p.clockwise ? 0 : 1} ${end[0]} ${end[1]}`;
}
export function ringsPath(rings: Point[][]) {
  return rings.map((r) => "M " + r.map((p) => p.join(" ")).join(" L ") + " Z").join(" ");
}

export function hatchLines(rings: Point[][], kind: string): Point[][] {
  const all = rings.flat(),
    minX = Math.min(...all.map((p) => p[0])),
    maxX = Math.max(...all.map((p) => p[0])),
    minY = Math.min(...all.map((p) => p[1])),
    maxY = Math.max(...all.map((p) => p[1])),
    diagonal = kind !== "brick",
    low = diagonal ? minY - maxX : minY,
    high = diagonal ? maxY - minX : maxY,
    spacing = Math.max(kind === "insulation" ? 70 : 120, (high - low) / 350),
    result: Point[][] = [];
  for (let k = Math.floor(low / spacing) * spacing; k <= high; k += spacing) {
    const a: Point = [minX - 1, diagonal ? minX - 1 + k : k],
      b: Point = [maxX + 1, diagonal ? maxX + 1 + k : k],
      hits: Point[] = [];
    for (const ring of rings)
      for (let i = 0; i < ring.length; i++) {
        const h = intersection(a, b, ring[i], ring[(i + 1) % ring.length]);
        if (h && !hits.some((p) => distance(h, p) < 0.001)) hits.push(h);
      }
    hits.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < hits.length - 1; i++) {
      const mid = mul(add(hits[i], hits[i + 1]), 0.5);
      if (pointInPolygon(mid, rings[0]) && !rings.slice(1).some((h) => pointInPolygon(mid, h)))
        result.push([hits[i], hits[i + 1]]);
    }
  }
  return result;
}

function convexHull(input: Point[]) {
  const points = input
    .filter((p, i) => !input.slice(0, i).some((q) => distance(p, q) < 0.001))
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (points.length < 3) return points;
  const turn = (a: Point, b: Point, c: Point) =>
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    half = (pts: Point[]) => {
      const out: Point[] = [];
      for (const p of pts) {
        while (out.length >= 2 && turn(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
        out.push(p);
      }
      return out.slice(0, -1);
    };
  return [...half(points), ...half([...points].reverse())];
}
