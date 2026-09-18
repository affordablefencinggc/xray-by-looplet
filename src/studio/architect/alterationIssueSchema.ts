import { z } from "zod";
import { deliveryRecordSchema } from "../industries/deliveryRecord.ts";

/**
 * Leaf schema module for formal frozen alteration issue sets.
 * No dependencies on geometry, resolver, or UI — the one import is the SH-03 delivery contract, which is
 * itself a schema module with no geometry in it (SC-01).
 */
export const ALTERATION_ISSUE_MAX = 10;
export const ALTERATION_ISSUE_PURPOSE_MAX = 100;
export const ALTERATION_ISSUE_SOURCE_MAX = 512000;
export const ALTERATION_ISSUE_SOURCE_BYTES_MAX = 1024000;

const identity = z.string().trim().min(1).max(100);

export const alterationIssueSheetSchema = z
  .object({
    sheetId: identity,
    number: z.string().min(1).max(40),
    name: z.string().min(1).max(120),
    stage: z.enum(["before", "proposed", "shared"]),
    view: z.enum(["plan", "north", "south", "east", "west", "section"]),
    levelId: identity,
    scale: z.string().min(1).max(20),
  })
  .strict();

export type AlterationIssueSheet = z.infer<typeof alterationIssueSheetSchema>;

export const stageQuantitiesSummarySchema = z
  .object({
    wallSolidVolumeM3: z.number().finite().nonnegative(),
    openingsCount: z.number().int().nonnegative(),
    roomsCount: z.number().int().nonnegative(),
    totalRoomAreaM2: z.number().finite().nonnegative(),
    orphanedTagsCount: z.number().int().nonnegative(),
  })
  .strict();

export type StageQuantitiesSummary = z.infer<typeof stageQuantitiesSummarySchema>;

export const alterationScheduleSummarySchema = z
  .object({
    demolitionRowsCount: z.number().int().nonnegative(),
    demolitionVolumeM3: z.number().finite().nonnegative(),
    salvageDisposalVolumeM3: z.number().finite().nonnegative(),
    repairRowsCount: z.number().int().nonnegative(),
    repairVolumeM3: z.number().finite().nonnegative(),
    materialRowsCount: z.number().int().nonnegative(),
    materialNetVolumeM3: z.number().finite().nonnegative(),
    materialOrderAreaM2: z.number().finite().nonnegative(),
  })
  .strict();

export type AlterationScheduleSummary = z.infer<typeof alterationScheduleSummarySchema>;

export const alterationIssueRecordSchema = z
  .object({
    format: z.literal("xray.alteration-issue/v1"),
    id: identity,
    issuedAt: z.string().datetime({ offset: true }),
    purpose: z.string().trim().min(1).max(ALTERATION_ISSUE_PURPOSE_MAX),
    projectId: identity,
    projectRevision: z.number().int().positive(),
    designRevision: z.string().min(1).max(40),
    projectName: z.string().min(1).max(200),
    projectAddress: z.string().max(500),
    basis: z
      .object({
        reference: z.string().trim().min(1).max(500),
        fingerprint: z.string().min(1).max(512000),
      })
      .strict(),
    status: z.enum(["current", "superseded"]).default("current"),
    supersededAt: z.string().datetime({ offset: true }).optional(),
    supersededById: identity.optional(),
    supersededByRevision: z.string().max(40).optional(),
    sheets: z.array(alterationIssueSheetSchema).min(1).max(40),
    beforeSummary: stageQuantitiesSummarySchema,
    proposedSummary: stageQuantitiesSummarySchema,
    schedulesSummary: alterationScheduleSummarySchema,
    sourceJson: z
      .string()
      .min(1)
      .max(ALTERATION_ISSUE_SOURCE_MAX)
      .refine(
        (val) => new TextEncoder().encode(val).byteLength <= ALTERATION_ISSUE_SOURCE_BYTES_MAX,
        "Saved alteration issue source exceeds the 1MB byte limit.",
      ),
    sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
    issued: z.literal(true),
    sharedAnnotationsAudited: z.boolean(),
    /**
     * The SH-03 delivery identity for this issue (SC-01), carrying the same frozen hash as `sourceSha256`
     * in the contract's own shape so an alteration issue set and an industry report speak the same language.
     *
     * Optional because issues issued before the contract was wired in carry none. `checkedAlterationIssue`
     * adopts those from their own frozen bytes instead of refusing a project that was valid when it was
     * saved — a stricter schema here would turn "this project predates the field" into "this project cannot
     * be opened", which is data loss dressed as validation. Every issue created since carries it, and the
     * adopted one is written back on the next append.
     */
    delivery: deliveryRecordSchema.optional(),
  })
  .strict();

export type AlterationIssueRecord = z.infer<typeof alterationIssueRecordSchema>;
