import { z } from "zod";
import { classificationInputSchema, classifyQuantities } from "./classification.ts";

export const name = "classify_draft_quantities";
export const description = "Group explicitly supplied quantities into an explicitly supplied user-defined classification hierarchy. Supply hierarchy ID/revision, nodes, measured-item IDs, decimal quantity strings, units, declared evidence status and source metadata (or explicit null), plus one assignment per classified item. Use only quantities, classifications and references actually supplied by the user or read from project evidence; never invent them. Unassigned items remain visible. Returns exact decimal totals separated by unit and declared evidence status, direct node totals and overlapping ancestor rollups; use report totals for reconciliation rather than summing ancestor rows. Preserves source metadata without verifying it. Always draft-classification and verifiedQuoteEligible:false, even with complete classification or caller-declared measured evidence. No project changes, saved classifications, rate application, currency, cost plan issue or approval. Missing required inputs must be requested, not guessed.";

// Input mode preserves accepted decimal syntax before lossless normalisation.
// Cross-field graph/assignment checks also run through classifyQuantities.
export const inputSchema = z.toJSONSchema(classificationInputSchema, { io: "input" });

export function execute(input: unknown) {
  try { return classifyQuantities(classificationInputSchema.parse(input)); }
  catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ");
      const nullableField = error.issues.some(issue =>
        (issue.path[0] === "nodes" && issue.path[2] === "parentId") ||
        (issue.path[0] === "items" && issue.path[2] === "source"));
      throw Error(`Invalid tool arguments: ${issues}${nullableField ? " Top-level nodes accept parentId: null. Items without supplied source evidence accept source: null. Preserve the user's explicit JSON null values; do not invent parent nodes, source IDs, hashes or calibration metadata. Empty strings and empty objects are not null." : ""}`);
    }
    throw error;
  }
}
