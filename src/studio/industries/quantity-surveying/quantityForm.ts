import { z } from "zod";
import { classifyQuantities, type ClassificationInput } from "./classification.ts";

const text = z.string().max(240);
const key = z.string().min(1).max(240);
export const quantityFormSchema = z.object({
  hierarchyId: text,
  hierarchyRevision: text,
  nodes: z.array(z.object({ key, code: text, label: text, parentKey: text }).strict()).max(1000),
  items: z.array(z.object({
    key, reference: text, quantity: z.string().max(80), unit: text,
    evidence: z.enum(["unverified", "inferred", "sample"]), nodeKey: text,
  }).strict()).max(10000),
  calculated: z.boolean(),
}).strict();
export type QuantityForm = z.infer<typeof quantityFormSchema>;

export function createEmptyQuantityForm(): QuantityForm {
  return { hierarchyId: "", hierarchyRevision: "", nodes: [], items: [], calculated: false };
}

/** Form keys are UI identity only; explicit user codes identify the calculation. */
export function quantityFormInput(raw: QuantityForm): ClassificationInput {
  const form = quantityFormSchema.parse(raw);
  if (!form.hierarchyId.trim()) throw Error("Enter a hierarchy name.");
  if (!form.hierarchyRevision.trim()) throw Error("Enter the hierarchy revision.");
  if (!form.nodes.length) throw Error("Add at least one classification.");
  if (!form.items.length) throw Error("Add at least one quantity row.");
  form.nodes.forEach((node, index) => {
    if (!node.code.trim() || !node.label.trim()) throw Error(`Enter a code and label for classification ${index + 1}.`);
  });
  form.items.forEach((item, index) => {
    if (!item.reference.trim()) throw Error(`Enter an item reference for quantity ${index + 1}.`);
    if (!item.unit.trim()) throw Error(`Enter a unit for quantity ${index + 1}.`);
    if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(item.quantity)) throw Error(`Quantity ${index + 1} needs a non-negative decimal, such as 0.25. Use a decimal point, without commas or unit text.`);
  });
  const nodes = new Map(form.nodes.map(node => [node.key, node]));
  if (nodes.size !== form.nodes.length || new Set(form.items.map(item => item.key)).size !== form.items.length)
    throw Error("Duplicate form row identity.");
  const codeFor = (nodeKey: string) => {
    const node = nodes.get(nodeKey);
    if (!node) throw Error("A selected classification no longer exists. Choose another classification.");
    return node.code;
  };
  return {
    hierarchyId: form.hierarchyId, hierarchyRevision: form.hierarchyRevision,
    nodes: form.nodes.map(node => ({ id: node.code, label: node.label, parentId: node.parentKey ? codeFor(node.parentKey) : null })),
    items: form.items.map(item => ({ id: item.reference, quantity: item.quantity, unit: item.unit, evidence: item.evidence, source: null })),
    assignments: form.items.filter(item => item.nodeKey).map(item => ({ itemId: item.reference, nodeId: codeFor(item.nodeKey) })),
  };
}

export function calculateQuantityForm(form: QuantityForm) {
  return classifyQuantities(quantityFormInput(form));
}

export function assignQuantityItem(form: QuantityForm, itemKey: string, nodeKey: string): QuantityForm {
  if (!form.items.some(item => item.key === itemKey)) throw Error("Quantity row no longer exists.");
  if (nodeKey && !form.nodes.some(node => node.key === nodeKey)) throw Error("Classification no longer exists.");
  return { ...form, calculated: false, items: form.items.map(item => item.key === itemKey ? { ...item, nodeKey } : item) };
}
