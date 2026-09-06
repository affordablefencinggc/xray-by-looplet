export type NavigationMode = "orbit" | "fly" | "walk";
export function movementVector(
  keys: ReadonlySet<string>,
  yaw: number,
  pitch: number,
  mode: NavigationMode,
): [number, number, number] {
  const forward = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0),
    right = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
    p = mode === "walk" ? 0 : pitch;
  const up =
    mode === "fly"
      ? (keys.has("Space") ? 1 : 0) - (keys.has("ControlLeft") || keys.has("ControlRight") ? 1 : 0)
      : 0;
  const v: [number, number, number] = [
    -Math.sin(yaw) * Math.cos(p) * forward + Math.cos(yaw) * right,
    Math.sin(p) * forward + up,
    -Math.cos(yaw) * Math.cos(p) * forward - Math.sin(yaw) * right,
  ];
  const length = Math.hypot(...v);
  return length > 0 ? (v.map((n) => n / length) as [number, number, number]) : v;
}
