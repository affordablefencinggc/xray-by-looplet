import {
  add,
  sub,
  mul,
  unit,
  distance,
  intersection,
  projectPoint,
  cross,
  type Point,
  type ArchitectProject,
} from "./model.ts";
export type SnapKind =
  "endpoint" | "midpoint" | "center" | "intersection" | "perpendicular" | "tangent" | "extension";
export const SNAP_KINDS: SnapKind[] = [
  "endpoint",
  "midpoint",
  "center",
  "intersection",
  "perpendicular",
  "tangent",
  "extension",
];
export function snapPoint(
  p: Point,
  project: ArchitectProject,
  levelId: string,
  tolerance: number,
  kinds: SnapKind[],
  anchor: Point | null = null,
) {
  const candidates: { point: Point; kind: SnapKind }[] = [],
    segments = [...project.walls, ...project.lines].filter((e) => e.levelId === levelId),
    push = (point: Point, kind: SnapKind) => {
      if (kinds.includes(kind) && distance(point, p) <= tolerance) candidates.push({ point, kind });
    };
  for (const e of segments) {
    push(e.a, "endpoint");
    push(e.b, "endpoint");
    push(mul(add(e.a, e.b), 0.5), "midpoint");
    const foot = projectPoint(p, e.a, e.b, false);
    if (distance(e.a, foot) + distance(foot, e.b) > distance(e.a, e.b) + 0.01)
      push(foot, "extension");
    if (anchor) push(projectPoint(anchor, e.a, e.b, false), "perpendicular");
  }
  for (let i = 0; i < segments.length; i++)
    for (let j = i + 1; j < segments.length; j++) {
      const hit = intersection(segments[i].a, segments[i].b, segments[j].a, segments[j].b);
      if (hit) push(hit, "intersection");
    }
  const circles: {
      center: Point;
      radius: number;
      startAngle?: number;
      endAngle?: number;
      clockwise?: boolean;
    }[] = [...project.circles, ...project.arcs].filter((c) => c.levelId === levelId),
    inArc = (c: (typeof circles)[number], pt: Point) => {
      if (c.startAngle === undefined || c.endAngle === undefined) return true;
      const normalize = (n: number) => ((n % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
        angle = Math.atan2(pt[1] - c.center[1], pt[0] - c.center[0]);
      return c.clockwise
        ? normalize(c.startAngle - angle) <= normalize(c.startAngle - c.endAngle) + 1e-7
        : normalize(angle - c.startAngle) <= normalize(c.endAngle - c.startAngle) + 1e-7;
    };
  for (const c of circles) {
    push(c.center, "center");
    if (c.startAngle !== undefined && c.endAngle !== undefined)
      for (const angle of [c.startAngle, c.endAngle])
        push(add(c.center, [Math.cos(angle) * c.radius, Math.sin(angle) * c.radius]), "endpoint");
    if (anchor) {
      const d = distance(anchor, c.center),
        angle = Math.atan2(anchor[1] - c.center[1], anchor[0] - c.center[0]);
      if (d > 0.001) {
        for (const sign of [1, -1]) {
          const pt = add(c.center, [
            Math.cos(angle) * c.radius * sign,
            Math.sin(angle) * c.radius * sign,
          ]);
          if (inArc(c, pt)) push(pt, "perpendicular");
        }
      }
      if (d > c.radius) {
        const delta = Math.acos(c.radius / d);
        for (const a of [angle + delta, angle - delta]) {
          const pt = add(c.center, [Math.cos(a) * c.radius, Math.sin(a) * c.radius]);
          if (inArc(c, pt)) push(pt, "tangent");
        }
      }
    }
    for (const segment of segments) {
      const v = sub(segment.b, segment.a),
        q = sub(segment.a, c.center),
        A = v[0] ** 2 + v[1] ** 2,
        B = 2 * (q[0] * v[0] + q[1] * v[1]),
        C = q[0] ** 2 + q[1] ** 2 - c.radius ** 2,
        discriminant = B * B - 4 * A * C;
      if (discriminant >= 0)
        for (const sign of [-1, 1]) {
          const t = (-B + sign * Math.sqrt(discriminant)) / (2 * A);
          if (t >= 0 && t <= 1) {
            const pt = add(segment.a, mul(v, t));
            if (inArc(c, pt)) push(pt, "intersection");
          }
        }
    }
  }
  for (let i = 0; i < circles.length; i++)
    for (let j = i + 1; j < circles.length; j++) {
      const a = circles[i],
        b = circles[j],
        d = distance(a.center, b.center);
      if (d < 0.001 || d > a.radius + b.radius || d < Math.abs(a.radius - b.radius)) continue;
      const along = (a.radius * a.radius - b.radius * b.radius + d * d) / (2 * d),
        height = Math.sqrt(Math.max(0, a.radius * a.radius - along * along)),
        u = unit(a.center, b.center),
        mid = add(a.center, mul(u, along));
      for (const sign of [-1, 1]) {
        const pt = add(mid, mul([-u[1], u[0]], height * sign));
        if (inArc(a, pt) && inArc(b, pt)) push(pt, "intersection");
      }
    }
  // An extension is a guide, not a connection. Near an existing endpoint,
  // prefer joining it even when the pointer is closer to its extended line.
  const hasEndpoint = candidates.some(candidate => candidate.kind === "endpoint");
  return (
    candidates.filter(candidate => !hasEndpoint || candidate.kind !== "extension")
      .sort((a, b) => distance(a.point, p) - distance(b.point, p))[0] ?? {
      point: p,
      kind: null,
    }
  );
}
export function constrainPoint(
  anchor: Point,
  p: Point,
  mode: "free" | "ortho" | "polar",
  angleDegrees: number,
  lengthMm: number | null = null,
): Point {
  if (
    mode === "polar" &&
    (!Number.isFinite(angleDegrees) || angleDegrees <= 0 || angleDegrees > 180)
  )
    throw Error("Polar angle must be greater than 0 and at most 180 degrees.");
  const v = sub(p, anchor),
    angle = Math.atan2(v[1], v[0]),
    step = ((mode === "ortho" ? 90 : angleDegrees) * Math.PI) / 180,
    a = mode === "free" ? angle : Math.round(angle / step) * step,
    len = lengthMm ?? distance(anchor, p);
  return [anchor[0] + Math.cos(a) * len, anchor[1] + Math.sin(a) * len];
}
export function offsetSegment(a: Point, b: Point, offset: number) {
  const d = unit(a, b),
    normal: Point = [-d[1], d[0]];
  return { a: add(a, mul(normal, offset)), b: add(b, mul(normal, offset)) };
}
export function mirrorPoint(p: Point, a: Point, b: Point): Point {
  return sub(mul(projectPoint(p, a, b, false), 2), p);
}
export function trimSegment(a: Point, b: Point, c: Point, d: Point, keep: Point) {
  const cut = intersection(a, b, c, d);
  if (!cut) throw Error("The trim boundary must cross the selected segment.");
  return distance(keep, a) < distance(keep, b) ? { a, b: cut } : { a: cut, b };
}
export function extendSegment(a: Point, b: Point, c: Point, d: Point) {
  const hit = intersection(a, b, c, d, false);
  if (!hit) throw Error("Parallel segments cannot meet.");
  if (distance(a, hit) + distance(hit, b) <= distance(a, b) + 0.001)
    throw Error("The intersection is already inside the selected segment.");
  return distance(a, hit) < distance(b, hit) ? { a: hit, b } : { a, b: hit };
}
// Tangential circular fillet between two intersecting reference segments.
export function fillet(a: Point, b: Point, c: Point, d: Point, radius: number) {
  const corner = intersection(a, b, c, d, false);
  if (!corner || radius <= 0) throw Error("Fillet needs intersecting lines and a positive radius.");
  const end1 = distance(a, corner) > distance(b, corner) ? a : b,
    end2 = distance(c, corner) > distance(d, corner) ? c : d,
    u = unit(corner, end1),
    v = unit(corner, end2),
    angle = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1])));
  if (angle < 0.01 || Math.abs(Math.PI - angle) < 0.01)
    throw Error("These lines do not form a fillet corner.");
  const run = radius / Math.tan(angle / 2);
  if (run > Math.min(distance(corner, end1), distance(corner, end2)))
    throw Error("Radius is too large for these segments.");
  const tangent1 = add(corner, mul(u, run)),
    tangent2 = add(corner, mul(v, run)),
    bisector = mul(add(u, v), 1 / distance([0, 0], add(u, v))),
    center = add(corner, mul(bisector, radius / Math.sin(angle / 2)));
  return {
    a: end1,
    b: tangent1,
    c: tangent2,
    d: end2,
    center,
    radius,
    startAngle: Math.atan2(tangent1[1] - center[1], tangent1[0] - center[0]),
    endAngle: Math.atan2(tangent2[1] - center[1], tangent2[0] - center[0]),
    clockwise: cross(sub(tangent1, center), sub(tangent2, center)) < 0,
  };
}
