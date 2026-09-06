import { Vector3 } from "three";

// Looplet CRM canvas cameraFilm timing; React Flow's cubic-in-out easing.
export const INSPECTION_DURATION = 900;
export const INSPECTION_STANDOFF = 20;

export function inspectionPath(from: Vector3, target: Vector3, forward: Vector3, right: Vector3, up: Vector3, surfaceDistance: number) {
  const nearby = surfaceDistance <= INSPECTION_STANDOFF;
  const offset = target.clone().sub(from);
  let shift: Vector3;
  if (nearby) {
    // Stay in the starting camera's image plane: no forward/backward travel.
    shift = offset.clone().addScaledVector(forward, -offset.dot(forward)).multiplyScalar(0.25);
    if (shift.length() < 0.15) shift.copy(right).multiplyScalar(0.5);
    shift.clampLength(0, 1.5);
  } else {
    // Never use the approach itself to cross the 20 m stand-off boundary.
    const travel = Math.min(offset.length() * 0.25, surfaceDistance - INSPECTION_STANDOFF);
    shift = offset.clone().normalize().multiplyScalar(travel);
  }
  const arc = nearby
    ? forward.clone().cross(shift).normalize().multiplyScalar(Math.min(0.35, shift.length() * 0.2))
    : up.clone().multiplyScalar(Math.min(2, shift.length() * 0.1));
  return { from: from.clone(), to: from.clone().add(shift), arc, nearby };
}

export function inspectionEase(progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function sampleInspectionPath(path: ReturnType<typeof inspectionPath>, progress: number, out = new Vector3()) {
  const eased = inspectionEase(progress);
  return out.lerpVectors(path.from, path.to, eased).addScaledVector(path.arc, Math.sin(Math.PI * eased));
}
