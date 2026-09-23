import {
  fencingJobSchema,
  gateSpecificationSchema,
  runSpecificationSchema,
  type FencingJob,
  type GateSpecification,
  type PhotoEvidence,
  type RevisionEvent,
  type RunSpecification,
} from "./domain.ts";
import { getCalibrationForSheet } from "./calibration.ts";
import { calculateRunLengths } from "./tracing.ts";

export const REVISION_HISTORY_LIMIT = 1000;

export type PhotoEvidencePatch = Partial<
  Pick<PhotoEvidence, "capturedAt" | "caption" | "runIds" | "gateIds">
>;

export type EvidenceCommand =
  | {
      type: "update-run-specification";
      runId: string;
      expectedRevision: number;
      patch: Partial<RunSpecification>;
    }
  | {
      type: "update-gate-specification";
      gateId: string;
      expectedRevision: number;
      patch: Partial<GateSpecification>;
    }
  | { type: "add-photo"; photo: PhotoEvidence }
  | { type: "update-photo"; photoId: string; expectedRevision: number; patch: PhotoEvidencePatch }
  | { type: "reorder-photo"; photoId: string; expectedRevision: number; toIndex: number }
  | { type: "remove-photo"; photoId: string; expectedRevision: number }
  | {
      type: "review-run";
      runId: string;
      expectedRevision: number;
      decision: "approve" | "reject";
      actor: string;
      note?: string;
    }
  | {
      type: "review-gate";
      gateId: string;
      expectedRevision: number;
      decision: "approve" | "reject";
      actor: string;
      note?: string;
    };

export type RevisionDescriptor = Pick<
  RevisionEvent,
  "entityType" | "entityId" | "action" | "summary"
>;

export function appendJobRevision(
  job: FencingJob,
  descriptor: RevisionDescriptor,
  occurredAt = new Date().toISOString(),
): FencingJob {
  const revision = job.revision + 1;
  const event: RevisionEvent = {
    ...descriptor,
    id: `revision-${revision}-${descriptor.entityType}-${descriptor.entityId}-${descriptor.action}`,
    sequence: revision,
    occurredAt,
  };
  return fencingJobSchema.parse({
    ...job,
    revision,
    updatedAt: occurredAt,
    revisionHistory: [...job.revisionHistory, event].slice(-REVISION_HISTORY_LIMIT),
  });
}

export function applyEvidenceCommand(
  job: FencingJob,
  command: EvidenceCommand,
  occurredAt = new Date().toISOString(),
): FencingJob {
  let next: FencingJob;
  let event: RevisionDescriptor;

  switch (command.type) {
    case "update-run-specification": {
      const run = requireRun(job, command.runId, command.expectedRevision);
      const specification = runSpecificationSchema.parse({
        ...run.specification,
        ...command.patch,
      });
      next = {
        ...job,
        runs: job.runs.map((entry) =>
          entry.id === run.id
            ? {
                ...entry,
                revision: requiredRevision(entry) + 1,
                specification,
                review: invalidatedReview(entry.review),
              }
            : entry,
        ),
      };
      event = {
        entityType: "run",
        entityId: run.id,
        action: "update",
        summary: `Updated specification for ${run.label}.`,
      };
      break;
    }
    case "update-gate-specification": {
      const gate = requireGate(job, command.gateId, command.expectedRevision);
      const specification = gateSpecificationSchema.parse({
        widthM: gate.widthM,
        heightM: gate.heightM,
        type: gate.type,
        customType: gate.customType,
        openingDirection: gate.openingDirection,
        hingeSide: gate.hingeSide,
        hardware: gate.hardware,
        latch: gate.latch,
        postSize: gate.postSize,
        finish: gate.finish,
        clearanceM: gate.clearanceM,
        motorised: gate.motorised,
        notes: gate.notes,
        ...command.patch,
      });
      const gates = job.gates.map((entry) =>
        entry.id === gate.id
          ? {
              ...entry,
              ...specification,
              revision: requiredRevision(entry) + 1,
              review: invalidatedReview(entry.review),
            }
          : entry,
      );
      let runs = job.runs;
      if (gate.runId && specification.widthM !== gate.widthM) {
        const run = job.runs.find((entry) => entry.id === gate.runId);
        if (!run) throw new Error(`Gate ${gate.id} references missing run ${gate.runId}.`);
        const calibration = getCalibrationForSheet(job.calibrations, run.sheet);
        if (!calibration?.locked)
          throw new Error(`Sheet ${run.sheet} requires a locked calibration.`);
        const lengths = calculateRunLengths(run, gates, calibration);
        runs = job.runs.map((entry) =>
          entry.id === run.id
            ? {
                ...entry,
                ...lengths,
                lengthM: lengths.netLengthM,
                revision: requiredRevision(entry) + 1,
                review: invalidatedReview(entry.review),
              }
            : entry,
        );
      }
      next = { ...job, gates, runs };
      event = {
        entityType: "gate",
        entityId: gate.id,
        action: "update",
        summary: `Updated specification for ${gate.label}.`,
      };
      break;
    }
    case "add-photo": {
      if (job.photos.some((photo) => photo.id === command.photo.id))
        throw new Error(`Photo ID already exists: ${command.photo.id}.`);
      if (command.photo.order !== job.photos.length)
        throw new Error(`New photo order must be ${job.photos.length}.`);
      assertLinksExist(job, command.photo.runIds, command.photo.gateIds);
      const photo = {
        ...command.photo,
        revision: 1,
        order: job.photos.length,
        updatedAt: occurredAt,
      };
      next = linkPhoto(
        { ...job, photos: [...job.photos, photo] },
        photo.id,
        [],
        [],
        photo.runIds,
        photo.gateIds,
      );
      event = {
        entityType: "photo",
        entityId: photo.id,
        action: "create",
        summary: `Added photo ${photo.name}.`,
      };
      break;
    }
    case "update-photo": {
      const photo = requirePhoto(job, command.photoId, command.expectedRevision);
      const nextRunIds = unique(command.patch.runIds ?? photo.runIds);
      const nextGateIds = unique(command.patch.gateIds ?? photo.gateIds);
      assertLinksExist(job, nextRunIds, nextGateIds);
      const updated: PhotoEvidence = {
        ...photo,
        ...command.patch,
        runIds: nextRunIds,
        gateIds: nextGateIds,
        revision: photo.revision + 1,
        updatedAt: occurredAt,
      };
      next = linkPhoto(
        { ...job, photos: job.photos.map((entry) => (entry.id === photo.id ? updated : entry)) },
        photo.id,
        photo.runIds,
        photo.gateIds,
        nextRunIds,
        nextGateIds,
      );
      const added =
        nextRunIds.some((id) => !photo.runIds.includes(id)) ||
        nextGateIds.some((id) => !photo.gateIds.includes(id));
      const removed =
        photo.runIds.some((id) => !nextRunIds.includes(id)) ||
        photo.gateIds.some((id) => !nextGateIds.includes(id));
      const action = added && !removed ? "link" : removed && !added ? "unlink" : "update";
      event = {
        entityType: "photo",
        entityId: photo.id,
        action,
        summary: `Updated photo ${photo.name}.`,
      };
      break;
    }
    case "reorder-photo": {
      const photo = requirePhoto(job, command.photoId, command.expectedRevision);
      if (
        !Number.isInteger(command.toIndex) ||
        command.toIndex < 0 ||
        command.toIndex >= job.photos.length
      ) {
        throw new Error("Photo order target is outside the evidence list.");
      }
      const ordered = [...job.photos].sort((left, right) => left.order - right.order);
      const fromIndex = ordered.findIndex((entry) => entry.id === photo.id);
      if (fromIndex === command.toIndex)
        throw new Error("Photo is already at the requested order.");
      const [moved] = ordered.splice(fromIndex, 1);
      ordered.splice(command.toIndex, 0, moved);
      const changedPhotos: PhotoEvidence[] = [];
      const reordered = ordered.map((entry, order) => {
        if (order === entry.order) return entry;
        const changed = { ...entry, order, revision: entry.revision + 1, updatedAt: occurredAt };
        changedPhotos.push(changed);
        return changed;
      });
      next = invalidateEvidenceApprovals(
        {
          ...job,
          photos: reordered,
        },
        changedPhotos,
      );
      event = {
        entityType: "photo",
        entityId: photo.id,
        action: "reorder",
        summary: `Moved photo ${photo.name} to position ${command.toIndex + 1}.`,
      };
      break;
    }
    case "remove-photo": {
      const photo = requirePhoto(job, command.photoId, command.expectedRevision);
      const without = linkPhoto(job, photo.id, photo.runIds, photo.gateIds, [], []);
      const ordered = without.photos
        .filter((entry) => entry.id !== photo.id)
        .sort((left, right) => left.order - right.order)
        .map((entry, order) =>
          order === entry.order
            ? entry
            : { ...entry, order, revision: entry.revision + 1, updatedAt: occurredAt },
        );
      next = { ...without, photos: ordered };
      event = {
        entityType: "photo",
        entityId: photo.id,
        action: "delete",
        summary: `Removed photo ${photo.name}.`,
      };
      break;
    }
    case "review-run": {
      const run = requireRun(job, command.runId, command.expectedRevision);
      if (command.decision === "approve" && run.review.status === "approved") throw new Error(`${run.label} is already approved at this revision.`);
      const review = decision(command.decision, command.actor, command.note, occurredAt);
      next = {
        ...job,
        runs: job.runs.map((entry) =>
          entry.id === run.id ? { ...entry, revision: requiredRevision(entry) + 1, review } : entry,
        ),
      };
      event = {
        entityType: "run",
        entityId: run.id,
        action: command.decision,
        summary: `${command.decision === "approve" ? "Approved" : "Rejected"} ${run.label}.`,
      };
      break;
    }
    case "review-gate": {
      const gate = requireGate(job, command.gateId, command.expectedRevision);
      if (command.decision === "approve" && gate.review.status === "approved") throw new Error(`${gate.label} is already approved at this revision.`);
      const review = decision(command.decision, command.actor, command.note, occurredAt);
      next = {
        ...job,
        gates: job.gates.map((entry) =>
          entry.id === gate.id
            ? { ...entry, revision: requiredRevision(entry) + 1, review }
            : entry,
        ),
      };
      event = {
        entityType: "gate",
        entityId: gate.id,
        action: command.decision,
        summary: `${command.decision === "approve" ? "Approved" : "Rejected"} ${gate.label}.`,
      };
      break;
    }
  }

  return appendJobRevision(fencingJobSchema.parse(next), event, occurredAt);
}

function requireRun(job: FencingJob, id: string, revision: number) {
  const run = job.runs.find((entry) => entry.id === id);
  if (!run) throw new Error(`Unknown fence run: ${id}.`);
  const current = requiredRevision(run);
  if (current !== revision)
    throw new Error(
      `Stale fence run revision for ${id}: expected ${revision}, current ${current}.`,
    );
  return run;
}

function requireGate(job: FencingJob, id: string, revision: number) {
  const gate = job.gates.find((entry) => entry.id === id);
  if (!gate) throw new Error(`Unknown gate: ${id}.`);
  const current = requiredRevision(gate);
  if (current !== revision)
    throw new Error(`Stale gate revision for ${id}: expected ${revision}, current ${current}.`);
  return gate;
}

function requirePhoto(job: FencingJob, id: string, revision: number) {
  const photo = job.photos.find((entry) => entry.id === id);
  if (!photo) throw new Error(`Unknown photo: ${id}.`);
  if (photo.revision !== revision)
    throw new Error(
      `Stale photo revision for ${id}: expected ${revision}, current ${photo.revision}.`,
    );
  return photo;
}

function assertLinksExist(job: FencingJob, runIds: readonly string[], gateIds: readonly string[]) {
  for (const id of runIds)
    if (!job.runs.some((run) => run.id === id)) throw new Error(`Unknown fence run link: ${id}.`);
  for (const id of gateIds)
    if (!job.gates.some((gate) => gate.id === id)) throw new Error(`Unknown gate link: ${id}.`);
}

function linkPhoto(
  job: FencingJob,
  photoId: string,
  previousRunIds: readonly string[],
  previousGateIds: readonly string[],
  nextRunIds: readonly string[],
  nextGateIds: readonly string[],
): FencingJob {
  const runIds = new Set(nextRunIds);
  const gateIds = new Set(nextGateIds);
  const affectedRuns = new Set([...previousRunIds, ...nextRunIds]);
  const affectedGates = new Set([...previousGateIds, ...nextGateIds]);
  return {
    ...job,
    runs: job.runs.map((run) => {
      if (!affectedRuns.has(run.id)) return run;
      const photoIds = runIds.has(run.id)
        ? unique([...run.photoIds, photoId])
        : run.photoIds.filter((id) => id !== photoId);
      return {
        ...run,
        revision: requiredRevision(run) + 1,
        photoIds,
        review: invalidatedReview(run.review, "Linked evidence changed after review."),
      };
    }),
    gates: job.gates.map((gate) => {
      if (!affectedGates.has(gate.id)) return gate;
      const photoIds = gateIds.has(gate.id)
        ? unique([...gate.photoIds, photoId])
        : gate.photoIds.filter((id) => id !== photoId);
      return {
        ...gate,
        revision: requiredRevision(gate) + 1,
        photoIds,
        review: invalidatedReview(gate.review, "Linked evidence changed after review."),
      };
    }),
  };
}

function invalidatedReview<
  T extends { status: string; decidedAt: string | null; decidedBy: string; note: string },
>(review: T, note = "Specification changed after review."): T {
  if (review.status === "draft") return review;
  return { ...review, status: "needs-review", decidedAt: null, decidedBy: "", note };
}

function decision(
  kind: "approve" | "reject",
  actor: string,
  note: string | undefined,
  occurredAt: string,
) {
  const decidedBy = actor.trim();
  if (!decidedBy) throw new Error("A review decision requires an actor.");
  return {
    status: kind === "approve" ? ("approved" as const) : ("rejected" as const),
    decidedAt: occurredAt,
    decidedBy,
    note: (note ?? "").slice(0, 1000),
  };
}

function invalidateEvidenceApprovals(
  job: FencingJob,
  photos: readonly PhotoEvidence[],
): FencingJob {
  const runIds = new Set(photos.flatMap((photo) => photo.runIds));
  const gateIds = new Set(photos.flatMap((photo) => photo.gateIds));
  return {
    ...job,
    runs: job.runs.map((run) =>
      runIds.has(run.id)
        ? {
            ...run,
            revision: requiredRevision(run) + 1,
            review: invalidatedReview(run.review, "Linked evidence changed after review."),
          }
        : run,
    ),
    gates: job.gates.map((gate) =>
      gateIds.has(gate.id)
        ? {
            ...gate,
            revision: requiredRevision(gate) + 1,
            review: invalidatedReview(gate.review, "Linked evidence changed after review."),
          }
        : gate,
    ),
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function requiredRevision(entity: { id: string; revision?: number }): number {
  if (entity.revision === undefined)
    throw new Error(`Entity ${entity.id} has no revision and must be migrated before editing.`);
  return entity.revision;
}
