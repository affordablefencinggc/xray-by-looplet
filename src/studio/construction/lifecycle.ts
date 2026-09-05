import { constructionJobSchema } from "./contract.ts";
import type { ConstructionJob, Measurement, SourceRevision, Calibration } from "./contract.ts";

/** Canonical equality for immutable JSON records; object key ordering is not semantic. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map(
      (key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
    )
    .join(",")}}`;
}
/** Future store must persist prior job snapshots before accepting this validated replacement. */
export function validateJobTransition(previousInput: unknown, nextInput: unknown): ConstructionJob {
  const previous = constructionJobSchema.parse(previousInput),
    next = constructionJobSchema.parse(nextInput);
  if (
    next.id !== previous.id ||
    next.revision !== previous.revision + 1 ||
    next.createdAt !== previous.createdAt ||
    Date.parse(next.updatedAt) < Date.parse(previous.updatedAt)
  )
    throw new Error("Transition must preserve job identity and advance its revision exactly once.");
  for (const key of ["sources", "evidence", "calibrations"] as const) {
    for (const record of previous[key]) {
      const retained = next[key].find((entry) => entry.id === record.id);
      if (!retained || canonicalJson(retained) !== canonicalJson(record))
        throw new Error(`${key} are append-only; changed records require new identities.`);
    }
  }
  if (canonicalJson(previous.extensions) !== canonicalJson(next.extensions))
    throw new Error("Imported legacy snapshots are immutable.");
  for (const record of previous.workPackages) {
    const retained = next.workPackages.find((entry) => entry.id === record.id);
    if (
      !retained ||
      (canonicalJson(record) !== canonicalJson(retained) &&
        retained.revision !== record.revision + 1)
    )
      throw new Error("Work package updates require retained identity and a new revision.");
  }
  for (const record of previous.measurements) {
    const retained = next.measurements.find((entry) => entry.id === record.id);
    if (!retained)
      throw new Error(
        "Measurement deletion requires a future archival command; do not discard history.",
      );
    const oldPackage = previous.workPackages.find((entry) => entry.id === record.workPackageId);
    const newPackage = next.workPackages.find((entry) => entry.id === retained.workPackageId);
    if (
      canonicalJson(oldPackage) !== canonicalJson(newPackage) &&
      retained.review.status !== "draft"
    )
      throw new Error("Work package changes invalidate affected measurement review.");
    const { review: _oldReview, revision: _oldRevision, ...oldOperands } = record;
    const { review: _newReview, revision: _newRevision, ...newOperands } = retained;
    if (canonicalJson(oldOperands) !== canonicalJson(newOperands)) {
      if (retained.revision !== record.revision + 1 || retained.review.status !== "draft")
        throw new Error(
          "Changed measurement operands require the next revision and a fresh draft review.",
        );
    } else if (retained.revision !== record.revision)
      throw new Error("Review-only changes must retain the measurement revision.");
  }
  return next;
}

type CommandEnvelope = {
  commandId: string;
  jobId: string;
  expectedJobRevision: number;
  actor: string;
  occurredAt: string;
};
/** API boundary only: no runtime executor, persistence, review actor authentication or undo store is installed here. */
export type ConstructionCommand = CommandEnvelope &
  (
    | { kind: "append-source"; source: SourceRevision }
    | { kind: "append-evidence"; evidence: ConstructionJob["evidence"][number] }
    | { kind: "append-calibration"; calibration: Calibration }
    | { kind: "put-work-package"; workPackage: ConstructionJob["workPackages"][number] }
    | { kind: "put-measurement"; measurement: Measurement }
    | {
        kind: "review-measurement";
        measurementId: string;
        expectedMeasurementRevision: number;
        decision: "approved" | "rejected";
        note: string;
      }
  );
export interface ConstructionCommandPort {
  execute(
    command: ConstructionCommand,
  ): Promise<
    | { ok: true; job: ConstructionJob }
    | { ok: false; code: "conflict" | "invalid" | "storage"; message: string }
  >;
}
