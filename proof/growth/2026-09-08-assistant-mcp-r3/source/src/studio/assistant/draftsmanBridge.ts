import { z } from "zod";
import type { DraftsmanStatus } from "../MagicPencilDraftsman.ts";

export const draftsmanActionSchema = z.enum([
  "play",
  "pause",
  "replay",
  "seek",
  "set_speed",
  "finish",
  "exit",
  "status",
  "tour",
  "jump_storey",
  "blueprint",
  "section_cut",
  "dimensions",
  "plan_book",
]);
export type DraftsmanAction = z.infer<typeof draftsmanActionSchema>;

/** MCP publishes only viewer actions with an implemented, observable result.
 * Blueprint/export and presentation controls remain UI-only until receipt APIs exist. */
export const draftsmanMcpActions = ["play", "pause", "replay", "seek", "set_speed", "finish", "exit", "status", "tour", "jump_storey"] as const;
export const draftsmanMcpSchema = z.object({
  expectedJobId: z.string().min(1).max(100),
  action: z.enum(draftsmanMcpActions),
  progress: z.number().finite().min(0).max(1).optional(),
  speed: z.number().finite().positive().max(20).optional(),
  storey: z.union([z.string().min(1), z.number().finite().int().min(0)]).optional(),
}).strict();

export const draftsmanControlSchema = z.object({
  action: draftsmanActionSchema,
  progress: z.number().finite().min(0).max(1).optional(),
  speed: z.number().finite().positive().max(20).optional(),
  storey: z.union([z.string(), z.number()]).optional(),
  filename: z.string().max(200).optional(),
  mode: z.enum(["none", "plan", "section-x", "section-z"]).optional(),
  visible: z.boolean().optional(),
  download: z.boolean().optional(),
}).strict().superRefine((val, ctx) => {
  if (val.action === "seek" && val.progress === undefined) {
    ctx.addIssue({
      code: "custom",
      message: "Action 'seek' requires a 'progress' value between 0.0 and 1.0.",
    });
  }
  if (val.action === "set_speed" && val.speed === undefined) {
    ctx.addIssue({
      code: "custom",
      message: "Action 'set_speed' requires a 'speed' multiplier value.",
    });
  }
  if (val.action === "jump_storey" && val.storey === undefined) {
    ctx.addIssue({
      code: "custom",
      message: "Action 'jump_storey' requires a 'storey' level label or index.",
    });
  }
});
export type DraftsmanControlInput = z.infer<typeof draftsmanControlSchema>;

export type DraftsmanController = {
  control(input: DraftsmanControlInput): Promise<DraftsmanStatus | null> | DraftsmanStatus | null;
  getStatus(): DraftsmanStatus | null;
  isActive(): boolean;
  getModelInfo(): { id: string; title: string; meshCount: number } | null;
};

let activeController: { token: symbol; controller: DraftsmanController } | null = null;

export const hasDraftsmanController = () => activeController !== null;

/** The mounted 3D building viewer owns registration and drives the real draftsman lifecycle. */
export function registerDraftsmanController(controller: DraftsmanController): () => void {
  const token = Symbol("draftsman-controller");
  activeController = { token, controller };
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("xray:draftsman-controller-ready"));
  }
  return () => {
    if (activeController?.token === token) activeController = null;
  };
}

export async function requestDraftsmanTool(action: DraftsmanAction, input?: unknown): Promise<unknown> {
  const current = activeController;
  if (!current) {
    throw Error("3D model viewer is not currently active. Open the 3D viewer (Model pane) to use the Magic Pencil draftsman.");
  }
  const payload = typeof input === "object" && input !== null ? { ...input, action } : { action };
  const parsed = draftsmanControlSchema.parse(payload);
  const status = await current.controller.control(parsed);
  const modelInfo = current.controller.getModelInfo();
  return {
    model: modelInfo,
    active: current.controller.isActive(),
    status,
  };
}
