import { z } from "zod";
import { classifyQuantities, type ClassificationInput } from "./classification.ts";
import type { QuantityReport } from "./report.ts";
import { qsItemBindingSchema } from "./qsItemBinding.ts";
import {
  INDUSTRY_SOURCE_BINDING_SCHEMA,
  createIndustrySourceBinding,
  evaluateIndustryBinding,
  industrySourceBindingSchema,
  isVerifiedEvidenceClass,
  type IndustryBindingEvaluation,
  type IndustrySourceBinding,
  type IndustrySourceState,
} from "../sourceBinding.ts";

const text = z.string().max(240);
const key = z.string().min(1).max(240);
export const quantityFormSchema = z.object({
  hierarchyId: text,
  hierarchyRevision: text,
  nodes: z.array(z.object({ key, code: text, label: text, parentKey: text }).strict()).max(1000),
  items: z.array(z.object({
    key, reference: text, quantity: z.string().max(80), unit: text,
    evidence: z.enum(["unverified", "inferred", "sample"]), nodeKey: text,
    /** Optional for backwards compatibility with drafts saved before QS-03.
     * `null` is an explicit unbound row; a record is the immutable measured
     * entity snapshot chosen by the estimator. */
    entityBinding: qsItemBindingSchema.nullable().optional(),
  }).strict()).max(10000),
  // Optional so drafts saved before source binding existed still open; `null` is an explicit unbound worksheet.
  binding: industrySourceBindingSchema.nullable().optional(),
  calculated: z.boolean(),
}).strict();
export type QuantityForm = z.infer<typeof quantityFormSchema>;

export function createEmptyQuantityForm(): QuantityForm {
  return { hierarchyId: "", hierarchyRevision: "", nodes: [], items: [], binding: null, calculated: false };
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

/** What the user types to bind. Project, revision, hash and calibration are read from the live source
 * state, never from these fields, so a typed value can never masquerade as source identity. Quantity
 * rows carry their own units, so the source's length unit is an explicit choice, never an assumed one.
 */
export type QuantityBindingDraft = {
  pageIndexText: string;
  evidenceClass: string;
  reference: string;
  units: string;
};
export const createEmptyQuantityBindingDraft = (): QuantityBindingDraft => ({
  pageIndexText: "", evidenceClass: "", reference: "", units: "",
});

/** A raw ZodError would reach the panel as serialised issues; name the offending field instead. */
function bindingError(cause: unknown): Error {
  if (cause instanceof z.ZodError)
    return Error(cause.issues.map(issue => `${issue.path.join(".") || "binding"}: ${issue.message}`).join("; "));
  return cause instanceof Error ? cause : Error("Check the source binding inputs.");
}

/** Build a binding from the live source state plus the user's explicit inputs. A blank page index,
 * evidence class or unit is refused rather than defaulted to a plausible-looking page zero or class.
 */
export function createQuantityBinding(
  source: IndustrySourceState,
  draft: QuantityBindingDraft,
  boundAt: string,
): IndustrySourceBinding {
  const revision = source.sourceRevision;
  if (revision === null) throw Error("This project has no current source revision. Open or add a source before binding.");
  const pageIndexText = draft.pageIndexText.trim();
  if (!/^\d+$/.test(pageIndexText)) throw Error("Page index: enter the page you measured from as a whole number.");
  const evidenceClass = draft.evidenceClass.trim();
  if (evidenceClass === "") throw Error("Evidence class: choose how the source evidence was obtained.");
  const units = draft.units.trim();
  if (units === "") throw Error("Units: choose the length unit the source drawing is measured in.");
  if (draft.reference.trim() === "") throw Error("Reference: describe where this evidence came from.");
  try {
    return createIndustrySourceBinding({
      schema: INDUSTRY_SOURCE_BINDING_SCHEMA,
      projectId: source.projectId,
      sourceRevisionId: revision.id,
      sha256: revision.sha256,
      // The document's own label when the project supplies one; otherwise its revision id.
      sourceName: revision.name ?? revision.id,
      locator: { kind: "page", pageIndex: Number(pageIndexText) },
      calibrationId: source.calibrationId,
      units,
      evidenceClass,
      reference: draft.reference,
      boundAt,
    });
  } catch (cause) { throw bindingError(cause); }
}

export type QuantityFormBindingEvaluation = {
  evaluation: IndustryBindingEvaluation;
  report: QuantityReport | null;
};

/** Pair the form with the live project state. A stale binding withholds the report entirely: the
 * worksheet must never present a current-looking total once its source has changed underneath it.
 * An unbound or current worksheet reports exactly as a manual worksheet always has.
 */
export function evaluateQuantityFormBinding(
  form: QuantityForm,
  source: IndustrySourceState,
): QuantityFormBindingEvaluation {
  const evaluation = evaluateIndustryBinding(form.binding ?? null, source);
  if (!form.calculated || evaluation.status === "stale") return { evaluation, report: null };
  try { return { evaluation, report: calculateQuantityForm(form) }; }
  catch { return { evaluation, report: null }; }
}

const QUANTITY_EVIDENCE_TEXT: Record<IndustrySourceBinding["evidenceClass"], string> = {
  traced: "traced source geometry",
  dimensioned: "dimensioned source geometry",
  inferred: "an inferred reconstruction",
  declared: "a typed reference",
};

/** Evidence classes are never promoted. Only traced and dimensioned evidence is source-derived; a
 * declared or inferred binding stays supplied and unverified even while its binding is current.
 */
export function describeQuantityBindingEvidence(binding: IndustrySourceBinding | null | undefined): string {
  if (!binding)
    return "Not bound: quantities and totals use the supplied inputs only and are not verified against any source.";
  return isVerifiedEvidenceClass(binding.evidenceClass)
    ? `Source-derived ${binding.evidenceClass} evidence from “${binding.sourceName}”. Quantities remain a draft classification and are not eligible for verified quotes.`
    : `Supplied evidence (${binding.evidenceClass}): ${QUANTITY_EVIDENCE_TEXT[binding.evidenceClass]} from “${binding.sourceName}”, not verified against the source.`;
}
