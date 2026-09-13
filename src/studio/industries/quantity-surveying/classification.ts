import { z } from "zod";

const identifier = z.string().trim().min(1).max(240);
// Accept ordinary non-negative decimal strings, including 1.0 / 1.20.
// Canonicalise only redundant fractional zeroes; never round a measurement.
const quantity = z.string().max(80).regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/)
  .transform(value => value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value);
const evidence = z.enum(["measured", "inferred", "sample", "unverified"]);
const itemSchema = z.object({
  id: identifier,
  quantity,
  unit: identifier,
  evidence,
  source: z.object({
    documentId: identifier,
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    revision: identifier,
    sheet: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    regionId: identifier.nullable(),
    calibrationId: identifier.nullable(),
  }).strict().nullable(),
}).strict();
const inputSchema = z.object({
  hierarchyId: identifier,
  hierarchyRevision: identifier,
  nodes: z.array(z.object({
    id: identifier,
    label: identifier,
    parentId: identifier.nullable(),
  }).strict()).max(1000),
  items: z.array(itemSchema).max(100000),
  assignments: z.array(z.object({ itemId: identifier, nodeId: identifier }).strict()).max(100000),
}).strict();

export type ClassificationInput = z.input<typeof inputSchema>;
export type QuantitySubtotal = {
  unit: string;
  evidence: z.infer<typeof evidence>;
  quantity: string;
  itemCount: number;
};
type Item = z.infer<typeof itemSchema>;

// Exact decimal addition: quantities are never rounded or converted between units.
function add(left: string, right: string): string {
  const [li, lf = ""] = left.split(".");
  const [ri, rf = ""] = right.split(".");
  const scale = Math.max(lf.length, rf.length);
  const value = BigInt(li + lf.padEnd(scale, "0")) + BigInt(ri + rf.padEnd(scale, "0"));
  if (!scale) return value.toString();
  const digits = value.toString().padStart(scale + 1, "0");
  const fraction = digits.slice(-scale).replace(/0+$/, "");
  return digits.slice(0, -scale) + (fraction ? `.${fraction}` : "");
}

function accumulate(totals: Map<string, QuantitySubtotal>, item: Item): void {
  const key = JSON.stringify([item.unit, item.evidence]);
  const previous = totals.get(key);
  totals.set(key, {
    unit: item.unit,
    evidence: item.evidence,
    quantity: add(previous?.quantity ?? "0", item.quantity),
    itemCount: (previous?.itemCount ?? 0) + 1,
  });
}

/** Organises declared quantities only. Does not verify source hashes, calibration,
 * measurement standards, rates, or authority to issue a cost plan. Rollups overlap
 * their descendants; use the report totals, not a sum of every hierarchy row. */
export function classifyQuantities(raw: ClassificationInput) {
  const input = inputSchema.parse(raw);
  const nodes = new Map(input.nodes.map(node => [node.id, node]));
  if (nodes.size !== input.nodes.length) throw new Error("Duplicate classification node ID.");
  const paths = new Map<string, string[]>();
  for (const node of input.nodes) {
    const path: string[] = [];
    const visited = new Set<string>();
    let current: string | null = node.id;
    while (current !== null) {
      if (visited.has(current)) throw new Error("Classification hierarchy contains a cycle.");
      visited.add(current);
      const ancestor = nodes.get(current);
      if (!ancestor) throw new Error(`Missing classification parent: ${current}`);
      path.push(current);
      current = ancestor.parentId;
    }
    paths.set(node.id, path);
  }
  const items = new Map(input.items.map(item => [item.id, item]));
  if (items.size !== input.items.length) throw new Error("Duplicate measured item ID.");
  const assigned = new Map<string, string>();
  for (const assignment of input.assignments) {
    if (!items.has(assignment.itemId)) throw new Error(`Unknown item: ${assignment.itemId}`);
    if (!nodes.has(assignment.nodeId)) throw new Error(`Unknown classification: ${assignment.nodeId}`);
    if (assigned.has(assignment.itemId)) throw new Error(`Duplicate item assignment: ${assignment.itemId}`);
    assigned.set(assignment.itemId, assignment.nodeId);
  }
  const direct = new Map(input.nodes.map(node => [node.id, new Map<string, QuantitySubtotal>()]));
  const rollup = new Map(input.nodes.map(node => [node.id, new Map<string, QuantitySubtotal>()]));
  const totals = new Map<string, QuantitySubtotal>();
  const residue = new Map<string, QuantitySubtotal>();
  const classified = new Map<string, QuantitySubtotal>();
  const rows = input.items.map(item => {
    const nodeId = assigned.get(item.id) ?? null;
    accumulate(totals, item);
    if (nodeId === null) accumulate(residue, item);
    else {
      accumulate(classified, item);
      accumulate(direct.get(nodeId)!, item);
      for (const ancestor of paths.get(nodeId)!) accumulate(rollup.get(ancestor)!, item);
    }
    return { ...item, nodeId };
  });
  return {
    status: "draft-classification" as const,
    verifiedQuoteEligible: false as const,
    hierarchyId: input.hierarchyId,
    hierarchyRevision: input.hierarchyRevision,
    classificationComplete: assigned.size === input.items.length,
    rows,
    nodes: input.nodes.map(node => ({
      ...node, direct: [...direct.get(node.id)!.values()], rollup: [...rollup.get(node.id)!.values()],
    })),
    totals: [...totals.values()],
    classifiedTotals: [...classified.values()],
    unclassifiedTotals: [...residue.values()],
    unclassifiedItemIds: rows.filter(row => row.nodeId === null).map(row => row.id),
  };
}
