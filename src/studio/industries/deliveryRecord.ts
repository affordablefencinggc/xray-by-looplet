import { z } from "zod";
import { industrySourceBindingSchema } from "./sourceBinding.ts";

/** Shared report/issue delivery and revision contract (SH-03).
 *
 * Every industry produces artefacts — a roofing quantity report, a duct schedule, a cost plan, an
 * alteration issue set — and every one of them moves through the same four delivery states:
 *
 *   draft-export       an export of the current, unsaved draft. It is not an identity and nothing is frozen.
 *   saved-draft        a stored, editable draft (what the worksheets already persist).
 *   reviewed-estimate  a frozen snapshot that has been reviewed but not yet issued.
 *   issued-deliverable a frozen, issued deliverable that participates in supersession.
 *
 * The contract fixes the metadata that identifies a deliverable and fixes the two things that must
 * never happen to a frozen deliverable: its content hash changing, and a superseded deliverable being
 * edited. It reuses the alteration issue's supersession shape (status + supersededAt/ById/ByRevision)
 * so the residential issue set and the industry reports speak the same language.
 */

export const DELIVERY_RECORD_SCHEMA = "xray.delivery-record/v1" as const;

export const DELIVERY_STATES = [
  "draft-export",
  "saved-draft",
  "reviewed-estimate",
  "issued-deliverable",
] as const;
export type DeliveryState = (typeof DELIVERY_STATES)[number];

const id = z
  .string()
  .min(1)
  .max(240)
  .refine((value) => value.trim() === value, "Identifiers cannot have surrounding whitespace.");
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.string().datetime({ offset: true });

export const deliveryRecordSchema = z
  .object({
    format: z.literal(DELIVERY_RECORD_SCHEMA),
    id: id,
    /** Which artefact this is, e.g. "roofing", "duct", "quantity", "alteration". */
    kind: id,
    projectId: id,
    state: z.enum(DELIVERY_STATES),
    revision: z.number().int().positive(),
    createdAt: timestamp,
    reviewedAt: timestamp.optional(),
    issuedAt: timestamp.optional(),
    /** The primary source binding this deliverable was reviewed against, when there is one. */
    sourceBinding: industrySourceBindingSchema.nullable(),
    /** Hash of the frozen content. Once a deliverable is reviewed or issued this must never change. */
    contentSha256: hash,
    status: z.enum(["active", "superseded"]).default("active"),
    supersededAt: timestamp.optional(),
    supersededById: id.optional(),
    supersededByRevision: z.string().max(40).optional(),
  })
  .strict()
  .superRefine((record, context) => {
    const issue = (path: (string | number)[], message: string) =>
      context.addIssue({ code: "custom", path, message });

    const supersessionFields = ["supersededAt", "supersededById", "supersededByRevision"] as const;

    if (record.state === "draft-export" || record.state === "saved-draft") {
      if (record.reviewedAt !== undefined) issue(["reviewedAt"], "A draft has not been reviewed yet.");
      if (record.issuedAt !== undefined) issue(["issuedAt"], "A draft has not been issued yet.");
      if (record.status !== "active") issue(["status"], "Only an issued deliverable can be superseded.");
    }
    if (record.state === "reviewed-estimate") {
      if (record.reviewedAt === undefined) issue(["reviewedAt"], "A reviewed estimate records when it was reviewed.");
      if (record.issuedAt !== undefined) issue(["issuedAt"], "A reviewed estimate has not been issued yet.");
      if (record.status !== "active") issue(["status"], "Only an issued deliverable can be superseded.");
    }
    if (record.state === "issued-deliverable") {
      if (record.reviewedAt === undefined) issue(["reviewedAt"], "An issued deliverable records when it was reviewed.");
      if (record.issuedAt === undefined) issue(["issuedAt"], "An issued deliverable records when it was issued.");
    }

    if (record.status === "superseded") {
      if (record.state !== "issued-deliverable") issue(["status"], "Only an issued deliverable can be superseded.");
      if (record.supersededAt === undefined) issue(["supersededAt"], "A superseded deliverable records when it was superseded.");
      if (record.supersededById === undefined) issue(["supersededById"], "A superseded deliverable records which deliverable superseded it.");
    } else {
      for (const field of supersessionFields) {
        if (record[field] !== undefined) issue([field], `${field} only applies to a superseded deliverable.`);
      }
    }

    if (record.sourceBinding !== null && record.sourceBinding.projectId !== record.projectId)
      issue(["sourceBinding", "projectId"], "A deliverable's source binding must belong to the same project.");
  });

export type DeliveryRecord = z.infer<typeof deliveryRecordSchema>;

/** Whether a state's content is frozen. Drafts are not; a reviewed or issued deliverable is. */
export function frozenDeliveryState(state: DeliveryState): boolean {
  return state === "reviewed-estimate" || state === "issued-deliverable";
}

const STATE_ORDER: Record<DeliveryState, number> = {
  "draft-export": 0,
  "saved-draft": 1,
  "reviewed-estimate": 2,
  "issued-deliverable": 3,
};

export function describeDeliveryState(state: DeliveryState): string {
  switch (state) {
    case "draft-export":
      return "Draft export";
    case "saved-draft":
      return "Saved draft";
    case "reviewed-estimate":
      return "Reviewed estimate";
    case "issued-deliverable":
      return "Issued deliverable";
  }
}

export type AdvanceDeliveryOptions = { reviewedAt?: string; issuedAt?: string };

/** Advance a deliverable one state forward. A superseded deliverable cannot advance, and a state can
 * never be skipped or regressed, so a deliverable cannot be issued without first being reviewed. The
 * content hash is carried through unchanged. */
export function advanceDelivery(
  record: DeliveryRecord,
  nextState: DeliveryState,
  options: AdvanceDeliveryOptions = {},
): DeliveryRecord {
  if (record.status !== "active")
    throw Error("A superseded deliverable cannot change state.");
  const from = STATE_ORDER[record.state];
  const to = STATE_ORDER[nextState];
  if (to !== from + 1)
    throw Error(
      `A ${record.state.replace(/-/g, " ")} becomes a ${nextState.replace(/-/g, " ")} only one step at a time.`,
    );

  const patch: Partial<DeliveryRecord> = { state: nextState };
  if (nextState === "reviewed-estimate") {
    if (!options.reviewedAt) throw Error("A reviewed estimate records when it was reviewed.");
    patch.reviewedAt = options.reviewedAt;
  }
  if (nextState === "issued-deliverable") {
    if (!options.issuedAt) throw Error("An issued deliverable records when it was issued.");
    patch.issuedAt = options.issuedAt;
  }

  const next = deliveryRecordSchema.parse({ ...record, ...patch });
  if (next.contentSha256 !== record.contentSha256)
    throw Error("Advancing a deliverable must not change its frozen content hash.");
  return next;
}

/** Mark an active, issued deliverable superseded by a later one. The superseded record's content hash
 * and every other frozen field are carried through unchanged; only the supersession pointers change. */
export function supersedeDelivery(current: DeliveryRecord, superseding: DeliveryRecord): DeliveryRecord {
  if (current.state !== "issued-deliverable" || current.status !== "active")
    throw Error("Only an active issued deliverable can be superseded.");
  if (superseding.state !== "issued-deliverable" || superseding.status !== "active")
    throw Error("A deliverable can only be superseded by an active issued deliverable.");
  if (superseding.projectId !== current.projectId)
    throw Error("A deliverable can only be superseded within the same project.");
  if (!superseding.issuedAt)
    throw Error("The superseding deliverable records when it was issued.");

  const next = deliveryRecordSchema.parse({
    ...current,
    status: "superseded" as const,
    supersededAt: superseding.issuedAt,
    supersededById: superseding.id,
    supersededByRevision: String(superseding.revision),
  });
  if (next.contentSha256 !== current.contentSha256)
    throw Error("Superseding a deliverable must not change its frozen content hash.");
  return next;
}

/** Prove that frozen content still matches the hash the deliverable recorded. The hash is computed by
 * the caller (synchronously in the browser), so this module keeps no crypto dependency. */
export function assertDeliveryContentIntact(
  record: DeliveryRecord,
  contentJson: string,
  computeSha256: (contentJson: string) => string,
): void {
  if (computeSha256(contentJson) !== record.contentSha256)
    throw Error("The deliverable's content no longer matches its frozen hash.");
}
