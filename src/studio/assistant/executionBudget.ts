import { z } from 'zod';

export const executionBudgetSchema = z.object({
  maxRounds: z.number().int().min(1).max(512),
  maxToolCalls: z.number().int().min(1).max(4096),
  maxOutputTokens: z.number().int().min(1024).max(65536),
  timeoutMs: z.number().int().min(10000).max(600000),
  contextTokens: z.number().int().min(16000).max(900000),
}).strict();
export type ExecutionBudget = z.infer<typeof executionBudgetSchema>;
export const DEFAULT_EXECUTION_BUDGET: Readonly<ExecutionBudget> = Object.freeze({
  maxRounds: 64, maxToolCalls: 256, maxOutputTokens: 32768, timeoutMs: 300000, contextTokens: 600000,
});
export const EXECUTION_BUDGET_KEY = 'xray:assistant-execution-budget:v1';
export function readExecutionBudget(storage?: Pick<Storage, 'getItem'> | null): ExecutionBudget {
  try {
    const parsed = executionBudgetSchema.safeParse(JSON.parse(storage?.getItem(EXECUTION_BUDGET_KEY) || 'null'));
    if (parsed.success) return parsed.data;
  } catch { /* Unavailable or corrupt preferences use explicit defaults. */ }
  return { ...DEFAULT_EXECUTION_BUDGET };
}
