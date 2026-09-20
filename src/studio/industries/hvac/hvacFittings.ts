import { Box3, Vector3 } from "three";
import type { HvacEdge, HvacNetwork } from "./hvacNetwork.ts";
import { hvacRunFrame } from "./hvacRunGeometry.ts";

export type HvacPoint = [number, number, number];
export type FittingRing = { center: HvacPoint; right: HvacPoint; up: HvacPoint; width: number; height: number; round: boolean; insulation: number };
export type HvacFitting = {
  id: string; kind: "elbow" | "tee" | "reducer"; service: "duct" | "pipe"; reference: string;
  ports: { edgeId: string; point: HvacPoint; setbackM: number }[];
  surfaces: FittingRing[][]; bounds: { min: HvacPoint; max: HvacPoint }; clash: boolean;
};
export const isFittingKind = (kind: string) => kind === "elbow" || kind === "tee" || kind === "reducer";
const point = (v: Vector3): HvacPoint => [v.x, v.y, v.z];
const sizeKey = (edge: HvacEdge) => `${edge.shape}:${edge.widthM}:${edge.shape === "round" ? edge.widthM : edge.heightM}`;
const radius = (edge: HvacEdge) => edge.shape === "round" ? edge.widthM / 2 + edge.insulationM : Math.hypot(edge.widthM / 2 + edge.insulationM, edge.heightM / 2 + edge.insulationM);
function ring(center: Vector3, tangent: Vector3, edge: HvacEdge): FittingRing {
  const frame = hvacRunFrame(point(center), point(center.clone().add(tangent)))!;
  const right = new Vector3(), up = new Vector3(), forward = new Vector3(); frame.rotation.extractBasis(right, up, forward);
  return { center: point(center), right: point(right), up: point(up), width: edge.widthM, height: edge.shape === "round" ? edge.widthM : edge.heightM, round: edge.shape === "round", insulation: edge.insulationM };
}

/** Coordination envelopes only: no sheet-metal development, bore mesh or fabrication allowance.
 * Curved/branched fitting beam checks use an explicitly conservative bounding box. */
export function coordinateHvacFittings(network: HvacNetwork) {
  const fittings: HvacFitting[] = [], issues: { target: string; message: string }[] = [];
  const nodes = new Map(network.nodes.map(n => [n.id, n]));
  for (const node of network.nodes.filter(n => isFittingKind(n.kind))) {
    const fail = (message: string) => issues.push({ target: node.id, message });
    const attached = network.edges.filter(e => e.from === node.id || e.to === node.id);
    const required = node.kind === "tee" ? 3 : 2;
    if (attached.length !== required || new Set(attached.map(e => e.id)).size !== required) { fail(`${node.kind} requires ${required} distinct connected runs.`); continue; }
    if (!node.fitting?.reference.trim()) { fail("Fitting geometry unknown: enter its source reference and declared dimension."); continue; }
    const origin = new Vector3(node.x, node.y, node.z);
    const legs = attached.map(edge => { const other = nodes.get(edge.from === node.id ? edge.to : edge.from); const delta = other ? new Vector3(other.x, other.y, other.z).sub(origin) : new Vector3(); return { edge, direction: delta.clone().normalize(), length: delta.length() }; });
    if (legs.some(leg => leg.length <= 1e-8)) { fail("Fitting ends need distinct, existing endpoint positions."); continue; }
    if (new Set(attached.map(e => e.service ?? "duct")).size !== 1) { fail("A fitting cannot join pipe and duct services."); continue; }
    if (node.kind !== "reducer" && new Set(attached.map(sizeKey)).size !== 1) { fail("Elbow and tee ports require matching sections; add a separate reducer for changed dimensions."); continue; }
    const surfaces: FittingRing[][] = [], ports: HvacFitting["ports"] = [];
    let arcPadding = 0;
    if (node.kind === "elbow") {
      const r = node.fitting.radiusM;
      const theta = Math.acos(Math.max(-1, Math.min(1, legs[0].direction.dot(legs[1].direction))));
      if (r == null || r <= Math.max(...attached.map(radius)) || theta < 1e-4 || Math.PI - theta < 1e-4) { fail("Elbow needs a declared bend radius larger than the insulated section radius and non-collinear legs."); continue; }
      const setback = r / Math.tan(theta / 2);
      if (legs.some(leg => setback >= leg.length)) { fail("Elbow bend radius consumes an entire connected run."); continue; }
      const ends = legs.map(leg => origin.clone().addScaledVector(leg.direction, setback));
      const center = origin.clone().addScaledVector(legs[0].direction.clone().add(legs[1].direction).normalize(), r / Math.sin(theta / 2));
      const radial = ends[0].clone().sub(center), axis = radial.clone().cross(ends[1].clone().sub(center)).normalize();
      const sweep = Math.PI - theta, steps = 32;
      arcPadding = r * (1 - Math.cos(sweep / steps / 2));
      // Use the largest insulation at the joint; core port dimensions are equal.
      const section = { ...attached[0], insulationM: Math.max(...attached.map(e => e.insulationM)) };
      surfaces.push(Array.from({ length: steps + 1 }, (_, i) => { const offset = radial.clone().applyAxisAngle(axis, sweep * i / steps); return ring(center.clone().add(offset), axis.clone().cross(offset).normalize(), section); }));
      ports.push(...legs.map((leg, i) => ({ edgeId: leg.edge.id, point: point(ends[i]), setbackM: setback })));
    } else {
      const length = node.fitting.lengthM;
      if (length == null) { fail(node.kind === "tee" ? "Tee geometry unknown: enter centre-to-port length." : "Reducer geometry unknown: enter total length."); continue; }
      const setback = node.kind === "reducer" ? length / 2 : length;
      if (legs.some(leg => setback >= leg.length)) { fail("Fitting length consumes an entire connected run."); continue; }
      if (node.kind === "reducer" && legs[0].direction.dot(legs[1].direction) > -1 + 1e-6) { fail("Reducer ports must be collinear and face opposite directions."); continue; }
      if (node.kind === "tee") {
        const pair = [[0, 1], [0, 2], [1, 2]].find(([a, b]) => legs[a].direction.dot(legs[b].direction) < -1 + 1e-6);
        if (!pair || Math.abs(legs[pair[0]].direction.dot(legs[[0, 1, 2].find(i => !pair.includes(i))!].direction)) > 1e-6) { fail("Tee needs opposite main ports and a perpendicular branch."); continue; }
      }
      const ends = legs.map(leg => origin.clone().addScaledVector(leg.direction, setback));
      ports.push(...legs.map((leg, i) => ({ edgeId: leg.edge.id, point: point(ends[i]), setbackM: setback })));
      if (node.kind === "reducer") surfaces.push([ring(ends[0], legs[1].direction, attached[0]), ring(ends[1], legs[1].direction, attached[1])]);
      else for (let i = 0; i < legs.length; i++) surfaces.push([ring(origin, legs[i].direction, attached[i]), ring(ends[i], legs[i].direction, attached[i])]);
    }
    const bounds = new Box3().setFromPoints(surfaces.flat().map(r => new Vector3(...r.center))).expandByScalar(Math.max(...attached.map(radius)) + arcPadding);
    fittings.push({ id: node.id, kind: node.kind as HvacFitting["kind"], service: attached[0].service ?? "duct", reference: node.fitting.reference, ports, surfaces, bounds: { min: point(bounds.min), max: point(bounds.max) }, clash: false });
  }
  const invalid = new Set<string>();
  for (const edge of network.edges) {
    const ends = fittings.flatMap(f => f.ports.filter(p => p.edgeId === edge.id).map(p => ({ fitting: f.id, setback: p.setbackM })));
    const a = nodes.get(edge.from), b = nodes.get(edge.to);
    if (a && b && ends.reduce((sum, end) => sum + end.setback, 0) >= Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) - 1e-8 && ends.length) {
      for (const end of ends) invalid.add(end.fitting);
      issues.push({ target: edge.id, message: "Fitting cutbacks overlap or consume the straight run; fitting geometry withheld." });
    }
  }
  const valid = fittings.filter(f => !invalid.has(f.id));
  const ports = new Map<string, Map<string, HvacPoint>>();
  for (const f of valid) ports.set(f.id, new Map(f.ports.map(p => [p.edgeId, p.point])));
  return { fittings: valid, ports, issues };
}

/** Triangle positions for coordination preview; identical profiles drive testable bounds. */
export function fittingSurfacePositions(rings: FittingRing[], insulated: boolean): number[] {
  const count = 32, vertices: Vector3[][] = rings.map(r => Array.from({ length: count }, (_, i) => {
    const t = insulated ? r.insulation : 0, w = r.width / 2 + t, h = r.height / 2 + t;
    let x: number, y: number;
    if (r.round) { const angle = Math.PI / 4 + i * Math.PI * 2 / count; x = w * Math.cos(angle); y = w * Math.sin(angle); }
    else { const corners = [[w, h], [-w, h], [-w, -h], [w, -h]], side = Math.floor(i / 8), u = i % 8 / 8; x = corners[side][0] * (1 - u) + corners[(side + 1) % 4][0] * u; y = corners[side][1] * (1 - u) + corners[(side + 1) % 4][1] * u; }
    return new Vector3(...r.center).addScaledVector(new Vector3(...r.right), x).addScaledVector(new Vector3(...r.up), y);
  }));
  const positions: number[] = [], triangle = (...vs: Vector3[]) => vs.forEach(v => positions.push(v.x, v.y, v.z));
  for (let j = 0; j < vertices.length - 1; j++) for (let i = 0; i < count; i++) { const next = (i + 1) % count; triangle(vertices[j][i], vertices[j][next], vertices[j + 1][i]); triangle(vertices[j][next], vertices[j + 1][next], vertices[j + 1][i]); }
  if (rings.length) for (let i = 0; i < count; i++) { const next = (i + 1) % count, last = rings.length - 1; triangle(new Vector3(...rings[0].center), vertices[0][next], vertices[0][i]); triangle(new Vector3(...rings[last].center), vertices[last][i], vertices[last][next]); }
  return positions;
}
