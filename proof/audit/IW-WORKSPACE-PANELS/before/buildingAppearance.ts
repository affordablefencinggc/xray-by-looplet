export const APPEARANCE_KEY = "xray.building-appearance.v1";
export const VISUAL_PRESETS = [
  { id: "chrome", name: "Chrome", background: "#E4E6E9", wire: "#414952" },
  { id: "silver", name: "Silver / white", background: "#737A84", wire: "#FFFFFF" },
  { id: "gold", name: "Obsidian / gold", background: "#090B0E", wire: "#D7B96E" },
  { id: "paper", name: "Paper / graphite", background: "#FFFFFF", wire: "#34383E" },
  { id: "blueprint", name: "Blueprint", background: "#102A45", wire: "#BFDFF5" },
  { id: "carbon", name: "Carbon", background: "#252A31", wire: "#E0E6ED" },
  { id: "ivory", name: "Ivory", background: "#ECE8DF", wire: "#514C43" },
  { id: "slate", name: "Slate", background: "#526170", wire: "#E7EBF0" },
  { id: "parchment", name: "Parchment", background: "#E8DEC7", wire: "#695544" },
  { id: "cobalt", name: "Cobalt", background: "#14255F", wire: "#DBE4FF" },
  { id: "midnight", name: "Midnight", background: "#151827", wire: "#9CB5E3" },
  { id: "platinum", name: "Platinum", background: "#BFC3CA", wire: "#292C33" },
] as const;
export type BuildingAppearance = {
  preset: string;
  background: string;
  wire: string;
  opacity: number;
  lighting: number;
  shadows: boolean;
};
export const DEFAULT_APPEARANCE: BuildingAppearance = {
  background: VISUAL_PRESETS[0].background,
  wire: VISUAL_PRESETS[0].wire,
  preset: VISUAL_PRESETS[0].id,
  opacity: 0.82,
  lighting: 1,
  shadows: true,
};
export function presetAppearance(id: string): BuildingAppearance {
  const preset = VISUAL_PRESETS.find((p) => p.id === id);
  if (!preset) throw Error("Unknown visual preset.");
  return {
    preset: id,
    background: preset.background,
    wire: preset.wire,
    opacity: 0.82,
    lighting: 1,
    shadows: true,
  };
}
export function parseBuildingAppearance(value: unknown): BuildingAppearance {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid visual preferences.");
  const v = value as Record<string, unknown>;
  if (
    typeof v.preset !== "string" ||
    !(v.preset === "custom" || VISUAL_PRESETS.some((p) => p.id === v.preset)) ||
    typeof v.background !== "string" ||
    !/^#[\da-f]{6}$/i.test(v.background) ||
    typeof v.wire !== "string" ||
    !/^#[\da-f]{6}$/i.test(v.wire) ||
    typeof v.opacity !== "number" ||
    !Number.isFinite(v.opacity) ||
    v.opacity < 0.1 ||
    v.opacity > 1 ||
    typeof v.lighting !== "number" ||
    !Number.isFinite(v.lighting) ||
    v.lighting < 0.2 ||
    v.lighting > 2 ||
    typeof v.shadows !== "boolean"
  )
    throw Error("Invalid visual preferences.");
  return {
    preset: v.preset,
    background: v.background.toUpperCase(),
    wire: v.wire.toUpperCase(),
    opacity: v.opacity,
    lighting: v.lighting,
    shadows: v.shadows,
  };
}
export function nextPreset(current: string): BuildingAppearance {
  const i = VISUAL_PRESETS.findIndex((p) => p.id === current);
  return presetAppearance(VISUAL_PRESETS[(i + 1) % VISUAL_PRESETS.length].id);
}
export function loadAppearance(storage: Pick<Storage, "getItem">): BuildingAppearance {
  try {
    const raw = storage.getItem(APPEARANCE_KEY);
    return raw ? parseBuildingAppearance(JSON.parse(raw)) : { ...DEFAULT_APPEARANCE };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}
export function saveAppearance(storage: Pick<Storage, "setItem">, value: BuildingAppearance) {
  storage.setItem(APPEARANCE_KEY, JSON.stringify(parseBuildingAppearance(value)));
}
