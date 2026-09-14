import { z } from "zod";

/** Leaf schema module: no model, resolver, export or register imports. */
export const ALTERATION_DRAFT_MAX = 5;
export const ALTERATION_DRAFT_SOURCE_MAX = 256000;
export const ALTERATION_DRAFT_SOURCE_BYTES_MAX = 512000;
const identity = z.string().trim().min(1).max(100);
export const alterationDraftRecordSchema = z.object({
  format: z.literal("xray.alteration-draft/v1"),
  id: identity,
  savedAt: z.string().datetime({ offset: true }),
  stage: z.enum(["before", "proposed"]),
  projectId: z.string().min(1).max(100),
  projectRevision: z.number().int().positive(),
  designRevision: z.string().max(40),
  basis: z.object({ reference: z.string().trim().min(1).max(500), fingerprint: z.string().min(1).max(512000) }).strict(),
  selection: z.object({ levelId: z.string().min(1).max(100), view: z.enum(["plan", "north", "south", "east", "west", "section"]) }).strict(),
  sourceJson: z.string().min(1).max(ALTERATION_DRAFT_SOURCE_MAX)
    .refine((value) => new TextEncoder().encode(value).byteLength <= ALTERATION_DRAFT_SOURCE_BYTES_MAX, "Saved alteration source exceeds the 512000-byte limit."),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  draftOnly: z.literal(true), issued: z.literal(false), quoteEligible: z.literal(false), sharedAnnotationsReviewed: z.literal(false),
}).strict();
export type AlterationDraftRecord = z.infer<typeof alterationDraftRecordSchema>;
