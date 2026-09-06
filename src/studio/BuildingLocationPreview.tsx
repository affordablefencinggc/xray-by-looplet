import { useEffect, useRef } from "react";
import type { BuildingPart, SourceBuilding } from "./sourceBuilding";
import { floorKey } from "./componentLocation";

/** An isometric locator drawn from the same source meshes as the live model. */
export function BuildingLocationPreview({
  model,
  part,
}: {
  model: SourceBuilding;
  part: BuildingPart;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    level = floorKey(part);
  const storey = model.storeys?.find((s) => s.id === level);
  const elevation =
    storey?.elevation ??
    (level === "upper" ? model.floorElevations?.upper : model.floorElevations?.ground);
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const draw = () => {
      const w = node.clientWidth,
        h = node.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(devicePixelRatio, 2);
      node.width = w * dpr;
      node.height = h * dpr;
      const ctx = node.getContext("2d")!;
      ctx.scale(dpr, dpr);
      const css = getComputedStyle(node),
        dark = css.getPropertyValue("--color-ink").trim();
      const paper = css.getPropertyValue("--color-card").trim() || "#f3efe7";
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, w, h);
      const project = (x: number, y: number, z: number) => [(x - z) * 0.866, (x + z) * 0.35 - y];
      const relevant = model.objects.filter((p) =>
        ["slab", "roof", "wall", "column"].includes(p.category),
      );
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      for (const p of relevant)
        for (let i = 0; i < p.positions.length; i += 3) {
          const q = project(p.positions[i], p.positions[i + 1], p.positions[i + 2]);
          minX = Math.min(minX, q[0]);
          maxX = Math.max(maxX, q[0]);
          minY = Math.min(minY, q[1]);
          maxY = Math.max(maxY, q[1]);
        }
      const compact = Math.min(w, h) < 180,
        pad = compact ? 4 : 30,
        top = compact ? 4 : 38,
        bottom = compact ? 4 : 36;
      const scale = Math.min(
        (w - pad * 2) / Math.max(1, maxX - minX),
        (h - top - bottom) / Math.max(1, maxY - minY),
      );
      const ox = (w - (maxX - minX) * scale) / 2 - minX * scale,
        oy = top + (h - top - bottom - (maxY - minY) * scale) / 2 - minY * scale;
      const screen = (x: number, y: number, z: number) => {
        const p = project(x, y, z);
        return [ox + p[0] * scale, oy + p[1] * scale];
      };
      const groundY = model.bounds.min[1],
        cx = (model.bounds.min[0] + model.bounds.max[0]) / 2,
        cz = (model.bounds.min[2] + model.bounds.max[2]) / 2;
      const shadow = screen(cx, groundY, cz);
      ctx.save();
      ctx.translate(shadow[0], shadow[1]);
      ctx.scale(1, 0.28);
      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        (maxX - minX) * scale * 0.5,
        (maxX - minX) * scale * 0.4,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = "#30343b18";
      ctx.fill();
      ctx.restore();
      type Face = { p: number[][]; depth: number; shade: number; selected: boolean };
      const faces: Face[] = [];
      for (const object of relevant)
        for (let i = 0; i < object.indices.length; i += 3) {
          const v = object.indices
            .slice(i, i + 3)
            .map((index) => object.positions.slice(index * 3, index * 3 + 3));
          const a = v[0],
            b = v[1],
            c = v[2];
          const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
          faces.push({
            p: v.map((p) => screen(p[0], p[1], p[2])),
            depth: v.reduce((n, p) => n + p[0] + p[2] + p[1] * 0.05, 0) / 3,
            shade: Math.abs(ny) > 0.1 ? 0 : 1,
            selected: floorKey(object) === level,
          });
        }
      faces.sort((a, b) => a.depth - b.depth);
      for (const selected of [false, true])
        for (const face of faces) {
          if (face.selected !== selected) continue;
          ctx.beginPath();
          face.p.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
          ctx.closePath();
          ctx.fillStyle = selected
            ? face.shade
              ? "#b72b3b"
              : "#ef4b58"
            : face.shade
              ? "#a3adb1"
              : "#dce2e1";
          ctx.strokeStyle = selected ? "#a82b37" : "#76858a55";
          ctx.lineWidth = compact ? 0.25 : 0.45;
          ctx.fill();
          ctx.stroke();
        }
      if (!compact) {
        ctx.fillStyle = dark || "#27343a";
        ctx.font = "600 10px system-ui";
        ctx.fillText("BUILDING LOCATOR", 14, 20);
        ctx.fillStyle = "#b72b3b";
        ctx.font = "600 11px system-ui";
        ctx.fillText(storey?.label ?? level, 14, h - 18);
        ctx.fillStyle = dark || "#27343a";
        ctx.font = "10px system-ui";
        const datum =
          elevation === undefined
            ? "Source-linked floor"
            : `${elevation >= 0 ? "+" : ""}${elevation.toFixed(2)} m datum`;
        ctx.textAlign = "right";
        ctx.fillText(datum, w - 14, h - 18);
      }
    };
    const resize = new ResizeObserver(draw);
    resize.observe(node);
    draw();
    return () => resize.disconnect();
  }, [model, part, level, elevation, storey]);
  return (
    <div className="building-locator" data-map-kind="building" data-highlight={level}>
      <canvas
        ref={canvas}
        role="img"
        aria-label={`Building locator: ${storey?.label ?? level}, highlighted in red`}
      />
    </div>
  );
}
