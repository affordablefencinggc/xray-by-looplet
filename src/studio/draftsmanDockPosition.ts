/**
 * Pure horizontal-position maths for the Magic Pencil drafting dock.
 *
 * The dock sits on the bottom edge of its stage and can be dragged left/right.
 * Everything here is DOM-free so it can be unit tested with node --test:
 * clamping to the container, keyboard stepping, preset positions and the
 * localStorage (de)serialisation with defensive parsing of stored values.
 */

export const DRAFTSMAN_DOCK_STORAGE_KEY = "xray:draftsman-dock:v1";
export const DRAFTSMAN_DOCK_EDGE_MARGIN = 8;
export const DRAFTSMAN_DOCK_KEY_STEP = 16;

export type DockPreset = "bottom-left" | "bottom-center";

export interface DockBounds {
  /** Width of the containing block the dock is positioned inside (px). */
  containerWidth: number;
  /** Rendered width of the dock (px). */
  dockWidth: number;
  /** Gap kept between the dock and either edge (px). Defaults to 8. */
  margin?: number;
}

export interface DockStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Inclusive [min, max] range the dock's left edge may occupy. */
export function dockRange(bounds: DockBounds): { min: number; max: number } {
  const margin = finite(bounds.margin) ? Math.max(0, bounds.margin) : DRAFTSMAN_DOCK_EDGE_MARGIN;
  const container = finite(bounds.containerWidth) ? bounds.containerWidth : 0;
  const width = finite(bounds.dockWidth) ? bounds.dockWidth : 0;
  const min = margin;
  const max = Math.max(min, Math.round(container - width - margin));
  return { min, max };
}

/** Clamp a candidate left edge into the container; non-finite input snaps to the left edge. */
export function clampDockX(x: number, bounds: DockBounds): number {
  const { min, max } = dockRange(bounds);
  if (!finite(x)) return min;
  return Math.min(max, Math.max(min, Math.round(x)));
}

/** Left edge for the legacy presets (bottom-left / bottom-center). */
export function presetDockX(preset: DockPreset, bounds: DockBounds): number {
  const { min } = dockRange(bounds);
  if (preset === "bottom-center") {
    return clampDockX((bounds.containerWidth - bounds.dockWidth) / 2, bounds);
  }
  return min;
}

/** Resolve the initial left edge: a stored value wins (re-clamped), otherwise the preset. */
export function resolveDockX(stored: number | null, preset: DockPreset, bounds: DockBounds): number {
  if (stored !== null && finite(stored)) return clampDockX(stored, bounds);
  return presetDockX(preset, bounds);
}

/** Left edge during a pointer drag: the dock's start left edge plus the pointer delta, clamped. */
export function dragDockX(
  startX: number,
  pointerStartClientX: number,
  pointerClientX: number,
  bounds: DockBounds,
): number {
  return clampDockX(startX + (pointerClientX - pointerStartClientX), bounds);
}

/**
 * Keyboard handling for the grip. Returns the new left edge, or null when the
 * key is not a dock-moving key (so the caller leaves the event alone).
 */
export function stepDockX(
  x: number,
  key: string,
  bounds: DockBounds,
  step: number = DRAFTSMAN_DOCK_KEY_STEP,
): number | null {
  const { min, max } = dockRange(bounds);
  const current = clampDockX(x, bounds);
  switch (key) {
    case "ArrowLeft":
      return clampDockX(current - step, bounds);
    case "ArrowRight":
      return clampDockX(current + step, bounds);
    case "Home":
      return min;
    case "End":
      return max;
    default:
      return null;
  }
}

/** Serialise a left edge for localStorage. */
export function serializeDockX(x: number): string {
  return JSON.stringify({ v: 1, x: Math.round(x) });
}

/**
 * Parse a stored value. Accepts the v1 JSON envelope or a bare finite number;
 * anything else (garbage, NaN, Infinity, strings, objects without x) is ignored.
 */
export function parseStoredDockX(raw: unknown): number | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (finite(parsed)) return Math.round(parsed);
  if (parsed && typeof parsed === "object" && finite((parsed as { x?: unknown }).x)) {
    return Math.round((parsed as { x: number }).x);
  }
  return null;
}

/** Read the persisted left edge; storage failures (private mode, quota, SecurityError) yield null. */
export function readStoredDockX(
  storage: DockStorage | null | undefined,
  key: string = DRAFTSMAN_DOCK_STORAGE_KEY,
): number | null {
  if (!storage) return null;
  try {
    return parseStoredDockX(storage.getItem(key));
  } catch {
    return null;
  }
}

/** Persist the left edge; returns false when storage is unavailable or throws. */
export function writeStoredDockX(
  storage: DockStorage | null | undefined,
  x: number,
  key: string = DRAFTSMAN_DOCK_STORAGE_KEY,
): boolean {
  if (!storage || !finite(x)) return false;
  try {
    storage.setItem(key, serializeDockX(x));
    return true;
  } catch {
    return false;
  }
}
