import { fitAssistantRect, type AssistantRect, type AssistantViewport } from "./panelGeometry.ts";

/**
 * Corner resizing for the live assistant panel: any of the four corners can be pinched while the
 * opposite corner stays fixed. Pure geometry; `useAssistantPanel` supplies the pointer deltas.
 */
export type Corner = "nw" | "ne" | "sw" | "se";
export const CORNERS: readonly Corner[] = ["nw", "ne", "sw", "se"];
export type CornerHitBox = { corner: Corner; x: number; y: number; size: number };
export type ResizeLimits = { minWidth?: number; minHeight?: number };

// Mirrors the private constants in panelGeometry.ts (MARGIN = 12, LAUNCHER = 52, 300 px minimum side).
// Keep them in step: fitAssistantRect() re-applies the same margins after every corner resize here.
const MARGIN = 12;
const LAUNCHER = 52;
const MIN_SIDE = 300;
/** Touch-sized square at each corner (WCAG 2.5.5 target size). */
export const CORNER_HIT_SIZE = 44;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

/**
 * Grows or shrinks `rect` by the pointer delta at `corner`, keeping the opposite corner fixed.
 * Sizes are capped at the viewport edge on the moving side, so the panel never slides to make room
 * (unlike the legacy top-right `changeAssistantRect(..., "resize")`, which lets fitAssistantRect shift it).
 */
export function resizeAssistantRectFromCorner(
  rect: AssistantRect,
  corner: Corner,
  dx: number,
  dy: number,
  viewport: AssistantViewport,
  limits: ResizeLimits = {},
): AssistantRect {
  const minWidth = Math.min(limits.minWidth ?? MIN_SIDE, viewport.width - MARGIN * 2);
  const minHeight = Math.min(limits.minHeight ?? MIN_SIDE, viewport.height - MARGIN * 2 - LAUNCHER);
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const east = corner === "ne" || corner === "se";
  const south = corner === "sw" || corner === "se";
  const width = east
    ? clamp(rect.width + dx, minWidth, viewport.width - MARGIN - rect.x)
    : clamp(rect.width - dx, minWidth, right - MARGIN);
  const height = south
    ? clamp(rect.height + dy, minHeight, viewport.height - LAUNCHER - MARGIN - rect.y)
    : clamp(rect.height - dy, minHeight, bottom - MARGIN);
  return fitAssistantRect(
    { width, height, x: east ? rect.x : right - width, y: south ? rect.y : bottom - height },
    viewport,
  );
}

/** Four hit boxes in the same coordinate space as `rect`, shrunk when the panel is smaller than two boxes. */
export function cornerHitBoxes(rect: AssistantRect, size = CORNER_HIT_SIZE): CornerHitBox[] {
  const side = Math.max(0, Math.min(size, rect.width, rect.height));
  const right = rect.x + rect.width - side;
  const bottom = rect.y + rect.height - side;
  return [
    { corner: "nw", x: rect.x, y: rect.y, size: side },
    { corner: "ne", x: right, y: rect.y, size: side },
    { corner: "sw", x: rect.x, y: bottom, size: side },
    { corner: "se", x: right, y: bottom, size: side },
  ];
}

/** Which corner a pointer at (px, py) lands on, or null when it is on the panel body or outside it. */
export function cornerAtPoint(
  rect: AssistantRect,
  px: number,
  py: number,
  size = CORNER_HIT_SIZE,
): Corner | null {
  for (const box of cornerHitBoxes(rect, size))
    if (px >= box.x && px < box.x + box.size && py >= box.y && py < box.y + box.size) return box.corner;
  return null;
}

export function cornerCursor(corner: Corner): "nwse-resize" | "nesw-resize" {
  return corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize";
}
