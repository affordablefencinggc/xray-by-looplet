export const RAIL_WIDTHS_CHANGED_EVENT = "xray:rail-widths-changed";
export const CLOSE_SETTINGS_EVENT = "xray:close-settings";
export const RAIL_LAYOUT_KEY = "xray.rail-layout.v1";
export const DEFAULT_RAILS = { left: 260, right: 400 };
export type RailWidths = typeof DEFAULT_RAILS;
export function railWidth(
  side: keyof RailWidths,
  value: number,
  viewport: number,
  other: number,
): number {
  const min = side === "left" ? 200 : 320,
    max = side === "left" ? 440 : 1000;
  return Math.round(
    Math.max(
      min,
      Math.min(
        max,
        Number.isFinite(value) ? value : DEFAULT_RAILS[side],
        Math.max(min, viewport - other - 420),
      ),
    ),
  );
}
export function readRailWidths(raw: string | null): RailWidths {
  try {
    const v = JSON.parse(raw ?? "null");
    if (!v || !Number.isFinite(v.left) || !Number.isFinite(v.right)) return { ...DEFAULT_RAILS };
    return {
      left: railWidth("left", v.left, 2000, 0),
      right: railWidth("right", v.right, 2000, 0),
    };
  } catch {
    return { ...DEFAULT_RAILS };
  }
}
