import { ArchitectPreparationRejected, preparationReceipt } from './actionOutcome.ts';
import { WORKFLOWS, WORKFLOW_VERSION, workflowNames, workflowSelectionSchema } from './workflowRouting.ts';
import { z } from "zod";
import { readAttachment } from './readAttachment.ts';
import { readSourceGeometry, sourceGeometryArgs } from './sourceGeometry.ts';
import { searchStandardsLibrary, standardsOriginalUrl } from './standardsLibrary.ts';
import { prepareSourceRoom, sourceRoomOverlay, sourceRoomSchema } from './sourceRoom.ts';
import type { FencingJob } from "../domain.ts";
import type { Pane } from "../store.ts";
import { ARCHITECT_BATCH_LIMIT, architectDrawSchema, architectReadSchema, architectRevisionSchema, hasArchitectController, requestArchitectTool } from "./architectBridge.ts";
import { draftsmanControlSchema, draftsmanMcpActions, draftsmanMcpSchema, hasDraftsmanController, requestDraftsmanTool, type DraftsmanAction } from "./draftsmanBridge.ts";
import { DESIGNED_SCENE_ENTRY, WORKBENCH_STRUCTURE, loadCatalogScene, sourceBuildingQuerySchema, summariseSourceBuilding, type SourceBuildingQuery } from "./workbenchStructure.ts";
import { buildDesignedScene } from "../architect/designedScene.ts";
import type { SourceBuilding } from "../sourceBuilding.ts";
import { applySheetAction, backupSchema, describePriceBooks, describeSourceSheets, describeTakeoffEvidence, sheetActionSchema, sheetReadSchema, takeoffReadSchema } from "./workbenchTools.ts";
import { architectEditSchema } from "./architectBridge.ts";
import { calibrateSheet, calibrateSheetSchema, removeTrace, removeTraceSchema, reviewTakeoffItem, reviewTakeoffItemSchema, traceRun, traceRunSchema, type TakeoffPort } from "./takeoffTools.ts";
import { browserPriceImportDeps, importPriceBook, notifyPriceBooksChanged, priceImportInputSchema, type PriceImportDeps } from "./priceImportTool.ts";
import { browserDownload, describeExportReceipt, exportDesign, exportDesignSchema, exportFormats, type ExportDeliveryDeps } from "./exportTools.ts";
import { RENDER_TOOL_DESCRIPTION, RENDER_TOOL_INPUT_SCHEMA, RENDER_TOOL_NAME, requestRender } from "./renderTool.ts";
import type { ArchitectProject } from "../architect/model.ts";
import { readBrowserPriceBooks, type PriceBookSession } from "../pricing/priceBooks.ts";
import type { BackupSummary } from "../projectBackupStorage.ts";
import { listWorkPackets, readWorkEvents } from "./workPacketStore.ts";
import * as roofDraftTool from '../industries/roofing/assistantTool.ts';
import * as ductDraftTool from '../industries/hvac/assistantTool.ts';
import * as roofSheetTool from '../industries/roofing/sheetCoverageTool.ts';
import * as ductWrapTool from '../industries/hvac/ductWrapTool.ts';
import * as quantityDraftTool from '../industries/quantity-surveying/assistantTool.ts';

export type AppToolResult = { content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }>; isError?: boolean; _meta?: Record<string, unknown> };
export type AppTool = { name: string; description: string; inputSchema: { type: "object"; [key: string]: unknown }; execute(args: unknown): Promise<AppToolResult> };
export const APP_PANES = ["overview", "sheets", "measure", "sketch", "components", "model", "render", "review", "cost", "proof"] as const;
type AppState = {
  activePlanBinary?: import('../documentContract.ts').PlanBinary | null;
  job: Pick<FencingJob, "id" | "name" | "revision" | "documents" | "activeDocumentId" | "annotations" | "runs" | "gates" | "calibrations" | "photos">;
  pane: Pane; sheet: number; hydrationStatus: string; persistenceHydrated: boolean; persistenceRecoveryBlocked: boolean;
  persistenceError: string | null; lastSavedJobRevision: number | null;
  pending?: unknown[]; calibrationCapture?: { points: unknown[] } | null;
  setPane(pane: Pane): void; saveCurrentProject(): { ok: boolean; error: string | null };
};
export type AppToolPort = {
  getState(): AppState | Promise<AppState>;
  architect(action: "read" | "draw" | "undo" | "edit", args: unknown): Promise<unknown>;
  architectAvailable(): boolean;
  capture(target: "architect" | "source-building"): Promise<AppToolResult>;
  openArchitectWorkspace?(expectedJobId: string): Promise<void>;
  draftsman?(action: DraftsmanAction, args?: unknown): Promise<unknown>;
  draftsmanAvailable?(): boolean;
  sourceBuilding?(query: SourceBuildingQuery): Promise<unknown>;
  /** Saved sidecar storage shared with the Sheets pane (browser localStorage). */
  storage?: Pick<Storage, "getItem" | "setItem">;
  sheetChanged?(storageKey: string): void;
  priceBooks?(jobId: string): PriceBookSession;
  backup?(name: string): Promise<BackupSummary>;
  /** Synchronous studio-store snapshot for the Measure pane sequences (calibrate, trace, review, remove). */
  takeoff?: TakeoffPort;
  priceImport?: PriceImportDeps;
  priceBooksChanged?(storageKey: string): void;
  /** Export delivery; the browser default hands bytes to an anchor download. */
  exportDelivery?: ExportDeliveryDeps;
  /** Model mode: mounts a designed scene in the Model viewer (null returns it to the catalog). Session state only; never written to the project. */
  mountDesignedModel?(scene: SourceBuilding | null): void | Promise<void>;
  setModelDisplay?(expectedJobId: string, designRevision: number, mode: "solid" | "wireframe", sceneSha256: string): Promise<void>;
};
const idSchema = z.string().min(1).max(100);
const emptySchema = z.object({}).strict();
const navigationSchema = z.object({ expectedJobId: idSchema, pane: z.enum(APP_PANES) }).strict();
const captureSchema = z.object({ expectedJobId: idSchema, target: z.enum(["architect", "source-building"]) }).strict();
const designedModelSchema = z.object({ expectedJobId: idSchema, expectedRevision: z.number().int().positive().optional(), displayMode: z.enum(["solid", "wireframe"]).optional() }).strict();
const text = (value: unknown): AppToolResult => ({ content: [{ type: "text", text: JSON.stringify(value) }] });
const objectSchema = (properties: Record<string, unknown>, required = Object.keys(properties)): AppTool["inputSchema"] => ({ type: "object", properties, required, additionalProperties: false });
const id = { type: "string", minLength: 1, maxLength: 100 }, num = { type: "number", minimum: -1e6, maximum: 1e6 }, positive = { type: "number", exclusiveMinimum: 0, maximum: 1e6 };
const point = { type: "array", items: num, minItems: 2, maxItems: 2 };
const bound = { expectedJobId: id, expectedRevision: { type: "integer", minimum: 1 } };
const ref = { type: "string", minLength: 1, maxLength: 80 };
const opening = { ref, wallRef: id, offsetMm: num, widthMm: positive, heightMm: positive, tag: { type: "string", minLength: 1, maxLength: 30 }, hinge: { enum: ["left", "right"] }, swing: { enum: ["in", "out"] } };
const name = { type: "string", minLength: 1, maxLength: 120 };
const polygon = { type: "array", items: point, minItems: 3, maxItems: 200 };
const sheetIndex = { type: "integer", minimum: 0, maximum: 9999 };
const sourcePoint = { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"], additionalProperties: false };
const pitchDeg = { type: "number", minimum: 0, maximum: 89.9 }, eavesMm = { type: "number", minimum: 0, maximum: 3000 };
const gableEdges = { type: "array", items: { type: "integer", minimum: 0, maximum: 199 }, maxItems: 200 };
const operations = {
  type: "array", minItems: 1, maxItems: ARCHITECT_BATCH_LIMIT, items: { oneOf: [
    objectSchema({ kind: { const: "wall" }, ref, levelId: id, a: point, b: point, heightMm: positive, thicknessMm: positive, name, templateWallId: id }, ["kind", "levelId", "a", "b"]),
    objectSchema({ kind: { const: "door" }, ...opening }, ["kind", "wallRef", "offsetMm", "widthMm", "heightMm", "tag", "hinge", "swing"]),
    objectSchema({ kind: { const: "window" }, ...opening, sillMm: { type: "number", minimum: 0, maximum: 1e6 } }, ["kind", "wallRef", "offsetMm", "widthMm", "heightMm", "sillMm", "tag", "hinge", "swing"]),
    objectSchema({ kind: { const: "line" }, ref, levelId: id, a: point, b: point }, ["kind", "levelId", "a", "b"]),
    objectSchema({ kind: { const: "room" }, ref, levelId: id, point, name: { type: "string", minLength: 1, maxLength: 100 } }, ["kind", "levelId", "point", "name"]),
    objectSchema({ kind: { const: "level" }, ref, name: { type: "string", minLength: 1, maxLength: 100 }, elevationMm: num, heightMm: positive }, ["kind", "name", "elevationMm", "heightMm"]),
    objectSchema({ kind: { const: "slab" }, ref, levelId: id, points: polygon, thicknessMm: positive, offsetMm: num, name, material: { type: "string", maxLength: 100 } }, ["kind", "levelId", "points", "thicknessMm"]),
    objectSchema({ kind: { const: "roof" }, ref, levelId: id, points: polygon, offsetMm: num, eavesMm, pitchDeg, gableEdges, name }, ["kind", "levelId", "points"]),
    objectSchema({ kind: { const: "footprint" }, levelId: id, points: polygon, heightMm: positive, name, templateWallId: id }, ["kind", "levelId", "points"]),
    objectSchema({ kind: { const: "extrude" }, points: polygon, storeys: { type: "integer", minimum: 1, maximum: 100 }, storeyHeightMm: positive, baseLevelId: id, levelNamePrefix: { type: "string", minLength: 1, maxLength: 60 }, slabs: { type: "boolean" },
      roof: { oneOf: [{ const: false }, objectSchema({ pitchDeg, eavesMm, gableEdges }, [])] } }, ["kind", "points", "storeys"]),
  ] },
};
const editOperations = {
  type: "array", minItems: 1, maxItems: ARCHITECT_BATCH_LIMIT, items: { oneOf: [
    objectSchema({ kind: { const: "set-opening-disposition" }, id, disposition: { anyOf: [
      objectSchema({ kind: { enum: ["retain-void", "infill"] }, reference: { type: "string", minLength: 1, maxLength: 500 } }),
      { type: "null" },
    ] } }),
    objectSchema({ kind: { const: "set-lifecycle" }, id, lifecycle: { anyOf: [
      objectSchema({ status: { enum: ["existing", "new", "demolished", "repaired"] }, reference: { type: "string", minLength: 1, maxLength: 500 } }),
      { type: "null" },
    ] } }, ["kind", "id", "lifecycle"]),
    objectSchema({ kind: { const: "set-wall-repair-basis" }, id, basis: { anyOf: [
      objectSchema({ heightMm: positive, reference: { type: "string", minLength: 1, maxLength: 500 } }), { type: "null" },
    ] } }),
    objectSchema({ kind: { const: "remove" }, id }, ["kind", "id"]),
    objectSchema({ kind: { const: "move-wall" }, id, a: point, b: point }, ["kind", "id"]),
    objectSchema({ kind: { const: "set-wall" }, id, name, heightMm: positive, templateWallId: id }, ["kind", "id"]),
    objectSchema({ kind: { const: "set-level" }, id, name: { type: "string", minLength: 1, maxLength: 100 }, elevationMm: num, heightMm: positive }, ["kind", "id"]),
    objectSchema({ kind: { const: "set-slab" }, id, name, thicknessMm: positive, offsetMm: num, material: { type: "string", maxLength: 100 }, points: polygon }, ["kind", "id"]),
    objectSchema({ kind: { const: "set-roof" }, id, name, offsetMm: num, eavesMm, pitchDeg, gableEdges, points: polygon }, ["kind", "id"]),
    objectSchema({ kind: { const: "set-opening" }, id, offsetMm: num, widthMm: positive, heightMm: positive, sillMm: { type: "number", minimum: 0, maximum: 1e6 }, tag: { type: "string", minLength: 1, maxLength: 30 }, hinge: { enum: ["left", "right"] }, swing: { enum: ["in", "out"] } }, ["kind", "id"]),
    objectSchema({ kind: { const: "rename-design" }, name: { type: "string", minLength: 1, maxLength: 200 }, address: { type: "string", maxLength: 500 }, designRevision: { type: "string", maxLength: 40 }, notes: { type: "string", maxLength: 5000 } }, ["kind"]),
  ] },
};

function checkProject(state: AppState, expectedJobId?: string, expectedRevision?: number) {
  if (!state.persistenceHydrated || state.persistenceRecoveryBlocked || state.hydrationStatus !== "ready") throw Error("Wait for project recovery to finish before using project tools.");
  if (expectedJobId !== undefined && state.job.id !== expectedJobId) throw Error("The active project changed. Read project context again.");
  if (expectedRevision !== undefined && state.job.revision !== expectedRevision) throw Error("The project revision changed. Read project context again before saving.");
}

/** Select the existing UI subworkspace once; its mounted controller remains the sole design writer. */
export async function openArchitectWorkspace(expectedJobId: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let clicked = false, finished = false;
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true; observer.disconnect(); clearTimeout(timeout);
      window.removeEventListener("xray:architect-controller-ready", check);
      if (error) reject(error); else resolve();
    };
    const check = () => {
      if (finished) return;
      const workspace = document.querySelector<HTMLElement>(".architect-workspace");
      if (workspace?.dataset.designId === expectedJobId && hasArchitectController()) {
        void requestArchitectTool("read", { expectedJobId }).then(value => {
          if ((value as { ready?: boolean }).ready) finish();
        }, error => finish(error instanceof Error ? error : Error(String(error))));
        return;
      }
      const button = [...document.querySelectorAll<HTMLButtonElement>('nav[aria-label="Sketch workspaces"] button')].find(button => button.textContent?.trim() === "Architectural workspace");
      if (!clicked && button && !button.disabled) { clicked = true; button.click(); }
    };
    const observer = new MutationObserver(check);
    const timeout = setTimeout(() => finish(Error("Architectural workspace did not become ready. Open Sketch → Architectural workspace and retry.")), 5000);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-design-id", "data-design-revision"] });
    window.addEventListener("xray:architect-controller-ready", check);
    check();
  });
}

/** Captures actual preserved renderer pixels only; never synthesizes an HTML/UI screenshot. */
export async function captureCanvasImage(target: "architect" | "source-building", doc: Document = document): Promise<AppToolResult> {
  if (doc.visibilityState === "hidden") throw Error("Bring this workspace into view before capturing its renderer.");
  // Allow pending React/renderer invalidations to reach the framebuffer; no timed retry.
  if (doc.defaultView) await new Promise<void>(resolve => doc.defaultView!.requestAnimationFrame(() => doc.defaultView!.requestAnimationFrame(() => resolve())));
  const selector = target === "architect" ? 'canvas[aria-label="Live architectural 3D model"]' : ".building-canvas canvas";
  const source = doc.querySelector<HTMLCanvasElement>(selector);
  if (!source || !source.width || !source.height || !source.getBoundingClientRect().width || !source.getBoundingClientRect().height) throw Error("The requested 3D canvas is not visible. Open its viewer first.");
  if (Number(source.dataset.frameCount ?? 0) < 1) throw Error("Wait for the 3D viewer to render before capturing it.");
  const scale = Math.min(1, 1536 / Math.max(source.width, source.height));
  const output = doc.createElement("canvas");
  output.width = Math.max(1, Math.round(source.width * scale)); output.height = Math.max(1, Math.round(source.height * scale));
  const context = output.getContext("2d");
  if (!context) throw Error("Canvas image capture is unavailable.");
  context.drawImage(source, 0, 0, output.width, output.height);
  const pixels = context.getImageData(0, 0, output.width, output.height).data;
  let visible = false;
  for (let index = 3; index < pixels.length; index += 4) if (pixels[index]) { visible = true; break; }
  if (!visible) throw Error("The renderer returned no visible pixels. Wait for a rendered frame and retry.");
  const url = output.toDataURL("image/png"), prefix = "data:image/png;base64,";
  if (!url.startsWith(prefix) || url.length > 12_000_000) throw Error("The captured image is invalid or too large.");
  return { content: [
    { type: "text", text: JSON.stringify({ target, width: output.width, height: output.height, frame: Number(source.dataset.frameCount), renderedDesignRevision: source.dataset.projectRevision ? Number(source.dataset.projectRevision) : null, sourceSha256: source.dataset.sourceSha256 ?? null, scope: "Rendered 3D canvas pixels only; HTML controls are not included." }) },
    { type: "image", data: url.slice(prefix.length), mimeType: "image/png" },
  ] };
}

export function createAppTools(port: AppToolPort): AppTool[] {
  const tool = (name: string, description: string, inputSchema: AppTool["inputSchema"], run: (args: unknown) => Promise<AppToolResult>): AppTool => ({
    name, description, inputSchema, execute: async args => {
      try { return await run(args); }
      catch (error) { return { isError: true, ...(error instanceof ArchitectPreparationRejected ? { _meta: preparationReceipt(error) } : {}), content: [{ type: "text", text: error instanceof z.ZodError ? "Invalid tool arguments: " + error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ") : error instanceof Error ? error.message : String(error) }] }; }
    },
  });
  return [
    tool('search_standards_library', 'Search this computer’s downloaded NCC and housing reference PDFs. Returns up to 20 original-page excerpts with document hashes, edition labels and links. Optional edition narrows the search. Summary guides and ZIP archives are excluded. Check the printed document title and jurisdiction; filenames and applicability are unverified. Cite PDF pages and only section identifiers present in source text. Keyword results are not an exhaustive compliance assessment.', objectSchema({expectedJobId:id,topic:{type:'string',minLength:2,maxLength:200},edition:{type:'string',pattern:'^(19|20)[0-9]{2}$'}},['expectedJobId','topic']), async input=>{
      const args=z.object({expectedJobId:idSchema,topic:z.string().trim().min(2).max(200),edition:z.string().regex(/^(19|20)\d{2}$/).optional()}).strict().parse(input);
      checkProject(await port.getState(),args.expectedJobId);
      const matches=await searchStandardsLibrary(args.topic,args.edition);
      checkProject(await port.getState(),args.expectedJobId);
      return text({matches:matches.map(match=>({...match,originalUrl:standardsOriginalUrl(match.documentId,match.page)})),scope:'Source excerpts only. Verify printed title, edition, jurisdiction and applicability before relying on a reference.'});
    }),
    tool("read_workflow_route", "Select the structured process for this task: discussion, inspect, architecture, takeoff, render or export. Returns ordered tool steps; the orchestrator tracks prerequisites and current-revision receipts. Select before task actions. Selection does not grant edit permission or execute geometry. Change the selection only when the user's intended task changes.", objectSchema({ expectedJobId: id, workflow: { enum: [...workflowNames] } }), async input => {
      const args = workflowSelectionSchema.parse(input);
      checkProject(await port.getState(), args.expectedJobId);
      return text({ version: WORKFLOW_VERSION, workflow: args.workflow, steps: WORKFLOWS[args.workflow], scope: "Workflow selection only; no geometry, evidence or authority changed." });
    }),
    tool("read_assistant_file", "Read the active imported project source PDF as well as files saved through Live assistant. The active document ID from read_project_context is a valid fileId; no duplicate upload is needed. Omit fileId to list files (offset paginates 20 records). For PDF, choose page (1-based): returns a rendered page and extracted text (offset paginates 16000 text characters). For images returns a resized preview. TXT, CSV, JSON, DXF, IFC and SVG return raw text excerpts (offset is a byte offset, nextOffset continues). Original files stay on device; never treat an excerpt as the whole file or CAD text as validated geometry. Hash identifies the stored original, not approval or calibration.", objectSchema({ expectedJobId: id, fileId: id, page: { type: "integer", minimum: 1 }, offset: { type: "integer", minimum: 0 } }, ["expectedJobId"]), async input => {
      const args = z.object({ expectedJobId: idSchema, fileId: idSchema.optional(), page: z.number().int().positive().optional(), offset: z.number().int().nonnegative().optional() }).strict().parse(input);
      const state = await port.getState();
      checkProject(state, args.expectedJobId);
      const source = state.activePlanBinary;
      const registered = state.job.documents.find(doc => doc.id === state.job.activeDocumentId);
      const matchedSource = source && registered?.id === source.documentId && registered.sha256 === source.sha256 ? source : null;
      const result = await readAttachment(args.expectedJobId, args.fileId, args.page, args.offset, matchedSource);
      const after = await port.getState();
      checkProject(after, args.expectedJobId);
      if (matchedSource && after.job.activeDocumentId !== matchedSource.documentId) throw Error('The active source changed while reading. Read the current source again.');
      return result;
    }),
    tool("read_source_geometry", "Read actual PDF line endpoints, stable segment IDs, positioned characters and a source close-up through the local Python engine. Use before reconstructing a PDF. Region is normalized [left,top,width,height], all returned coordinates are full-page top-left PDF points. Start with a small room region and use offset to retrieve additional groups of 200 segments sorted longest first. minimumLengthPt defaults to 2; use 0 to include short details. Page lines include hatching, fixtures and dimensions, not just walls. For engine-computed millimetres, supply a real scaleSegmentId and its printed knownLengthMm; the dimension association remains unverified, not locked calibration. No wall classification or guessed fallback. Returns unavailable if Python is not connected.", objectSchema({ expectedJobId: id, page: { type: 'integer', minimum: 1, maximum: 100 }, region: { type: 'array', items: { type: 'number', minimum: 0, maximum: 1 }, minItems: 4, maxItems: 4 }, offset: { type: 'integer', minimum: 0, maximum: 600000 }, minimumLengthPt: { type: 'number', minimum: 0, maximum: 1000 }, scaleSegmentId: { type: 'string', maxLength: 200 }, knownLengthMm: { type: 'number', exclusiveMinimum: 0, maximum: 100000 } }, ['expectedJobId', 'page']), async input => {
      const args = sourceGeometryArgs.parse(input), state = await port.getState(); checkProject(state, args.expectedJobId);
      const source = state.activePlanBinary, registered = state.job.documents.find(doc => doc.id === state.job.activeDocumentId);
      if (!source || source.documentId !== registered?.id || source.sha256 !== registered.sha256) throw Error('Open the matching original PDF before extracting coordinates.');
      const result = await readSourceGeometry(source, args);
      const after = await port.getState(); checkProject(after, args.expectedJobId);
      if (after.activePlanBinary?.sha256 !== source.sha256 || after.job.activeDocumentId !== source.documentId) throw Error('Source changed during extraction. Read the current source again.');
      return result;
    }),
    tool('prepare_source_room', 'Prepare an orthogonal room from ordered source wall-face segment IDs and a real door-leaf reference. Python calculates scale; geometry code intersects faces, offsets centerlines by half the stated wall thickness, and places the hosted opening. Returns ready-to-use draw_architect_elements operations plus a blue source overlay for inspection. Does not edit the project. Inspect the overlay before drawing, and use the returned operations unchanged. Caller must identify the correct source faces and printed door-width association; heights and material are unverified.', objectSchema({ expectedJobId:id, page:{type:'integer',minimum:1,maximum:100}, region:{type:'array',items:{type:'number',minimum:0,maximum:1},minItems:4,maxItems:4},
      boundaryIds:{type:'array',items:{type:'string'},minItems:4,maxItems:12}, doorLeafId:{type:'string'},doorWallIndex:{type:'integer',minimum:0,maximum:11},doorHingeEndpoint:{enum:['a','b']},doorDirection:{enum:['forward','backward']},doorWidthMm:positive,wallThicknessMm:positive,wallHeightMm:positive,doorHeightMm:positive,levelName:name }), async input=>{
      const raw=input as Record<string,unknown>, {expectedJobId,page,region,...room}=raw;
      const args=sourceGeometryArgs.parse({expectedJobId,page,region,minimumLengthPt:10,scaleSegmentId:room.doorLeafId,knownLengthMm:room.doorWidthMm});
      sourceRoomSchema.parse(room);
      const state=await port.getState();checkProject(state,args.expectedJobId);
      const source=state.activePlanBinary,registered=state.job.documents.find(d=>d.id===state.job.activeDocumentId);
      if(!source||source.documentId!==registered?.id||source.sha256!==registered.sha256)throw Error('Open the matching original PDF.');
      const result=await readSourceGeometry(source,args),geometry=JSON.parse(result.content[0].text!);
      const prepared=prepareSourceRoom(geometry,room);
      const overlay=await sourceRoomOverlay(prepared,result.content[1] as {data:string;mimeType:string},geometry.regionPt);
      const after=await port.getState();checkProject(after,args.expectedJobId);
      if(after.activePlanBinary?.sha256!==source.sha256||after.job.activeDocumentId!==source.documentId)throw Error('Source changed during preparation.');
      return {content:[{type:'text' as const,text:JSON.stringify({...prepared,documentId:source.documentId,note:'Blue geometry overlays the original source pixels; this is a proposal, not a saved or verified model.'})},overlay]};
    }),
    tool("read_project_context", "Read the current local project identity/revision, source list and save/recovery status. No external data is fetched.", objectSchema({}), async args => {
      emptySchema.parse(args); const state = await port.getState();
      return text({ projectId: state.job.id, projectName: state.job.name, projectRevision: state.job.revision, pane: state.pane, sourcePage: state.sheet + 1,
        documents: state.job.documents.map(doc => ({ id: doc.id, name: doc.name, kind: doc.kind, pageCount: doc.pageCount, sha256: doc.sha256 })), activeDocumentId: state.job.activeDocumentId,
        counts: { annotations: state.job.annotations?.length ?? 0, measuredTraces: state.job.runs.length, locatedItems: state.job.gates.length },
        hydration: state.hydrationStatus, recoveryBlocked: state.persistenceRecoveryBlocked, saveError: state.persistenceError,
        savedProjectRevision: state.lastSavedJobRevision, architectControllerAvailable: port.architectAvailable() });
    }),
    tool("navigate_workspace", "Select an existing workbench pane in the current project. Sketch opens its Architectural workspace through the existing UI. Pending drawing or calibration gestures must be finished or cancelled first.", objectSchema({ expectedJobId: id, pane: { enum: APP_PANES } }), async input => {
      const args = navigationSchema.parse(input), state = await port.getState(); checkProject(state, args.expectedJobId);
      if (state.pending?.length || state.calibrationCapture?.points.length) throw Error("Finish or cancel the pending trace or calibration before navigating.");
      if (state.pane === "sketch" && port.architectAvailable()) {
        const design = await port.architect("read", { expectedJobId: args.expectedJobId }) as { pendingDraft?: boolean };
        if (design.pendingDraft) throw Error("Finish or cancel the current architectural draft before leaving Sketch.");
      }
      const beforeNavigation = await port.getState(); checkProject(beforeNavigation, args.expectedJobId);
      if (beforeNavigation.pending?.length || beforeNavigation.calibrationCapture?.points.length) throw Error("Finish or cancel the pending trace or calibration before navigating.");
      beforeNavigation.setPane(args.pane);
      if (args.pane === "sketch" && port.openArchitectWorkspace) await port.openArchitectWorkspace(args.expectedJobId);
      const current = await port.getState(); checkProject(current, args.expectedJobId);
      if (current.pane !== args.pane) throw Error("The requested pane could not be selected.");
      return text({ projectId: current.job.id, pane: current.pane, selected: true, ...(args.pane === "sketch" && port.openArchitectWorkspace ? { subworkspace: "architect", controllerReady: true } : {}), note: "Pane selected. Read the active design before drawing." });
    }),
    tool("read_work_packet", "Retrieve a saved internal work packet or list recent task checkpoints for this project. Read its original objective, revision snapshot, unresolved inputs and authority limits; these records are not professional approvals.", objectSchema({ expectedJobId: id, packetId: id }, ["expectedJobId"]), async input => {
      const args = z.object({ expectedJobId: idSchema, packetId: idSchema.optional() }).strict().parse(input);
      checkProject(await port.getState(), args.expectedJobId);
      const packets = await listWorkPackets(args.expectedJobId);
      checkProject(await port.getState(), args.expectedJobId);
      if (args.packetId) {
        const packet = packets.find(p => p.id === args.packetId);
        if (!packet) throw Error("Work packet not found in this project.");
        return text(packet);
      }
      return text({ packets: packets.slice(0, 20).map(p => ({ id: p.id, objective: p.objective.slice(0, 500), state: p.state, nextAction: p.nextAction, pendingAction: p.pendingAction })), total: packets.length });
    }),
    tool("read_work_packet_event", "Retrieve an archived task event by packet ID and event sequence, or list event metadata. Original model responses are unreviewed; use successful tool receipts and current source revisions to check conclusions. Large event text is paged using offset, never silently treated as complete.", objectSchema({ expectedJobId: id, packetId: id, sequence: { type: "integer", minimum: 1 }, offset: { type: "integer", minimum: 0 } }, ["expectedJobId", "packetId"]), async input => {
      const args = z.object({ expectedJobId: idSchema, packetId: idSchema, sequence: z.number().int().positive().optional(), offset: z.number().int().nonnegative().optional() }).strict().parse(input);
      checkProject(await port.getState(), args.expectedJobId);
      if (!(await listWorkPackets(args.expectedJobId)).some(p => p.id === args.packetId)) throw Error("Work packet not found in this project.");
      const events = await readWorkEvents(args.packetId);
      checkProject(await port.getState(), args.expectedJobId);
      if (args.sequence === undefined) return text({ events: events.map(e => ({ sequence: e.sequence, kind: e.kind, at: e.at, hash: e.hash })) });
      const event = events.find(e => e.sequence === args.sequence);
      if (!event) throw Error("Task event not found.");
      const data = JSON.stringify(event), offset = args.offset ?? 0;
      return text({ sequence: event.sequence, offset, text: data.slice(offset, offset + 12000), nextOffset: offset + 12000 < data.length ? offset + 12000 : null, totalCharacters: data.length, status: "archived-unreviewed" });
    }),
    tool("read_architect_design", "Read the real mounted architectural design in millimetres, including stable entity IDs, sheet layouts, revision and pending-draft status. Open Sketch / Architectural workspace first.", objectSchema({ expectedJobId: id }), async input => {
      const args = architectReadSchema.parse(input); checkProject(await port.getState(), args.expectedJobId);
      return text(await port.architect("read", args));
    }),
    tool("draw_architect_elements", "Append 1-200 validated operations to the active design in millimetres: walls, hosted doors/windows, reference lines, room labels, new levels (storeys), slabs, roofs, a footprint (closed wall loop on one level) or an extrude (footprint repeated over N storeys with new levels, optional slabs and a top roof) — this is how a multi-storey wireframe is drawn; it renders in the workspace's live 3D model. wallRef/levelId may refer to an existing ID or an earlier operation ref. The whole batch validates and saves once; existing geometry and sheets remain intact. No deletions or moves. Unspecified wall assembly uses the unpriced default and is reported for review.", objectSchema({ ...bound, operations }), async input => {
      const args = architectDrawSchema.parse(input); checkProject(await port.getState(), args.expectedJobId);
      return text(await port.architect("draw", args));
    }),
    tool("undo_architect_change", "Undo one change using the active architectural workspace's real session history, then save and verify the resulting design. Requires its current design revision.", objectSchema(bound), async input => {
      const args = architectRevisionSchema.parse(input); checkProject(await port.getState(), args.expectedJobId);
      return text(await port.architect("undo", args));
    }),
    tool("capture_workspace_image", "Capture actual visible architectural or source-building 3D canvas pixels as a PNG (up to1536px). Does not capture HTML controls or invent an image.", objectSchema({ expectedJobId: id, target: { enum: ["architect", "source-building"] } }), async input => {
      const args = captureSchema.parse(input); checkProject(await port.getState(), args.expectedJobId);
      const result = await port.capture(args.target);
      checkProject(await port.getState(), args.expectedJobId);
      return result;
    }),
    tool("save_project", "Save and readback-verify the current main project record on this device. This does not export a portable backup or imply every sidecar was saved.", objectSchema(bound), async input => {
      const args = architectRevisionSchema.parse(input), state = await port.getState(); checkProject(state, args.expectedJobId, args.expectedRevision);
      const result = state.saveCurrentProject(); if (!result.ok) throw Error(result.error || "Project save was not verified.");
      const current = await port.getState(); checkProject(current, args.expectedJobId, args.expectedRevision);
      if (current.lastSavedJobRevision !== args.expectedRevision || current.persistenceError) throw Error(current.persistenceError || "Project save revision was not confirmed.");
      return text({ saved: true, projectId: current.job.id, projectRevision: current.job.revision, verified: true, scope: "Main project record on this device. Use Backups for a portable complete workspace copy." });
    }),
    tool("control_draftsman", "Control playback of the mounted Model viewer's Magic Pencil: play, pause, replay, seek, speed, finish, exit, status, tour or jump_storey. Read project context first. Does not navigate, export images or generate documents. Exit stops the animation and restores its view; completed project edits are unaffected.", objectSchema({
      expectedJobId: id,
      action: { type: "string", enum: draftsmanMcpActions },
      progress: { type: "number", minimum: 0, maximum: 1 },
      speed: { type: "number", exclusiveMinimum: 0, maximum: 20 },
      storey: { anyOf: [{ type: "string", minLength: 1 }, { type: "integer", minimum: 0 }] },
    }, ["expectedJobId", "action"]), async input => {
      const { expectedJobId, ...payload } = draftsmanMcpSchema.parse(input);
      const parsed = draftsmanControlSchema.parse(payload);
      const state = await port.getState(); checkProject(state, expectedJobId);
      if (state.pane !== "model" || !port.draftsmanAvailable?.() || !port.draftsman) throw Error("Open the Model viewer and wait for it to load before controlling the draftsman. This tool does not navigate.");
      const result = await port.draftsman(parsed.action, parsed);
      checkProject(await port.getState(), expectedJobId);
      return text(result);
    }),
    tool("read_draftsman_status", "Read the mounted Model viewer's current draftsman telemetry. Does not navigate or start an animation. An inactive viewer may have no drafting status.", objectSchema({ expectedJobId: id }), async input => {
      const args = architectReadSchema.parse(input); const state = await port.getState(); checkProject(state, args.expectedJobId);
      if (state.pane !== "model" || !port.draftsmanAvailable?.() || !port.draftsman) throw Error("Open the Model viewer and wait for it to load before reading draftsman status. This tool does not navigate.");
      const result = await port.draftsman("status", {});
      checkProject(await port.getState(), args.expectedJobId);
      return text(result);
    }),
    tool("read_workbench_structure", "Read X-Ray's data model: units, panes, architectural entities and the wireframe operations draw_architect_elements accepts, the source-building reconstruction schema and catalog, evidence states, the sample firewall and what is NOT available through tools. Static reference; no project data is read.", objectSchema({}), async args => {
      emptySchema.parse(args);
      return text(WORKBENCH_STRUCTURE);
    }),
    tool("read_source_building", "Read a catalogued source-building reconstruction (Model viewer scene), or the mounted designed model (building 'designed', origin designed, every part inferred), as a part summary in metres: identity, category, storey, evidence state, bounds and source pages per part, filtered by storey and category. Meshes are omitted. Read-only; sample buildings stay labelled sample.", objectSchema({ expectedJobId: id, building: { enum: [...WORKBENCH_STRUCTURE.sourceBuilding.catalog.map(item => item.id), DESIGNED_SCENE_ENTRY.id] }, floor: { type: "string", minLength: 1, maxLength: 80 }, category: { enum: [...WORKBENCH_STRUCTURE.sourceBuilding.partCategories] }, limit: { type: "integer", minimum: 1, maximum: 200 } }, ["expectedJobId", "building"]), async input => {
      const args = sourceBuildingQuerySchema.parse(input); checkProject(await port.getState(), args.expectedJobId);
      if (!port.sourceBuilding) throw Error("Source building reading is unavailable in this session.");
      const result = await port.sourceBuilding(args);
      checkProject(await port.getState(), args.expectedJobId);
      return text(result);
    }),
    tool("read_source_sheets", "Read the active source drawing's sheet register: each original page with its name, discipline, archived state, saved views and the calibrations, traces, items, annotations and photos it carries. Sample sources are reported as not organisable.", objectSchema({ expectedJobId: id }), async input => {
      const args = sheetReadSchema.parse(input), state = await port.getState(); checkProject(state, args.expectedJobId);
      if (!port.storage) throw Error("Sheet organisation storage is unavailable in this session.");
      return text(describeSourceSheets(state.job as Parameters<typeof describeSourceSheets>[0], port.storage));
    }),
    tool("manage_source_sheet", "Rename (with optional discipline), archive or recover one sheet of the active source drawing. Original page numbers, drawing bytes, calibrations, traces and annotations are retained; archiving only removes the page from active navigation and is reversible with recover. Read the sheets first for documentId and pageIndex.", objectSchema({ expectedJobId: id, documentId: id, action: { enum: ["rename", "archive", "recover"] }, pageIndex: { type: "integer", minimum: 0, maximum: 9999 }, name: { type: "string", minLength: 1, maxLength: 120 }, discipline: { type: "string", minLength: 1, maxLength: 80 } }, ["expectedJobId", "documentId", "action", "pageIndex"]), async input => {
      const args = sheetActionSchema.parse(input), state = await port.getState(); checkProject(state, args.expectedJobId);
      if (!port.storage) throw Error("Sheet organisation storage is unavailable in this session.");
      const result = applySheetAction(state.job as Parameters<typeof applySheetAction>[0], args, port.storage);
      port.sheetChanged?.(result.storageKey);
      checkProject(await port.getState(), args.expectedJobId);
      const { storageKey: _key, ...rest } = result;
      return text(rest);
    }),
    tool("read_takeoff_evidence", "Read calibration state, measured traces (with lengths, review status and missing specification fields), located items and readiness blockers per source sheet from the live project record. Optional sheet index narrows the result. Read-only; no quantities are invented.", objectSchema({ expectedJobId: id, sheet: { type: "integer", minimum: 0, maximum: 9999 } }, ["expectedJobId"]), async input => {
      const args = takeoffReadSchema.parse(input), state = await port.getState(); checkProject(state, args.expectedJobId);
      return text(describeTakeoffEvidence(state.job as FencingJob, args.sheet));
    }),
    tool("read_price_books", "Read this project's imported price books: names, archived state, revisions with row counts and supplier metadata, and the number of priced worksheet lines. Rate rows are not listed; nothing is a quote.", objectSchema({ expectedJobId: id }), async input => {
      const args = sheetReadSchema.parse(input), state = await port.getState(); checkProject(state, args.expectedJobId);
      if (!port.priceBooks) throw Error("Price book storage is unavailable in this session.");
      const session = port.priceBooks(state.job.id);
      return text(describePriceBooks(session.value, session.blocked, session.error));
    }),
    tool("capture_project_backup", "Capture and verify a complete workspace backup on this device (project record, saved sidecars, original plans and photos) under the given name, exactly as the Backups panel does. Requires the current project revision. Does not download or send the file anywhere.", objectSchema({ ...bound, name: { type: "string", minLength: 1, maxLength: 120 } }), async input => {
      const args = backupSchema.parse(input), state = await port.getState(); checkProject(state, args.expectedJobId, args.expectedRevision);
      if (!port.backup) throw Error("Backups are unavailable in this session.");
      const summary = await port.backup(args.name);
      checkProject(await port.getState(), args.expectedJobId, args.expectedRevision);
      if (summary.jobId !== args.expectedJobId || summary.jobRevision !== args.expectedRevision) throw Error("The stored backup does not match the expected project revision.");
      return text({ saved: true, verified: true, backupId: summary.id, name: summary.name, storedAt: summary.storedAt, sha256: summary.sha256, sizeBytes: summary.sizeBytes, plans: summary.plans, photos: summary.photos, records: summary.records, scope: "Stored in this browser's backup database. Download it from Backups to keep a copy outside the app." });
    }),
    tool("edit_architect_elements", "Edit, move or remove existing Architectural design entities by stable ID in one validated, undoable batch (max 200 operations): remove (a wall takes its hosted openings and dimensions with it; a level only when empty), move-wall, set-wall, set-level, set-slab, set-roof, set-opening (offsets are measured from the wall's a end; include set-opening in the same batch when a move would leave a door or window outside its wall, otherwise the whole batch is rejected) set-lifecycle (explicit existing/new/demolished/repaired status and supplied survey/client reference; null clears to unassigned; walls/openings/slabs/roofs only; does not filter quantities or verify evidence), set-opening-disposition (demolished door/window only: retain-void preserves an empty aperture; infill explicitly closes the full aperture with the host wall layers; each requires a supplied reference; null clears intent; no partial infill or invented layers), set-wall-repair-basis (repaired walls only: supplied before-repair heightMm and reference; proposed height stays unchanged; null clears the before basis), and rename-design (the demonstration marker is kept). Read the design first for expectedRevision and IDs.", objectSchema({ ...bound, operations: editOperations }), async input => {
      const args = architectEditSchema.parse(input); checkProject(await port.getState(), args.expectedJobId);
      return text(await port.architect("edit", args));
    }),
    tool("calibrate_source_sheet", "Two-point manual calibration of one page of the active imported source, exactly like the Measure pane: select the page, capture two points in source-page-v1 page units (top-left origin, y down, PDF points at scale 1), enter the known distance the user stated, optionally lock. The provenance method is recorded with a Live-assistant prefix and the evidence text must be the user's own statement of where the distance comes from. Refuses the bundled sample and, unless replaceLocked is true at the user's explicit request, any page that is already locked. Returns the scale read back from the project record.", objectSchema({ ...bound, sheet: sheetIndex, points: { type: "array", items: sourcePoint, minItems: 2, maxItems: 2 }, knownDistance: objectSchema({ value: { type: "number", exclusiveMinimum: 0, maximum: 1e6 }, unit: { enum: ["m", "cm", "mm", "ft", "in"] } }), provenance: objectSchema({ method: { type: "string", minLength: 1, maxLength: 100 }, evidence: { type: "string", minLength: 1, maxLength: 1000 }, documentId: id }, ["method", "evidence"]), lock: { type: "boolean" }, replaceLocked: { type: "boolean" } }, ["expectedJobId", "expectedRevision", "sheet", "points", "knownDistance", "provenance", "lock"]), async input => {
      const args = calibrateSheetSchema.parse(input); checkProject(await port.getState(), args.expectedJobId, args.expectedRevision);
      if (!port.takeoff) throw Error("Takeoff tools are unavailable in this session.");
      return text(calibrateSheet(port.takeoff, args));
    }),
    tool("trace_takeoff_run", "Draw one length trace (2–500 vertices in source-page-v1 page units) on a page whose calibration is locked, through the Measure tool sequence. The new run is identified by ID diff and its lengths are read back from the project record, never computed by the assistant. An optional partial specification is validated before anything is drawn. Refuses the sample source. Run labels are assigned by the store.", objectSchema({ ...bound, sheet: sheetIndex, points: { type: "array", items: sourcePoint, minItems: 2, maxItems: 500 }, specification: { type: "object", additionalProperties: true } }, ["expectedJobId", "expectedRevision", "sheet", "points"]), async input => {
      const args = traceRunSchema.parse(input); checkProject(await port.getState(), args.expectedJobId, args.expectedRevision);
      if (!port.takeoff) throw Error("Takeoff tools are unavailable in this session.");
      return text(traceRun(port.takeoff, args));
    }),
    tool("review_takeoff_item", "Currently unavailable to the assistant: the internal-draft authority gate blocks this tool. Its underlying UI operation can approve or reject one measured run or located item on behalf of a named human reviewer (actor must be the person's name as they gave it; never invent one). Needs the item's own revision from read_takeoff_evidence. The note records that the decision was made through the Live assistant. Refuses the bundled sample. Does not verify scale, source or specification; blockers are reported alongside.", objectSchema({ ...bound, kind: { enum: ["run", "gate"] }, id, expectedItemRevision: { type: "integer", minimum: 1 }, decision: { enum: ["approve", "reject"] }, actor: { type: "string", minLength: 1, maxLength: 120 }, note: { type: "string", maxLength: 1000 } }, ["expectedJobId", "expectedRevision", "kind", "id", "expectedItemRevision", "decision", "actor"]), async input => {
      const args = reviewTakeoffItemSchema.parse(input); checkProject(await port.getState(), args.expectedJobId, args.expectedRevision);
      if (!port.takeoff) throw Error("Takeoff tools are unavailable in this session.");
      return text(reviewTakeoffItem(port.takeoff, args));
    }),
    tool("remove_takeoff_trace", "Remove one measured run and the located items placed on it, with the run's current revision. The source drawing, calibration and photos are untouched; Measure-pane undo remains available.", objectSchema({ ...bound, runId: id, expectedItemRevision: { type: "integer", minimum: 1 } }), async input => {
      const args = removeTraceSchema.parse(input); checkProject(await port.getState(), args.expectedJobId, args.expectedRevision);
      if (!port.takeoff) throw Error("Takeoff tools are unavailable in this session.");
      return text(removeTrace(port.takeoff, args));
    }),
    tool("import_price_book", "Import supplier rates from CSV text the user supplied as a new price book (bookName) or a new revision of an existing book (bookId from read_price_books), exactly as the Cost pane import does. Requires expectedLibraryRevision from read_price_books. The whole import is refused if any row is invalid; nothing partial is saved. Supplier, currency, tax basis, effective date and source reference must come from the user; the stored source reference is prefixed to show it arrived through the assistant. Rates only: no quantities, quotes or currency conversion.", objectSchema({ expectedJobId: id, expectedLibraryRevision: { type: "integer", minimum: 0 }, bookId: { type: "string", minLength: 36, maxLength: 36 }, bookName: { type: "string", minLength: 1, maxLength: 120 }, csvText: { type: "string", minLength: 1, maxLength: 2097152 }, fileName: { type: "string", minLength: 1, maxLength: 255 }, delimiter: { enum: [",", ";", "\t"] }, headerRow: { type: "integer", minimum: 1, maximum: 100 }, mapping: objectSchema({ stockCode: { type: ["integer", "null"], minimum: 0, maximum: 39 }, description: { type: "integer", minimum: 0, maximum: 39 }, unit: { type: "integer", minimum: 0, maximum: 39 }, rate: { type: "integer", minimum: 0, maximum: 39 } }), metadata: objectSchema({ supplier: { type: "string", minLength: 1, maxLength: 200 }, currency: { type: "string", minLength: 3, maxLength: 3 }, amountDecimals: { type: "integer", minimum: 0, maximum: 4 }, taxBasis: { enum: ["exclusive", "inclusive", "unspecified"] }, taxPercent: { type: ["number", "null"], minimum: 0, maximum: 100 }, effectiveDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, sourceReference: { type: "string", minLength: 1, maxLength: 1900 } }, ["supplier", "currency", "taxBasis", "effectiveDate", "sourceReference"]) }, ["expectedJobId", "expectedLibraryRevision", "csvText", "metadata"]), async input => {
      const args = priceImportInputSchema.parse(input), state = await port.getState(); checkProject(state, args.expectedJobId);
      if (!port.priceBooks || !port.priceImport) throw Error("Price book storage is unavailable in this session.");
      const receipt = await importPriceBook(port.priceBooks(state.job.id), args, port.priceImport);
      port.priceBooksChanged?.(receipt.storageKey);
      checkProject(await port.getState(), args.expectedJobId);
      const { storageKey: _key, ...rest } = receipt;
      return text(rest);
    }),
    tool("export_design_file", "Download one export exactly as the Sketch/Sheets export buttons do: dxf, ifc, drawing-pdf (active or chosen authored sheet), material-pdf (download only; not imported as evidence) or sheet-register (active verified source). expectedRevision is the design revision (project revision for sheet-register). Returns the sha256 and byte length of the exact bytes handed to the browser download; no file path or on-disk readback exists.", objectSchema({ ...bound, format: { enum: [...exportFormats] }, sheetId: id }, ["expectedJobId", "expectedRevision", "format"]), async input => {
      const args = exportDesignSchema.parse(input), state = await port.getState();
      const delivery: ExportDeliveryDeps = port.exportDelivery ?? { download: browserDownload };
      if (args.format === "sheet-register") {
        checkProject(state, args.expectedJobId, args.expectedRevision);
        if (!port.storage) throw Error("Sheet organisation storage is unavailable in this session.");
        const receipt = await exportDesign({ job: state.job, storage: port.storage }, args, delivery);
        checkProject(await port.getState(), args.expectedJobId, args.expectedRevision);
        return text(describeExportReceipt(receipt));
      }
      checkProject(state, args.expectedJobId);
      const read = await port.architect("read", { expectedJobId: args.expectedJobId }) as { project: ArchitectProject; ready?: boolean; blocked?: boolean; error?: string | null; pendingDraft?: boolean };
      if (read.ready === false || read.blocked || read.error) throw Error(read.error || "Architectural design recovery must finish before exporting.");
      if (read.pendingDraft) throw Error("Finish or cancel the pending draft before exporting.");
      const receipt = await exportDesign({ project: read.project }, args, delivery);
      checkProject(await port.getState(), args.expectedJobId);
      return text(describeExportReceipt(receipt));
    }),
    tool(RENDER_TOOL_NAME, RENDER_TOOL_DESCRIPTION, RENDER_TOOL_INPUT_SCHEMA as unknown as AppTool["inputSchema"], input => requestRender(port, input)),
    tool("show_design_in_model", "Model mode: turn the current architectural design into a Model-viewer scene ('Designed model') and select the Model pane, so the Magic Pencil can animate its existing geometry (control_draftsman), the view can be captured (capture_workspace_image target source-building) or rendered, and the user sees it in the 3D viewer. Every part is labelled inferred: designed geometry, not measured from a source drawing; nothing is written to the project. Read the design first and pass expectedRevision to bind the scene to it. Opens Sketch's Architectural workspace through the existing UI when its controller is not mounted. Set displayMode to wireframe or solid to select and verify that actual viewer mode.", objectSchema({ expectedJobId: id, expectedRevision: { type: "integer", minimum: 1 }, displayMode: { enum: ["solid", "wireframe"] } }, ["expectedJobId"]), async input => {
      const args = designedModelSchema.parse(input), state = await port.getState(); checkProject(state, args.expectedJobId);
      if (!port.mountDesignedModel) throw Error("Model mode is unavailable in this session.");
      if (args.displayMode && !port.setModelDisplay) throw Error("Model display selection is unavailable in this session.");
      if (state.pending?.length || state.calibrationCapture?.points.length) throw Error("Finish or cancel the pending trace or calibration before opening Model mode.");
      if (!port.architectAvailable()) {
        if (!port.openArchitectWorkspace) throw Error("Open Sketch → Architectural workspace before showing the design in Model.");
        state.setPane("sketch");
        await port.openArchitectWorkspace(args.expectedJobId);
      }
      const read = await port.architect("read", { expectedJobId: args.expectedJobId }) as { project?: ArchitectProject; ready?: boolean; blocked?: boolean; error?: string | null; pendingDraft?: boolean };
      if (read.ready === false || read.blocked || read.error || !read.project) throw Error(read.error || "Architectural design recovery must finish before showing it in Model.");
      if (read.pendingDraft) throw Error("Finish or cancel the pending draft before showing the design in Model.");
      if (read.project.id !== args.expectedJobId) throw Error("The mounted design belongs to another project. Read project context again.");
      if (args.expectedRevision !== undefined && read.project.revision !== args.expectedRevision) throw Error("The design revision changed. Read the design again before showing it in Model.");
      const scene = buildDesignedScene(read.project);
      const before = await port.getState(); checkProject(before, args.expectedJobId);
      await port.mountDesignedModel(scene);
      before.setPane("model");
      const current = await port.getState(); checkProject(current, args.expectedJobId);
      if (current.pane !== "model") throw Error("The Model pane could not be selected.");
      if (args.displayMode) await port.setModelDisplay!(args.expectedJobId, read.project.revision, args.displayMode, scene.source.sha256);
      checkProject(await port.getState(), args.expectedJobId);
      return text({ mounted: true, pane: "model", building: DESIGNED_SCENE_ENTRY.id, objects: scene.objects.length, walls: scene.summary.wallRuns, openings: scene.summary.openings, ...(scene.summary.apertures === undefined ? {} : { apertures: scene.summary.apertures }), roofFaces: scene.summary.roofFaces, storeys: scene.storeys?.length ?? scene.summary.floors ?? 1,
        ...(args.displayMode ? { displayMode: args.displayMode } : {}),
        evidence: "inferred", origin: "designed", designRevision: read.project.revision, sceneSha256: scene.source.sha256,
        note: "Designed geometry, not measured from a source drawing. control_draftsman animates existing geometry, capture_workspace_image (source-building) captures it, read_source_building (building 'designed') summarises it and hide_designed_model returns the viewer to the catalog." });
    }),
    tool("hide_designed_model", "Leave Model mode: remove the designed model from the Model viewer so it shows its catalogued source reconstructions again. Does not navigate or change the project.", objectSchema({ expectedJobId: id }), async input => {
      const args = architectReadSchema.parse(input); checkProject(await port.getState(), args.expectedJobId);
      if (!port.mountDesignedModel) throw Error("Model mode is unavailable in this session.");
      await port.mountDesignedModel(null);
      checkProject(await port.getState(), args.expectedJobId);
      return text({ mounted: false, building: DESIGNED_SCENE_ENTRY.id, origin: "designed", note: "The Model viewer returned to its catalogued source reconstructions." });
    }),
    ...[roofDraftTool, ductDraftTool, quantityDraftTool, roofSheetTool, ductWrapTool].map(adapter => tool(adapter.name, adapter.description,
      objectSchema({ expectedJobId: id, input: adapter.inputSchema }, ['expectedJobId', 'input']), async input => {
        const args = z.object({ expectedJobId: idSchema, input: z.unknown() }).strict().parse(input);
        const state = await port.getState();
        checkProject(state, args.expectedJobId);
        const result = adapter.execute(args.input);
        checkProject(await port.getState(), args.expectedJobId);
        return text({ projectId: state.job.id, projectRevision: state.job.revision, ...result });
      })),
  ];
}

export async function captureBrowserBackup(name: string): Promise<BackupSummary> {
  const [{ useStudio }, { captureProjectBackup }, { readBackupRecords, storeProjectBackup }, { createBrowserPlanStore }, { createBrowserPhotoStore }] = await Promise.all([
    import("../store.ts"), import("../projectBackup.ts"), import("../projectBackupStorage.ts"), import("../documents.ts"), import("../evidence.ts"),
  ]);
  const state = useStudio.getState();
  if (!state.persistenceHydrated || state.hydrationStatus !== "ready") throw Error("Wait for the workspace to finish restoring before saving a backup.");
  if (state.persistenceError || state.bomPersistenceError || state.inventoryPersistenceError) throw Error("Resolve the workspace's save errors before creating a backup, so no working data is omitted.");
  const plans = createBrowserPlanStore(), photos = createBrowserPhotoStore();
  const value = await captureProjectBackup(state.job, name, { records: readBackupRecords, plan: id => plans.get(id), photo: id => photos.get(id), currentJob: () => useStudio.getState().job });
  return storeProjectBackup(value);
}

let studioModule: typeof import("../store.ts") | null = null;
/** Catalogued scenes load once from their JSON; the designed model is read from the studio store while it is mounted. */
export async function readCatalogSourceBuilding(query: SourceBuildingQuery, designedScene?: () => SourceBuilding | null | Promise<SourceBuilding | null>): Promise<unknown> {
  const { expectedJobId: _job, ...rest } = query;
  if (rest.building === DESIGNED_SCENE_ENTRY.id) {
    const scene = await (designedScene ?? (async () => { studioModule ??= await import("../store.ts"); return studioModule.useStudio.getState().designedBuilding; }))();
    if (!scene) throw Error("No designed model is mounted in the Model viewer. Use show_design_in_model first.");
    return summariseSourceBuilding(scene, rest, DESIGNED_SCENE_ENTRY);
  }
  return summariseSourceBuilding(await loadCatalogScene(rest.building), rest);
}

export const appTools: AppTool[] = createAppTools({
  getState: async () => { studioModule ??= await import("../store.ts"); return studioModule.useStudio.getState(); },
  // Measure-pane sequences need synchronous snapshots; every tool awaits getState() (above) before using this port.
  takeoff: { getState: () => { if (!studioModule) throw Error("Read project context before using takeoff tools."); return studioModule.useStudio.getState(); } },
  priceImport: browserPriceImportDeps(),
  priceBooksChanged: key => { notifyPriceBooksChanged(key); },
  architect: requestArchitectTool,
  architectAvailable: hasArchitectController,
  capture: captureCanvasImage,
  openArchitectWorkspace,
  draftsman: requestDraftsmanTool,
  draftsmanAvailable: hasDraftsmanController,
  sourceBuilding: query => readCatalogSourceBuilding(query),
  setModelDisplay: async (expectedJobId, _designRevision, mode, sceneSha256) => {
    studioModule ??= await import("../store.ts");
    const deadline = performance.now() + 5000;
    let clicked = false;
    while (performance.now() < deadline) {
      const state = studioModule.useStudio.getState();
      if (state.job.id !== expectedJobId || state.pane !== "model") throw Error("Project or pane changed before display selection.");
      const canvas = document.querySelector<HTMLCanvasElement>(".building-canvas canvas");
      const button = [...document.querySelectorAll<HTMLButtonElement>('.building-toolbar button')].find(b => b.textContent?.trim().toLowerCase() === mode);
      if (canvas?.dataset.sceneSha256 === sceneSha256 && button) {
        if (button.getAttribute("aria-pressed") === "true" && canvas.dataset.displayMode === mode) return;
        if (!clicked && !button.disabled) { button.click(); clicked = true; }
      }
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
    throw Error("Model mounted, but the requested display mode was not confirmed. Inspect the viewer before retrying.");
  },
  mountDesignedModel: async scene => { studioModule ??= await import("../store.ts"); studioModule.useStudio.getState().setDesignedBuilding(scene); },
  storage: typeof localStorage === "undefined" ? undefined : localStorage,
  sheetChanged: key => { void import("../useSheetLifecycle.ts").then(module => module.notifySheetLifecycleChanged(key)); },
  priceBooks: jobId => readBrowserPriceBooks(jobId),
  backup: captureBrowserBackup,
});
