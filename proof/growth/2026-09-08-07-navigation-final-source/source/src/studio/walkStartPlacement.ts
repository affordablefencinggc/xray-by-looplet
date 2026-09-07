import type { BuildingPart, SourceBuilding } from "./sourceBuilding.ts";

export type WalkFloor = { id: string; label: string; elevation: number };
export type WalkPlacement = { x: number; z: number; elevation: number; level: string; yaw: number;
  supportId: string; label: string; clearView: number; inferred: true };
export type WalkAssessment = { ok: true; placement: WalkPlacement } | { ok: false; reason: string };
type V3 = [number, number, number];
type P2 = { x: number; z: number };
type Triangle = { a: V3; b: V3; c: V3; part: BuildingPart; minY: number; maxY: number };
const BODY_RADIUS = .3, HEAD_HEIGHT = 1.85, EYE_HEIGHT = 1.65, EPS = 1e-7;
const levelOf = (part: BuildingPart) => part.storey ?? part.level;

/** Only levels with explicit elevations and geometry can supply a walking start. */
export function listWalkFloors(model: SourceBuilding): WalkFloor[] {
  const floors = model.storeys ?? (model.floorElevations ? [
    { id: "ground", label: "Ground floor", elevation: model.floorElevations.ground },
    { id: "upper", label: "Upper floor", elevation: model.floorElevations.upper },
  ] : []);
  return floors.filter(f => Number.isFinite(f.elevation) && model.objects.some(p => levelOf(p) === f.id));
}
function triangles(part: BuildingPart): Triangle[] {
  const result: Triangle[] = [];
  for (let i = 0; i + 2 < part.indices.length; i += 3) {
    const points = part.indices.slice(i, i + 3).map(index => part.positions.slice(index * 3, index * 3 + 3) as V3);
    if (points.some(p => p.length !== 3 || !p.every(Number.isFinite))) return [];
    const [a, b, c] = points;
    result.push({ a, b, c, part, minY: Math.min(a[1], b[1], c[1]), maxY: Math.max(a[1], b[1], c[1]) });
  }
  return result;
}
const cross2 = (a: P2, b: P2, p: P2) => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
const projected = (p: V3): P2 => ({ x: p[0], z: p[2] });
function inside(p: P2, a: P2, b: P2, c: P2) {
  if (Math.abs(cross2(a, b, c)) < EPS) return false;
  const d = [cross2(a, b, p), cross2(b, c, p), cross2(c, a, p)];
  return d.every(v => v >= -EPS) || d.every(v => v <= EPS);
}
function segmentDistance(p: P2, a: P2, b: P2) {
  const dx = b.x - a.x, dz = b.z - a.z, length = dx * dx + dz * dz;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / length)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
}
function clipY(poly: V3[], y: number, above: boolean): V3[] {
  const result: V3[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], ain = above ? a[1] >= y : a[1] <= y, bin = above ? b[1] >= y : b[1] <= y;
    if (ain) result.push(a);
    if (ain !== bin) { const t = (y - a[1]) / (b[1] - a[1]); result.push([a[0] + t * (b[0] - a[0]), y, a[2] + t * (b[2] - a[2])]); }
  }
  return result;
}
function closeToOccupiedTriangle(point: P2, triangle: Triangle, feet: number) {
  if (triangle.maxY <= feet + .04 || triangle.minY >= feet + HEAD_HEIGHT) return false;
  const poly = clipY(clipY([triangle.a, triangle.b, triangle.c], feet + .04, true), feet + HEAD_HEIGHT, false).map(projected);
  for (let i = 1; i + 1 < poly.length; i++) if (inside(point, poly[0], poly[i], poly[i + 1])) return true;
  return poly.some((a, i) => segmentDistance(point, a, poly[(i + 1) % poly.length]) < BODY_RADIUS);
}
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function rayHit(origin: V3, direction: V3, t: Triangle): number | null {
  const e1 = sub(t.b, t.a), e2 = sub(t.c, t.a), h = cross(direction, e2), det = dot(e1, h);
  if (Math.abs(det) < EPS) return null;
  const s = sub(origin, t.a), u = dot(s, h) / det;
  if (u < -EPS || u > 1 + EPS) return null;
  const q = cross(s, e1), v = dot(direction, q) / det;
  if (v < -EPS || u + v > 1 + EPS) return null;
  const distance = dot(e2, q) / det;
  return distance > EPS ? distance : null;
}
function insideSolid(point: P2, feet: number, solids: Triangle[]) {
  // Per-part parity catches thick closed solids whose outer faces are farther away than the body radius.
  for (const height of [.15, .75, EYE_HEIGHT]) {
    const hits = new Map<string, number[]>(), y = feet + height;
    for (const t of solids) {
      if (t.minY > y || t.maxY < y) continue;
      const hit = rayHit([point.x, y, point.z], [1, 0, .013], t);
      if (hit !== null) { const list = hits.get(t.part.id) ?? []; if (!list.some(d => Math.abs(d - hit) < 1e-5)) list.push(hit); hits.set(t.part.id, list); }
    }
    if ([...hits.values()].some(list => list.length % 2 === 1)) return true;
  }
  return false;
}
function prepare(model: SourceBuilding, floorId: string) {
  const floor = listWalkFloors(model).find(f => f.id === floorId);
  if (!floor) return null;
  if (model.objects.some(p => p.positions.length % 3 || p.indices.length % 3 || !p.positions.every(Number.isFinite)
    || p.indices.some(i => !Number.isInteger(i) || i < 0 || i * 3 + 2 >= p.positions.length))) return null;
  const all = model.objects.flatMap(triangles);
  const supports = all.filter(t => levelOf(t.part) === floorId && ["room", "slab"].includes(t.part.category)
    && t.maxY - t.minY < .001 && Math.abs(t.maxY - floor.elevation) <= .25
    && Math.abs(cross2(projected(t.a), projected(t.b), projected(t.c))) > EPS);
  const solids = all.filter(t => t.part.category !== "room" && t.maxY > floor.elevation - .2 && t.minY < floor.elevation + 2.1);
  return { floor, supports, solids };
}
type Context = NonNullable<ReturnType<typeof prepare>>;
function supportAt(ctx: Context, point: P2) {
  return ctx.supports.filter(t => inside(point, projected(t.a), projected(t.b), projected(t.c)))
    .sort((a, b) => b.maxY - a.maxY || Number(b.part.category === "room") - Number(a.part.category === "room"))[0];
}
function clearPosition(ctx: Context, point: P2): { support: Triangle } | { reason: string } {
  const support = supportAt(ctx, point);
  if (!support) return { reason: "Choose a point on a modelled room floor or slab for this level." };
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6, near = supportAt(ctx, { x: point.x + BODY_RADIUS * Math.cos(angle), z: point.z + BODY_RADIUS * Math.sin(angle) });
    if (!near || Math.abs(near.maxY - support.maxY) > .05) return { reason: "Move farther from the floor edge or step." };
  }
  if (ctx.solids.some(t => closeToOccupiedTriangle(point, t, support.maxY)) || insideSolid(point, support.maxY, ctx.solids))
    return { reason: "That point is inside or too close to a modelled wall, fixture or solid. Choose a clear area." };
  return { support };
}
function heading(ctx: Context, point: P2, elevation: number) {
  let best = { yaw: 0, clearView: 0, score: -1 };
  const eye: V3 = [point.x, elevation + EYE_HEIGHT, point.z];
  const visible = ctx.solids.filter(t => t.minY <= eye[1] && t.maxY >= eye[1]);
  for (let i = 0; i < 32; i++) {
    const yaw = i * Math.PI / 16;
    const distances = [-.32, 0, .32].map(offset => {
      const direction: V3 = [-Math.sin(yaw + offset), 0, -Math.cos(yaw + offset)];
      let distance = 12;
      for (const triangle of visible) { const hit = rayHit(eye, direction, triangle); if (hit !== null) distance = Math.min(distance, hit); }
      return distance;
    });
    const score = Math.min(...distances) * .7 + distances[1] * .3;
    if (score > best.score) best = { yaw: Math.atan2(Math.sin(yaw), Math.cos(yaw)), clearView: Math.min(...distances), score };
  }
  return best;
}
function assess(ctx: Context, point: P2): WalkAssessment {
  if (![point.x, point.z].every(Number.isFinite)) return { ok: false, reason: "The starting coordinates are invalid." };
  const clear = clearPosition(ctx, point);
  if ("reason" in clear) return { ok: false, reason: clear.reason };
  const view = heading(ctx, point, clear.support.maxY);
  if (view.clearView < 1.2) return { ok: false, reason: "This area has no clear starting view. Choose a more open part of the floor." };
  return { ok: true, placement: { ...point, elevation: clear.support.maxY, level: ctx.floor.id, yaw: view.yaw,
    supportId: clear.support.part.id, label: clear.support.part.label, clearView: view.clearView, inferred: true } };
}
export function assessWalkStart(model: SourceBuilding, floorId: string, point: P2): WalkAssessment {
  const ctx = prepare(model, floorId);
  return ctx ? assess(ctx, point) : { ok: false, reason: "This model has no supported elevation for that floor." };
}
/** Model geometry suggests starts; these are not surveyed circulation or accessibility assessments. */
export function recommendWalkStarts(model: SourceBuilding, floorId: string): WalkPlacement[] {
  const ctx = prepare(model, floorId); if (!ctx) return [];
  const parts = [...new Map(ctx.supports.map(t => [t.part.id, t.part])).values()];
  const results: { placement: WalkPlacement; score: number }[] = [];
  for (const part of parts) {
    const ts = ctx.supports.filter(t => t.part === part), vertices = ts.flatMap(t => [t.a, t.b, t.c]);
    const xs = vertices.map(v => v[0]), zs = vertices.map(v => v[2]), x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    let best: { placement: WalkPlacement; score: number } | undefined;
    for (const fx of [.25, .5, .75]) for (const fz of [.25, .5, .75]) {
      const result = assess(ctx, { x: x0 + (x1 - x0) * fx, z: z0 + (z1 - z0) * fz });
      if (!result.ok) continue;
      const p = result.placement;
      const score = Math.min(p.clearView, 6) + (model.objects.find(o => o.id === p.supportId)?.category === "room" ? 1 : 0)
        + (/lounge|living|entry|hall|dining/i.test(p.label) ? 2 : 0)
        - (/storage|terrace|outdoor|carport|court|garage|walkway/i.test(p.label) ? 2 : 0)
        - Math.abs(p.elevation - ctx.floor.elevation) * 4;
      if (!best || score > best.score) best = { placement: p, score };
    }
    if (best) {
      const previous = results.findIndex(r => r.placement.supportId === best!.placement.supportId);
      if (previous >= 0) { if (best.score > results[previous].score) results[previous] = best; }
      else if (!results.some(r => Math.hypot(r.placement.x - best!.placement.x, r.placement.z - best!.placement.z) < .8)) results.push(best);
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 4).map(r => r.placement);
}
