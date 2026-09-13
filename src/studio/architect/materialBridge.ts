import { designQuantities } from "./geometry.ts";
import type { ArchitectProject } from "./model.ts";
import {
  attachMaterialSource,
  newProjectMaterial,
  putProjectMaterial,
  projectMaterialsSchema,
  type ProjectMaterials,
  type MaterialSource,
} from "../construction/projectMaterials.ts";
export const designPrefix = (p: ArchitectProject) => "design:" + p.id + ":";
/** Classification is not a phase-aware quantity calculation or procurement scope. */
export function designMaterialSyncBlockedReason(p: ArchitectProject): string | null {
  return [...p.walls, ...p.openings, ...p.slabs, ...p.roofs].some(element => element.lifecycle !== undefined)
    ? "Alteration quantities require phase-aware review. Phase quantities are not supported yet; classified designs cannot sync to the material register."
    : null;
}
export function designSyncSummary(p: ArchitectProject, register: ProjectMaterials): {
  add: number; update: number; retire: number; blockedReason?: string;
} {
  const blockedReason = designMaterialSyncBlockedReason(p);
  if (blockedReason) return { add: 0, update: 0, retire: 0, blockedReason };
  const rows = designQuantities(p).rows.filter((r) => r.areaM2 > 1e-9),
    keys = new Set(rows.map((r) => designPrefix(p) + r.id));
  return {
    add: rows.filter(
      (r) => !register.materials.some((m) => m.physicalKey === designPrefix(p) + r.id),
    ).length,
    update: rows.filter((r) =>
      register.materials.some(
        (m) =>
          m.physicalKey === designPrefix(p) + r.id &&
          !m.calculation.startsWith(`Design revision ${p.revision};`),
      ),
    ).length,
    retire: register.materials.filter(
      (m) =>
        m.physicalKey.startsWith(designPrefix(p)) &&
        !keys.has(m.physicalKey) &&
        m.stock.quantity !== 0,
    ).length,
  };
}
export function syncDesignMaterials(
  p: ArchitectProject,
  register: ProjectMaterials,
  source: MaterialSource,
) {
  const blockedReason = designMaterialSyncBlockedReason(p);
  if (blockedReason) throw Error(blockedReason);
  if (register.projectId !== p.id) throw Error("Design and register project differ.");
  let next = attachMaterialSource(register, source);
  const rows = designQuantities(p).rows.filter((r) => r.areaM2 > 1e-9),
    keys = new Set(rows.map((r) => designPrefix(p) + r.id));
  for (const [i, r] of rows.entries()) {
    const key = designPrefix(p) + r.id,
      existing = next.materials.find((m) => m.physicalKey === key),
      page = 2 + Math.floor(i / 12),
      draft = existing
        ? structuredClone(existing)
        : newProjectMaterial(source, page, crypto.randomUUID()),
      host = [...p.walls, ...p.slabs, ...p.roofs].find((w) => w.id === r.wallId)!,
      level = p.levels.find((l) => l.id === host.levelId)!;
    if (existing?.calculation.startsWith(`Design revision ${p.revision};`)) continue;
    draft.physicalKey = key;
    draft.stock.stockCode = existing?.stock.stockCode || "DES-" + draft.stock.id.slice(0, 12);
    if (existing && existing.stock.unit !== "m2")
      throw Error("A design-linked stock unit was edited. Review that row before resynchronising.");
    draft.stock.description = existing?.stock.description || r.name;
    draft.stock.quantity = r.areaM2;
    draft.stock.unit = "m2";
    draft.stock.reference = `${source.name}, page ${page}; authored design, not measured source-plan evidence`;
    draft.stock.specifiedWeightKg =
      r.weightKg === null ? (existing?.stock.specifiedWeightKg ?? null) : r.weightKg / r.areaM2;
    draft.stock.weightBasis = "unit";
    draft.discipline = "Architectural";
    draft.category =
      r.layerId === "roof"
        ? "Roof covering"
        : r.layerId === "slab"
          ? "Slab"
          : ["fascia", "gutter"].includes(r.layerId)
            ? "Roof trim"
            : "Wall layer";
    draft.building = "Authored design / " + p.name;
    draft.floor = level.name;
    draft.location = host.name;
    draft.specification = r.supplierReference || existing?.specification || "";
    draft.quantityBasis = "derived";
    draft.calculation = `Design revision ${p.revision}; ${r.areaM2.toFixed(6)} m2 net geometry. Openings deducted and wall junction overlap removed. ${r.allowancePercent}% waste excluded from net register quantity.`;
    draft.materialVolumePerUnitM3 =
      r.materialVolumeM3 === null ? null : r.materialVolumeM3 / r.areaM2;
    draft.volumeReference =
      r.materialVolumeM3 === null
        ? ""
        : `Authored solid geometry ${r.materialVolumeM3.toFixed(6)} m3 / ${r.areaM2.toFixed(6)} m2; design revision ${p.revision}`;
    draft.unresolved = [
      r.materialVolumeM3 === null ? "Assembly contents or covering thickness unspecified." : "",
      r.weightKg === null ? "Density/weight unspecified." : "",
      "Packed storage dimensions require supplier information.",
    ]
      .filter(Boolean)
      .join(" ");
    draft.evidence = [
      ...draft.evidence.filter((e) => e.sha256 !== source.sha256),
      {
        sha256: source.sha256,
        page,
        reference: `Design quantity ${i + 1}; model revision ${p.revision}`,
        x: null,
        y: null,
      },
    ];
    draft.review = "pending";
    draft.reviewNote = "";
    next = putProjectMaterial(next, draft);
  }
  for (const m of next.materials.filter(
    (m) =>
      m.physicalKey.startsWith(designPrefix(p)) &&
      !keys.has(m.physicalKey) &&
      m.stock.quantity !== 0,
  )) {
    next = putProjectMaterial(next, {
      ...m,
      stock: { ...m.stock, quantity: 0 },
      calculation: `Design revision ${p.revision}; removed from authored design, retained as a zero-quantity audit record.`,
      review: "pending",
      reviewNote: "",
    });
  }
  return projectMaterialsSchema.parse(next);
}
