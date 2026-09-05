export type ModelScopeOptions = { enabled: boolean; zoom: number; diameter: number };
type Point = { x: number; y: number };
export type ScopeFrame = {
  width: number;
  height: number;
  diameter: number;
  pixels: number;
  left: number;
  top: number;
  sampleLeft: number;
  sampleTop: number;
  sampleSize: number;
};
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const finite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);

export function normalizeScopeOptions(options: ModelScopeOptions): ModelScopeOptions {
  return {
    enabled: options.enabled === true,
    zoom: clamp(finite(options.zoom, 4), 2, 8),
    diameter: clamp(finite(options.diameter, 240), 160, 360),
  };
}

/** Input and crop coordinates stay in CSS pixels; DPR affects resolution only. */
export function scopePointer(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  width: number,
  height: number,
): Point | null {
  if (
    ![clientX, clientY, rect.left, rect.top, rect.width, rect.height, width, height].every(
      Number.isFinite,
    ) ||
    rect.width <= 0 ||
    rect.height <= 0 ||
    width <= 0 ||
    height <= 0
  )
    return null;
  const x = ((clientX - rect.left) * width) / rect.width;
  const y = ((clientY - rect.top) * height) / rect.height;
  return x < 0 || y < 0 || x > width || y > height ? null : { x, y };
}

export function scopeFrame(
  width: number,
  height: number,
  point: Point,
  options: ModelScopeOptions,
  dpr: number,
): ScopeFrame | null {
  if (![width, height, point.x, point.y].every(Number.isFinite) || width < 1 || height < 1)
    return null;
  const normalized = normalizeScopeOptions(options);
  const diameter = Math.min(normalized.diameter, width, height);
  const sampleSize = diameter / normalized.zoom;
  return {
    width,
    height,
    diameter,
    pixels: Math.max(1, Math.min(720, Math.round(diameter * clamp(finite(dpr, 1), 1, 2)))),
    left: clamp(point.x - diameter / 2, 0, width - diameter),
    top: clamp(point.y - diameter / 2, 0, height - diameter),
    // The lens box is bounded, but its crosshair must retain the exact pointer ray.
    // Negative view offsets are valid: at an edge, inspect just beyond the main view.
    sampleLeft: clamp(point.x, 0, width) - sampleSize / 2,
    sampleTop: clamp(point.y, 0, height) - sampleSize / 2,
    sampleSize,
  };
}

export type ScopePoint = { x: number; y: number };
export type PrecisionFrame = {
  left: number;
  top: number;
  diameter: number;
  sampleLeft: number;
  sampleTop: number;
  sampleSize: number;
};

export function insideScope(point: ScopePoint, frame: PrecisionFrame): boolean {
  const radius = frame.diameter / 2;
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    radius > 0 &&
    Math.hypot(point.x - frame.left - radius, point.y - frame.top - radius) <= radius
  );
}

/** Inverse of the displayed lens transform, in the main viewport's CSS pixels. */
export function throughScope(point: ScopePoint, frame: PrecisionFrame): ScopePoint {
  if (!insideScope(point, frame)) return point;
  return {
    x: frame.sampleLeft + ((point.x - frame.left) * frame.sampleSize) / frame.diameter,
    y: frame.sampleTop + ((point.y - frame.top) * frame.sampleSize) / frame.diameter,
  };
}

export function scopeWheelZoom(zoom: number, deltaY: number, deltaMode = 0): number {
  const current = Math.max(2, Math.min(8, Number.isFinite(zoom) ? zoom : 4));
  if (!Number.isFinite(deltaY)) return current;
  const pixels = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? 240 : 1);
  return (
    Math.round(
      Math.max(2, Math.min(8, current * Math.exp(-Math.max(-600, Math.min(600, pixels)) * 0.002))) *
        100,
    ) / 100
  );
}

/** The circle, not its rectangular DOM bounds, owns the wheel event. */
export function routeScopeWheel(
  event: Pick<WheelEvent, "deltaY" | "deltaMode" | "preventDefault" | "stopImmediatePropagation">,
  point: ScopePoint,
  frame: PrecisionFrame | null,
  zoom: number,
  update: (zoom: number) => void,
): boolean {
  if (!frame || !insideScope(point, frame)) return false;
  event.preventDefault();
  event.stopImmediatePropagation();
  update(scopeWheelZoom(zoom, event.deltaY, event.deltaMode));
  return true;
}

/** Three tapered posts: left, right, bottom. The upper field remains clear. */
export function drawScopeReticle(
  ctx: CanvasRenderingContext2D,
  diameter: number,
  zoom: number,
  ink = "#20262d",
  rim = "#eef1f3",
) {
  const r = diameter / 2;
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(r, r, r - 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = rim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(r, r, r - 2, 0, Math.PI * 2);
  ctx.stroke();
  const post = (angle: number) => {
    ctx.save();
    ctx.translate(r, r);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-r + 4, -4);
    ctx.lineTo(-22, -4);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-22, 4);
    ctx.lineTo(-r + 4, 4);
    ctx.closePath();
    ctx.fillStyle = ink;
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1.3;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };
  post(0);
  post(Math.PI);
  post(-Math.PI / 2);
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(r, r, 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(r, r, 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.fillRect(r - 33, diameter - 32, 66, 19);
  ctx.fillStyle = rim;
  ctx.font = "600 11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${Number(zoom.toFixed(2))}\u00d7 SCOPE`, r, diameter - 18);
  ctx.restore();
}
