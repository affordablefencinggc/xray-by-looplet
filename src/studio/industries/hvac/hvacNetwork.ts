import { z } from "zod";
import { hvacRunIntersectsBeam } from "./hvacRunGeometry.ts";

const id = z.string().trim().min(1).max(120);
const positive = z.number().finite().positive().max(1000000);
const coordinate = z.number().finite().min(-10000).max(10000);
export const hvacNodeSchema = z.object({ id, zone: id, kind: z.enum(["equipment", "junction", "reducer", "damper", "diffuser"]), x: coordinate, y: coordinate, z: coordinate,
  designAirflowLs: positive.nullable(), equipmentTag: z.string().max(120) }).strict();
export const hvacEdgeSchema = z.object({ id, from: id, to: id, shape: z.enum(["rectangular", "round"]), widthM: positive, heightM: positive,
  insulationM: z.number().finite().nonnegative().max(10), availablePlenumM: positive.nullable(), airflowLs: positive.nullable(), pressureAllowancePaPerM: positive.nullable() }).strict();
export const hvacBeamSchema = z.object({ id, min: z.tuple([coordinate, coordinate, coordinate]), max: z.tuple([coordinate, coordinate, coordinate]) }).strict().refine(b => b.min.every((v, i) => v < b.max[i]), "Beam bounds must have positive dimensions.");
export const hvacNetworkSchema = z.object({ reference: id, evidence: z.enum(["declared", "sample"]), occupancy: z.enum(["residential", "commercial"]),
  nodes: z.array(hvacNodeSchema).min(1).max(100), edges: z.array(hvacEdgeSchema).min(1).max(200), beams: z.array(hvacBeamSchema).max(100) }).strict();
export type HvacNetwork = z.infer<typeof hvacNetworkSchema>;
export type HvacEdge = HvacNetwork["edges"][number];
export type NetworkIssue = { code: "duplicate-id" | "missing-node" | "zero-length" | "disconnected" | "transition" | "plenum" | "beam" | "unknown-plenum"; target: string; message: string };

export function evaluateHvacNetwork(input: unknown) {
  const network = hvacNetworkSchema.parse(input);
  const issues: NetworkIssue[] = [];
  const add = (code: NetworkIssue["code"], target: string, message: string) => issues.push({ code, target, message });
  for (const collection of [network.nodes, network.edges, network.beams]) {
    const seen = new Set<string>();
    for (const item of collection) { if (seen.has(item.id)) add("duplicate-id", item.id, "Identifiers must be unique within each schedule."); seen.add(item.id); }
  }
  const nodes = new Map(network.nodes.map(n => [n.id, n]));
  const adjacency = new Map(network.nodes.map(n => [n.id, [] as string[]]));
  const runs = network.edges.map(edge => {
    const a = nodes.get(edge.from), b = nodes.get(edge.to);
    const height = edge.shape === "round" ? edge.widthM : edge.heightM;
    const areaM2 = edge.shape === "round" ? Math.PI * edge.widthM ** 2 / 4 : edge.widthM * height;
    const lengthM = a && b ? Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) : null;
    if (!a || !b) add("missing-node", edge.id, "Both ends must reference existing nodes.");
    else {
      adjacency.get(a.id)!.push(b.id); adjacency.get(b.id)!.push(a.id);
      if (!lengthM) add("zero-length", edge.id, "Run endpoints must occupy different positions.");
      for (const beam of network.beams) {
        if (hvacRunIntersectsBeam([a.x, a.y, a.z], [b.x, b.y, b.z], edge.widthM, height, edge.insulationM, beam)) add("beam", edge.id, edge.shape === "round"
          ? `Potential clash with beam ${beam.id}; round run checked with a conservative enclosing box.`
          : `Insulated rectangular envelope intersects beam ${beam.id} (including touching faces). Review declared geometry.`);
      }
    }
    if (edge.availablePlenumM === null) add("unknown-plenum", edge.id, "Ceiling void is unknown; clearance has not been checked.");
    else if (height + 2 * edge.insulationM > edge.availablePlenumM) add("plenum", edge.id, "Insulated duct height exceeds the entered ceiling void.");
    return { ...edge, lengthM, areaM2, outerHeightM: height + 2 * edge.insulationM };
  });
  const reached = new Set<string>();
  const queue = network.nodes.filter(n => n.kind === "equipment").map(n => n.id);
  for (let i = 0; i < queue.length; i++) { const current = queue[i]; if (reached.has(current)) continue; reached.add(current); queue.push(...(adjacency.get(current) ?? []).filter(next => !reached.has(next))); }
  for (const node of network.nodes) {
    if (!reached.has(node.id)) add("disconnected", node.id, "Node has no connection to equipment.");
    const attached = network.edges.filter(e => e.from === node.id || e.to === node.id);
    const dimensions = new Set(attached.map(e => `${e.shape}:${e.widthM}:${e.shape === "round" ? e.widthM : e.heightM}`));
    if (dimensions.size > 1 && node.kind !== "reducer") add("transition", node.id, "Different duct dimensions meet without an explicit reducer.");
  }
  return { status: "draft-unverified" as const, verifiedQuoteEligible: false as const, network, runs, issues };
}
