import { aiRunSchema, type AiMaterialRun } from "./aiMaterials.ts";
import {
  newProjectMaterial,
  projectMaterialsSchema,
  putProjectMaterial,
  type ProjectMaterials,
  type ProjectMaterial,
} from "./projectMaterials.ts";

export function appendAiRun(value: ProjectMaterials, run: AiMaterialRun): ProjectMaterials {
  const checked = aiRunSchema.parse(run);
  if (checked.inventoryRevision !== value.revision)
    throw Error(
      "Inventory changed during AI interpretation. Review the latest source before retrying.",
    );
  return projectMaterialsSchema.parse({
    ...value,
    revision: value.revision + 1,
    aiRuns: [...value.aiRuns, checked],
    sheets: value.sheets.map((s) =>
      s.sha256 === run.sourceSha256 && s.page === run.page
        ? { ...s, reviewed: false, reviewNote: "" }
        : s,
    ),
  });
}
export function aiProposalDraft(
  value: ProjectMaterials,
  runId: string,
  index: number,
  id: string,
): ProjectMaterial {
  const run = value.aiRuns.find((r) => r.id === runId),
    p = run?.result.proposals[index];
  if (!run || !p || run.decisions.some((d) => d.index === index))
    throw Error("AI proposal is unavailable or already resolved.");
  const source = value.sources.find((s) => s.sha256 === run.sourceSha256)!;
  const m = newProjectMaterial(source, run.page, id);
  const provenance = `AI proposal ${run.provider}/${run.model}, run ${run.id}; unverified. ${p.evidence.reference}: ${p.evidence.quote}`;
  return {
    ...m,
    physicalKey: p.tag ? `${p.discipline}/${p.tag}/${p.category}` : "",
    discipline: p.discipline,
    category: p.category,
    floor: p.floor,
    location: p.location,
    specification: p.specification,
    quantityBasis: p.quantityBasis,
    calculation: p.calculation,
    dimensionsM: p.dimensionsM,
    dimensionReference: p.dimensionReference,
    unresolved: p.unresolved.join("; "),
    materialVolumePerUnitM3: p.materialVolumePerUnitM3,
    volumeReference: p.volumeReference,
    evidence: [
      {
        sha256: run.sourceSha256,
        page: run.page,
        reference: p.evidence.reference.slice(0, 240),
        x: p.evidence.box.x + p.evidence.box.width / 2,
        y: p.evidence.box.y + p.evidence.box.height / 2,
      },
    ],
    stock: {
      ...m.stock,
      stockCode: `AI-${run.id.slice(0, 8)}-${index + 1}`,
      description: p.label.slice(0, 300),
      quantity: p.quantity,
      unit: p.unit,
      specifiedWeightKg: p.specifiedWeightKg,
      reference: [provenance, p.weightReference].filter(Boolean).join("; ").slice(0, 2000),
    },
    review: "pending",
    reviewNote: "",
  };
}
export function resolveAiProposal(
  value: ProjectMaterials,
  runId: string,
  index: number,
  action: "material" | "linked" | "excluded",
  materialId: string | null,
  reason: string,
): ProjectMaterials {
  const run = value.aiRuns.find((r) => r.id === runId),
    p = run?.result.proposals[index];
  if (!run || !p || run.decisions.some((d) => d.index === index))
    throw Error("AI proposal already resolved or unavailable.");
  if (!reason.trim()) throw Error("Record why this AI proposal was accepted, linked or excluded.");
  let next = value;
  if (action !== "excluded") {
    const material = value.materials.find((m) => m.stock.id === materialId);
    if (!material) throw Error("Choose an existing physical material.");
    if (!material.evidence.some((e) => e.sha256 === run.sourceSha256 && e.page === run.page))
      next = putProjectMaterial(value, {
        ...material,
        evidence: [
          ...material.evidence,
          {
            sha256: run.sourceSha256,
            page: run.page,
            reference: p.evidence.reference.slice(0, 240),
            x: p.evidence.box.x + p.evidence.box.width / 2,
            y: p.evidence.box.y + p.evidence.box.height / 2,
          },
        ],
      });
  }
  return projectMaterialsSchema.parse({
    ...next,
    revision: next.revision + 1,
    aiRuns: next.aiRuns.map((r) =>
      r.id === runId
        ? {
            ...r,
            decisions: [
              ...r.decisions,
              { index, action, materialId: action === "excluded" ? null : materialId, reason },
            ],
          }
        : r,
    ),
    sheets: next.sheets.map((s) =>
      s.sha256 === run.sourceSha256 && s.page === run.page
        ? { ...s, reviewed: false, reviewNote: "" }
        : s,
    ),
  });
}
