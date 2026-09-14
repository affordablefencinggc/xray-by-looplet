import { z } from "zod";
import { classificationInputSchema, classifyQuantities } from "./classification.ts";
import { CSV_COLUMNS } from "./report.ts";

/** Facts about the report/CSV that an explanation must not have to infer.
 * Both recorded answer failures came from guessing these: that the CSV drops parent
 * labels (it does not — "Classification path" carries the full ancestor path), and
 * that inclusive totals are safe because evidence classes are disjoint (they are not;
 * they are safe because every actual item is counted exactly once). */
const reportContract = {
  csvColumns: [...CSV_COLUMNS],
  csvRowRule: "One CSV record per actual item, including an item assigned directly to a nonleaf (parent) classification. There are no rollup, subtotal or ancestor records.",
  csvHierarchyRule: "Hierarchy fields are retained on every record: 'Classification' is the assigned node and 'Classification path' is the full JSON ancestor path. Evidence, every supplied source-reference field, report status and the quote-ineligible flag are retained too. A manual item with no supplied reference reports 'Unavailable', never an invented ID.",
  totalsRule: "'totals' counts each actual item exactly once, split by exact unit and declared evidence. That item-once rule is why the report total is safe.",
  rollupOverlapRule: "Each node's 'rollup' is INCLUSIVE: it re-counts the same items already reported by its descendants' 'direct' and 'rollup' entries. Parent and child rows therefore OVERLAP by construction and must NEVER be added together. Safety comes from item-once aggregation, not from units or evidence classes being disjoint across nodes.",
  reconciliation: "Reconcile against 'totals'. Summing ancestor rows double-counts every item held below a parent.",
} as const;

export const name = "classify_draft_quantities";
export const description = "Group explicitly supplied quantities into an explicitly supplied user-defined classification hierarchy. Supply hierarchy ID/revision, nodes, measured-item IDs, decimal quantity strings, units, declared evidence status and source metadata (or explicit null), plus one assignment per classified item. Use only quantities, classifications and references actually supplied by the user or read from project evidence; never invent them. Unassigned items remain visible. Returns exact decimal totals separated by unit and declared evidence status, direct node totals and inclusive ancestor rollups, plus a reportContract field stating the real CSV columns and aggregation rules. When explaining the export or the hierarchy, quote reportContract instead of inferring: the CSV holds one record per actual item (including items assigned directly to a parent classification) with no rollup records, and it retains the classification path and every supplied source-reference field. Inclusive parent rollups re-count their descendants' items, so parent and child rows overlap and must never be added together; totals are safe because each actual item is counted exactly once, not because units or evidence classes are disjoint. Use report totals for reconciliation rather than summing ancestor rows. Preserves source metadata without verifying it. Always draft-classification and verifiedQuoteEligible:false, even with complete classification or caller-declared measured evidence. No project changes, saved classifications, rate application, currency, cost plan issue or approval. Missing required inputs must be requested, not guessed.";

// Input mode preserves accepted decimal syntax before lossless normalisation.
// Cross-field graph/assignment checks also run through classifyQuantities.
export const inputSchema = z.toJSONSchema(classificationInputSchema, { io: "input" });

export function execute(input: unknown) {
  try { return { ...classifyQuantities(classificationInputSchema.parse(input)), reportContract }; }
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
