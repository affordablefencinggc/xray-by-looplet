import { z } from "zod";
import { defaultLayers, newWall, validateProject, type ArchitectProject } from "../architect/model.ts";

const id = z.string().min(1).max(100);
const coordinate = z.number().finite().min(-1e6).max(1e6);
const point = z.tuple([coordinate, coordinate]);
const positive = z.number().finite().positive().max(1e6);
const reference = { ref: z.string().min(1).max(80).optional() };
const opening = {
  ...reference, wallRef: id, offsetMm: coordinate, widthMm: positive, heightMm: positive,
  tag: z.string().trim().min(1).max(30), hinge: z.enum(["left", "right"]), swing: z.enum(["in", "out"]),
};
export const architectOperationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("wall"), ...reference, levelId: id, a: point, b: point, heightMm: positive.optional(), name: z.string().trim().min(1).max(120).optional(), templateWallId: id.optional() }).strict(),
  z.object({ kind: z.literal("door"), ...opening }).strict(),
  z.object({ kind: z.literal("window"), ...opening, sillMm: z.number().finite().nonnegative().max(1e6) }).strict(),
  z.object({ kind: z.literal("line"), ...reference, levelId: id, a: point, b: point }).strict(),
  z.object({ kind: z.literal("room"), ...reference, levelId: id, point, name: z.string().trim().min(1).max(100) }).strict(),
]);
export const architectReadSchema = z.object({ expectedJobId: id }).strict();
export const architectRevisionSchema = z.object({ expectedJobId: id, expectedRevision: z.number().int().positive() }).strict();
export const architectDrawSchema = architectRevisionSchema.extend({ operations: z.array(architectOperationSchema).min(1).max(25) }).strict();
export type ArchitectDrawInput = z.infer<typeof architectDrawSchema>;
export type ArchitectRevisionInput = z.infer<typeof architectRevisionSchema>;
export type ArchitectCreatedElement = { ref?: string; kind: string; id: string };

/** Append-only draft: no persistence or UI mutation occurs until the entire batch validates. */
export function prepareArchitectElements(project: ArchitectProject, input: unknown, makeId: () => string = () => crypto.randomUUID()) {
  const args = architectDrawSchema.parse(input);
  if (project.id !== args.expectedJobId) throw Error("The active project changed. Read project context again.");
  if (project.revision !== args.expectedRevision) throw Error("The design revision changed. Read the design again before drawing.");
  const draft = structuredClone(validateProject(project));
  const refs = new Map<string, string>(), created: ArchitectCreatedElement[] = [], notices: string[] = [];
  for (const operation of args.operations) {
    if (operation.ref && refs.has(operation.ref)) throw Error("Operation references must be unique within a batch.");
    const entityId = makeId();
    if ("levelId" in operation && !draft.levels.some(level => level.id === operation.levelId)) throw Error("Choose an existing design level.");
    if (operation.kind === "wall") {
      const template = operation.templateWallId ? draft.walls.find(wall => wall.id === operation.templateWallId) : null;
      if (operation.templateWallId && !template) throw Error("Wall assembly template was not found.");
      const layers = (template ? structuredClone(template.layers) : defaultLayers()).map(layer => ({ ...layer, id: makeId() }));
      const wall = newWall(draft, operation.levelId, operation.a, operation.b, layers);
      wall.id = entityId;
      if (operation.name) wall.name = operation.name;
      if (operation.heightMm !== undefined) wall.height = operation.heightMm;
      draft.walls.push(wall);
      if (!template) notices.push(`Wall ${entityId} uses the existing unpriced default assembly. Review its layers and dimensions.`);
    } else if (operation.kind === "door" || operation.kind === "window") {
      const wallId = refs.get(operation.wallRef) ?? operation.wallRef;
      if (!draft.walls.some(wall => wall.id === wallId)) throw Error("Opening needs an existing wall ID or an earlier wall operation reference.");
      draft.openings.push({ id: entityId, revision: 1, kind: operation.kind, wallId, tag: operation.tag,
        offset: operation.offsetMm, width: operation.widthMm, height: operation.heightMm,
        sill: operation.kind === "window" ? operation.sillMm : 0, hinge: operation.hinge, swing: operation.swing });
    } else if (operation.kind === "line") draft.lines.push({ id: entityId, revision: 1, levelId: operation.levelId, a: operation.a, b: operation.b });
    else draft.roomTags.push({ id: entityId, revision: 1, levelId: operation.levelId, point: operation.point, name: operation.name });
    if (operation.ref) refs.set(operation.ref, entityId);
    created.push({ ...(operation.ref ? { ref: operation.ref } : {}), kind: operation.kind, id: entityId });
  }
  return { draft: validateProject(draft), created, notices };
}

export type ArchitectController = {
  read(args: z.infer<typeof architectReadSchema>): unknown | Promise<unknown>;
  draw(args: ArchitectDrawInput): unknown | Promise<unknown>;
  undo(args: ArchitectRevisionInput): unknown | Promise<unknown>;
};
let active: { token: symbol; controller: ArchitectController } | null = null;
export const hasArchitectController = () => active !== null;
/** The mounted drafting UI owns registration, its save function and its existing undo stack. */
export function registerArchitectController(controller: ArchitectController): () => void {
  const token = Symbol("architect-controller");
  active = { token, controller };
  if (typeof window !== "undefined") window.dispatchEvent(new Event("xray:architect-controller-ready"));
  return () => { if (active?.token === token) active = null; };
}
export async function requestArchitectTool(action: "read" | "draw" | "undo", input: unknown): Promise<unknown> {
  const current = active;
  if (!current) throw Error("Open Sketch → Architectural workspace before using this design tool.");
  if (action === "read") return current.controller.read(architectReadSchema.parse(input));
  if (action === "draw") return current.controller.draw(architectDrawSchema.parse(input));
  return current.controller.undo(architectRevisionSchema.parse(input));
}
