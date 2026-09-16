import { polygonArea, union, difference, polygonIntersection, wallAtHeight, type MultiPolygon } from "./geometry.ts";
import { wallThickness, type ArchitectProject } from "./model.ts";
import { resolveAlterationStage, type AlterationBasis } from "./alterationStage.ts";

type Blocker = { elementId: string; reason: string };

export type AlterationLifecycleBreakdown = {
  existingBeforeVolumeM3: number;
  existingProposedVolumeM3: number;
  demolishedVolumeM3: number;
  newVolumeM3: number;
  repairedBeforeVolumeM3: number;
  repairedProposedVolumeM3: number;
  beforeSharedJunctionVolumeM3: number;
  proposedSharedJunctionVolumeM3: number;
  hasUnresolvedSharedAllocation: boolean;
};

export type AlterationQuantities =
  | {
      ready: true;
      basisReference: string;
      units: "m3";
      beforeWallSolidVolumeM3: number;
      proposedWallSolidVolumeM3: number;
      deltaWallSolidVolumeM3: number;
      breakdown: AlterationLifecycleBreakdown;
      notes: string[];
      quoteEligible: false;
    }
  | { ready: false; blockers: Blocker[]; quoteEligible: false };

/** Bounds synchronous clipping work; exceeding this limit must not return a partial total. */
const MAX_LAYER_BAND_CHECKS = 100_000;

type StageVolumeResult = {
  totalVolumeM3: number;
  existingVolumeM3: number;
  demolishedVolumeM3: number;
  newVolumeM3: number;
  repairedVolumeM3: number;
  sharedJunctionVolumeM3: number;
};

const sortByGeometry = (polygons: MultiPolygon[]) =>
  polygons.sort((a, b) => {
    const left = JSON.stringify(a), right = JSON.stringify(b);
    return left < right ? -1 : left > right ? 1 : 0;
  });

/** Union physical solid layers within lifecycle categories before resolving cross-category boundaries.
 * Wall solid geometry is partitioned into pure category footprints and explicit shared junction volume,
 * guaranteeing strict ID-order invariance across wall naming, array ordering, and level offsets.
 */
function stageVolumes(p: ArchitectProject, stage: "before" | "proposed"): StageVolumeResult {
  const levels = new Map(p.levels.map(level => [level.id, level]));
  const walls = p.walls.map(wall => ({ wall, bottom: levels.get(wall.levelId)!.elevation }));
  const hosts = new Map(walls.map(host => [host.wall.id, host]));
  const cuts = [...new Set([
    ...walls.flatMap(({ wall, bottom }) => [bottom, bottom + wall.height]),
    ...p.openings.flatMap(opening => {
      const bottom = hosts.get(opening.wallId)!.bottom;
      return [bottom + opening.sill, bottom + opening.sill + opening.height];
    }),
  ])].sort((a, b) => a - b);
  const layerCount = walls.reduce((sum, { wall }) => sum + wall.layers.length, 0);
  if (Math.max(0, cuts.length - 1) * layerCount > MAX_LAYER_BAND_CHECKS)
    throw Error("Stage geometry exceeds the supported layer/height-band calculation limit; no partial volume was returned.");

  let totalVolumeM3 = 0;
  let existingVolumeM3 = 0;
  let demolishedVolumeM3 = 0;
  let newVolumeM3 = 0;
  let repairedVolumeM3 = 0;
  let sharedJunctionVolumeM3 = 0;

  for (let band = 0; band + 1 < cuts.length; band++) {
    const low = cuts[band], high = cuts[band + 1], mid = low + (high - low) / 2;
    if (high - low <= 0.002)
      throw Error("Stage height boundaries are within 0.002 mm; the opening-cut tolerance cannot resolve this band safely.");

    const existingPolygons: MultiPolygon[] = [];
    const demolishedPolygons: MultiPolygon[] = [];
    const newPolygons: MultiPolygon[] = [];
    const repairedPolygons: MultiPolygon[] = [];

    for (const { wall, bottom } of walls) {
      if (mid <= bottom || mid >= bottom + wall.height) continue;
      let offset = -wallThickness(wall) / 2;
      for (const layer of wall.layers) {
        if (layer.kind === "solid") {
          const raw = wallAtHeight(wall, p, mid - bottom, offset, offset + layer.thickness);
          if (raw.length) {
            const status = wall.lifecycle?.status ?? "existing";
            if (status === "existing") existingPolygons.push(raw);
            else if (status === "demolished") demolishedPolygons.push(raw);
            else if (status === "new") newPolygons.push(raw);
            else if (status === "repaired") repairedPolygons.push(raw);
          }
        }
        offset += layer.thickness;
      }
    }

    const allPolygons = [...existingPolygons, ...demolishedPolygons, ...newPolygons, ...repairedPolygons];
    sortByGeometry(allPolygons);
    const bandTotal = polygonArea(union(...allPolygons)) * (high - low) / 1e9;
    if (!Number.isFinite(bandTotal) || bandTotal < 0) throw Error("Stage clipping produced an invalid solid volume; review the geometry.");
    totalVolumeM3 += bandTotal;

    const P_E = union(...sortByGeometry(existingPolygons));
    const P_D = stage === "before" ? union(...sortByGeometry(demolishedPolygons)) : [];
    const P_N = stage === "proposed" ? union(...sortByGeometry(newPolygons)) : [];
    const P_R = union(...sortByGeometry(repairedPolygons));

    let P_shared: MultiPolygon;
    let pure_E: MultiPolygon;
    let pure_D: MultiPolygon = [];
    let pure_N: MultiPolygon = [];
    let pure_R: MultiPolygon;

    if (stage === "before") {
      const I_ED = polygonIntersection(P_E, P_D);
      const I_ER = polygonIntersection(P_E, P_R);
      const I_DR = polygonIntersection(P_D, P_R);
      P_shared = union(I_ED, I_ER, I_DR);
      pure_E = difference(P_E, P_shared);
      pure_D = difference(P_D, P_shared);
      pure_R = difference(P_R, P_shared);
    } else {
      const I_EN = polygonIntersection(P_E, P_N);
      const I_ER = polygonIntersection(P_E, P_R);
      const I_NR = polygonIntersection(P_N, P_R);
      P_shared = union(I_EN, I_ER, I_NR);
      pure_E = difference(P_E, P_shared);
      pure_N = difference(P_N, P_shared);
      pure_R = difference(P_R, P_shared);
    }

    const bandHeightM = (high - low) / 1e9;
    existingVolumeM3 += polygonArea(pure_E) * bandHeightM;
    if (stage === "before") demolishedVolumeM3 += polygonArea(pure_D) * bandHeightM;
    if (stage === "proposed") newVolumeM3 += polygonArea(pure_N) * bandHeightM;
    repairedVolumeM3 += polygonArea(pure_R) * bandHeightM;
    sharedJunctionVolumeM3 += polygonArea(P_shared) * bandHeightM;
  }

  if (!Number.isFinite(totalVolumeM3)) throw Error("Stage volume exceeded the finite calculation range.");

  return {
    totalVolumeM3,
    existingVolumeM3,
    demolishedVolumeM3,
    newVolumeM3,
    repairedVolumeM3,
    sharedJunctionVolumeM3,
  };
}

/** Authored wall-solid geometry only. Delta is proposed minus before, never
 * a demolition, disposal, salvage, repair or purchase quantity. Unknown assembly
 * contents block the report rather than being treated as either solid or empty.
 */
export function calculateAlterationQuantities(project: ArchitectProject, basis: AlterationBasis | null): AlterationQuantities {
  try {
    const before = resolveAlterationStage(project, basis, "before");
    const proposed = resolveAlterationStage(project, basis, "proposed");
    const blockers: Blocker[] = [];
    for (const result of [before, proposed]) {
      if (!result.ready) for (const blocker of result.blockers) {
        if (!blockers.some(existing => existing.elementId === blocker.elementId && existing.reason === blocker.reason)) blockers.push(blocker);
      }
    }
    if (!before.ready || !proposed.ready) return { ready: false, blockers, quoteEligible: false };
    for (const wall of project.walls) {
      if (wall.layers.some(layer => layer.kind === "assembly")) blockers.push({
        elementId: wall.id,
        reason: "Wall assembly contents are unspecified. Declare physical solid and void layers before calculating wall-solid volume.",
      });
    }
    if (blockers.length) return { ready: false, blockers, quoteEligible: false };

    const beforeVolumes = stageVolumes(before.model, "before");
    const proposedVolumes = stageVolumes(proposed.model, "proposed");

    const beforeWallSolidVolumeM3 = beforeVolumes.totalVolumeM3;
    const proposedWallSolidVolumeM3 = proposedVolumes.totalVolumeM3;
    const deltaWallSolidVolumeM3 = proposedWallSolidVolumeM3 - beforeWallSolidVolumeM3;
    if (!Number.isFinite(deltaWallSolidVolumeM3)) throw Error("Stage volume difference is not finite.");

    const hasUnresolvedSharedAllocation = beforeVolumes.sharedJunctionVolumeM3 > 0.0005 || proposedVolumes.sharedJunctionVolumeM3 > 0.0005;
    const breakdown: AlterationLifecycleBreakdown = {
      existingBeforeVolumeM3: beforeVolumes.existingVolumeM3,
      existingProposedVolumeM3: proposedVolumes.existingVolumeM3,
      demolishedVolumeM3: beforeVolumes.demolishedVolumeM3,
      newVolumeM3: proposedVolumes.newVolumeM3,
      repairedBeforeVolumeM3: beforeVolumes.repairedVolumeM3,
      repairedProposedVolumeM3: proposedVolumes.repairedVolumeM3,
      beforeSharedJunctionVolumeM3: beforeVolumes.sharedJunctionVolumeM3,
      proposedSharedJunctionVolumeM3: proposedVolumes.sharedJunctionVolumeM3,
      hasUnresolvedSharedAllocation,
    };

    return {
      ready: true,
      basisReference: before.basisReference,
      units: "m3",
      beforeWallSolidVolumeM3,
      proposedWallSolidVolumeM3,
      deltaWallSolidVolumeM3,
      breakdown,
      quoteEligible: false,
      notes: [
        "Authored wall solid layers only; void layers excluded. Slabs, roofs, contents and fixtures are outside this calculation.",
        "Openings cut their own host. Overlapping solid geometry within a lifecycle category is unified without duplicate count.",
        "Cross-category shared junction volume (e.g. existing/new or demolished/repaired intersections) is disclosed explicitly without arbitrary priority or ID-order attribution.",
        "Wall outlines use the existing authored miter rule for equal-thickness walls sharing an endpoint, including where wall heights differ; no alternative junction detailing is inferred.",
        "Delta is proposed minus before geometry, not a demolition, disposal, salvage, repair or procurement quantity.",
        "Planar clipping uses the model's 0.001 mm coordinate precision. Reviewed authored intent is not verified survey evidence.",
      ],
    };
  } catch (error) {
    return { ready: false, blockers: [{ elementId: project.id, reason: error instanceof Error ? error.message : "Stage geometry calculation failed." }], quoteEligible: false };
  }
}
