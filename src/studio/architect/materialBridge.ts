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
import type { AlterationBasis } from "./alterationStage.ts";
import { calculateAlterationQuantities } from "./alterationQuantities.ts";
import { calculateAlterationMaterialSchedule } from "./alterationSchedules.ts";

export const designPrefix = (p: ArchitectProject) => "design:" + p.id + ":";

/** Classification requires phase-aware review before syncing new work materials. */
export function designMaterialSyncBlockedReason(
  p: ArchitectProject,
  basis?: AlterationBasis | null,
): string | null {
  const isClassified = [...p.walls, ...p.openings, ...p.slabs, ...p.roofs].some(
    (element) => element.lifecycle !== undefined,
  );
  if (!isClassified) return null;
  if (!basis) {
    return "Alteration quantities require phase-aware review. Phase quantities are not supported yet without a valid reviewed alteration basis; classified designs cannot sync to the material register.";
  }
  const quantities = calculateAlterationQuantities(p, basis);
  if (!quantities.ready) {
    const firstBlocker = quantities.blockers[0]?.reason ?? "Alteration quantities are not ready.";
    return `Alteration quantities contain blockers: ${firstBlocker}`;
  }
  return null;
}

export function designSyncSummary(
  p: ArchitectProject,
  register: ProjectMaterials,
  basis?: AlterationBasis | null,
): {
  add: number;
  update: number;
  retire: number;
  blockedReason?: string;
} {
  const blockedReason = designMaterialSyncBlockedReason(p, basis);
  if (blockedReason) return { add: 0, update: 0, retire: 0, blockedReason };

  const isClassified = [...p.walls, ...p.openings, ...p.slabs, ...p.roofs].some(
    (element) => element.lifecycle !== undefined,
  );

  const rows = isClassified
    ? calculateAlterationMaterialSchedule(p, basis!).rows.map((r) => ({
        id: r.id,
        areaM2: r.netAreaM2,
        name: `${r.sourceElementName} / ${r.materialName}`,
        wallId: r.sourceElementId,
        layerId: r.layerId,
        materialVolumeM3: r.netVolumeM3,
        weightKg: null,
        allowancePercent: r.wastePercent,
        orderAreaM2: r.orderAreaM2,
        supplierReference: r.supplierReference,
        rateRevision: r.rateRevision,
        category: r.category,
      }))
    : designQuantities(p).rows.filter((r) => r.areaM2 > 1e-9);

  const keys = new Set(rows.map((r) => designPrefix(p) + r.id));
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
  basis?: AlterationBasis | null,
) {
  const blockedReason = designMaterialSyncBlockedReason(p, basis);
  if (blockedReason) throw Error(blockedReason);
  if (register.projectId !== p.id) throw Error("Design and register project differ.");

  const isClassified = [...p.walls, ...p.openings, ...p.slabs, ...p.roofs].some(
    (element) => element.lifecycle !== undefined,
  );

  let next = attachMaterialSource(register, source);
  const rows = isClassified
    ? calculateAlterationMaterialSchedule(p, basis!).rows.map((r) => ({
        id: r.id,
        areaM2: r.netAreaM2,
        name: `${r.sourceElementName} / ${r.materialName}`,
        wallId: r.sourceElementId,
        layerId: r.layerId,
        materialVolumeM3: r.netVolumeM3,
        weightKg: null as number | null,
        allowancePercent: r.wastePercent,
        orderAreaM2: r.orderAreaM2,
        supplierReference: r.supplierReference,
        rateRevision: r.rateRevision,
        category: r.category as string,
        lifecycleStatus: r.lifecycleStatus,
      }))
    : designQuantities(p).rows.filter((r) => r.areaM2 > 1e-9).map((r) => ({
        ...r,
        category:
          r.layerId === "roof"
            ? "Roof covering"
            : r.layerId === "slab"
              ? "Slab"
              : ["fascia", "gutter"].includes(r.layerId)
                ? "Roof trim"
                : "Wall layer",
        lifecycleStatus: "legacy",
      }));

  const keys = new Set(rows.map((r) => designPrefix(p) + r.id));
  for (const [i, r] of rows.entries()) {
    const key = designPrefix(p) + r.id,
      existing = next.materials.find((m) => m.physicalKey === key),
      page = 2 + Math.floor(i / 12),
      draft = existing
        ? structuredClone(existing)
        : newProjectMaterial(source, page, crypto.randomUUID()),
      host = [...p.walls, ...p.slabs, ...p.roofs].find((w) => w.id === r.wallId),
      level = host ? p.levels.find((l) => l.id === host.levelId) : undefined;
    if (existing?.calculation.startsWith(`Design revision ${p.revision};`)) continue;
    draft.physicalKey = key;
    draft.stock.stockCode = existing?.stock.stockCode || "DES-" + draft.stock.id.slice(0, 12);
    if (existing && existing.stock.unit !== "m2")
      throw Error("A design-linked stock unit was edited. Review that row before resynchronising.");
    draft.stock.description = existing?.stock.description || r.name;
    draft.stock.quantity = r.areaM2;
    draft.stock.unit = "m2";
    draft.stock.reference = isClassified
      ? `${source.name}, page ${page}; reviewed alteration basis ${basis!.reference}`
      : `${source.name}, page ${page}; authored design, not measured source-plan evidence`;
    draft.stock.specifiedWeightKg =
      r.weightKg === null ? (existing?.stock.specifiedWeightKg ?? null) : r.weightKg / r.areaM2;
    draft.stock.weightBasis = "unit";
    draft.discipline = "Architectural";
    draft.category = r.category;
    draft.building = "Authored design / " + p.name;
    draft.floor = level?.name ?? "General";
    draft.location = host?.name ?? r.name;
    draft.specification = r.supplierReference || existing?.specification || "";
    draft.quantityBasis = "derived";
    draft.calculation = isClassified
      ? `Design revision ${p.revision}; alteration basis ${basis!.reference}; ${r.areaM2.toFixed(6)} m2 net geometry. ${r.allowancePercent}% waste excluded from net register quantity. Lifecycle: ${r.lifecycleStatus}.`
      : `Design revision ${p.revision}; ${r.areaM2.toFixed(6)} m2 net geometry. Openings deducted and wall junction overlap removed. ${r.allowancePercent}% waste excluded from net register quantity.`;
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
        reference: isClassified
          ? `Alteration quantity ${i + 1}; model revision ${p.revision}; basis ${basis!.reference}`
          : `Design quantity ${i + 1}; model revision ${p.revision}`,
        x: null,
        y: null,
      },
    ];
    draft.review = "pending";
    draft.reviewNote = isClassified ? `Reviewed alteration basis: ${basis!.reference}` : "";
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
