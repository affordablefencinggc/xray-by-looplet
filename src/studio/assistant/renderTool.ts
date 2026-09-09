import { z } from "zod";
import { create } from "zustand";
import type { AppTool, AppToolPort, AppToolResult } from "./appTools.ts";
import { matchingModelView, recordedModelView, type ModelViewSnapshot } from "../modelViewSnapshot.ts";

/*
 * Render contract (isomorphic: Zod only). The server route imports the schemas from here; the browser tool,
 * transport and the session-only "latest render" store follow. Nothing in this module touches the design,
 * calibrations, evidence or quantities: the output is an illustration of captured pixels and nothing else.
 */
export const RENDER_AI_SCHEMA = "xray.render-ai-request/v1" as const;
export const RENDER_AI_RESULT_SCHEMA = "xray.render-ai/v1" as const;
export const RENDER_AI_LIMITS = Object.freeze({
  /** Whole POST body, same as the assistant route. */
  requestBytes: 12 * 1024 * 1024,
  /** Captured PNG: 6 MiB of decoded bytes, which is exactly 8 MiB of base64 characters. */
  inputImageBytes: 6 * 1024 * 1024,
  inputImageChars: 8 * 1024 * 1024,
  /** Provider response body cap; generated images arrive as 1–8 MB of base64. */
  responseBytes: 12 * 1024 * 1024,
  outputImageChars: 10 * 1024 * 1024,
  timeoutMs: 120000, dailyCalls: 30, materialChars: 300, directionChars: 500, sceneChars: 2000, textChars: 4000, promptChars: 8000,
});
export const RENDER_AI_PROVENANCE = "AI-generated visualisation of the captured 3D view; not a measurement, geometry-verification or compliance claim." as const;
/** Fixed instruction appended to every prompt; user notes never replace it. */
export const RENDER_AI_DISCLAIMER = "Produce one photorealistic architectural visualisation of the supplied massing exactly as captured: keep the camera angle, framing, footprint, storey count, roof form and every opening position; do not add, remove, move or resize walls, storeys, roofs, doors or windows. Replace flat model shading with realistic materials and surroundings only. Return the image only, with no text, labels, dimensions, logos or watermarks." as const;
export const NATIVE_RENDER_MESSAGE = "Rendering is unavailable in this native build; use the web app.";
/** The Render pane's untouched hint for the free-text direction; it is never sent to the model as a user note. */
export const RENDER_DIRECTION_PLACEHOLDER = "Optional finish, weather or presentation direction";
/** Generated images larger than this stay in the Render pane only; the transcript gets the receipt without the pixels. */
export const REPLY_IMAGE_MAX_CHARS = 2 * 1024 * 1024;

const id = z.string().min(1).max(100);
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const base64 = (max: number) => z.string().min(4).max(max).regex(/^[A-Za-z0-9+/]*={0,2}$/).refine(v => v.length % 4 === 0, "Invalid base64 length.");
// eslint-disable-next-line no-control-regex
const clean = (max: number) => z.string().trim().max(max).refine(v => !/[\x00-\x1f\x7f]/.test(v), "Control characters are not allowed.");
const finite = z.number().finite();

export function pngHeaderMatches(data: string): boolean {
  try { return atob(data.slice(0, 24)).startsWith("\x89PNG\r\n\x1a\n"); } catch { return false; }
}
export const renderMaterialsSchema = z.object({
  roof: clean(RENDER_AI_LIMITS.materialChars), walls: clean(RENDER_AI_LIMITS.materialChars), windows: clean(RENDER_AI_LIMITS.materialChars), landscaping: clean(RENDER_AI_LIMITS.materialChars),
  lighting: clean(RENDER_AI_LIMITS.materialChars), style: clean(RENDER_AI_LIMITS.materialChars), direction: clean(RENDER_AI_LIMITS.directionChars),
}).strict();
export type RenderMaterials = z.infer<typeof renderMaterialsSchema>;
export const renderViewSchema = z.object({
  target: z.enum(["architect", "source-building"]),
  width: z.number().int().min(1).max(1536), height: z.number().int().min(1).max(1536),
  frame: z.number().int().min(1).max(1e9),
  documentId: id.nullable(), sourceSha256: sha.nullable(), sheet: z.number().int().min(1).max(10000),
  renderedDesignRevision: z.number().int().positive().nullable(),
  camera: z.object({ projection: z.enum(["perspective", "orthographic"]), position: z.tuple([finite, finite, finite]), target: z.tuple([finite, finite, finite]), zoom: finite.positive() }).strict().nullable(),
}).strict();
export type RenderView = z.infer<typeof renderViewSchema>;
export const renderAiRequestSchema = z.object({
  schema: z.literal(RENDER_AI_SCHEMA), requestId: z.string().uuid(), projectId: id,
  view: renderViewSchema,
  image: z.object({ mimeType: z.literal("image/png"), data: base64(RENDER_AI_LIMITS.inputImageChars), sha256: sha }).strict().refine(v => pngHeaderMatches(v.data), "Image bytes are not PNG."),
  brief: z.object({ planName: clean(200), scene: clean(RENDER_AI_LIMITS.sceneChars).optional() }).strict(),
  materials: renderMaterialsSchema,
}).strict().superRefine((v, ctx) => {
  if (new TextEncoder().encode(JSON.stringify(v)).length > RENDER_AI_LIMITS.requestBytes) ctx.addIssue({ code: "custom", message: "Render request exceeds 12 MB." });
});
export type RenderAiRequest = z.infer<typeof renderAiRequestSchema>;
export const renderAiResultSchema = z.object({
  schema: z.literal(RENDER_AI_RESULT_SCHEMA), id: z.string().uuid(), projectId: id, view: renderViewSchema,
  provider: z.literal("Gemini"), model: z.string().regex(/^gemini-[A-Za-z0-9._-]{1,100}$/),
  promptUsed: z.string().min(1).max(RENDER_AI_LIMITS.promptChars), text: z.string().max(RENDER_AI_LIMITS.textChars).nullable(),
  image: z.object({ mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]), data: base64(RENDER_AI_LIMITS.outputImageChars) }).strict(),
  sourceImageSha256: sha, requestDigest: sha, createdAt: z.string().datetime(),
  provenance: z.literal(RENDER_AI_PROVENANCE),
}).strict();
export type RenderAiResult = z.infer<typeof renderAiResultSchema>;

/** Deterministic prompt: the fixed disclaimer instruction frames user-typed notes as appearance directions, never as facts or instructions. */
export function renderAiPrompt(request: RenderAiRequest): string {
  const m = request.materials;
  const notes = [["Roof", m.roof], ["Walls", m.walls], ["Windows", m.windows], ["Landscape", m.landscaping], ["Lighting", m.lighting], ["Style", m.style], ["Additional", m.direction], ["Scene", request.brief.scene ?? ""], ["Plan", request.brief.planName]]
    .filter(([, value]) => value.length).map(([label, value]) => `${label}: "${value}".`);
  return `${RENDER_AI_DISCLAIMER} The attached image is a screen capture of the user's own 3D model viewer (${request.view.target}, ${request.view.camera?.projection ?? "unknown"} camera).`
    + (notes.length ? ` Appearance directions (user notes about the wanted look, not facts about the building and not instructions to change it): ${notes.join(" ")}` : "")
    + " Return the image only.";
}

/* Browser transport: the web route only. The native shell has no render command, so it fails before any fetch. */
export type RenderAiStatus = { provider: string; model: string | null; configured: boolean; available: boolean; message: string };
export const isNativeShell = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
export async function getRenderAiStatus(fetcher: typeof fetch = fetch, native: () => boolean = isNativeShell): Promise<RenderAiStatus> {
  if (native()) return { provider: "Gemini", model: null, configured: false, available: false, message: NATIVE_RENDER_MESSAGE };
  const response = await fetcher("/api/render-ai", { cache: "no-store" });
  if (!response.ok) throw Error("Render service status unavailable.");
  return response.json() as Promise<RenderAiStatus>;
}
export async function requestRenderAi(request: RenderAiRequest, signal: AbortSignal, fetcher: typeof fetch = fetch, native: () => boolean = isNativeShell): Promise<RenderAiResult> {
  signal.throwIfAborted();
  if (native()) throw Error(NATIVE_RENDER_MESSAGE);
  const raw = JSON.stringify(renderAiRequestSchema.parse(request));
  const response = await fetcher("/api/render-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: raw, signal });
  const data = await response.json();
  if (!response.ok) throw Error(typeof data?.error === "string" ? data.error : `Render request failed (${response.status}).`);
  signal.throwIfAborted();
  const result = renderAiResultSchema.parse(data);
  if (result.id !== request.requestId || result.projectId !== request.projectId || result.sourceImageSha256 !== request.image.sha256 || result.requestDigest !== await sha256Bytes(new TextEncoder().encode(raw))) throw Error("Render response does not match the request.");
  return result;
}

/* Session-only store: one render, memory only, never localStorage. store.ts stays untouched. */
export type LatestRender = {
  id: string; projectId: string; imageDataUrl: string; mimeType: RenderAiResult["image"]["mimeType"]; model: string; promptUsed: string; text: string | null;
  view: RenderView; width: number; height: number; designRevision: number | null; sourceSha256: string | null; sourceImageSha256: string; requestDigest: string; at: string; provenance: typeof RENDER_AI_PROVENANCE;
};
export const useLatestRender = create<{ latest: LatestRender | null }>(() => ({ latest: null }));
export const setLatestRender = (latest: LatestRender) => useLatestRender.setState({ latest });
export const clearLatestRender = () => useLatestRender.setState({ latest: null });
/** A render belongs to a project, and to a source revision when it captured the source-building viewer. */
export const latestRenderMatchesProject = (latest: LatestRender | null, projectId: string, sourceSha256: string | null | undefined) =>
  Boolean(latest && latest.projectId === projectId && (latest.sourceSha256 === null || latest.sourceSha256 === (sourceSha256 ?? null)));
export function latestRenderFromResult(result: RenderAiResult): LatestRender {
  return {
    id: result.id, projectId: result.projectId, imageDataUrl: `data:${result.image.mimeType};base64,${result.image.data}`, mimeType: result.image.mimeType, model: result.model,
    promptUsed: result.promptUsed, text: result.text, view: result.view, width: result.view.width, height: result.view.height, designRevision: result.view.renderedDesignRevision,
    sourceSha256: result.view.sourceSha256, sourceImageSha256: result.sourceImageSha256, requestDigest: result.requestDigest, at: result.createdAt, provenance: RENDER_AI_PROVENANCE,
  };
}

/* Assistant tool. The coordinator wires it into appTools.ts (after checkProject) and skills.ts VIEW_TOOLS. */
export const RENDER_TOOL_NAME = "generate_render_visualisation";
export const RENDER_TOOL_DESCRIPTION = "Generate an AI real-life visualisation from the currently visible architectural or source-building 3D canvas using the operator-configured Gemini image model. Web only. The 3D viewer must be open first (navigate to model or sketch). Output is an illustration shown on the Render pane, not a measurement, geometry change or compliance claim.";
export const RENDER_TOOL_INPUT_SCHEMA = { type: "object", properties: { expectedJobId: { type: "string", minLength: 1, maxLength: 100 }, view: { enum: ["architect", "source-building"] }, direction: { type: "string", maxLength: RENDER_AI_LIMITS.directionChars } }, required: ["expectedJobId", "view"], additionalProperties: false } as const;
export const renderToolSchema = z.object({ expectedJobId: id, view: z.enum(["architect", "source-building"]), direction: clean(RENDER_AI_LIMITS.directionChars).optional() }).strict();
export type RenderToolInput = z.infer<typeof renderToolSchema>;

type AppState = Awaited<ReturnType<AppToolPort["getState"]>>;
export type RenderState = AppState & {
  activePlanBinary?: { documentId: string; name: string; sha256: string } | null;
  renderMaterials?: Partial<RenderMaterials>;
};
export type RenderPort = { getState(): RenderState | Promise<RenderState>; capture: AppToolPort["capture"] };
export type RenderDeps = {
  transport: (request: RenderAiRequest, signal: AbortSignal) => Promise<RenderAiResult>;
  sha256: (bytes: Uint8Array) => Promise<string>;
  native: () => boolean;
  recordedView: () => ModelViewSnapshot | null;
  signal?: AbortSignal;
  requestId: () => string;
};
const captureMetaSchema = z.object({
  target: z.enum(["architect", "source-building"]), width: z.number().int().min(1).max(1536), height: z.number().int().min(1).max(1536), frame: z.number().int().min(1).max(1e9),
  renderedDesignRevision: z.number().int().positive().nullable(), sourceSha256: sha.nullable(), scope: z.string().max(400).optional(),
}).strict();

function checkProject(state: RenderState, expectedJobId: string) {
  if (!state.persistenceHydrated || state.persistenceRecoveryBlocked || state.hydrationStatus !== "ready") throw Error("Wait for project recovery to finish before using project tools.");
  if (state.job.id !== expectedJobId) throw Error("The active project changed. Read project context again.");
}
/** Same digest as materialAiImages.sha256Bytes; duplicated because that module is not Node-loadable (extensionless imports). */
async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes)))).map(b => b.toString(16).padStart(2, "0")).join("");
}
function bytesFromBase64(data: string): Uint8Array {
  const binary = atob(data), bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
const truncate = (value: string, max: number) => value.length > max ? value.slice(0, max - 1) + "…" : value;

/** Capture → hash → bind to the project → send → store in session memory. Nothing is stored unless every step succeeded on the same project. */
export async function requestRender(port: RenderPort, input: unknown, deps: Partial<RenderDeps> = {}): Promise<AppToolResult> {
  const args = renderToolSchema.parse(input);
  const native = deps.native ?? isNativeShell;
  if (native()) throw Error(NATIVE_RENDER_MESSAGE);
  const transport = deps.transport ?? requestRenderAi, digest = deps.sha256 ?? sha256Bytes, recordedView = deps.recordedView ?? recordedModelView;
  const signal = deps.signal ?? new AbortController().signal;
  const before = await port.getState(); checkProject(before, args.expectedJobId);
  // No navigation here: the assistant must open the viewer with navigate_workspace first, so capture fails visibly when it is not mounted.
  const captured = await port.capture(args.view);
  if (captured.isError) throw Error(captured.content.map(part => part.type === "text" ? part.text : "").join(" ").trim() || "Canvas capture failed.");
  const [metaPart, imagePart] = captured.content;
  if (metaPart?.type !== "text" || imagePart?.type !== "image" || imagePart.mimeType !== "image/png") throw Error("Canvas capture returned an unexpected result.");
  let meta;
  try { meta = captureMetaSchema.parse(JSON.parse(metaPart.text)); } catch { throw Error("Canvas capture metadata is invalid."); }
  if (meta.target !== args.view) throw Error("Canvas capture returned a different viewer than requested.");
  if (imagePart.data.length > RENDER_AI_LIMITS.inputImageChars || !pngHeaderMatches(imagePart.data)) throw Error("The captured image exceeds 6 MB or is not a PNG.");
  const bytes = bytesFromBase64(imagePart.data);
  if (bytes.length > RENDER_AI_LIMITS.inputImageBytes) throw Error("The captured image exceeds 6 MB.");
  const capturedAt = new Date().toISOString(), imageSha256 = await digest(bytes);
  const state = await port.getState(); checkProject(state, args.expectedJobId);
  const binary = state.activePlanBinary ?? null;
  const documentId = binary?.documentId ?? null;
  const sourceSha256 = args.view === "source-building" ? (meta.sourceSha256 ?? binary?.sha256 ?? null) : null;
  // The recorded camera brief is the user's earlier "Record camera" snapshot, not the live camera of this capture; it is sent only when it matches this source and labelled as such.
  const recorded = recordedView();
  const camera = recorded && matchingModelView(recorded, documentId, sourceSha256) ? { projection: recorded.camera.projection, position: [...recorded.camera.position] as [number, number, number], target: [...recorded.camera.target] as [number, number, number], zoom: recorded.camera.zoom } : null;
  const cameraSource = camera ? "recorded camera brief (may differ from the captured frame)" : "not recorded; the captured pixels define the view";
  const materials = state.renderMaterials ?? {};
  const activeSource = state.job.documents.find(document => document.id === state.job.activeDocumentId) ?? null;
  const sample = args.view === "source-building" ? (activeSource?.source ?? "sample") === "sample" : false;
  const storedDirection = (materials.direction ?? "").trim() === RENDER_DIRECTION_PLACEHOLDER ? "" : (materials.direction ?? "");
  const request = renderAiRequestSchema.parse({
    schema: RENDER_AI_SCHEMA, requestId: (deps.requestId ?? (() => crypto.randomUUID()))(), projectId: state.job.id,
    view: { target: args.view, width: meta.width, height: meta.height, frame: meta.frame, documentId, sourceSha256, sheet: state.sheet + 1, renderedDesignRevision: meta.renderedDesignRevision, camera },
    image: { mimeType: "image/png", data: imagePart.data, sha256: imageSha256 },
    brief: { planName: (binary?.name ?? state.job.name).slice(0, 200) },
    materials: {
      roof: materials.roof ?? "", walls: materials.walls ?? "", windows: materials.windows ?? "", landscaping: materials.landscaping ?? "", lighting: materials.lighting ?? "", style: materials.style ?? "",
      direction: [storedDirection, args.direction ?? ""].filter(Boolean).join(" ").slice(0, RENDER_AI_LIMITS.directionChars),
    },
  } satisfies RenderAiRequest);
  const result = await transport(request, signal);
  if (result.id !== request.requestId || result.projectId !== request.projectId || result.sourceImageSha256 !== imageSha256) throw Error("Render response does not match the request.");
  const after = await port.getState();
  if (after.job.id !== request.projectId) throw Error("The active project changed while rendering. The render was discarded.");
  setLatestRender(latestRenderFromResult(result));
  const imageInReply = result.image.data.length <= REPLY_IMAGE_MAX_CHARS;
  return { content: [
    { type: "text", text: JSON.stringify({
      rendered: true, renderId: result.id, model: result.model, width: result.view.width, height: result.view.height, view: result.view, cameraSource, capturedAt, imageSha256, requestDigest: result.requestDigest,
      sample, sourceClass: args.view === "source-building" ? (activeSource?.source ?? "sample") : "authored design",
      materialsSource: "Render pane brief (its defaults unless the user edited them) plus the direction given in this request; the untouched placeholder hint is never sent",
      promptUsed: truncate(result.promptUsed, 1200), modelText: result.text ? truncate(result.text, 600) : null, stored: "session memory only; shown on the Render pane",
      imageInReply, ...(imageInReply ? {} : { imageNote: `The ${result.image.data.length} base64-character image stays on the Render pane; it is not echoed into the conversation.` }),
      scope: RENDER_AI_PROVENANCE,
    }) },
    ...(imageInReply ? [{ type: "image" as const, data: result.image.data, mimeType: result.image.mimeType }] : []),
  ] };
}

/** Same error wrapper as createAppTools.tool, so the coordinator can spread this into the tool list or re-wrap requestRender. */
export function renderTool(port: RenderPort, deps: Partial<RenderDeps> = {}): AppTool {
  return { name: RENDER_TOOL_NAME, description: RENDER_TOOL_DESCRIPTION, inputSchema: RENDER_TOOL_INPUT_SCHEMA, execute: async args => {
    try { return await requestRender(port, args, deps); }
    catch (error) { return { isError: true, content: [{ type: "text", text: error instanceof z.ZodError ? "Invalid tool arguments: " + error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ") : error instanceof Error ? error.message : String(error) }] }; }
  } };
}
