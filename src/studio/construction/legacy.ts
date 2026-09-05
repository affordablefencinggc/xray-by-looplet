import { parseFencingJob, revisionEventSchema } from "../domain.ts";
import {
  constructionJobSchema,
  legacyExtensionSchema,
  CONSTRUCTION_JOB_SCHEMA,
} from "./contract.ts";
import type { ConstructionJob } from "./contract.ts";
import { z } from "zod";

const optionsSchema = z
  .object({
    workPackageId: z.string().min(1),
    preservedAssets: legacyExtensionSchema.shape.preservedAssets,
    preservedRecords: legacyExtensionSchema.shape.preservedRecords,
  })
  .strict();
export type LegacyImportOptions = z.infer<typeof optionsSchema>;

/** Explicit non-writing adapter. Exact original JSON and caller-supplied assets/records survive import.
 * Legacy geometry is NOT promoted to verified generic measurements: document ownership/scale may be ambiguous.
 */
export function importLegacyFencingJob(
  originalJobJson: string,
  inputOptions: LegacyImportOptions,
): ConstructionJob {
  const options = optionsSchema.parse(inputOptions);
  const candidate: unknown = JSON.parse(originalJobJson);
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
    throw new Error("Legacy job must be an object.");
  const version = (candidate as { schemaVersion?: unknown }).schemaVersion;
  if (version !== 1 && version !== 2) throw new Error("Unsupported legacy fencing version.");
  // Validate using the established importer, but retain the untouched original, never its lossy normalized projection.
  const validated = parseFencingJob(candidate);
  const originalRevision = (candidate as { revision?: unknown }).revision;
  const retainedRevision =
    originalRevision === undefined
      ? validated.revision
      : z.number().int().positive().max(Number.MAX_SAFE_INTEGER).parse(originalRevision);
  const originalHistory = (candidate as { revisionHistory?: unknown }).revisionHistory;
  if (originalHistory !== undefined) z.array(revisionEventSchema).max(1000).parse(originalHistory);
  for (const record of options.preservedRecords) JSON.parse(record.originalJson);
  if (
    new Set(options.preservedAssets.map((entry) => entry.id)).size !==
      options.preservedAssets.length ||
    new Set(options.preservedRecords.map((entry) => entry.key)).size !==
      options.preservedRecords.length
  )
    throw new Error("Duplicate preserved assets or record keys.");
  return constructionJobSchema.parse({
    schema: CONSTRUCTION_JOB_SCHEMA,
    id: validated.id,
    revision: retainedRevision,
    name: validated.name,
    createdAt: validated.createdAt,
    updatedAt: validated.updatedAt,
    workPackages: [
      {
        id: options.workPackageId,
        revision: 1,
        name: "Imported fencing",
        trade: "fencing",
        pack: null,
      },
    ],
    sources: [],
    calibrations: [],
    evidence: [],
    measurements: [],
    extensions: {
      legacyFencing: {
        schema: "xray.legacy-fencing-import/v1",
        originalSchemaVersion: version,
        originalJobJson,
        preservedAssets: options.preservedAssets,
        preservedRecords: options.preservedRecords,
      },
    },
  });
}
