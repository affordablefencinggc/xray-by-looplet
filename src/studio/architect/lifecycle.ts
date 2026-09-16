import { z } from "zod";
import { validateProject, type ArchitectProject } from "./model.ts";

export type LifecycleStatus = "existing" | "new" | "demolished" | "repaired";
export type LifecycleRecord = { status: LifecycleStatus; reference: string };
export type AlterationStatus = LifecycleStatus | "unassigned";
export type OpeningDemolitionDisposition =
  | { kind: "retain-void"; reference: string }
  | { kind: "infill"; reference: string }
  | {
      kind: "partial-infill";
      reference: string;
      remainingVoid: { offset: number; width: number; height: number; sill: number };
    };
export type RepairBasis = { reference: string; height: number };
export type AlterationRow = {
  id: string;
  kind: "wall" | "opening" | "slab" | "roof";
  name: string;
  levelId: string;
  status: AlterationStatus;
  reference: string;
  demolitionDisposition?: OpeningDemolitionDisposition;
  repairBasis?: RepairBasis;
};
export type AlterationWarning = {
  code: "new-opening-demolished-host";
  elementId: string;
  hostId: string;
  message: string;
};

const lifecycleSchema = z.object({
  status: z.enum(["existing", "new", "demolished", "repaired"]),
  reference: z.string().trim().min(1).max(500),
}).strict();

/** Explicit authored classification, never source verification or a quantity instruction.
 * Revisions and history belong to the workspace commit, not this pure edit.
 */
export function setElementLifecycle(
  project: ArchitectProject,
  id: string,
  lifecycle: LifecycleRecord | null,
): ArchitectProject {
  const record = lifecycle === null ? null : lifecycleSchema.parse(lifecycle);
  const next = validateProject(project);
  const element = [...next.walls, ...next.openings, ...next.slabs, ...next.roofs]
    .find((item) => item.id === id);
  if (!element) throw Error("Lifecycle requires an existing wall, opening, slab or roof identity.");
  if (record === null) delete element.lifecycle;
  else element.lifecycle = record;
  if ("wallId" in element && record?.status !== "demolished") delete element.demolitionDisposition;
  // A changed-repair before state only has meaning while the wall is repaired.
  if ("layers" in element && record?.status !== "repaired") delete element.repairBasis;
  return validateProject(next);
}

const dispositionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("retain-void"), reference: z.string().trim().min(1).max(500) }).strict(),
  z.object({ kind: z.literal("infill"), reference: z.string().trim().min(1).max(500) }).strict(),
  z.object({
    kind: z.literal("partial-infill"),
    reference: z.string().trim().min(1).max(500),
    remainingVoid: z.object({
      offset: z.number().finite().min(-1e6).max(1e6),
      width: z.number().finite().positive().max(1e6),
      height: z.number().finite().positive().max(1e6),
      sill: z.number().finite().nonnegative().max(1e6),
    }).strict(),
  }).strict(),
]);

/** Explicit authored disposition for a demolished door or window.
 * retain-void removes the fixture and keeps its authored cut; infill removes the
 * fixture and closes the cut using only the host wall's own authored layers.
 * Neither may be inferred: the operator authors one with an explicit reference.
 */
export function setOpeningDemolitionDisposition(project: ArchitectProject, id: string,
  disposition: OpeningDemolitionDisposition | null): ArchitectProject {
  const next = validateProject(project);
  const opening = next.openings.find(item => item.id === id);
  if (!opening) throw Error("Demolition disposition requires an existing opening.");
  if (disposition === null) delete opening.demolitionDisposition;
  else {
    if (opening.kind === "void" || opening.lifecycle?.status !== "demolished")
      throw Error("Assign demolished work status to a door or window before retaining or infilling its void.");
    opening.demolitionDisposition = dispositionSchema.parse(disposition);
  }
  return validateProject(next);
}

const repairBasisInputSchema = z.object({
  reference: z.string().trim().min(1).max(500),
  height: z.number().finite().positive().max(1e6),
}).strict();

/** Explicit authored before-alteration shape for a repair whose geometry changed.
 * It describes the earlier dimensions of this same wall and is never derived from
 * the current geometry, a survey or frozen issue history. Without it a repaired
 * wall keeps its existing unchanged-across-stages meaning.
 */
export function setWallRepairBasis(project: ArchitectProject, id: string,
  basis: RepairBasis | null): ArchitectProject {
  const next = validateProject(project);
  const wall = next.walls.find(item => item.id === id);
  if (!wall) throw Error("A changed-repair before state requires an existing wall.");
  if (basis === null) delete wall.repairBasis;
  else {
    if (wall.lifecycle?.status !== "repaired")
      throw Error("Assign repaired work status to the wall before recording its changed-repair before state.");
    wall.repairBasis = repairBasisInputSchema.parse(basis);
  }
  return validateProject(next);
}

/** Element counts only: no measured quantities, pricing or compliance is implied.
 * A new opening in a demolished host is retained as an explicit review warning;
 * changing its status must not silently change or remove either geometry object.
 */
export function alterationSchedule(project: ArchitectProject): {
  rows: AlterationRow[];
  counts: Record<AlterationStatus, number>;
  warnings: AlterationWarning[];
  draftOnly: true;
  quoteEligible: false;
} {
  const p = validateProject(project);
  const walls = new Map(p.walls.map((wall) => [wall.id, wall]));
  const rows: AlterationRow[] = [];
  const warnings: AlterationWarning[] = [];
  const counts: Record<AlterationStatus, number> = {
    unassigned: 0, existing: 0, new: 0, demolished: 0, repaired: 0,
  };
  for (const [kind, elements] of [
    ["wall", p.walls], ["opening", p.openings], ["slab", p.slabs], ["roof", p.roofs],
  ] as const) {
    for (const element of elements) {
      const host = "wallId" in element ? walls.get(element.wallId) : undefined;
      const status = element.lifecycle?.status ?? "unassigned";
      rows.push({
        id: element.id,
        kind,
        name: "tag" in element ? element.tag : element.name,
        levelId: "levelId" in element ? element.levelId : host!.levelId,
        status,
        reference: element.lifecycle?.reference ?? "",
        ...("wallId" in element && element.demolitionDisposition ? { demolitionDisposition: element.demolitionDisposition } : {}),
        ...("layers" in element && element.repairBasis ? { repairBasis: element.repairBasis } : {}),
      });
      counts[status]++;
      if (status === "new" && host?.lifecycle?.status === "demolished") {
        warnings.push({
          code: "new-opening-demolished-host",
          elementId: element.id,
          hostId: host.id,
          message: `New opening ${"tag" in element ? element.tag : element.id} is hosted by demolished wall ${host.name}; review the alteration intent.`,
        });
      }
    }
  }
  return { rows, counts, warnings, draftOnly: true, quoteEligible: false };
}

/** Spreadsheet-safe text export of authored intent, with per-row evidence flags.
 * Prefix formula-like text before quoting: CSV quoting alone does not stop a
 * spreadsheet interpreting user-controlled labels or references as formulas.
 */
export function alterationScheduleCsv(project: ArchitectProject): string {
  const schedule = alterationSchedule(project);
  const cell = (value: string | number | boolean): string => {
    const text = String(value);
    const safe = /^[\s\u0000-\u001f\u007f-\u009f]*[=+\-@]/u.test(text) ? "'" + text : text;
    return '"' + safe.replace(/"/g, '""') + '"';
  };
  const headers = ["projectId", "revision", "id", "kind", "name", "levelId", "status", "reference", "draftOnly", "quoteEligible", "demolitionDisposition", "dispositionReference", "repairBasisReference", "repairBasisHeight"];
  return [
    headers.map(cell).join(","),
    ...schedule.rows.map((row) => [
      project.id, project.revision, row.id, row.kind, row.name, row.levelId,
      row.status, row.reference, schedule.draftOnly, schedule.quoteEligible, row.demolitionDisposition?.kind ?? "", row.demolitionDisposition?.reference ?? "",
      row.repairBasis?.reference ?? "", row.repairBasis?.height ?? "",
    ].map(cell).join(",")),
  ].join("\r\n") + "\r\n";
}
