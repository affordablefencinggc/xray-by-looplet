/**
 * Assistant rail mode: one small button on the right-hand menu turns that whole
 * menu into the Live assistant (full height, same width, same seam). The panel
 * itself is untouched; the rails container publishes the rail box and a root
 * attribute, and `assistantRail.css` docks the existing panel into that box.
 * Desktop and tablet only (the rails are not measured under 941 px).
 */
export const ASSISTANT_RAIL_KEY = "xray:assistant-rail:v3";
/** Dispatched on window by the panel's own dock/undock header button; WorkspaceRails toggles rail mode on it. */
export const ASSISTANT_RAIL_TOGGLE_EVENT = "xray:assistant-rail-toggle";
export const ASSISTANT_RAIL_MIN_VIEWPORT = 941;
export type RailBox = { left: number; top: number; height: number };
export type AssistantRailBox = { left: number; top: number; width: number; height: number };
export type RailState = { rail: boolean; rightCollapsed: boolean };
export type RailAction = "toggle-rail" | "collapse-right" | "expand-right" | "assistant-closed";

export function readAssistantRail(raw: string | null): boolean {
  // The right column is the assistant unless the user has chosen the floating panel.
  if (raw === null || raw === "") return true;
  return raw !== "0" && raw !== "false";
}
export function serializeAssistantRail(on: boolean): string {
  return on ? "1" : "0";
}
export function assistantRailAllowed(viewportWidth: number): boolean {
  return Number.isFinite(viewportWidth) && viewportWidth >= ASSISTANT_RAIL_MIN_VIEWPORT;
}
/** The box the docked assistant fills: from the measured seam of the right menu to the viewport edge. */
export function assistantRailBox(rail: RailBox | null, viewportWidth: number, viewportHeight: number): AssistantRailBox | null {
  if (!rail || !assistantRailAllowed(viewportWidth)) return null;
  const left = Math.max(0, Math.min(rail.left, viewportWidth - 320));
  const top = Math.max(0, rail.top);
  const height = Math.max(240, Math.min(rail.height, viewportHeight - top));
  return { left, top, width: viewportWidth - left, height };
}
/**
 * State machine for the two toggles that share the right menu. Entering rail mode
 * needs the menu expanded (its box is the dock). Collapsing preserves docking preference.
 * Only the explicit dock/undock control changes that preference. Closing keeps the column: the launcher
 * stays at the bottom of that rail instead of turning into a box at the top of the page.
 */
export function nextRailState(current: RailState, action: RailAction): RailState {
  switch (action) {
    case "toggle-rail":
      return current.rail ? { ...current, rail: false } : { rail: true, rightCollapsed: false };
    case "collapse-right":
      return { ...current, rightCollapsed: true };
    case "expand-right":
      return { ...current, rightCollapsed: false };
    case "assistant-closed":
      return current;
  }
}
/** CSS custom properties published on the document root for the docked panel. */
export function assistantRailVars(box: AssistantRailBox | null): Record<string, string> {
  if (!box) return {};
  return {
    "--assistant-rail-left": `${Math.round(box.left)}px`,
    "--assistant-rail-top": `${Math.round(box.top)}px`,
    "--assistant-rail-width": `${Math.round(box.width)}px`,
    "--assistant-rail-height": `${Math.round(box.height)}px`,
  };
}
