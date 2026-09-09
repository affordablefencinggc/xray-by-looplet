/** Illustrative display materials only; no product specification or evidence status. */
export const SURFACE_APPEARANCES = {
  slab: { color: '#b5b7b3', roughness: 0.8, opacity: 1, metalness: 0 },
  water: { color: '#329bb7', roughness: 0.15, opacity: 0.82, metalness: 0.1 },
  planting: { color: '#537b3d', roughness: 0.95, opacity: 1, metalness: 0 },
  grass: { color: '#779a50', roughness: 0.95, opacity: 1, metalness: 0 },
  soil: { color: '#81654d', roughness: 1, opacity: 1, metalness: 0 },
} as const;
export function surfaceMaterialKey(material: string): keyof typeof SURFACE_APPEARANCES {
  const key = material.trim().toLowerCase();
  return ['water', 'planting', 'grass', 'soil'].includes(key) ? key as keyof typeof SURFACE_APPEARANCES : 'slab';
}
