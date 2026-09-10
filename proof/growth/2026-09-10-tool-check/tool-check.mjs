/**
 * Tool check: does the MiniMax route carry X-Ray's whole tool surface, and does the model pick the
 * right tool for a plain request?
 *
 * Each case sends one real request with the FULL declaration set and asserts which tool came back.
 * The tools are not executed; this measures declaration fidelity and selection, which is what a
 * "missing tools" report is really about. Nothing is drawn and no project is touched.
 *
 * Run: node --experimental-strip-types proof/growth/2026-09-10-tool-check/tool-check.mjs
 */
import fs from 'node:fs';
import { minimaxAiTurn } from '../../../src/lib/minimaxAi.server.ts';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) env[m[1]] = m[2];
}
env.XRAY_AI_WEB_ENABLED = 'true';

/** The shipped surface, with the real descriptions the app sends. */
const TOOLS = [
  ['read_project_context', 'Read the current X-Ray project: identity, revision, open pane, source documents and counts.'],
  ['navigate_workspace', 'Open a workspace pane (sheets, measure, sketch, model, render, cost, review) and mount its controller.'],
  ['read_architect_design', 'Read the mounted architectural design in millimetres, including stable entity IDs, levels and revision.'],
  ['draw_architect_elements', 'Author walls, hosted doors and windows, lines, room labels, levels, slabs, roofs, footprints and extrusions.'],
  ['edit_architect_elements', 'Edit or delete existing design entities by their stable IDs.'],
  ['undo_architect_change', 'Undo the last design change made through the assistant.'],
  ['capture_workspace_image', 'Capture the current 3D or plan view as an image for inspection.'],
  ['save_project', 'Save the project record and confirm the stored revision.'],
  ['control_draftsman', 'Control Magic Pencil playback in the Model viewer: play, pause, replay, seek, speed, finish, exit.'],
  ['read_draftsman_status', 'Read the Model viewer Magic Pencil telemetry without navigating or starting animation.'],
  ['read_workbench_structure', 'Read how X-Ray is organised: panes, data model, units, evidence states and what is unavailable.'],
  ['read_source_building', 'Read a catalogued source-building reconstruction or the designed model in the Model viewer.'],
  ['read_source_sheets', 'Read the source sheet register: pages, names, disciplines, calibrations and archive state.'],
  ['manage_source_sheet', 'Rename, archive, recover or reorder a source sheet, with an impact review before archiving.'],
  ['read_takeoff_evidence', 'Read measured runs, located items, calibrations and review state for the takeoff.'],
  ['read_price_books', 'Read the imported price books, their revisions, suppliers, currency and rows.'],
  ['capture_project_backup', 'Capture a verified portable backup of the workspace and report its size and digest.'],
  ['calibrate_source_sheet', 'Set or lock the scale of a source page from a known distance.'],
  ['trace_takeoff_run', 'Trace a measured run on a calibrated source page and report its length.'],
  ['review_takeoff_item', 'Record a takeoff review decision for a named reviewer.'],
  ['remove_takeoff_trace', 'Remove a measured trace and its dependent quantities.'],
  ['import_price_book', 'Import a pasted CSV price book with supplier, currency and provenance.'],
  ['export_design_file', 'Export the design as DXF, IFC, drawing PDF, material PDF or sheet register, with a hash receipt.'],
  ['generate_render_visualisation', 'Generate an AI real-life view of the current design from the active camera.'],
  ['show_design_in_model', 'Turn the current architectural design into a Model-viewer scene and select the Model pane.'],
  ['hide_designed_model', 'Return the Model viewer to its catalogued source reconstructions.'],
  ['web_search', 'Search the current web and return a grounded answer with source URLs.'],
  ['read_assistant_file', 'Retrieve a page or text section from a file the user attached to the chat.'],
  ['read_work_packet', 'Read the current task record: objective, actions taken and unresolved items.'],
  ['read_work_packet_event', 'Read one recorded task event in full, including its receipt.'],
  ['read_workflow_route', 'Read the active workflow route and the next expected step for this task.'],
];

const declarations = TOOLS.map(([name, description]) => ({
  name,
  description,
  parametersJsonSchema: { type: 'object', properties: { id: { type: 'string' }, query: { type: 'string' }, pane: { type: 'string' } }, additionalProperties: false },
}));

/** A plain request, and the tool a competent assistant should reach for. */
const CASES = [
  ['What project am I in and what revision is it?', 'read_project_context'],
  ['Open the Sketch workspace.', 'navigate_workspace'],
  ['What walls does the current design have?', 'read_architect_design'],
  ['Draw a 6 m by 4 m room.', 'draw_architect_elements'],
  ['Delete the wall with id wall-3.', 'edit_architect_elements'],
  ['Undo that last change.', 'undo_architect_change'],
  ['Take a picture of the 3D view.', 'capture_workspace_image'],
  ['Save my project now.', 'save_project'],
  ['List the source sheets in this project.', 'read_source_sheets'],
  ['Rename sheet 3 to "Ground floor plan".', 'manage_source_sheet'],
  ['Set the scale of this page using a known 5 m distance.', 'calibrate_source_sheet'],
  ['Export the design as a DXF file.', 'export_design_file'],
  ['Make a photorealistic view of this design.', 'generate_render_visualisation'],
  ['Show the design in the 3D model viewer.', 'show_design_in_model'],
  ['What price books do I have?', 'read_price_books'],
  ['Back up my workspace.', 'capture_project_backup'],
  ['What can X-Ray actually do?', 'read_workbench_structure'],
  ['Search the web for current steel stud prices.', 'web_search'],
];

const results = [];
for (const [prompt, expected] of CASES) {
  const request = {
    schema: 'xray.assistant-request/v1',
    requestId: crypto.randomUUID(),
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    declarations,
    webSearch: false,
    execution: { maxRounds: 8, maxToolCalls: 24, maxOutputTokens: 4096, timeoutMs: 90000, contextTokens: 300000 },
  };
  try {
    const response = await minimaxAiTurn(JSON.stringify(request), { env });
    const called = response.content.parts.filter(p => p.functionCall).map(p => p.functionCall.name);
    const text = response.content.parts.map(p => p.text ?? '').join('');
    results.push({ prompt, expected, called, matched: called.includes(expected), leakedTag: /<\/?think>/i.test(text) });
  } catch (error) {
    results.push({ prompt, expected, called: [], matched: false, error: error.message });
  }
}

const matched = results.filter(r => r.matched).length;
const leaks = results.filter(r => r.leakedTag).length;
const errors = results.filter(r => r.error).length;
console.log(JSON.stringify({
  declarationsSent: declarations.length,
  cases: results.length,
  matched,
  missed: results.length - matched,
  reasoningTagLeaks: leaks,
  transportErrors: errors,
  misses: results.filter(r => !r.matched).map(r => ({ prompt: r.prompt, expected: r.expected, called: r.called, error: r.error })),
}, null, 2));
