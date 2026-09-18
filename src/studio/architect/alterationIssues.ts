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
import {
  DELIVERY_RECORD_SCHEMA,
  assertDeliveryContentIntact,
  deliveryRecordSchema,
  supersedeDelivery,
  type DeliveryRecord,
} from "../industries/deliveryRecord.ts";
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

/**
 * The code a caller can act on when a record's delivery identity no longer describes the record (SC-01).
 * Every other failure here is a refusal to issue; this one means the bytes and the seal have come apart,
 * which is a different thing to tell a user: the record is not to be repaired, it is to be re-issued.
 */
export const CORRUPTED_ISSUE_DELIVERY = "CORRUPTED_ISSUE_DELIVERY";

export function isCorruptedIssueDelivery(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith(CORRUPTED_ISSUE_DELIVERY);
}

function corruptedIssueDelivery(detail: string): Error {
  return Error(
    `${CORRUPTED_ISSUE_DELIVERY}: ${detail} Re-issue the set from the project rather than repairing this record.`,
  );
}

/**
 * The delivery identity an issue issued before the contract was wired in would have carried, derived from
 * the record's own frozen bytes rather than from anything the caller supplies. Adopting it keeps a project
 * that was valid when it was saved openable; it is written back to storage on the next append.
 */
function adoptedDelivery(record: AlterationIssueRecord): DeliveryRecord {
  const superseded = record.status === "superseded";
  return deliveryRecordSchema.parse({
    format: DELIVERY_RECORD_SCHEMA,
    id: record.id,
    kind: "alteration",
    projectId: record.projectId,
    state: "issued-deliverable",
    revision: record.projectRevision,
    createdAt: record.issuedAt,
    reviewedAt: record.issuedAt,
    issuedAt: record.issuedAt,
    sourceBinding: null,
    contentSha256: record.sourceSha256,
    status: superseded ? "superseded" : "active",
    ...(superseded
      ? {
          supersededAt: record.supersededAt,
          supersededById: record.supersededById,
          supersededByRevision: record.supersededByRevision,
        }
      : {}),
  });
}

/** A checked record always carries a delivery identity, whether it was sealed with one or adopted. */
export type CheckedAlterationIssueRecord = AlterationIssueRecord & { delivery: DeliveryRecord };

/**
 * Whether a record's seal still describes its frozen bytes — the reading the history screen shows beside
 * each issue (SC-01). It answers rather than throws: a history screen has to be able to render an issue
 * whose seal has come apart and say so, which is exactly the case a user needs to see. The hash is
 * recomputed here rather than read from the record, so the badge means the bytes were hashed, not that a
 * pointer to a hash was present.
 */
export function alterationIssueSeal(record: {
  sourceJson: string;
  sourceSha256: string;
  delivery?: DeliveryRecord;
}): { sealed: boolean; contentSha256: string; format: string | null } {
  const recomputed = sha256Hex(record.sourceJson);
  const sealed =
    recomputed === record.sourceSha256 &&
    (record.delivery === undefined || record.delivery.contentSha256 === recomputed);
  return { sealed, contentSha256: record.sourceSha256, format: record.delivery?.format ?? null };
}

export function checkedAlterationIssue(
  value: unknown,
  projectId: string,
): { record: CheckedAlterationIssueRecord; source: ArchitectProject } {
  const record = alterationIssueRecordSchema.parse(value);
  if (record.projectId !== projectId) {
    throw Error("Saved alteration issue belongs to another project.");
  }
  if (sha256Hex(record.sourceJson) !== record.sourceSha256) {
    throw Error("Saved alteration issue source hash does not match its frozen bytes.");
  }
  /* The delivery identity (SC-01): the contract's own hash check over the same frozen bytes, and its
     pointers held to the record's own. A record whose delivery disagrees with the fields beside it is
     corrupted rather than merely invalid, so the failure carries the code a caller can act on. */
  const delivery = record.delivery ?? adoptedDelivery(record);
  try {
    assertDeliveryContentIntact(delivery, record.sourceJson, sha256Hex);
  } catch {
    throw corruptedIssueDelivery(
      "Its delivery record's frozen content hash does not match the bytes it sealed.",
    );
  }
  const agrees =
    delivery.id === record.id &&
    delivery.projectId === record.projectId &&
    delivery.contentSha256 === record.sourceSha256 &&
    delivery.state === "issued-deliverable" &&
    delivery.status === (record.status === "superseded" ? "superseded" : "active") &&
    delivery.revision === record.projectRevision &&
    delivery.issuedAt === record.issuedAt &&
    delivery.supersededAt === record.supersededAt &&
    delivery.supersededById === record.supersededById &&
    delivery.supersededByRevision === record.supersededByRevision;
  if (!agrees) {
    throw corruptedIssueDelivery("Its delivery record and its own fields disagree about what was issued.");
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
  return { record: { ...record, delivery }, source };
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
): CheckedAlterationIssueRecord {
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
  const sourceSha256 = sha256Hex(sourceJson);

  /* The issue enters the delivery contract already issued: an alteration set is only ever frozen at the
     moment it is issued, so there is no draft state here to advance through. Its revision is the project
     revision it froze, which is the number the record already carries and which the record's own
     `projectRevision` is checked against on every reopen. */
  const delivery = deliveryRecordSchema.parse({
    format: DELIVERY_RECORD_SCHEMA,
    id,
    kind: "alteration",
    projectId: source.id,
    state: "issued-deliverable",
    revision: source.revision,
    createdAt: issuedAt,
    reviewedAt: issuedAt,
    issuedAt,
    sourceBinding: null,
    contentSha256: sourceSha256,
    status: "active",
  });

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
    sourceSha256,
    issued: true,
    sharedAnnotationsAudited: audit.valid,
    delivery,
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

  /* Supersede previous active issues, through the delivery contract rather than beside it (SC-01): the
     prior record's delivery status flips and its pointers are written by `supersedeDelivery`, which carries
     the frozen content hash through untouched. The contract leaves `supersededByRevision` free-form, and
     this record's field of that name is the design revision the history screen and the drawing stamp
     print, so it is set to the same string here — the two representations must not disagree about the
     revision a reader is being pointed at. */
  const updatedRecords: AlterationIssueRecord[] = records.map((prior) => {
    if (prior.status === "current") {
      const superseded = supersedeDelivery(prior.delivery ?? adoptedDelivery(prior), verified.delivery);
      return {
        ...prior,
        status: "superseded" as const,
        supersededAt: verified.issuedAt,
        supersededById: verified.id,
        supersededByRevision: verified.designRevision,
        delivery: { ...superseded, supersededByRevision: verified.designRevision },
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
): { record: CheckedAlterationIssueRecord; source: ArchitectProject } {
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
