import { polygonArea, union, wallAtHeight, type MultiPolygon } from "./geometry.ts";
import { wallThickness, type ArchitectProject } from "./model.ts";
import { resolveAlterationStage, type AlterationBasis } from "./alterationStage.ts";

type Blocker = { elementId: string; reason: string };
export type AlterationQuantities =
  | { ready: true; basisReference: string; units: "m3"; beforeWallSolidVolumeM3: number;
      proposedWallSolidVolumeM3: number; deltaWallSolidVolumeM3: number; notes: string[]; quoteEligible: false }
  | { ready: false; blockers: Blocker[]; quoteEligible: false };

/** Bounds synchronous clipping work; exceeding this limit must not return a partial total. */
const MAX_LAYER_BAND_CHECKS = 100_000;

/** Union physical solid layers before assigning any ownership. wallSolids() assigns
 * overlaps to wall IDs, which cannot define an aggregate across solid/void layers.
 * Absolute height bands also remove overlap between walls on different levels.
 */
function solidVolume(p: ArchitectProject): number {
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
  let total = 0;
  for (let band = 0; band + 1 < cuts.length; band++) {
    const low = cuts[band], high = cuts[band + 1], mid = low + (high - low) / 2;
    if (high - low <= 0.002)
      throw Error("Stage height boundaries are within 0.002 mm; the opening-cut tolerance cannot resolve this band safely.");
    const polygons: MultiPolygon[] = [];
    for (const { wall, bottom } of walls) {
      if (mid <= bottom || mid >= bottom + wall.height) continue;
      let offset = -wallThickness(wall) / 2;
      for (const layer of wall.layers) {
        if (layer.kind === "solid") {
          const raw = wallAtHeight(wall, p, mid - bottom, offset, offset + layer.thickness);
          if (raw.length) polygons.push(raw);
        }
        offset += layer.thickness;
      }
    }
    // Geometry order, not identity or array order, determines clipping input order.
    polygons.sort((a, b) => {
      const left = JSON.stringify(a), right = JSON.stringify(b);
      return left < right ? -1 : left > right ? 1 : 0;
    });
    const volume = polygonArea(union(...polygons)) * (high - low) / 1e9;
    if (!Number.isFinite(volume) || volume < 0) throw Error("Stage clipping produced an invalid solid volume; review the geometry.");
    total += volume;
    if (!Number.isFinite(total)) throw Error("Stage volume exceeded the finite calculation range.");
  }
  return total;
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
    const beforeWallSolidVolumeM3 = solidVolume(before.model), proposedWallSolidVolumeM3 = solidVolume(proposed.model);
    const deltaWallSolidVolumeM3 = proposedWallSolidVolumeM3 - beforeWallSolidVolumeM3;
    if (!Number.isFinite(deltaWallSolidVolumeM3)) throw Error("Stage volume difference is not finite.");
    return {
      ready: true, basisReference: before.basisReference, units: "m3",
      beforeWallSolidVolumeM3, proposedWallSolidVolumeM3, deltaWallSolidVolumeM3, quoteEligible: false,
      notes: [
        "Authored wall solid layers only; void layers excluded. Slabs, roofs, contents and fixtures are outside this calculation.",
        "Openings cut their own host. Overlapping solid geometry is counted once across walls and levels; no material or lifecycle ownership is assigned.",
        "Wall outlines use the existing authored miter rule for equal-thickness walls sharing an endpoint, including where wall heights differ; no alternative junction detailing is inferred.",
        "Delta is proposed minus before geometry, not a demolition, disposal, salvage, repair or procurement quantity.",
        "Planar clipping uses the model's 0.001 mm coordinate precision. Reviewed authored intent is not verified survey evidence.",
      ],
    };
  } catch (error) {
    return { ready: false, blockers: [{ elementId: project.id, reason: error instanceof Error ? error.message : "Stage geometry calculation failed." }], quoteEligible: false };
  }
}
