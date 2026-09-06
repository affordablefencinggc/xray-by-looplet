export const APPEARANCE_KEY = "xray.building-appearance.v1";
export const MODEL_PALETTES = [
  { id: "source", name: "Source materials", color: "#C7C5BC", metalness: 0 },
  { id: "porcelain", name: "Porcelain", color: "#F4F0E8", metalness: 0 },
  { id: "titanium", name: "Titanium", color: "#8A9AA9", metalness: 0.55 },
  { id: "champagne", name: "Champagne", color: "#BD975C", metalness: 0.45 },
  { id: "terracotta", name: "Terracotta", color: "#BD6950", metalness: 0 },
  { id: "sage", name: "Sage", color: "#7C9A83", metalness: 0.1 },
  { id: "cobalt", name: "Cobalt", color: "#3E6BAA", metalness: 0.2 },
  { id: "carbon", name: "Carbon", color: "#353A41", metalness: 0.25 },
] as const;
export const ENVIRONMENTS = [
  { id: "studio", name: "Studio" },
  { id: "daylight", name: "Clear daylight" },
  { id: "sunset", name: "Golden sunset" },
  { id: "blue-hour", name: "Blue hour" },
  { id: "mist", name: "Morning mist" },
  { id: "storm", name: "Storm front" },
  { id: "cyclone", name: "Cyclonic sky" },
  { id: "midnight", name: "Midnight" },
] as const;
export type EnvironmentId = (typeof ENVIRONMENTS)[number]["id"];
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
  modelPalette: string;
  modelColor: string;
  environment: EnvironmentId;
  animateWeather: boolean;
  weatherIntensity: number;
};
export const DEFAULT_APPEARANCE: BuildingAppearance = {
  background: VISUAL_PRESETS[0].background,
  wire: VISUAL_PRESETS[0].wire,
  preset: VISUAL_PRESETS[0].id,
  opacity: 0.82,
  lighting: 1,
  shadows: true,
  modelPalette: "source",
  modelColor: "#C7C5BC",
  environment: "studio",
  animateWeather: true,
  weatherIntensity: 0.6,
};
export function presetAppearance(id: string): BuildingAppearance {
  const preset = VISUAL_PRESETS.find((p) => p.id === id);
  if (!preset) throw Error("Unknown visual preset.");
  return {
    ...DEFAULT_APPEARANCE,
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
  // Older appearance snapshots predate model colours and environments.
  const modelPalette = v.modelPalette ?? "source",
    modelColor = v.modelColor ?? "#C7C5BC";
  const environment = v.environment ?? "studio",
    animateWeather = v.animateWeather ?? true,
    weatherIntensity = v.weatherIntensity ?? 0.6;
  if (
    typeof modelPalette !== "string" ||
    !(modelPalette === "custom" || MODEL_PALETTES.some((p) => p.id === modelPalette)) ||
    typeof modelColor !== "string" ||
    !/^#[\da-f]{6}$/i.test(modelColor) ||
    !ENVIRONMENTS.some((e) => e.id === environment) ||
    typeof animateWeather !== "boolean" ||
    typeof weatherIntensity !== "number" ||
    !Number.isFinite(weatherIntensity) ||
    weatherIntensity < 0 ||
    weatherIntensity > 1
  )
    throw Error("Invalid model appearance.");
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
    modelPalette,
    modelColor: modelColor.toUpperCase(),
    environment: environment as EnvironmentId,
    animateWeather,
    weatherIntensity,
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
