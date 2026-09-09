import { z } from 'zod';
import type { ToolResult } from './conversation.ts';

export const WORKFLOW_VERSION = 'xray.workflow/1';
export const workflowNames = ['discussion', 'inspect', 'architecture', 'takeoff', 'render', 'export'] as const;
export const workflowSelectionSchema = z.object({ expectedJobId: z.string().min(1).max(100), workflow: z.enum(workflowNames) }).strict();
export const WORKFLOWS = {
  discussion: ['Discuss capabilities or plans; do not claim project actions occurred.'],
  inspect: ['Read project context.', 'Retrieve the relevant design, source sheets, attachments or evidence.', 'Answer with source/revision and unknowns.'],
  architecture: ['Read project context.', 'Open Sketch when its architectural controller is absent.', 'Read the current design and IDs.', 'Draw or edit a bounded batch through tools.', 'Read back the new revision before another edit.', 'Mount the current design in Model and capture actual pixels.', 'Inspect the returned image; correct with tools or report limitations.'],
  takeoff: ['Read project context and source sheets.', 'Read evidence on the target sheet.', 'Use calibration/trace tools only with their required real inputs and permissions.', 'Read the resulting evidence again; report exclusions and unknowns.'],
  render: ['Read project context.', 'For newly authored geometry, read and mount its current revision.', 'Capture the requested view.', 'Generate a visualisation of that view; it is not new geometry or verified evidence.'],
  export: ['Read project context.', 'Read current authored design, or source sheets for a sheet register.', 'Finish any outstanding authored-design readback and capture.', 'Export the requested format and inspect the actual delivery receipt.'],
} as const;

// Project source registries already have their own storage/context budgets; do not add a hidden document-count limit here.
const stamp = z.string();
export const workflowStateSchema = z.object({
  version: z.literal(WORKFLOW_VERSION), selected: z.enum(workflowNames).nullable(),
  context: stamp.nullable(), designRead: stamp.nullable(), sheetsRead: stamp.nullable(), evidenceRead: stamp.nullable(),
  mounted: stamp.nullable(), sceneSha256: z.string().nullable(), captured: stamp.nullable(), captureView: z.string().nullable(),
  designChanged: z.boolean(), evidenceChanged: z.boolean(), mutationCount: z.number().int().nonnegative(),
  rendered: z.boolean(), exported: z.boolean(),
  failure: z.string().nullable(),
}).strict();
export type WorkflowState = z.infer<typeof workflowStateSchema>;
export type RoutingContext = {
  projectId: string; projectRevision: number; designRevision: number | null;
  sourceKey: string; sheet: number; architectReady: boolean; pane: string; renderedSceneSha256: string | null;
};
export type RouteStep = { tool: string; args: Record<string, unknown>; reason: string };
export function emptyWorkflow(): WorkflowState {
  return { version: WORKFLOW_VERSION, selected: null, context: null, designRead: null, sheetsRead: null, evidenceRead: null,
    mounted: null, sceneSha256: null, captured: null, captureView: null, designChanged: false, evidenceChanged: false, mutationCount: 0, rendered: false, exported: false, failure: null };
}
const contextKey = (c: RoutingContext) => JSON.stringify([c.projectId, c.projectRevision, c.sourceKey, c.sheet]);
const designKey = (c: RoutingContext) => JSON.stringify([c.projectId, c.designRevision]);
const evidenceKey = (c: RoutingContext, sheet?: unknown) => JSON.stringify([contextKey(c), sheet ?? 'all']);
const captureKey = (c: RoutingContext) => JSON.stringify([contextKey(c), designKey(c), c.pane, c.renderedSceneSha256]);
const ARCHITECT_EDITS = new Set(['draw_architect_elements', 'edit_architect_elements', 'undo_architect_change']);
const TAKEOFF_EDITS = new Set(['calibrate_source_sheet', 'trace_takeoff_run', 'remove_takeoff_trace']);
const UNBOUND_READS = new Set(['read_project_context', 'read_workbench_structure', 'read_work_packet', 'read_work_packet_event', 'web_search']);
const bound = (c: RoutingContext) => ({ expectedJobId: c.projectId });
const contextStep = (): RouteStep => ({ tool: 'read_project_context', args: {}, reason: 'Read the current project identity, revision and workspace state.' });
const designStep = (c: RoutingContext): RouteStep => !c.architectReady
  ? { tool: 'navigate_workspace', args: { ...bound(c), pane: 'sketch' }, reason: 'Mount the architectural workspace; no geometry edit is required.' }
  : { tool: 'read_architect_design', args: bound(c), reason: 'Retrieve current design IDs and revision before authoring, mounting or exporting.' };

/** Selects a known process, never infers permissions or invents coordinates from user text. */
export function nextToolStep(s: WorkflowState, tool: string, args: Record<string, unknown>, c: RoutingContext): RouteStep | null {
  if (tool === 'read_workflow_route' || UNBOUND_READS.has(tool)) return null;
  if (!s.selected) {
    const workflow = ARCHITECT_EDITS.has(tool) || tool === 'show_design_in_model' ? 'architecture'
      : TAKEOFF_EDITS.has(tool) ? 'takeoff' : tool === 'generate_render_visualisation' ? 'render' : tool === 'export_design_file' ? 'export' : 'inspect';
    return { tool: 'read_workflow_route', args: { ...bound(c), workflow }, reason: 'Select the workflow for this requested tool. Use discussion for a discussion-only task. Selection is not edit permission.' };
  }
  if (s.context !== contextKey(c)) return contextStep();
  const architectural = ARCHITECT_EDITS.has(tool) || tool === 'show_design_in_model' || (tool === 'export_design_file' && args.format !== 'sheet-register');
  if (tool === 'read_architect_design' && !c.architectReady) return designStep(c);
  if (architectural && (s.designRead !== designKey(c) || (ARCHITECT_EDITS.has(tool) && !c.architectReady))) return designStep(c);
  if (TAKEOFF_EDITS.has(tool) || tool === 'manage_source_sheet' || (tool === 'export_design_file' && args.format === 'sheet-register')) {
    if (s.sheetsRead !== contextKey(c)) return { tool: 'read_source_sheets', args: bound(c), reason: 'Read the current source identity and sheet register before changing or exporting it.' };
  }
  if (TAKEOFF_EDITS.has(tool) && s.evidenceRead !== evidenceKey(c) && s.evidenceRead !== evidenceKey(c, args.sheet)) {
    return { tool: 'read_takeoff_evidence', args: { ...bound(c), ...(typeof args.sheet === 'number' ? { sheet: args.sheet } : {}) }, reason: 'Inspect current target-sheet calibration and traces. This does not replace calibration/authority checks in the actual tool.' };
  }
  if (tool === 'generate_render_visualisation' && (s.captured !== captureKey(c) || s.captureView !== args.view)) {
    return { tool: 'capture_workspace_image', args: { ...bound(c), target: args.view }, reason: 'Inspect actual current-view pixels before requesting an AI illustration.' };
  }
  if (s.designChanged && ((tool === 'capture_workspace_image' && args.target === 'source-building') || tool === 'export_design_file')) {
    if (s.designRead !== designKey(c)) return designStep(c);
    if (s.mounted !== designKey(c) || s.sceneSha256 !== c.renderedSceneSha256 || c.pane !== 'model') {
      return { tool: 'show_design_in_model', args: { ...bound(c), expectedRevision: c.designRevision, displayMode: 'solid' }, reason: 'Mount the current authored revision, not a catalog model or an older scene.' };
    }
    if (tool === 'export_design_file' && (s.captured !== captureKey(c) || s.captureView !== 'source-building')) {
      return { tool: 'capture_workspace_image', args: { ...bound(c), target: 'source-building' }, reason: 'Inspect the current authored model before exporting this task’s changes.' };
    }
  }
  return null;
}

function receipt(result: ToolResult): Record<string, unknown> {
  try { return JSON.parse(result.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('\n')); } catch { return {}; }
}
/** Only actual successful receipts advance prerequisites. Failed/rejected calls never do. */
export function recordWorkflowResult(s: WorkflowState, tool: string, args: Record<string, unknown>, result: ToolResult, before: RoutingContext, after: RoutingContext): WorkflowState {
  const next = { ...s };
  if (result.isError) return { ...next, failure: `${tool} failed; inspect its actual receipt. Do not claim this action completed.` };
  if (next.failure?.startsWith(`${tool} `) || next.failure?.startsWith(`${tool}:`)) next.failure = null;
  const data = receipt(result);
  if (tool === 'read_workflow_route') {
    const selection = workflowSelectionSchema.safeParse(args);
    if (selection.success && selection.data.expectedJobId === after.projectId) next.selected = selection.data.workflow;
    return next; // Selecting another route cannot erase outstanding verification or failed outcomes.
  }
  if (before.projectId !== after.projectId) return next;
  if (tool === 'read_project_context' && data.projectId === after.projectId && data.projectRevision === after.projectRevision) next.context = contextKey(after);
  if (tool === 'read_architect_design') {
    const project = data.project as { id?: string; revision?: number } | undefined;
    if (project?.id === after.projectId && project.revision === after.designRevision && !data.blocked && !data.pendingDraft) next.designRead = designKey(after);
    if (data.blocked || data.pendingDraft) next.failure = 'read_architect_design reports a blocked workspace or unfinished drawing gesture. Resolve that actual state before editing.';
  }
  if (tool === 'read_source_sheets' && contextKey(before) === contextKey(after)) next.sheetsRead = contextKey(after);
  if (tool === 'read_takeoff_evidence' && contextKey(before) === contextKey(after)) {
    next.evidenceRead = evidenceKey(after, args.sheet);
    if (args.sheet === undefined) next.evidenceChanged = false;
  }
  if (ARCHITECT_EDITS.has(tool)) {
    next.designChanged = true; next.mutationCount++; next.designRead = null; next.mounted = null; next.captured = null; next.failure = null;
  }
  if (TAKEOFF_EDITS.has(tool)) { next.evidenceChanged = true; next.evidenceRead = null; next.mutationCount++; next.failure = null; }
  if (tool === 'generate_render_visualisation') next.rendered = true;
  if (tool === 'export_design_file') {
    next.exported = data.downloaded === true;
    if (!next.exported) next.failure = 'Export receipt did not confirm browser delivery. Do not claim the file was delivered.';
  }
  if (tool === 'show_design_in_model' && data.mounted === true && data.designRevision === after.designRevision && typeof data.sceneSha256 === 'string') {
    next.mounted = designKey(after); next.sceneSha256 = data.sceneSha256;
  }
  if (tool === 'capture_workspace_image' && captureKey(before) === captureKey(after) && data.target === args.target && Number(data.frame) > 0
    && result.content.some(c => c.type === 'image' && !!c.data)) {
    next.captured = captureKey(after); next.captureView = String(args.target);
  }
  if (['navigate_workspace', 'control_draftsman', 'hide_designed_model'].includes(tool)) next.captured = null;
  return next;
}

export function completionStep(s: WorkflowState, c: RoutingContext): RouteStep | null {
  if (!s.selected) return { tool: 'read_workflow_route', args: bound(c), reason: 'Select the task workflow before giving the final answer. For a discussion, select discussion; no geometry actions are required.' };
  // A real failure may require a missing input or user decision. Never force a mutation retry.
  if (s.failure) return null;
  if (s.selected !== 'discussion' && s.context !== contextKey(c)) return contextStep();
  if (s.designChanged) {
    const prerequisite = nextToolStep(s, 'export_design_file', { format: 'ifc' }, c);
    if (prerequisite) return prerequisite;
  }
  if (s.evidenceChanged) return { tool: 'read_takeoff_evidence', args: bound(c), reason: 'Read back the changed takeoff evidence before reporting completion.' };
  if (s.selected === 'takeoff' && !s.evidenceRead) return { tool: 'read_takeoff_evidence', args: bound(c), reason: 'Retrieve current takeoff evidence before reporting results.' };
  if (s.selected === 'render' && !s.rendered) return { tool: 'generate_render_visualisation', args: { ...bound(c), view: c.pane === 'model' ? 'source-building' : 'architect' }, reason: 'No render has completed in this task. Capture the intended view, then call the render tool.' };
  if (s.selected === 'export' && !s.exported) return { tool: 'export_design_file', args: bound(c), reason: 'No export delivery has completed in this task. Use the requested format and its current revision; inspect the actual export receipt.' };
  if (s.selected === 'architecture' && s.mutationCount === 0) return { tool: 'read_architect_design', args: bound(c), reason: 'No architectural edit has completed in this task. Continue the requested creation with tools; if the request is discussion/inspection only, select that workflow instead.' };
  return null;
}

export function routingBrief(s: WorkflowState, c: RoutingContext): string {
  return '[xray:workflow-route]\n' + JSON.stringify({ version: WORKFLOW_VERSION, selected: s.selected, workflows: WORKFLOWS,
    nextRequired: completionStep(s, c), lastFailure: s.failure,
    rules: 'Select read_workflow_route for the user’s task. Follow the declared process using actual tools throughout; a narrative is not an action. Route selection grants no permission. Read receipts and returned images, correct or report defects. Capture/readback establish inspection, not engineering approval. Do not invent a procedural, array or mesh tool; these are not implemented. If a tool is rejected, use the returned next step, then retry only when appropriate. Re-read revisions after changes. If required input or permission is missing, report it instead of retrying indefinitely.' });
}
