import { useEffect, useRef } from "react";
import { drawScopeReticle, type ScopeFrame } from "./precisionScope";

export type DrawScopeScene = (context: CanvasRenderingContext2D, frame: ScopeFrame) => void;

export function PlanScope({
  frame,
  zoom,
  draw,
}: {
  frame: ScopeFrame;
  zoom: number;
  draw: DrawScopeScene | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !draw) return;
    canvas.width = canvas.height = frame.pixels;
    ctx.clearRect(0, 0, frame.pixels, frame.pixels);
    draw(ctx, frame);
    ctx.setTransform(frame.pixels / frame.diameter, 0, 0, frame.pixels / frame.diameter, 0, 0);
    drawScopeReticle(ctx, frame.diameter, zoom);
  }, [frame, zoom, draw]);
  return (
    <canvas
      ref={ref}
      className="plan-precision-lens"
      aria-hidden="true"
      data-plan-scope="true"
      data-reticle="three-post"
      data-zoom={zoom}
      data-sample={`${frame.sampleLeft},${frame.sampleTop},${frame.sampleSize}`}
      style={{ left: frame.left, top: frame.top, width: frame.diameter, height: frame.diameter }}
    />
  );
}
