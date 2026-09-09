import type { CanvasReference } from "./assistant/canvasReference";

/**
 * Pure model for the canvas right-click menu: which canvas a contextmenu event belongs to,
 * the AI items offered for a target, viewport clamping, the "did the pointer drag" rule that
 * keeps right-drag panning working, and web-only filtering. No DOM or React here; the
 * component in CanvasContextMenu.tsx wires it to document-level listeners.
 */

/** The structural subset of Element the resolvers read; real Elements satisfy it and tests pass plain fakes. */
export type ElementProbe = {
  matches(selectors: string): boolean;
  closest(selectors: string): ElementProbe | null;
  getAttribute(name: string): string | null;
  querySelector?(selectors: string): ElementProbe | null;
};

export const ARCHITECT_PLAN_SELECTOR = "svg.architect-plan";
export const ARCHITECT_WORKSPACE_SELECTOR = ".architect-workspace";
export const ARCHITECT_3D_SELECTOR = 'canvas[aria-label="Live architectural 3D model"]';
export const BUILDING_CANVAS_SELECTOR = ".building-canvas";
export const MEASURE_WORKSPACE_SELECTOR = ".measure-workspace";
export const MEASURE_SURFACE_SELECTOR = "canvas, img, svg";
const MEASURE_EXCLUDED_SELECTOR = ".measure-inspector";
const ENTITY_SELECTOR = "[data-entity-id]";

export type MenuTarget =
  | { kind: "architect-plan"; entityId: string | null }
  | { kind: "architect-3d"; designRevision: string | null }
  | { kind: "source-building"; selectedPart: string | null }
  | { kind: "source-sheet" };

/** Which canvas (if any) the right-clicked element belongs to. Null means "leave the browser menu alone". */
export function resolveMenuTarget(element: ElementProbe | null): MenuTarget | null {
  if (!element) return null;
  if (element.closest(ARCHITECT_PLAN_SELECTOR))
    return { kind: "architect-plan", entityId: element.closest(ENTITY_SELECTOR)?.getAttribute("data-entity-id") || null };
  const three = element.closest(ARCHITECT_3D_SELECTOR);
  if (three) return { kind: "architect-3d", designRevision: three.closest(ARCHITECT_WORKSPACE_SELECTOR)?.getAttribute("data-design-revision") || null };
  const building = element.closest(BUILDING_CANVAS_SELECTOR);
  if (building) {
    const canvas = element.closest("canvas") ?? building.querySelector?.("canvas") ?? null;
    return { kind: "source-building", selectedPart: canvas?.getAttribute("data-selected-part") || null };
  }
  if (element.closest(MEASURE_WORKSPACE_SELECTOR) && !element.closest(MEASURE_EXCLUDED_SELECTOR) && element.closest(MEASURE_SURFACE_SELECTOR))
    return { kind: "source-sheet" };
  return null;
}

export type PickTarget = { kind: "architect-entity"; entityId: string } | { kind: "source-building" };

/** In "select a shape" mode: a plan entity resolves immediately, a model click waits for the viewer's selection. */
export function resolvePickTarget(element: ElementProbe | null): PickTarget | null {
  if (!element) return null;
  if (element.closest(ARCHITECT_PLAN_SELECTOR)) {
    const entityId = element.closest(ENTITY_SELECTOR)?.getAttribute("data-entity-id");
    return entityId ? { kind: "architect-entity", entityId } : null;
  }
  if (element.closest(BUILDING_CANVAS_SELECTOR)) return { kind: "source-building" };
  return null;
}

export const CANVAS_INTENTS = Object.freeze({
  explain: "Explain this element and how it relates to the rest of the design.",
  improve: "Suggest specific improvements for this. List the exact edits with IDs before making any change.",
  draw: "Draw a similar element next to this one on the same level. Ask before overlapping existing elements.",
  render: "Generate a real-life render of this view.",
});
export const PICK_PROMPT = "Click a shape to reference it";
export const PICK_ACCEPT: ReadonlyArray<"architect-entity" | "source-part"> = ["architect-entity", "source-part"];
export const MODIFY_PLACEHOLDER = "e.g. make this wall 3 m longer";

export type MenuAction = { type: "insert"; intent?: string } | { type: "modify" } | { type: "pick" } | { type: "note" };
export type MenuItem = { id: string; label: string; action: MenuAction; disabled?: boolean; webOnly?: boolean };

/** Web-only items (AI rendering) are hidden in the native shell where rendering is unavailable. */
export function filterForShell(items: MenuItem[], native: boolean): MenuItem[] {
  return native ? items.filter(item => !item.webOnly) : items;
}

/** Entity references get every AI action; view references skip "draw something like this"; nothing here sends anything. */
export function menuItemsFor(ref: CanvasReference, options: { native: boolean; awaitingSelection?: boolean }): MenuItem[] {
  const view = ref.kind === "view";
  const items: MenuItem[] = [{ id: "reference", label: view ? "Reference this view in chat" : "Reference in chat", action: { type: "insert" } }];
  if (options.awaitingSelection) items.push({ id: "select-note", label: "Select a part first (left-click it)", action: { type: "note" }, disabled: true });
  items.push(
    { id: "explain", label: "Explain this", action: { type: "insert", intent: CANVAS_INTENTS.explain } },
    { id: "improve", label: "Suggest improvements", action: { type: "insert", intent: CANVAS_INTENTS.improve } },
    { id: "modify", label: "Modify with AI…", action: { type: "modify" } },
  );
  if (!view) items.push({ id: "draw", label: "Draw something like this here", action: { type: "insert", intent: CANVAS_INTENTS.draw } });
  items.push(
    { id: "render", label: "Real-life view of this", action: { type: "insert", intent: CANVAS_INTENTS.render }, webOnly: true },
    { id: "pick", label: "Select a shape to reference…", action: { type: "pick" } },
  );
  return filterForShell(items, options.native);
}

const VIEW_TITLES: Record<Extract<CanvasReference, { kind: "view" }>["target"], string> = {
  "architect-plan": "Architectural plan view",
  "architect-3d": "Architectural 3D view",
  "source-building": "Model viewer view",
  "source-sheet": "Source sheet view",
};

/** The two-line caption at the top of the menu so the user sees exactly what will be referenced. */
export function menuCaption(ref: CanvasReference): { title: string; detail: string } {
  if (ref.kind === "architect-entity")
    return { title: `${ref.entity} · ${ref.id}`, detail: ref.levelName ? `Level ${ref.levelName}` : "Architectural design" };
  if (ref.kind === "source-part")
    return { title: `${ref.category} · ${ref.label}`, detail: `${ref.building} part ${ref.partId}${ref.storey ? ` · storey ${ref.storey}` : ""}` };
  return { title: VIEW_TITLES[ref.target], detail: ref.summary };
}

/** The fields the view summaries read from an architect design; the bridge's read result satisfies it. */
export type ArchitectSummarySource = { name?: string; revision?: number; levels: readonly unknown[]; walls: readonly unknown[]; openings: readonly unknown[] };
const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
const designSummary = (project: ArchitectSummarySource) =>
  `${project.name ? `"${project.name}"` : "design"}${project.revision !== undefined ? ` revision ${project.revision}` : ""}: ${count(project.levels.length, "level")}, ${count(project.walls.length, "wall")}, ${count(project.openings.length, "opening")}`;

export function architectPlanViewReference(project: ArchitectSummarySource | null): CanvasReference {
  return { kind: "view", target: "architect-plan", summary: project ? `architectural plan of ${designSummary(project)}` : "current architectural plan view" };
}
export function architect3dViewReference(project: ArchitectSummarySource | null, designRevision: string | null): CanvasReference {
  const summary = project
    ? `current 3D view of the architectural ${designSummary(project)}`
    : `current 3D view of the architectural design${designRevision ? `, revision ${designRevision}` : ""}`;
  return { kind: "view", target: "architect-3d", summary };
}
export function sourceBuildingViewReference(building: { id: string; title: string } | null): CanvasReference {
  return { kind: "view", target: "source-building", summary: building ? `current Model viewer 3D view of "${building.title}" (${building.id})` : "current Model viewer 3D view" };
}
export function sheetViewReference(documentName: string | null, sheetIndex: number): CanvasReference {
  return { kind: "view", target: "source-sheet", summary: documentName ? `"${documentName}", sheet ${sheetIndex + 1}` : `sheet ${sheetIndex + 1}, no source document loaded` };
}

export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export const MENU_VIEWPORT_MARGIN = 8;

/** Keeps the whole menu inside the viewport; a menu taller than the viewport pins to the top-left margin. */
export function clampMenuPosition(anchor: Point, menu: Size, viewport: Size, margin = MENU_VIEWPORT_MARGIN): Point {
  const maxX = Math.max(margin, viewport.width - margin - menu.width);
  const maxY = Math.max(margin, viewport.height - margin - menu.height);
  return { x: Math.round(Math.min(Math.max(anchor.x, margin), maxX)), y: Math.round(Math.min(Math.max(anchor.y, margin), maxY)) };
}

export const CONTEXT_MENU_DRAG_THRESHOLD_PX = 4;
/** A press older than this is not the gesture that produced the contextmenu event (keyboard menu key, menu button). */
export const CONTEXT_MENU_PRESS_MAX_AGE_MS = 2500;
export type PointerPress = { x: number; y: number; travelled: number; at: number };

export const beginPress = (x: number, y: number, at: number): PointerPress => ({ x, y, travelled: 0, at });
export function trackPress(press: PointerPress, x: number, y: number): PointerPress {
  const travelled = Math.hypot(x - press.x, y - press.y);
  return travelled > press.travelled ? { ...press, travelled } : press;
}
/** The menu opens only for a still right-click; a right-drag (pan) never opens it. No press means a keyboard-invoked menu. */
export function pressStayedPut(press: PointerPress | null, point: Point, now: number, threshold = CONTEXT_MENU_DRAG_THRESHOLD_PX, maxAgeMs = CONTEXT_MENU_PRESS_MAX_AGE_MS): boolean {
  if (!press || now - press.at > maxAgeMs) return true;
  return press.travelled <= threshold && Math.hypot(point.x - press.x, point.y - press.y) <= threshold;
}

export function nextMenuIndex(current: number, delta: 1 | -1, total: number): number {
  if (total <= 0) return -1;
  if (current < 0 || current >= total) return delta > 0 ? 0 : total - 1;
  return (current + delta + total) % total;
}
/** Arrow keys wrap, Home/End jump; null means the key is not a menu navigation key. */
export function menuIndexForKey(key: string, current: number, total: number): number | null {
  if (key === "ArrowDown") return nextMenuIndex(current, 1, total);
  if (key === "ArrowUp") return nextMenuIndex(current, -1, total);
  if (key === "Home") return total > 0 ? 0 : -1;
  if (key === "End") return total - 1;
  return null;
}

export const PICK_SELECTION_POLL_MS = 50;
export const PICK_SELECTION_TIMEOUT_MS = 600;
/** A same-as-before value needs this long to count as the viewer's answer to the new click rather than a stale one. */
export const PICK_SELECTION_SETTLE_MS = 150;
/** Accepts the viewer's data-selected-part once it changed, or once the old value has clearly survived the click. */
export function acceptSelectedPart(before: string | null, value: string | null, elapsedMs: number): string | null {
  if (!value) return null;
  return value !== before || elapsedMs >= PICK_SELECTION_SETTLE_MS ? value : null;
}
