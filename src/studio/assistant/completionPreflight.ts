import { z } from 'zod';
import { completionStep, nextToolStep, type WorkflowState, type RoutingContext, type RouteStep } from './workflowRouting.ts';

const project = z.string().min(1).max(100);
const bound = z.object({ expectedJobId: project }).strict();
// Deliberately enumerated; prefix matching such as read_* is not an execution boundary.
const safeRead = z.discriminatedUnion('tool', [
  z.object({ tool: z.literal('read_workflow_route'), args: bound.extend({ workflow: z.enum(['inspect', 'discussion']) }).strict() }).strict(),
  z.object({ tool: z.literal('read_project_context'), args: z.object({}).strict() }).strict(),
  z.object({ tool: z.literal('read_source_sheets'), args: bound }).strict(),
  z.object({ tool: z.literal('read_takeoff_evidence'), args: bound.extend({ sheet: z.number().int().nonnegative().optional() }).strict() }).strict(),
  z.object({ tool: z.literal('read_architect_design'), args: bound }).strict(),
]);

export type CompletionRequirement = string | {
  instruction: string;
  readOnlyPrerequisite: { tool: string; args: Record<string, unknown> };
};

export function parseCompletionPreflight(value: unknown) { return safeRead.parse(value); }

/** Conservative explicit current-project inspection intent, never inference of edit authority. */
export function requestsCurrentProjectInspection(objective: string): boolean {
  if (/\b(recording|recorded|transcript|pasted|code|source code)\b/i.test(objective)) return false;
  if (/\b(do not|don't|never|without)\s+(?:actually\s+)?(?:read|inspect|check)\b/i.test(objective)) return false;
  return /\b(read|inspect|check)\s+(?:the\s+)?(?:actual\s+|current\s+|live\s+|this\s+)?project\s+(?:context|state|evidence|id|revision)\b/i.test(objective)
    || /\b(inspect|check)\s+(?:this|the current|the actual|the live)\s+project\b/i.test(objective);
}

export function completionStepForObjective(state: WorkflowState, context: RoutingContext, objective: string): RouteStep | null {
  if (state.failure) return null;
  let next = completionStep(state, context);
  const explicitInspection = requestsCurrentProjectInspection(objective);
  // Reuse the router's context-stamp rule without executing a sheet read.
  if (explicitInspection && state.selected === 'discussion') {
    const contextRead = nextToolStep(state, 'read_source_sheets', { expectedJobId: context.projectId }, context);
    if (contextRead?.tool === 'read_project_context') next = contextRead;
  }
  if (next?.tool === 'read_workflow_route' && explicitInspection) {
    return { ...next, args: { expectedJobId: context.projectId, workflow: 'inspect' } };
  }
  return next;
}
