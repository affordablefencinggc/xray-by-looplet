import { create } from "zustand";
import { useLiveAssistant } from "../liveAssistantState.ts";
import type { ArchitectProject } from "../architect/model.ts";
import type { SourceBuilding } from "../sourceBuilding.ts";

/**
 * Canvas references: a precise, human-readable pointer to one design entity, one
 * source-building part or one view, inserted into the Live assistant draft so the
 * model knows exactly which thing the user means. IDs are the same IDs the tools
 * accept (edit_architect_elements, read_source_building), so the model can act on
 * the reference without guessing. Shared by the canvas right-click menu and the
 * "select a shape" chat pills.
 */
export type ArchitectEntityKind =
  | "wall" | "door" | "window" | "line" | "circle" | "arc" | "room" | "slab" | "roof" | "level" | "grid" | "dimension";
export type CanvasReference =
  | { kind: "architect-entity"; entity: ArchitectEntityKind; id: string; levelId: string | null; levelName: string | null; summary: string }
  | { kind: "source-part"; building: string; partId: string; category: string; label: string; storey: string | null; evidenceState: string; summary: string }
  | { kind: "view"; target: "architect-plan" | "architect-3d" | "source-building" | "source-sheet"; summary: string };

/** The architect fields the describer reads; tests pass structural fixtures. */
export type ArchitectLike = Pick<ArchitectProject, "levels" | "walls" | "openings" | "lines" | "circles" | "arcs" | "roomTags" | "slabs" | "roofs" | "grids" | "dimensions">;
export const REFERENCE_MAX_CHARS = 320;

const mm = (p: readonly [number, number]) => `(${Math.round(p[0])}, ${Math.round(p[1])})`;
const clip = (text: string, max = REFERENCE_MAX_CHARS) => (text.length <= max ? text : text.slice(0, max - 1) + "…");

function ringExtent(points: readonly (readonly [number, number])[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
  return `${Math.round(maxX - minX)} × ${Math.round(maxY - minY)} mm from ${mm([minX, minY])}`;
}

/** Finds the entity with this id anywhere in the design and describes it in millimetres. Returns null for unknown ids. */
export function describeArchitectEntity(project: ArchitectLike, id: string): CanvasReference | null {
  const levelName = (levelId: string) => project.levels.find(level => level.id === levelId)?.name ?? null;
  const entity = (kind: ArchitectEntityKind, levelId: string | null, summary: string): CanvasReference =>
    ({ kind: "architect-entity", entity: kind, id, levelId, levelName: levelId ? levelName(levelId) : null, summary: clip(summary) });
  const level = project.levels.find(item => item.id === id);
  if (level) return entity("level", level.id, `level "${level.name}" at elevation ${Math.round(level.elevation)} mm, storey height ${Math.round(level.height)} mm`);
  const wall = project.walls.find(item => item.id === id);
  if (wall) return entity("wall", wall.levelId, `${wall.name}, from ${mm(wall.a)} to ${mm(wall.b)} mm, length ${Math.round(Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]))} mm, height ${Math.round(wall.height)} mm, ${wall.layers.length} layer${wall.layers.length === 1 ? "" : "s"}`);
  const opening = project.openings.find(item => item.id === id);
  if (opening) {
    const host = project.walls.find(item => item.id === opening.wallId);
    return entity(opening.kind, host?.levelId ?? null, `${opening.tag} ${opening.kind} in wall ${opening.wallId}, offset ${Math.round(opening.offset)} mm along the wall, ${Math.round(opening.width)} × ${Math.round(opening.height)} mm, sill ${Math.round(opening.sill)} mm`);
  }
  const line = project.lines.find(item => item.id === id);
  if (line) return entity("line", line.levelId, `line from ${mm(line.a)} to ${mm(line.b)} mm`);
  const circle = project.circles.find(item => item.id === id);
  if (circle) return entity("circle", circle.levelId, `circle centred ${mm(circle.center)} mm, radius ${Math.round(circle.radius)} mm`);
  const arc = project.arcs.find(item => item.id === id);
  if (arc) return entity("arc", arc.levelId, `arc centred ${mm(arc.center)} mm, radius ${Math.round(arc.radius)} mm`);
  const room = project.roomTags.find(item => item.id === id);
  if (room) return entity("room", room.levelId, `room "${room.name}" tagged at ${mm(room.point)} mm`);
  const slab = project.slabs.find(item => item.id === id);
  if (slab) return entity("slab", slab.levelId, `slab "${slab.name}", ${slab.points.length} points, ${ringExtent(slab.points)}, thickness ${Math.round(slab.thickness)} mm, ${slab.material || "material unset"}`);
  const roof = project.roofs.find(item => item.id === id);
  if (roof) return entity("roof", roof.levelId, `roof "${roof.name}", ${roof.points.length} edges, ${ringExtent(roof.points)}, eaves ${Math.round(roof.eaves)} mm, pitches ${roof.edges.map(edge => (edge.gable ? "gable" : `${edge.pitch}°`)).join("/")}`);
  const grid = project.grids.find(item => item.id === id);
  if (grid) return entity("grid", null, `grid line ${grid.label} on the ${grid.axis} axis at ${Math.round(grid.position)} mm`);
  const dimension = project.dimensions.find(item => item.id === id);
  if (dimension) return entity("dimension", null, `dimension on wall ${dimension.wallId}, offset ${Math.round(dimension.offset)} mm`);
  return null;
}

/** Describes one reconstruction part in metres (bounds only; no mesh). Returns null for unknown ids. */
export function describeSourcePart(scene: Pick<SourceBuilding, "objects">, building: string, partId: string): CanvasReference | null {
  const part = scene.objects.find(item => item.id === partId);
  if (!part) return null;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < part.positions.length; index++) {
    const axis = index % 3, value = part.positions[index];
    if (value < min[axis]) min[axis] = value;
    if (value > max[axis]) max[axis] = value;
  }
  const size = max.map((value, axis) => (value - min[axis]).toFixed(2));
  const storey = part.storey ?? part.level ?? null;
  return {
    kind: "source-part", building, partId, category: part.category, label: part.label, storey, evidenceState: part.evidenceState,
    summary: clip(`${size[0]} × ${size[2]} m footprint, ${size[1]} m tall, from x ${min[0].toFixed(2)} z ${min[2].toFixed(2)} at height ${min[1].toFixed(2)} m, material ${part.material}, evidence ${part.evidenceState}, source pages ${[...new Set(part.sourceRefs.map(ref => ref.page))].join(", ")}`),
  };
}

/** The bracketed line the model reads; keep it on one line so it survives chat rendering and the 1500-character composer. */
export function formatReference(ref: CanvasReference): string {
  if (ref.kind === "architect-entity")
    return `[Reference · ${ref.entity} id ${ref.id}${ref.levelName ? ` on level "${ref.levelName}" (${ref.levelId})` : ""} · ${ref.summary}]`;
  if (ref.kind === "source-part")
    return `[Reference · source-building "${ref.building}" part ${ref.partId} · ${ref.category} "${ref.label}"${ref.storey ? ` storey ${ref.storey}` : ""} · ${ref.summary}]`;
  return `[Reference · ${ref.target} view · ${ref.summary}]`;
}

/** The composer's hard limit (LiveAssistant textarea maxLength); a programmatic draft must respect it too. */
export const DRAFT_MAX_CHARS = 1500;
/**
 * Appends a reference (and an optional intent line) to the draft without duplicating either.
 * Never exceeds the composer limit: the intent is dropped first, and if the reference alone does
 * not fit the draft is returned unchanged (the caller can tell by comparing).
 */
export function mergeDraft(draft: string, reference: string, intent?: string, max = DRAFT_MAX_CHARS): string {
  const current = draft.trimEnd();
  const parts: string[] = current ? [current] : [];
  if (!current.includes(reference)) parts.push(reference);
  const withIntent = intent && !current.includes(intent) ? [...parts, intent] : parts;
  const full = withIntent.join("\n");
  if (full.length <= max) return full;
  const withoutIntent = parts.join("\n");
  return withoutIntent.length <= max ? withoutIntent : draft;
}

/** Puts the reference into the Live assistant composer, opens the panel and focuses the prompt. Nothing is sent. */
export function insertReference(ref: CanvasReference, intent?: string): string {
  const draft = mergeDraft(useLiveAssistant.getState().draft, formatReference(ref), intent);
  useLiveAssistant.setState({ draft, open: true });
  if (typeof document !== "undefined" && typeof requestAnimationFrame === "function")
    requestAnimationFrame(() => {
      const prompt = document.getElementById("live-assistant-prompt") as HTMLTextAreaElement | null;
      if (!prompt) return;
      prompt.focus();
      prompt.setSelectionRange(prompt.value.length, prompt.value.length);
    });
  return draft;
}

/** "Select a shape" mode: the next click on a plan entity or a model part becomes a reference. */
export type CanvasPickRequest = { prompt: string; intent?: string; accept: Array<"architect-entity" | "source-part">; startedAt: number };
export const useCanvasPick = create<{
  request: CanvasPickRequest | null;
  start: (request: Omit<CanvasPickRequest, "startedAt">) => void;
  cancel: () => void;
  resolve: (ref: CanvasReference) => boolean;
}>((set, get) => ({
  request: null,
  start: request => set({ request: { ...request, startedAt: Date.now() } }),
  cancel: () => set({ request: null }),
  resolve: ref => {
    const request = get().request;
    if (!request || ref.kind === "view" || !request.accept.includes(ref.kind)) return false;
    set({ request: null });
    insertReference(ref, request.intent);
    return true;
  },
}));
