import { z } from "zod";
import type { FencingJob } from "../domain.ts";
import type { Pane } from "../store.ts";
import { architectDrawSchema, architectReadSchema, architectRevisionSchema, hasArchitectController, requestArchitectTool } from "./architectBridge.ts";
import { draftsmanControlSchema, draftsmanMcpActions, draftsmanMcpSchema, hasDraftsmanController, requestDraftsmanTool, type DraftsmanAction } from "./draftsmanBridge.ts";

export type AppToolResult = { content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }>; isError?: boolean };
export type AppTool = { name: string; description: string; inputSchema: { type: "object"; [key: string]: unknown }; execute(args: unknown): Promise<AppToolResult> };
export const APP_PANES = ["overview", "sheets", "measure", "sketch", "components", "model", "render", "review", "cost", "proof"] as const;
type AppState = {
  job: Pick<FencingJob, "id" | "name" | "revision" | "documents" | "activeDocumentId" | "annotations" | "runs" | "gates">;
  pane: Pane; sheet: number; hydrationStatus: string; persistenceHydrated: boolean; persistenceRecoveryBlocked: boolean;
  persistenceError: string | null; lastSavedJobRevision: number | null;
  pending?: unknown[]; calibrationCapture?: { points: unknown[] } | null;
  setPane(pane: Pane): void; saveCurrentProject(): { ok: boolean; error: string | null };
};
export type AppToolPort = {
  getState(): AppState | Promise<AppState>;
  architect(action: "read" | "draw" | "undo", args: unknown): Promise<unknown>;
  architectAvailable(): boolean;
  capture(target: "architect" | "source-building"): Promise<AppToolResult>;
  openArchitectWorkspace?(expectedJobId: string): Promise<void>;
  draftsman?(action: DraftsmanAction, args?: unknown): Promise<unknown>;
  draftsmanAvailable?(): boolean;
};
const idSchema = z.string().min(1).max(100);
const emptySchema = z.object({}).strict();
const navigationSchema = z.object({ expectedJobId: idSchema, pane: z.enum(APP_PANES) }).strict();
const captureSchema = z.object({ expectedJobId: idSchema, target: z.enum(["architect", "source-building"]) }).strict();
const text = (value: unknown): AppToolResult => ({ content: [{ type: "text", text: JSON.stringify(value) }] });
const objectSchema = (properties: Record<string, unknown>, required = Object.keys(properties)): AppTool["inputSchema"] => ({ type: "object", properties, required, additionalProperties: false });
const id = { type: "string", minLength: 1, maxLength: 100 }, num = { type: "number", minimum: -1e6, maximum: 1e6 }, positive = { type: "number", exclusiveMinimum: 0, maximum: 1e6 };
const point = { type: "array", items: num, minItems: 2, maxItems: 2 };
const bound = { expectedJobId: id, expectedRevision: { type: "integer", minimum: 1 } };
const ref = { type: "string", minLength: 1, maxLength: 80 };
const opening = { ref, wallRef: id, offsetMm: num, widthMm: positive, heightMm: positive, tag: { type: "string", minLength: 1, maxLength: 30 }, hinge: { enum: ["left", "right"] }, swing: { enum: ["in", "out"] } };
const operations = {
  type: "array", minItems: 1, maxItems: 25, items: { oneOf: [
    objectSchema({ kind: { const: "wall" }, ref, levelId: id, a: point, b: point, heightMm: positive, name: { type: "string", minLength: 1, maxLength: 120 }, templateWallId: id }, ["kind", "levelId", "a", "b"]),
    objectSchema({ kind: { const: "door" }, ...opening }, ["kind", "wallRef", "offsetMm", "widthMm", "heightMm", "tag", "hinge", "swing"]),
    objectSchema({ kind: { const: "window" }, ...opening, sillMm: { type: "number", minimum: 0, maximum: 1e6 } }, ["kind", "wallRef", "offsetMm", "widthMm", "heightMm", "sillMm", "tag", "hinge", "swing"]),
    objectSchema({ kind: { const: "line" }, ref, levelId: id, a: point, b: point }, ["kind", "levelId", "a", "b"]),
    objectSchema({ kind: { const: "room" }, ref, levelId: id, point, name: { type: "string", minLength: 1, maxLength: 100 } }, ["kind", "levelId", "point", "name"]),
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
      error ? reject(error) : resolve();
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
      catch (error) { return { isError: true, content: [{ type: "text", text: error instanceof z.ZodError ? "Invalid tool arguments: " + error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ") : error instanceof Error ? error.message : String(error) }] }; }
    },
  });
  return [
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
    tool("read_architect_design", "Read the real mounted architectural design in millimetres, including stable entity IDs, sheet layouts, revision and pending-draft status. Open Sketch / Architectural workspace first.", objectSchema({ expectedJobId: id }), async input => {
      const args = architectReadSchema.parse(input); checkProject(await port.getState(), args.expectedJobId);
      return text(await port.architect("read", args));
    }),
    tool("draw_architect_elements", "Append 1–25 validated walls, hosted doors/windows, reference lines or room labels to the active design in millimetres. wallRef may refer to an existing wall ID or an earlier wall operation ref. The whole batch validates and saves once; existing geometry and sheets remain intact. No deletions. Unspecified wall assembly uses the unpriced default and is reported for review.", objectSchema({ ...bound, operations }), async input => {
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
  ];
}

export const appTools: AppTool[] = createAppTools({
  getState: async () => (await import("../store.ts")).useStudio.getState(),
  architect: requestArchitectTool,
  architectAvailable: hasArchitectController,
  capture: captureCanvasImage,
  openArchitectWorkspace,
  draftsman: requestDraftsmanTool,
  draftsmanAvailable: hasDraftsmanController,

});

