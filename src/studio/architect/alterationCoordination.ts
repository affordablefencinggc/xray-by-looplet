import {
  type ArchitectProject,
  type Opening,
  type Wall,
  validateProject,
  pointInPolygon,
  area,
  perimeter,
  type Point,
} from "./model.ts";
import {
  resolveAlterationStage,
  type AlterationBasis,
  type AlterationStage,
} from "./alterationStage.ts";
import { rooms } from "./geometry.ts";

export type StageOpeningItem = {
  id: string;
  tag: string;
  kind: "door" | "window" | "void";
  width: number;
  height: number;
  sill: number;
  hinge: string;
  swing: string;
  wallId: string;
  wallName: string;
  levelId: string;
  levelName: string;
  lifecycleStatus: string;
  disposition: string;
  isReplacement: boolean;
  notes: string;
};

export type StageOpeningSchedule = {
  ready: boolean;
  blockers: { elementId: string; reason: string }[];
  stage: AlterationStage;
  basisReference: string;
  rows: StageOpeningItem[];
  totalOpenings: number;
  doorsCount: number;
  windowsCount: number;
  voidsCount: number;
};

export type StageRoomItem = {
  id: string;
  name: string;
  levelId: string;
  levelName: string;
  point: Point;
  areaM2: number;
  perimeterM: number;
  ceilingHeightM: number;
  varianceFromBeforeM2: number | null;
  status: "retained-unchanged" | "altered" | "new" | "demolished";
  notes: string;
};

export type StageRoomSchedule = {
  ready: boolean;
  blockers: { elementId: string; reason: string }[];
  stage: AlterationStage;
  basisReference: string;
  rows: StageRoomItem[];
  totalAreaM2: number;
  orphanedTags: { tagId: string; name: string; levelName: string }[];
};

export type AnnotationAuditResult = {
  valid: boolean;
  tagCollisions: { tag: string; openingIds: string[]; reason: string }[];
  orphanedRoomTags: { tagId: string; tagName: string; levelName: string; stage: AlterationStage }[];
  excludedDimensionsCount: { before: number; proposed: number };
  warnings: string[];
};

/** Safe CSV cell utility */
function cell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const text = String(value);
  const safe = /^[\s\u0000-\u001f\u007f-\u009f]*[=+\-@]/u.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}

/** Calculate Opening Schedule for a given Alteration Stage */
export function calculateStageOpeningSchedule(
  project: ArchitectProject,
  basis: AlterationBasis | null,
  stage: AlterationStage,
): StageOpeningSchedule {
  const p = validateProject(project);
  const resolution = resolveAlterationStage(p, basis, stage);
  if (!resolution.ready) {
    return {
      ready: false,
      blockers: resolution.blockers,
      stage,
      basisReference: basis?.reference ?? "",
      rows: [],
      totalOpenings: 0,
      doorsCount: 0,
      windowsCount: 0,
      voidsCount: 0,
    };
  }

  const stageModel = resolution.model;
  const levels = new Map(p.levels.map((l) => [l.id, l]));
  const originalWalls = new Map(p.walls.map((w) => [w.id, w]));
  const stageWalls = new Map(stageModel.walls.map((w) => [w.id, w]));
  const originalOpenings = new Map(p.openings.map((o) => [o.id, o]));

  const rows: StageOpeningItem[] = [];

  for (const o of stageModel.openings) {
    const orig = originalOpenings.get(o.id);
    const wall = stageWalls.get(o.wallId) ?? originalWalls.get(o.wallId);
    const level = wall ? levels.get(wall.levelId) : undefined;
    const status = orig?.lifecycle?.status ?? "unassigned";

    let disposition = "retained";
    let isReplacement = false;
    let notes = "";

    if (stage === "before") {
      if (status === "demolished") {
        disposition = "scheduled-for-demolition";
        notes = orig?.demolitionDisposition
          ? `To be demolished (${orig.demolitionDisposition.kind}).`
          : "To be demolished.";
      } else if (status === "repaired") {
        disposition = "repaired";
        notes = "Existing opening retained during wall repair.";
      } else {
        disposition = "existing-retained";
        notes = "Existing opening retained unchanged.";
      }
    } else {
      // proposed stage
      if (status === "new") {
        disposition = "new-work";
        notes = "Proposed new opening aperture.";
        // Check if hosted on an existing wall where a demolished opening was situated (replacement)
        const hostOrigOpenings = p.openings.filter((other) => other.wallId === o.wallId && other.lifecycle?.status === "demolished");
        if (hostOrigOpenings.some((d) => Math.abs(d.offset - o.offset) < Math.max(d.width, o.width) / 2)) {
          isReplacement = true;
          notes = "Replacement opening at former aperture location.";
        }
      } else if (o.kind === "void") {
        disposition = "retained-void";
        notes = orig?.demolitionDisposition?.kind === "partial-infill"
          ? `Partial infill: reduced void ${o.width}x${o.height} mm at sill ${o.sill} mm.`
          : "Demolished fixture removed; aperture retained as open void.";
      } else if (status === "repaired") {
        disposition = "repaired";
        notes = "Opening retained in repaired wall.";
      } else {
        disposition = "existing-retained";
        notes = "Existing opening retained unchanged.";
      }
    }

    rows.push({
      id: o.id,
      tag: o.tag,
      kind: o.kind as "door" | "window" | "void",
      width: o.width,
      height: o.height,
      sill: o.sill,
      hinge: o.hinge ?? "—",
      swing: o.swing ?? "—",
      wallId: o.wallId,
      wallName: wall?.name ?? o.wallId,
      levelId: level?.id ?? "",
      levelName: level?.name ?? "General",
      lifecycleStatus: status,
      disposition,
      isReplacement,
      notes,
    });
  }

  // Sort deterministically by level, then tag
  rows.sort((a, b) => a.levelName.localeCompare(b.levelName) || a.tag.localeCompare(b.tag));

  const doorsCount = rows.filter((r) => r.kind === "door").length;
  const windowsCount = rows.filter((r) => r.kind === "window").length;
  const voidsCount = rows.filter((r) => r.kind === "void").length;

  return {
    ready: true,
    blockers: [],
    stage,
    basisReference: resolution.basisReference,
    rows,
    totalOpenings: rows.length,
    doorsCount,
    windowsCount,
    voidsCount,
  };
}

/** Calculate Room Schedule for a given Alteration Stage */
export function calculateStageRoomSchedule(
  project: ArchitectProject,
  basis: AlterationBasis | null,
  stage: AlterationStage,
): StageRoomSchedule {
  const p = validateProject(project);
  const resolution = resolveAlterationStage(p, basis, stage);
  if (!resolution.ready) {
    return {
      ready: false,
      blockers: resolution.blockers,
      stage,
      basisReference: basis?.reference ?? "",
      rows: [],
      totalAreaM2: 0,
      orphanedTags: [],
    };
  }

  const stageModel = resolution.model;
  const levels = new Map(p.levels.map((l) => [l.id, l]));

  // Also compute before stage rooms for variance calculation if in proposed stage (scoped by level to prevent collisions)
  let beforeRoomsMap = new Map<string, { areaM2: number; name: string }>();
  if (stage === "proposed") {
    const beforeRes = resolveAlterationStage(p, basis, "before");
    if (beforeRes.ready) {
      for (const level of p.levels) {
        for (const r of rooms(beforeRes.model, level.id)) {
          beforeRoomsMap.set(`${level.id}::${r.name}`, { areaM2: r.areaM2, name: r.name });
        }
      }
    }
  }

  const rows: StageRoomItem[] = [];
  const orphanedTags: { tagId: string; name: string; levelName: string }[] = [];

  for (const level of p.levels) {
    const stageRooms = rooms(stageModel, level.id);
    for (const r of stageRooms) {
      let status: StageRoomItem["status"] = "retained-unchanged";
      let varianceFromBeforeM2: number | null = null;
      let notes = "Room boundary unchanged.";

      if (stage === "proposed") {
        const beforeMatch = beforeRoomsMap.get(`${level.id}::${r.name}`);
        if (beforeMatch) {
          varianceFromBeforeM2 = r.areaM2 - beforeMatch.areaM2;
          if (Math.abs(varianceFromBeforeM2) > 0.01) {
            status = "altered";
            notes = varianceFromBeforeM2 > 0
              ? `Room enlarged by ${varianceFromBeforeM2.toFixed(2)} m² due to partition alterations.`
              : `Room reduced by ${Math.abs(varianceFromBeforeM2).toFixed(2)} m² due to partition alterations.`;
          }
        } else {
          status = "new";
          notes = "New room created by proposed alterations.";
        }
      }

      rows.push({
        id: r.id,
        name: r.name,
        levelId: level.id,
        levelName: level.name,
        point: r.point,
        areaM2: r.areaM2,
        perimeterM: r.perimeterM,
        ceilingHeightM: r.height / 1000,
        varianceFromBeforeM2,
        status,
        notes,
      });
    }

    // Check for orphaned tags on this level
    for (const tag of p.roomTags.filter((t) => t.levelId === level.id)) {
      const insideAny = stageRooms.some((r) => pointInPolygon(tag.point, r.ring));
      if (!insideAny) {
        orphanedTags.push({ tagId: tag.id, name: tag.name, levelName: level.name });
      }
    }
  }

  rows.sort((a, b) => a.levelName.localeCompare(b.levelName) || a.name.localeCompare(b.name));
  const totalAreaM2 = rows.reduce((sum, r) => sum + r.areaM2, 0);

  return {
    ready: true,
    blockers: [],
    stage,
    basisReference: resolution.basisReference,
    rows,
    totalAreaM2,
    orphanedTags,
  };
}

/** Verify Cross-View Tag Consistency & Annotation Coordination */
export function verifyAnnotationCoordination(
  project: ArchitectProject,
  basis: AlterationBasis | null,
): AnnotationAuditResult {
  const tagCollisions: { tag: string; openingIds: string[]; reason: string }[] = [];
  const warnings: string[] = [];

  // 1. Audit opening tags for collisions before validateProject throws
  const tagGroups = new Map<string, string[]>();
  for (const o of project.openings ?? []) {
    const key = o.tag ? o.tag.trim().toUpperCase() : "";
    if (!key) continue;
    const existing = tagGroups.get(key) ?? [];
    existing.push(o.id);
    tagGroups.set(key, existing);
  }

  for (const [tag, ids] of tagGroups) {
    if (ids.length > 1) {
      tagCollisions.push({
        tag,
        openingIds: ids,
        reason: `Duplicate opening tag "${tag}" assigned to ${ids.length} distinct elements.`,
      });
    }
  }

  if (tagCollisions.length > 0) {
    return {
      valid: false,
      tagCollisions,
      orphanedRoomTags: [],
      excludedDimensionsCount: { before: 0, proposed: 0 },
      warnings: ["Opening tag collisions detected. Cross-view opening identification requires unique tags."],
    };
  }

  const p = validateProject(project);

  // 2. Audit room tags in before and proposed stages
  const orphanedRoomTags: { tagId: string; tagName: string; levelName: string; stage: AlterationStage }[] = [];
  if (basis) {
    const beforeSched = calculateStageRoomSchedule(p, basis, "before");
    for (const orphan of beforeSched.orphanedTags) {
      orphanedRoomTags.push({ tagId: orphan.tagId, tagName: orphan.name, levelName: orphan.levelName, stage: "before" });
    }
    const proposedSched = calculateStageRoomSchedule(p, basis, "proposed");
    for (const orphan of proposedSched.orphanedTags) {
      orphanedRoomTags.push({ tagId: orphan.tagId, tagName: orphan.name, levelName: orphan.levelName, stage: "proposed" });
    }
  }

  // 3. Dimension exclusion audit
  let beforeExcludedDims = 0;
  let proposedExcludedDims = 0;
  if (basis) {
    const beforeRes = resolveAlterationStage(p, basis, "before");
    const proposedRes = resolveAlterationStage(p, basis, "proposed");
    if (beforeRes.ready) {
      beforeExcludedDims = beforeRes.excludedIds.filter((id) => p.dimensions.some((d) => d.id === id)).length;
    }
    if (proposedRes.ready) {
      proposedExcludedDims = proposedRes.excludedIds.filter((id) => p.dimensions.some((d) => d.id === id)).length;
    }
  }

  const valid = tagCollisions.length === 0 && orphanedRoomTags.length === 0;

  return {
    valid,
    tagCollisions,
    orphanedRoomTags,
    excludedDimensionsCount: { before: beforeExcludedDims, proposed: proposedExcludedDims },
    warnings,
  };
}

/** CSV Exporters for Stage Coordination */

export function stageOpeningScheduleCsv(
  project: ArchitectProject,
  basis: AlterationBasis | null,
  stage: AlterationStage,
): string {
  const sched = calculateStageOpeningSchedule(project, basis, stage);
  const headers = [
    "Project ID", "Revision", "Stage", "Opening ID", "Tag", "Kind", "Level",
    "Host Wall", "Width mm", "Height mm", "Sill mm", "Hinge", "Swing",
    "Lifecycle", "Disposition", "Replacement", "Notes",
  ];
  return [
    headers.map(cell).join(","),
    ...sched.rows.map((r) => [
      project.id, project.revision, stage, r.id, r.tag, r.kind, r.levelName,
      r.wallName, r.width, r.height, r.sill, r.hinge, r.swing,
      r.lifecycleStatus, r.disposition, r.isReplacement ? "Yes" : "No", r.notes,
    ].map(cell).join(",")),
  ].join("\r\n") + "\r\n";
}

export function stageRoomScheduleCsv(
  project: ArchitectProject,
  basis: AlterationBasis | null,
  stage: AlterationStage,
): string {
  const sched = calculateStageRoomSchedule(project, basis, stage);
  const headers = [
    "Project ID", "Revision", "Stage", "Room ID", "Name", "Level",
    "Area m2", "Perimeter m", "Ceiling Height m", "Variance m2", "Status", "Notes",
  ];
  return [
    headers.map(cell).join(","),
    ...sched.rows.map((r) => [
      project.id, project.revision, stage, r.id, r.name, r.levelName,
      r.areaM2.toFixed(3), r.perimeterM.toFixed(3), r.ceilingHeightM.toFixed(3),
      r.varianceFromBeforeM2 !== null ? r.varianceFromBeforeM2.toFixed(3) : "—",
      r.status, r.notes,
    ].map(cell).join(",")),
  ].join("\r\n") + "\r\n";
}
