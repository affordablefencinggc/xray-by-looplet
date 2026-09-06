import type { BuildingPart, SourceBuilding } from "./sourceBuilding.ts";
export type PlanBounds = [number, number, number, number];
export type LocationNote = {
  roomName: string;
  roomBounds: PlanBounds | null;
  note: string;
  updatedAt: string;
};
export const emptyLocation = (): LocationNote => ({
  roomName: "",
  roomBounds: null,
  note: "",
  updatedAt: "",
});
export const floorKey = (p: BuildingPart) => p.storey ?? p.level ?? "unknown";
export function planBounds(parts: BuildingPart[]): PlanBounds {
  let x0 = Infinity,
    z0 = Infinity,
    x1 = -Infinity,
    z1 = -Infinity;
  for (const p of parts)
    for (let i = 0; i < p.positions.length; i += 3) {
      x0 = Math.min(x0, p.positions[i]);
      x1 = Math.max(x1, p.positions[i]);
      z0 = Math.min(z0, p.positions[i + 2]);
      z1 = Math.max(z1, p.positions[i + 2]);
    }
  return Number.isFinite(x0) ? [x0, z0, x1, z1] : [0, 0, 1, 1];
}
export function locationKey(model: SourceBuilding, part: BuildingPart) {
  return `xray.component-location.v1:${model.source.sha256}:${part.id}`;
}
export function partMapBounds(part: BuildingPart, room: PlanBounds | null): PlanBounds {
  const p = planBounds([part]);
  const b: PlanBounds = room
    ? [
        Math.min(p[0], room[0]),
        Math.min(p[1], room[1]),
        Math.max(p[2], room[2]),
        Math.max(p[3], room[3]),
      ]
    : p;
  const pad = room ? 1 : Math.max(2, (b[2] - b[0]) * 0.4, (b[3] - b[1]) * 0.4);
  return [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad];
}
export function validateLocation(
  value: unknown,
  model: SourceBuilding,
  part: BuildingPart,
): LocationNote {
  const v = value as LocationNote;
  if (
    !v ||
    typeof v.roomName !== "string" ||
    v.roomName.length > 100 ||
    typeof v.note !== "string" ||
    v.note.length > 2000 ||
    typeof v.updatedAt !== "string"
  )
    throw Error("Location details are invalid.");
  if (v.roomBounds !== null) {
    const b = v.roomBounds,
      f = planBounds(model.objects.filter((p) => floorKey(p) === floorKey(part)));
    if (
      !Array.isArray(b) ||
      b.length !== 4 ||
      !b.every(Number.isFinite) ||
      b[0] >= b[2] ||
      b[1] >= b[3] ||
      b[0] < f[0] ||
      b[1] < f[1] ||
      b[2] > f[2] ||
      b[3] > f[3] ||
      !v.roomName.trim()
    )
      throw Error("Name the room and mark an area inside this floor.");
  }
  return { roomName: v.roomName, roomBounds: v.roomBounds, note: v.note, updatedAt: v.updatedAt };
}
