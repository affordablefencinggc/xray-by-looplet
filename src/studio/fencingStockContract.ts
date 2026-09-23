import { z } from "zod";

const length = z.number().int().positive().max(12000);
export const fencingStockRuleSchema = z.object({
  recipeId: z.string().min(1).max(240), recipeRevision: z.number().int().positive(), componentId: z.string().min(1).max(240),
  profile: z.string().trim().min(1).max(120), stockLengthsMm: z.array(length).min(1).max(20),
  kerfMm: z.number().finite().nonnegative().max(50), reusableOffcutMm: length,
  // Rails use actual bay spacing plus this declared joint/post deduction. Posts use a declared finished length.
  railAdjustmentMm: z.number().int().min(-1000).max(1000), postLengthMm: length.nullable(),
  reference: z.string().trim().min(1).max(1000), reviewedBy: z.string().trim().min(1).max(120), reviewedAt: z.string().datetime(),
}).strict().refine(rule => new Set(rule.stockLengthsMm).size === rule.stockLengthsMm.length, "List each stock length once.");
export type FencingStockRule = z.infer<typeof fencingStockRuleSchema>;
export const fencingStockRulesSchema = z.array(fencingStockRuleSchema).max(100).refine(
  rules => new Set(rules.map(rule => `${rule.recipeId}:${rule.componentId}`)).size === rules.length, "Each component needs one stock rule.",
);
