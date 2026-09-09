import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createDefaultJob } from "../domain.ts";
import type { Pane } from "../store.ts";
import type { AppToolResult } from "./appTools.ts";
import {
  NATIVE_RENDER_MESSAGE, RENDER_AI_PROVENANCE, RENDER_AI_RESULT_SCHEMA, RENDER_TOOL_NAME, RENDER_TOOL_INPUT_SCHEMA, clearLatestRender, getRenderAiStatus, latestRenderMatchesProject,
  renderTool, requestRender, requestRenderAi, useLatestRender, type RenderAiRequest, type RenderAiResult, type RenderPort, type RenderState,
} from "./renderTool.ts";
import type { ModelViewSnapshot } from "../modelViewSnapshot.ts";

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";
const PNG_SHA = createHash("sha256").update(Buffer.from(PNG, "base64")).digest("hex");
const SOURCE_SHA = "c".repeat(64);
const sha256 = async (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const captureResult = (target: "architect" | "source-building", overrides: Record<string, unknown> = {}): AppToolResult => ({ content: [
  { type: "text", text: JSON.stringify({ target, width: 640, height: 480, frame: 7, renderedDesignRevision: target === "architect" ? 4 : null, sourceSha256: target === "source-building" ? SOURCE_SHA : null, scope: "Rendered 3D canvas pixels only; HTML controls are not included.", ...overrides }) },
  { type: "image", data: PNG, mimeType: "image/png" },
] });
const echo = (request: RenderAiRequest, raw = JSON.stringify(request)): RenderAiResult => ({
  schema: RENDER_AI_RESULT_SCHEMA, id: request.requestId, projectId: request.projectId, view: request.view, provider: "Gemini", model: "gemini-2.5-flash-image", promptUsed: "prompt", text: "done",
  image: { mimeType: "image/png", data: PNG }, sourceImageSha256: request.image.sha256, requestDigest: createHash("sha256").update(raw).digest("hex"), createdAt: "2026-09-09T10:00:00.000Z", provenance: RENDER_AI_PROVENANCE,
});
const snapshot = (documentId: string, sourceSha256: string): ModelViewSnapshot => ({
  schema: "xray.model-view/v1", documentId, sourceSha256, sceneId: "scene", sceneSha256: "d".repeat(64), view: { wireframe: false, roof: true, cutaway: false, explode: false, plan: false, level: "all" }, capturedAt: "2026-09-09T09:00:00.000Z",
  camera: { projection: "perspective", position: [1, 2, 3], target: [0, 0, 0], up: [0, 1, 0], zoom: 1.5, near: 0.1, far: 100, projectionMatrix: Array(16).fill(0) },
});

function fixture() {
  const job = createDefaultJob();
  const state: RenderState = {
    job, pane: "model" as Pane, sheet: 2, hydrationStatus: "ready", persistenceHydrated: true, persistenceRecoveryBlocked: false, persistenceError: null, lastSavedJobRevision: job.revision,
    setPane(pane: Pane) { state.pane = pane; }, saveCurrentProject() { return { ok: true, error: null }; },
    activePlanBinary: { documentId: "doc-1", name: "Fixture plan.pdf", sha256: SOURCE_SHA },
    renderMaterials: { roof: "terracotta", walls: "", windows: "", landscaping: "", lighting: "", style: "", direction: "plain" },
  };
  const captures: string[] = [], sent: RenderAiRequest[] = [];
  const port: RenderPort = { getState: () => state, capture: async target => { captures.push(target); return captureResult(target); } };
  const deps = { native: () => false, sha256, recordedView: () => snapshot("doc-1", SOURCE_SHA), transport: async (request: RenderAiRequest) => { sent.push(request); return echo(request); } };
  clearLatestRender();
  return { state, port, deps, captures, sent, job };
}
const text = (result: AppToolResult) => JSON.parse(result.content.find(part => part.type === "text")!.text as string);

test("tool metadata matches the wiring contract", () => {
  assert.equal(RENDER_TOOL_NAME, "generate_render_visualisation");
  assert.equal(RENDER_TOOL_INPUT_SCHEMA.additionalProperties, false);
  assert.deepEqual(RENDER_TOOL_INPUT_SCHEMA.required, ["expectedJobId", "view"]);
});

test("success captures the requested viewer, binds the view to the project and source, stores the render in session memory and returns a receipt with the image", async () => {
  const f = fixture();
  const result = await requestRender(f.port, { expectedJobId: f.job.id, view: "source-building", direction: "add a hedge" }, f.deps);
  assert.deepEqual(f.captures, ["source-building"]);
  assert.equal(f.sent.length, 1);
  const request = f.sent[0];
  assert.equal(request.projectId, f.job.id);
  assert.deepEqual(request.view, { target: "source-building", width: 640, height: 480, frame: 7, documentId: "doc-1", sourceSha256: SOURCE_SHA, sheet: 3, renderedDesignRevision: null, camera: { projection: "perspective", position: [1, 2, 3], target: [0, 0, 0], zoom: 1.5 } });
  assert.deepEqual(request.image, { mimeType: "image/png", data: PNG, sha256: PNG_SHA });
  assert.equal(request.brief.planName, "Fixture plan.pdf");
  assert.equal(request.materials.roof, "terracotta"); assert.equal(request.materials.direction, "plain add a hedge");
  const receipt = text(result);
  assert.equal(receipt.rendered, true); assert.equal(receipt.model, "gemini-2.5-flash-image");
  assert.equal(receipt.width, 640); assert.equal(receipt.height, 480);
  assert.equal(receipt.stored, "session memory only; shown on the Render pane"); assert.equal(receipt.imageInReply, true); assert.equal(typeof receipt.sample, "boolean"); assert.equal(receipt.scope, RENDER_AI_PROVENANCE);
  assert.equal(receipt.imageSha256, PNG_SHA); assert.equal(receipt.promptUsed, "prompt");
  assert.deepEqual(result.content[1], { type: "image", data: PNG, mimeType: "image/png" });
  const latest = useLatestRender.getState().latest!;
  assert.equal(latest.id, request.requestId); assert.equal(latest.projectId, f.job.id);
  assert.equal(latest.imageDataUrl, `data:image/png;base64,${PNG}`);
  assert.equal(latest.sourceSha256, SOURCE_SHA); assert.equal(latest.designRevision, null);
  assert.equal(latest.at, "2026-09-09T10:00:00.000Z"); assert.equal(latest.provenance, RENDER_AI_PROVENANCE);
  assert.equal(latestRenderMatchesProject(latest, f.job.id, SOURCE_SHA), true);
  assert.equal(latestRenderMatchesProject(latest, f.job.id, "e".repeat(64)), false);
  assert.equal(latestRenderMatchesProject(latest, "other", SOURCE_SHA), false);
});

test("architect captures carry the design revision, no source sha and no camera when the recorded view does not match", async () => {
  const f = fixture();
  f.deps.recordedView = () => snapshot("doc-other", SOURCE_SHA);
  await requestRender(f.port, { expectedJobId: f.job.id, view: "architect" }, f.deps);
  const view = f.sent[0].view;
  assert.equal(view.target, "architect"); assert.equal(view.sourceSha256, null); assert.equal(view.renderedDesignRevision, 4); assert.equal(view.camera, null);
  const latest = useLatestRender.getState().latest!;
  assert.equal(latest.designRevision, 4); assert.equal(latest.sourceSha256, null);
  assert.equal(latestRenderMatchesProject(latest, f.job.id, "any-source"), true);
});

test("native shell refuses before capture; invalid arguments are reported as tool errors", async () => {
  const f = fixture();
  await assert.rejects(requestRender(f.port, { expectedJobId: f.job.id, view: "architect" }, { ...f.deps, native: () => true }), new RegExp(NATIVE_RENDER_MESSAGE.replace(/[.;]/g, "\\$&")));
  assert.equal(f.captures.length, 0);
  const tool = renderTool(f.port, f.deps);
  const invalid = await tool.execute({ expectedJobId: f.job.id, view: "elevation" });
  assert.equal(invalid.isError, true); assert.match((invalid.content[0] as { text: string }).text, /^Invalid tool arguments/);
  const long = await tool.execute({ expectedJobId: f.job.id, view: "architect", direction: "x".repeat(501) });
  assert.equal(long.isError, true);
  const extra = await tool.execute({ expectedJobId: f.job.id, view: "architect", target: "architect" });
  assert.equal(extra.isError, true);
  assert.equal(f.captures.length, 0); assert.equal(useLatestRender.getState().latest, null);
});

test("project mismatch before capture, project change after capture and a change during the render all refuse and store nothing", async () => {
  const f = fixture();
  await assert.rejects(requestRender(f.port, { expectedJobId: "other", view: "architect" }, f.deps), /active project changed/);
  assert.equal(f.captures.length, 0);
  f.port.capture = async target => { f.state.job = { ...f.job, id: "switched" }; return captureResult(target); };
  await assert.rejects(requestRender(f.port, { expectedJobId: f.job.id, view: "architect" }, f.deps), /active project changed/);
  assert.equal(f.sent.length, 0); assert.equal(useLatestRender.getState().latest, null);
  f.state.job = f.job;
  f.port.capture = async target => captureResult(target);
  f.deps.transport = async request => { f.state.job = { ...f.job, id: "switched-late" }; return echo(request); };
  await assert.rejects(requestRender(f.port, { expectedJobId: f.job.id, view: "architect" }, f.deps), /changed while rendering/);
  assert.equal(useLatestRender.getState().latest, null);
  f.state.job = f.job; f.state.hydrationStatus = "loading";
  await assert.rejects(requestRender(f.port, { expectedJobId: f.job.id, view: "architect" }, f.deps), /project recovery/);
});

test("route failure surfaces its message through the tool wrapper and keeps the previous render", async () => {
  const f = fixture();
  await requestRender(f.port, { expectedJobId: f.job.id, view: "source-building" }, f.deps);
  const previous = useLatestRender.getState().latest;
  const tool = renderTool(f.port, { ...f.deps, transport: async () => { throw Error("Gemini rejected the render request (HTTP 404). Check provider access, image-model availability and quota."); } });
  const result = await tool.execute({ expectedJobId: f.job.id, view: "source-building" });
  assert.equal(result.isError, true);
  assert.match((result.content[0] as { text: string }).text, /HTTP 404/);
  assert.equal(useLatestRender.getState().latest, previous);
  const capture = renderTool({ ...f.port, capture: async () => { throw Error("The requested 3D canvas is not visible. Open its viewer first."); } }, f.deps);
  assert.match((((await capture.execute({ expectedJobId: f.job.id, view: "architect" })).content[0]) as { text: string }).text, /not visible/);
});

test("capture results that are errors, malformed, mismatched or oversized are refused before any transport", async () => {
  const f = fixture();
  const cases: Array<() => Promise<AppToolResult>> = [
    async () => ({ isError: true, content: [{ type: "text", text: "Wait for the 3D viewer to render before capturing it." }] }),
    async () => ({ content: [{ type: "image", data: PNG, mimeType: "image/png" }] }),
    async () => captureResult("source-building"),
    async () => ({ content: [{ type: "text", text: "{}" }, { type: "image", data: PNG, mimeType: "image/png" }] }),
    async () => ({ content: [{ type: "text", text: JSON.stringify({ target: "architect", width: 1, height: 1, frame: 1, renderedDesignRevision: null, sourceSha256: null }) }, { type: "image", data: "/9j/4AAQSkZJRg==", mimeType: "image/png" }] }),
  ];
  for (const capture of cases) await assert.rejects(requestRender({ ...f.port, capture }, { expectedJobId: f.job.id, view: "architect" }, f.deps));
  assert.equal(f.sent.length, 0);
});

test("transport identity checks reject mismatched id, project, image hash and request digest", async () => {
  const f = fixture();
  const tamper = (patch: (result: RenderAiResult) => RenderAiResult) => ({ ...f.deps, transport: async (request: RenderAiRequest) => patch(echo(request)) });
  await assert.rejects(requestRender(f.port, { expectedJobId: f.job.id, view: "architect" }, tamper(r => ({ ...r, id: "8c806de6-124e-4232-925b-0196c1258646" }))), /does not match/);
  await assert.rejects(requestRender(f.port, { expectedJobId: f.job.id, view: "architect" }, tamper(r => ({ ...r, sourceImageSha256: "f".repeat(64) }))), /does not match/);
  assert.equal(useLatestRender.getState().latest, null);
});

test("browser transport posts the validated request, propagates route errors and rejects a digest mismatch; native short-circuits", async () => {
  const f = fixture();
  await requestRender(f.port, { expectedJobId: f.job.id, view: "source-building" }, f.deps);
  const request = f.sent[0];
  let posted: RequestInit | undefined;
  const ok: typeof fetch = async (url, init) => { posted = init; assert.equal(String(url), "/api/render-ai"); return Response.json(echo(request, String(init?.body))); };
  const result = await requestRenderAi(request, new AbortController().signal, ok, () => false);
  assert.equal(result.id, request.requestId);
  assert.equal((posted?.headers as Record<string, string>)["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(String(posted?.body)), request);
  await assert.rejects(requestRenderAi(request, new AbortController().signal, async () => Response.json({ error: "Image renderer is not configured." }, { status: 503 }), () => false), /not configured/);
  await assert.rejects(requestRenderAi(request, new AbortController().signal, async () => Response.json(echo(request, "different raw")), () => false), /does not match/);
  await assert.rejects(requestRenderAi(request, new AbortController().signal, async () => Response.json({ ...echo(request), provenance: "verified survey" }), () => false));
  let fetched = false;
  await assert.rejects(requestRenderAi(request, new AbortController().signal, async () => { fetched = true; return Response.json({}); }, () => true), new RegExp(NATIVE_RENDER_MESSAGE.replace(/[.;]/g, "\\$&")));
  assert.deepEqual(await getRenderAiStatus(async () => { fetched = true; return Response.json({}); }, () => true), { provider: "Gemini", model: null, configured: false, available: false, message: NATIVE_RENDER_MESSAGE });
  assert.equal(fetched, false);
  await assert.rejects(requestRenderAi(request, AbortSignal.abort(), ok, () => false));
});
