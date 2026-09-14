import { validateProject, type ArchitectProject } from "./model.ts";

export type AlterationStage = "before" | "proposed";
export type AlterationBasis = { reference: string; fingerprint: string };
export type AlterationStageResolution =
  | { ready: true; stage: AlterationStage; model: ArchitectProject; basisReference: string; excludedIds: string[] }
  | { ready: false; stage: AlterationStage; blockers: { elementId: string; reason: string }[] };

function stable(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value !== null && typeof value === "object") {
    return "{" + Object.entries(value).filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => JSON.stringify(key) + ":" + stable(item)).join(",") + "}";
  }
  return JSON.stringify(value);
}

/** Exact canonical signature, not a source hash or a certification. Full entity
 * fields intentionally invalidate the review conservatively, including layers,
 * host relationships, lifecycle references and revision changes. Physical entity
 * array ordering is immaterial; point/layer ordering remains meaningful.
 */
function fingerprint(p: ArchitectProject): string {
  const sorted = <T extends { id: string }>(items: T[]) => [...items].sort((a, b) => a.id.localeCompare(b.id));
  return stable({
    contract: "xray.alteration-basis/v1", projectId: p.id, units: p.units,
    levels: sorted(p.levels), walls: sorted(p.walls), openings: sorted(p.openings),
    slabs: sorted(p.slabs), roofs: sorted(p.roofs),
  });
}

/** Explicit session review: the operator declares that existing/repaired geometry
 * is unchanged across stages at this signature. It cannot reconstruct an earlier
 * shape or validate survey evidence. Reloading should require a new review.
 */
export function createAlterationBasis(project: ArchitectProject, reference: string): AlterationBasis {
  if (typeof reference !== "string" || !reference.trim() || reference.trim().length > 500) {
    throw Error("A reviewed alteration basis requires a reference of 1 to 500 characters.");
  }
  return { reference: reference.trim(), fingerprint: fingerprint(validateProject(project)) };
}

/** Derive stage geometry only after resolving the entire physical classification.
 * The result remains authored draft geometry. It does not unlock material sync,
 * pricing, disposal quantities or shared-volume allocation between classifications.
 */
export function resolveAlterationStage(
  project: ArchitectProject,
  basis: AlterationBasis | null,
  stage: AlterationStage,
): AlterationStageResolution {
  if (stage !== "before" && stage !== "proposed") throw Error("Unknown alteration stage.");
  const p = validateProject(project);
  const blockers: { elementId: string; reason: string }[] = [];
  if (!basis || typeof basis.reference !== "string" || !basis.reference.trim() || basis.reference.trim().length > 500 || typeof basis.fingerprint !== "string") {
    blockers.push({ elementId: p.id, reason: "Review a referenced geometry basis before resolving either alteration stage." });
  } else if (basis.fingerprint !== fingerprint(p)) {
    blockers.push({ elementId: p.id, reason: "The reviewed geometry basis is stale or belongs to another project; review the current geometry and lifecycle intent again." });
  }
  const elements = [...p.walls, ...p.openings, ...p.slabs, ...p.roofs];
  for (const element of elements) {
    if (!element.lifecycle) blockers.push({ elementId: element.id, reason: "Unassigned lifecycle prevents a complete before/proposed model." });
  }
  const hosts = new Map(p.walls.map((wall) => [wall.id, wall]));
  for (const opening of p.openings) {
    const host = hosts.get(opening.wallId)!;
    if (opening.lifecycle?.status === "new" && host.lifecycle?.status === "demolished") {
      blockers.push({ elementId: opening.id, reason: "A new opening cannot be resolved in a demolished host wall; review the contradictory intent." });
    }
    if (host.lifecycle?.status === "new" && opening.lifecycle && opening.lifecycle.status !== "new") {
      blockers.push({ elementId: opening.id, reason: "An opening present before alteration cannot be hosted by a new wall; review the contradictory intent." });
    }
    if (opening.lifecycle?.status === "demolished" && !opening.demolitionDisposition && (host.lifecycle?.status === "existing" || host.lifecycle?.status === "repaired")) {
      blockers.push({ elementId: opening.id, reason: "A demolished opening in a retained wall needs explicit retain-void or authored infill disposition; this resolver cannot invent it." });
    }
  }
  if (blockers.length) return { ready: false, stage, blockers };

  const excludedIds: string[] = [];
  const present = (element: { id: string; lifecycle?: { status: string } }): boolean => {
    const included = stage === "before" ? element.lifecycle!.status !== "new" : element.lifecycle!.status !== "demolished";
    if (!included) excludedIds.push(element.id);
    return included;
  };
  p.walls = p.walls.filter(present);
  const retainedHosts = new Set(p.walls.map((wall) => wall.id));
  p.openings = p.openings.filter((opening) => {
    if (!retainedHosts.has(opening.wallId)) { excludedIds.push(opening.id); return false; }
    if (stage === "proposed" && opening.lifecycle!.status === "demolished" && opening.demolitionDisposition?.kind === "retain-void") {
      opening.kind = "void";
      delete opening.demolitionDisposition;
      return true;
    }
    return present(opening);
  });
  p.slabs = p.slabs.filter(present);
  p.roofs = p.roofs.filter(present);
  p.dimensions = p.dimensions.filter((dimension) => {
    if (retainedHosts.has(dimension.wallId)) return true;
    excludedIds.push(dimension.id);
    return false;
  });
  // Frozen issue history belongs to the original all-work project; exposing it
  // as history of this ephemeral filtered model would imply a false issue basis.
  delete p.issues;
  delete p.alterationDrafts;
  return { ready: true, stage, model: validateProject(p), basisReference: basis!.reference.trim(), excludedIds };
}
