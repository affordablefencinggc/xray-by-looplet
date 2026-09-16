import {
  alterationIssueRecordSchema,
  ALTERATION_ISSUE_MAX,
  ALTERATION_ISSUE_SOURCE_MAX,
  ALTERATION_ISSUE_SOURCE_BYTES_MAX,
  type AlterationIssueRecord,
  type AlterationIssueSheet,
  type StageQuantitiesSummary,
  type AlterationScheduleSummary,
} from "./alterationIssueSchema.ts";
export {
  alterationIssueRecordSchema,
  ALTERATION_ISSUE_MAX,
  ALTERATION_ISSUE_SOURCE_MAX,
  ALTERATION_ISSUE_SOURCE_BYTES_MAX,
  type AlterationIssueRecord,
  type AlterationIssueSheet,
  type StageQuantitiesSummary,
  type AlterationScheduleSummary,
} from "./alterationIssueSchema.ts";

import { validateProject, type ArchitectProject } from "./model.ts";
import { sha256Hex } from "./designedScene.ts";
import { resolveAlterationStage, type AlterationBasis } from "./alterationStage.ts";
import { calculateAlterationQuantities } from "./alterationQuantities.ts";
import {
  calculateDemolitionSchedule,
  calculateSalvageDisposalSchedule,
  calculateRepairSchedule,
  calculateAlterationMaterialSchedule,
} from "./alterationSchedules.ts";
import {
  calculateStageOpeningSchedule,
  calculateStageRoomSchedule,
  verifyAnnotationCoordination,
} from "./alterationCoordination.ts";

/**
 * Snapshots are non-recursive and contain no generic issue history,
 * drafts, or alteration issue registers.
 */
function sourceSnapshot(project: ArchitectProject): ArchitectProject {
  const source = structuredClone(project);
  delete source.issues;
  delete source.alterationDrafts;
  delete (source as { alterationIssues?: unknown }).alterationIssues;
  return source;
}

export function checkedAlterationIssue(
  value: unknown,
  projectId: string,
): { record: AlterationIssueRecord; source: ArchitectProject } {
  const record = alterationIssueRecordSchema.parse(value);
  if (record.projectId !== projectId) {
    throw Error("Saved alteration issue belongs to another project.");
  }
  if (sha256Hex(record.sourceJson) !== record.sourceSha256) {
    throw Error("Saved alteration issue source hash does not match its frozen bytes.");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(record.sourceJson);
  } catch {
    throw Error("Saved alteration issue contains invalid source JSON.");
  }
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    "issues" in raw ||
    "alterationDrafts" in raw ||
    "alterationIssues" in raw
  ) {
    throw Error(
      "Saved alteration issue source must be a project without nested issue or alteration histories.",
    );
  }
  const source = validateProject(raw);
  if (
    source.id !== record.projectId ||
    source.revision !== record.projectRevision ||
    source.designRevision !== record.designRevision
  ) {
    throw Error("Saved alteration issue identity/revision does not match its frozen source.");
  }
  const beforeRes = resolveAlterationStage(source, record.basis, "before");
  if (!beforeRes.ready) {
    throw Error(
      "Saved alteration issue cannot resolve before stage: " +
        beforeRes.blockers.map((b) => b.reason).join(" "),
    );
  }
  const proposedRes = resolveAlterationStage(source, record.basis, "proposed");
  if (!proposedRes.ready) {
    throw Error(
      "Saved alteration issue cannot resolve proposed stage: " +
        proposedRes.blockers.map((b) => b.reason).join(" "),
    );
  }
  return { record, source };
}

/**
 * Safe hook for validateProject to check alteration issues.
 */
export function validateAlterationIssues(project: ArchitectProject): void {
  const records = project.alterationIssues ?? [];
  if (records.length > ALTERATION_ISSUE_MAX) {
    throw Error(`A project can retain at most ${ALTERATION_ISSUE_MAX} saved alteration issues.`);
  }
  const ids = new Set<string>();
  for (const value of records) {
    const { record } = checkedAlterationIssue(value, project.id);
    if (ids.has(record.id)) {
      throw Error("Saved alteration issue identities must be unique.");
    }
    ids.add(record.id);
  }
}

export type CreateAlterationIssueOptions = {
  purpose: string;
  sheets?: AlterationIssueSheet[];
  metadata?: { id?: string; issuedAt?: string };
};

export function defaultAlterationIssueSheets(project: ArchitectProject): AlterationIssueSheet[] {
  const sheets: AlterationIssueSheet[] = [];
  let index = 1;
  for (const level of project.levels) {
    sheets.push({
      sheetId: `alt-sheet-${index++}`,
      number: `ALT-${String(index - 1).padStart(2, "0")}`,
      name: `${level.name} Level — Before Alteration Plan`,
      stage: "before",
      view: "plan",
      levelId: level.id,
      scale: "1:100",
    });
    sheets.push({
      sheetId: `alt-sheet-${index++}`,
      number: `ALT-${String(index - 1).padStart(2, "0")}`,
      name: `${level.name} Level — Proposed Alteration Plan`,
      stage: "proposed",
      view: "plan",
      levelId: level.id,
      scale: "1:100",
    });
  }
  const primaryLevel = project.levels[0].id;
  for (const view of ["north", "south", "section"] as const) {
    sheets.push({
      sheetId: `alt-sheet-${index++}`,
      number: `ALT-${String(index - 1).padStart(2, "0")}`,
      name: `Proposed ${view.charAt(0).toUpperCase() + view.slice(1)} View`,
      stage: "proposed",
      view,
      levelId: primaryLevel,
      scale: "1:100",
    });
  }
  return sheets;
}

export function createAlterationIssueRecord(
  project: ArchitectProject,
  basis: AlterationBasis | null,
  options: CreateAlterationIssueOptions,
): AlterationIssueRecord {
  const source = sourceSnapshot(validateProject(project));
  if (!basis) {
    throw Error("A reviewed alteration basis is required to issue an alteration set.");
  }
  const beforeRes = resolveAlterationStage(source, basis, "before");
  if (!beforeRes.ready) {
    throw Error(
      "Before stage resolution blocked: " + beforeRes.blockers.map((b) => b.reason).join(" "),
    );
  }
  const proposedRes = resolveAlterationStage(source, basis, "proposed");
  if (!proposedRes.ready) {
    throw Error(
      "Proposed stage resolution blocked: " + proposedRes.blockers.map((b) => b.reason).join(" "),
    );
  }

  const quantities = calculateAlterationQuantities(source, basis);
  if (!quantities.ready) {
    throw Error(
      "Alteration quantities blocked: " + quantities.blockers.map((b) => b.reason).join(" "),
    );
  }

  const demoSched = calculateDemolitionSchedule(source, basis);
  const salvageSched = calculateSalvageDisposalSchedule(source, basis);
  const repairSched = calculateRepairSchedule(source, basis);
  const matSched = calculateAlterationMaterialSchedule(source, basis);

  const beforeOpenings = calculateStageOpeningSchedule(source, basis, "before");
  const proposedOpenings = calculateStageOpeningSchedule(source, basis, "proposed");
  const beforeRooms = calculateStageRoomSchedule(source, basis, "before");
  const proposedRooms = calculateStageRoomSchedule(source, basis, "proposed");
  const audit = verifyAnnotationCoordination(source, basis);

  const sheets = options.sheets && options.sheets.length > 0
    ? options.sheets
    : defaultAlterationIssueSheets(source);

  const sourceJson = JSON.stringify(source);
  if (
    sourceJson.length > ALTERATION_ISSUE_SOURCE_MAX ||
    new TextEncoder().encode(sourceJson).byteLength > ALTERATION_ISSUE_SOURCE_BYTES_MAX
  ) {
    throw Error(
      "This alteration source is too large to issue: maximum 512000 characters and 1024000 UTF-8 bytes.",
    );
  }

  const beforeSummary: StageQuantitiesSummary = {
    wallSolidVolumeM3: quantities.beforeWallSolidVolumeM3,
    openingsCount: beforeOpenings.rows.length,
    roomsCount: beforeRooms.rows.length,
    totalRoomAreaM2: beforeRooms.totalAreaM2,
    orphanedTagsCount: beforeRooms.orphanedTags.length,
  };

  const proposedSummary: StageQuantitiesSummary = {
    wallSolidVolumeM3: quantities.proposedWallSolidVolumeM3,
    openingsCount: proposedOpenings.rows.length,
    roomsCount: proposedRooms.rows.length,
    totalRoomAreaM2: proposedRooms.totalAreaM2,
    orphanedTagsCount: proposedRooms.orphanedTags.length,
  };

  const schedulesSummary: AlterationScheduleSummary = {
    demolitionRowsCount: demoSched.rows.length,
    demolitionVolumeM3: demoSched.totalDemolishedVolumeM3,
    salvageDisposalVolumeM3: salvageSched.totalGrossDisposalVolumeM3,
    repairRowsCount: repairSched.rows.length,
    repairVolumeM3: repairSched.totalRepairVolumeM3,
    materialRowsCount: matSched.rows.length,
    materialNetVolumeM3: matSched.totalNetVolumeM3,
    materialOrderAreaM2: matSched.totalOrderAreaM2,
  };

  const id = options.metadata?.id ?? crypto.randomUUID();
  const issuedAt = options.metadata?.issuedAt ?? new Date().toISOString();

  const record = alterationIssueRecordSchema.parse({
    format: "xray.alteration-issue/v1",
    id,
    issuedAt,
    purpose: options.purpose.trim(),
    projectId: source.id,
    projectRevision: source.revision,
    designRevision: source.designRevision,
    projectName: source.name,
    projectAddress: source.address,
    basis: { reference: basis.reference, fingerprint: basis.fingerprint },
    status: "current",
    sheets,
    beforeSummary,
    proposedSummary,
    schedulesSummary,
    sourceJson,
    sourceSha256: sha256Hex(sourceJson),
    issued: true,
    sharedAnnotationsAudited: audit.valid,
  });

  return checkedAlterationIssue(record, source.id).record;
}

/**
 * Append a newly issued alteration set to the project.
 * Automatically marks previous 'current' issues as 'superseded' with audit pointers.
 */
export function appendAlterationIssue(
  project: ArchitectProject,
  record: AlterationIssueRecord,
): ArchitectProject {
  const next = validateProject(project);
  const { record: verified } = checkedAlterationIssue(record, next.id);
  const records = next.alterationIssues ?? [];

  if (records.length >= ALTERATION_ISSUE_MAX) {
    throw Error(
      `Ten alteration issues are already recorded. Archive or remove an unneeded issue before issuing another.`,
    );
  }
  if (records.some((prior) => prior.id === verified.id)) {
    throw Error("An alteration issue with this identity is already recorded.");
  }
  if (verified.sourceJson !== JSON.stringify(sourceSnapshot(next))) {
    throw Error(
      "The project changed after this alteration issue was prepared; review and issue it again.",
    );
  }

  // Supersede previous active issues
  const updatedRecords: AlterationIssueRecord[] = records.map((prior) => {
    if (prior.status === "current") {
      return {
        ...prior,
        status: "superseded" as const,
        supersededAt: verified.issuedAt,
        supersededById: verified.id,
        supersededByRevision: verified.designRevision,
      };
    }
    return prior;
  });

  updatedRecords.push(structuredClone(verified));
  next.alterationIssues = updatedRecords;
  return validateProject(next);
}

export function retrieveAlterationIssue(
  project: ArchitectProject,
  id: string,
): { record: AlterationIssueRecord; source: ArchitectProject } {
  const found = project.alterationIssues?.find((issue) => issue.id === id);
  if (!found) {
    throw Error("The selected alteration issue record does not exist.");
  }
  return checkedAlterationIssue(found, project.id);
}

export type AlterationIssueComparison = {
  baselineRevision: string;
  targetRevision: string;
  baselineIssuedAt: string;
  targetIssuedAt: string;
  wallVolumeDeltaM3: number;
  demolitionVolumeDeltaM3: number;
  salvageVolumeDeltaM3: number;
  repairVolumeDeltaM3: number;
  materialOrderAreaDeltaM2: number;
  roomAreaDeltaM2: number;
  openingsCountDelta: number;
  sheetsAddedCount: number;
  sheetsRemovedCount: number;
  hasVariance: boolean;
};

/**
 * Compare two frozen alteration issues, or a baseline issue against target issue.
 */
export function compareAlterationIssues(
  baseline: AlterationIssueRecord,
  target: AlterationIssueRecord,
): AlterationIssueComparison {
  const wallVolumeDeltaM3 =
    target.proposedSummary.wallSolidVolumeM3 - baseline.proposedSummary.wallSolidVolumeM3;
  const demolitionVolumeDeltaM3 =
    target.schedulesSummary.demolitionVolumeM3 - baseline.schedulesSummary.demolitionVolumeM3;
  const salvageVolumeDeltaM3 =
    target.schedulesSummary.salvageDisposalVolumeM3 -
    baseline.schedulesSummary.salvageDisposalVolumeM3;
  const repairVolumeDeltaM3 =
    target.schedulesSummary.repairVolumeM3 - baseline.schedulesSummary.repairVolumeM3;
  const materialOrderAreaDeltaM2 =
    target.schedulesSummary.materialOrderAreaM2 - baseline.schedulesSummary.materialOrderAreaM2;
  const roomAreaDeltaM2 =
    target.proposedSummary.totalRoomAreaM2 - baseline.proposedSummary.totalRoomAreaM2;
  const openingsCountDelta =
    target.proposedSummary.openingsCount - baseline.proposedSummary.openingsCount;

  // Key sheets by functional identity (stage + level + view + name) rather than
  // solely by the positional number (ALT-01..ALT-0N), so renumbering does not mask additions/removals.
  const sheetSig = (s: AlterationIssueSheet) => `${s.stage}:${s.levelId}:${s.view}:${s.name}`;
  const baselineSheetSigs = new Set(baseline.sheets.map(sheetSig));
  const targetSheetSigs = new Set(target.sheets.map(sheetSig));

  let sheetsAddedCount = 0;
  for (const sig of targetSheetSigs) {
    if (!baselineSheetSigs.has(sig)) sheetsAddedCount++;
  }
  let sheetsRemovedCount = 0;
  for (const sig of baselineSheetSigs) {
    if (!targetSheetSigs.has(sig)) sheetsRemovedCount++;
  }

  const hasVariance =
    Math.abs(wallVolumeDeltaM3) > 1e-4 ||
    Math.abs(demolitionVolumeDeltaM3) > 1e-4 ||
    Math.abs(salvageVolumeDeltaM3) > 1e-4 ||
    Math.abs(repairVolumeDeltaM3) > 1e-4 ||
    Math.abs(materialOrderAreaDeltaM2) > 1e-4 ||
    Math.abs(roomAreaDeltaM2) > 1e-4 ||
    openingsCountDelta !== 0 ||
    sheetsAddedCount > 0 ||
    sheetsRemovedCount > 0;

  return {
    baselineRevision: baseline.designRevision,
    targetRevision: target.designRevision,
    baselineIssuedAt: baseline.issuedAt,
    targetIssuedAt: target.issuedAt,
    wallVolumeDeltaM3,
    demolitionVolumeDeltaM3,
    salvageVolumeDeltaM3,
    repairVolumeDeltaM3,
    materialOrderAreaDeltaM2,
    roomAreaDeltaM2,
    openingsCountDelta,
    sheetsAddedCount,
    sheetsRemovedCount,
    hasVariance,
  };
}
