import { z } from "zod";
import { hvacRunIntersectsBeam } from "./hvacRunGeometry.ts";
import { coordinateHvacFittings, isFittingKind } from "./hvacFittings.ts";

const id = z.string().trim().min(1).max(120);
const positive = z.number().finite().positive().max(1000000);
const coordinate = z.number().finite().min(-10000).max(10000);
export const hvacNodeSchema = z.object({ id, zone: id, kind: z.enum(["equipment", "junction", "reducer", "elbow", "tee", "damper", "diffuser", "pump", "valve", "pipe-terminal"]), x: coordinate, y: coordinate, z: coordinate,
  fitting: z.object({ reference: z.string().trim().max(120), radiusM: positive.nullable(), lengthM: positive.nullable() }).strict().optional(),
  designAirflowLs: positive.nullable(), designPipeFlowLs: positive.nullable().optional(), measuredLs: z.number().finite().nonnegative().max(1000000).nullable().optional(), equipmentTag: z.string().max(120) }).strict();
export const hvacEdgeSchema = z.object({ id, from: id, to: id, shape: z.enum(["rectangular", "round"]), widthM: positive, heightM: positive,
  service: z.enum(["duct", "pipe"]).optional(), innerDiameterM: positive.nullable().optional(), pipeFlowLs: positive.nullable().optional(),
  insulationM: z.number().finite().nonnegative().max(10), availablePlenumM: positive.nullable(), airflowLs: positive.nullable(), pressureAllowancePaPerM: positive.nullable() }).strict().superRefine((edge, ctx) => {
    if (edge.service !== "pipe") return;
    if (edge.shape !== "round") ctx.addIssue({ code: "custom", path: ["shape"], message: "Pipe runs require a round outside diameter." });
    if (edge.innerDiameterM != null && edge.innerDiameterM > edge.widthM) ctx.addIssue({ code: "custom", path: ["innerDiameterM"], message: "Inside diameter cannot exceed outside diameter." });
  });
export const hvacBeamSchema = z.object({ id, min: z.tuple([coordinate, coordinate, coordinate]), max: z.tuple([coordinate, coordinate, coordinate]) }).strict().refine(b => b.min.every((v, i) => v < b.max[i]), "Beam bounds must have positive dimensions.");
export const hvacNetworkSchema = z.object({ reference: id, evidence: z.enum(["declared", "sample"]), occupancy: z.enum(["residential", "commercial"]),
  nodes: z.array(hvacNodeSchema).min(1).max(100), edges: z.array(hvacEdgeSchema).min(1).max(200), beams: z.array(hvacBeamSchema).max(100) }).strict();
export type HvacNetwork = z.infer<typeof hvacNetworkSchema>;
export type HvacEdge = HvacNetwork["edges"][number];
export type NetworkIssue = { code: "duplicate-id" | "missing-node" | "zero-length" | "disconnected" | "transition" | "plenum" | "beam" | "unknown-plenum" | "service" | "fitting" | "fitting-beam" | "fitting-plenum"; target: string; message: string };
export const isPipeNode = (kind: HvacNetwork["nodes"][number]["kind"]) => ["pump", "valve", "pipe-terminal"].includes(kind);
const supports = (kind: HvacNetwork["nodes"][number]["kind"], service: "duct" | "pipe") => kind === "junction" || isFittingKind(kind) || isPipeNode(kind) === (service === "pipe");

export function evaluateHvacNetwork(input: unknown) {
  const network = hvacNetworkSchema.parse(input);
  const issues: NetworkIssue[] = [];
  const add = (code: NetworkIssue["code"], target: string, message: string) => issues.push({ code, target, message });
  for (const collection of [network.nodes, network.edges, network.beams]) {
    const seen = new Set<string>();
    for (const item of collection) { if (seen.has(item.id)) add("duplicate-id", item.id, "Identifiers must be unique within each schedule."); seen.add(item.id); }
  }
  const nodes = new Map(network.nodes.map(n => [n.id, n]));
  const coordinated = coordinateHvacFittings(network);
  for (const issue of coordinated.issues) add("fitting", issue.target, issue.message);
  for (const fitting of coordinated.fittings) {
    for (const beam of network.beams) if (beam.min.every((v, i) => v <= fitting.bounds.max[i] && beam.max[i] >= fitting.bounds.min[i])) {
      fitting.clash = true; add("fitting-beam", fitting.id, `Potential fitting clash with beam ${beam.id}; conservative fitting bounds require review.`);
    }
    const clearances = network.edges.filter(e => fitting.ports.some(p => p.edgeId === e.id)).map(e => e.availablePlenumM);
    if (clearances.some(v => v === null)) add("unknown-plenum", fitting.id, "Fitting ceiling void is incomplete; full clearance has not been checked.");
    const known = clearances.filter((v): v is number => v !== null);
    if (known.length && fitting.bounds.max[1] - fitting.bounds.min[1] > Math.min(...known)) {
      fitting.clash = true; add("fitting-plenum", fitting.id, "Conservative fitting height exceeds an entered ceiling void; review the fitting clearance.");
    }
  }
  const adjacency = new Map(network.nodes.map(n => [n.id, [] as { id: string; service: "duct" | "pipe" }[]]));
  const runs = network.edges.map(edge => {
    const a = nodes.get(edge.from), b = nodes.get(edge.to);
    const height = edge.shape === "round" ? edge.widthM : edge.heightM;
    const service = edge.service ?? "duct";
    const areaM2 = service === "pipe" ? edge.innerDiameterM == null ? null : Math.PI * edge.innerDiameterM ** 2 / 4 : edge.shape === "round" ? Math.PI * edge.widthM ** 2 / 4 : edge.widthM * height;
    const lengthM = a && b ? Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) : null;
    const start = a ? coordinated.ports.get(a.id)?.get(edge.id) ?? [a.x, a.y, a.z] as [number, number, number] : null;
    const end = b ? coordinated.ports.get(b.id)?.get(edge.id) ?? [b.x, b.y, b.z] as [number, number, number] : null;
    if (!a || !b) add("missing-node", edge.id, "Both ends must reference existing nodes.");
    else {
      if (supports(a.kind, service) && supports(b.kind, service)) {
        adjacency.get(a.id)!.push({ id: b.id, service }); adjacency.get(b.id)!.push({ id: a.id, service });
      } else add("service", edge.id, "Run service does not match its connected equipment or terminal.");
      if (!lengthM) add("zero-length", edge.id, "Run endpoints must occupy different positions.");
      for (const beam of network.beams) {
        if (hvacRunIntersectsBeam(start!, end!, edge.widthM, height, edge.insulationM, beam)) add("beam", edge.id, edge.shape === "round"
          ? `Potential clash with beam ${beam.id}; round run checked with a conservative enclosing box.`
          : `Insulated rectangular envelope intersects beam ${beam.id} (including touching faces). Review declared geometry.`);
      }
    }
    if (edge.availablePlenumM === null) add("unknown-plenum", edge.id, "Ceiling void is unknown; clearance has not been checked.");
    else if (height + 2 * edge.insulationM > edge.availablePlenumM) add("plenum", edge.id, "Insulated run height exceeds the entered ceiling void.");
    return { ...edge, lengthM, areaM2, outerHeightM: height + 2 * edge.insulationM, start, end, straightLengthM: start && end ? Math.hypot(...end.map((v, i) => v - start[i])) : null };
  });
  const reached = new Set<string>();
  for (const service of ["duct", "pipe"] as const) {
    const visited = new Set<string>();
    const queue = network.nodes.filter(n => n.kind === (service === "pipe" ? "pump" : "equipment")).map(n => n.id);
    for (let i = 0; i < queue.length; i++) { const current = queue[i]; if (visited.has(current)) continue; visited.add(current); reached.add(current); queue.push(...(adjacency.get(current) ?? []).filter(next => next.service === service && !visited.has(next.id)).map(next => next.id)); }
  }
  for (const node of network.nodes) {
    if (!reached.has(node.id)) add("disconnected", node.id, "Node has no connection to matching air equipment or a pump.");
    const attached = network.edges.filter(e => e.from === node.id || e.to === node.id);
    if (new Set(attached.map(e => e.service ?? "duct")).size > 1) add("service", node.id, "Duct and pipe runs cannot share a fluid connection; use separate nodes.");
    const dimensions = new Set(attached.map(e => `${e.shape}:${e.widthM}:${e.shape === "round" ? e.widthM : e.heightM}`));
    if (dimensions.size > 1 && node.kind !== "reducer") add("transition", node.id, "Different duct dimensions meet without an explicit reducer.");
  }
  return { status: "draft-unverified" as const, verifiedQuoteEligible: false as const, network, runs, fittings: coordinated.fittings, issues };
}
