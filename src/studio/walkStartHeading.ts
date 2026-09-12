/** Plan +Z points down; the camera faces (-sin(yaw), 0, -cos(yaw)). */
export function walkStartYaw(origin: { x: number; z: number }, target: { x: number; z: number }, previous = 0): number {
  const dx = target.x - origin.x, dz = target.z - origin.z;
  if (![dx, dz].every(Number.isFinite) || Math.hypot(dx, dz) < 1e-6) return previous;
  return Math.atan2(-dx, -dz);
}
