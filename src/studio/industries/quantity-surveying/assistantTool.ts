import { z } from "zod";
import { classificationInputSchema, classifyQuantities } from "./classification.ts";

export const name = "classify_draft_quantities";
export const description = "Group explicitly supplied quantities into an explicitly supplied user-defined classification hierarchy. Supply hierarchy ID/revision, nodes, measured-item IDs, decimal quantity strings, units, declared evidence status and source metadata (or explicit null), plus one assignment per classified item. Use only quantities, classifications and references actually supplied by the user or read from project evidence; never invent them. Unassigned items remain visible. Returns exact decimal totals separated by unit and declared evidence status, direct node totals and overlapping ancestor rollups; use report totals for reconciliation rather than summing ancestor rows. Preserves source metadata without verifying it. Always draft-classification and verifiedQuoteEligible:false, even with complete classification or caller-declared measured evidence. No project changes, saved classifications, rate application, currency, cost plan issue or approval. Missing required inputs must be requested, not guessed.";

// Input mode preserves accepted decimal syntax before lossless normalisation.
// Cross-field graph/assignment checks also run through classifyQuantities.
export const inputSchema = z.toJSONSchema(classificationInputSchema, { io: "input" });

export function execute(input: unknown) {
  return classifyQuantities(classificationInputSchema.parse(input));
}
