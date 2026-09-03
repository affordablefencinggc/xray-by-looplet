import { useEffect, useRef, type PointerEvent } from "react";
import { HOUSE, PAL, PLAN, SHEETS, type Seg } from "./geometry";
import { useStudio } from "./store";
import { mountWireframe, type Elem } from "./wireframeGl";

function segsToElems(segs: Seg[], type: string, colour: string, pose: "standing" | "laid"): Elem[] {
  const yScale = pose === "laid" ? 0.02 : 1;
  return segs.map((seg) => ({
    type,
    colour,
    a: [seg[0], seg[2], seg[1] * yScale],
    b: [seg[3], seg[5], seg[4] * yScale],
  }));
}

export function IsoCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; az: number; el: number; pan: boolean } | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const viewer = mountWireframe(canvas, {
      getElements() {
        const s = useStudio.getState();
        const kind = SHEETS[s.sheet]?.kind ?? "elev";
        const geom = kind === "elev" || kind === "detail" ? HOUSE : PLAN;
        const navy = s.skin === "navy";
        const out: Elem[] = [];
        if (s.showSrc && s.showBld) {
          out.push(...segsToElems(geom.B, "building", navy ? PAL.cyan : PAL.planInk, s.pose));
        }
        if (s.showSrc && s.showRoof) {
          out.push(...segsToElems(geom.R, "roof", navy ? PAL.roof : "#c9a227", s.pose));
        }
        if (s.showMan) {
          for (const m of s.markups) {
            if (m.kind !== "sketch" && m.kind !== "length") continue;
            const pts = m.points;
            for (let i = 0; i < pts.length - 1; i++) {
              const y = s.height * (s.pose === "laid" ? 0.02 : 1);
              out.push({
                type: "manual",
                colour: PAL.manual,
                a: [pts[i].x, pts[i].y, y],
                b: [pts[i + 1].x, pts[i + 1].y, y],
              });
            }
          }
        }
        return out;
      },
      getCam() {
        const s = useStudio.getState();
        return { az: s.az, el: s.el, dist: s.dist };
      },
      getClear() {
        const navy = useStudio.getState().skin === "navy";
        return navy ? [0.02, 0.043, 0.078, 1] : [0.949, 0.929, 0.89, 1];
      },
    });

    const unsub = useStudio.subscribe((s, prev) => {
      if (
        s.sheet !== prev.sheet ||
        s.showSrc !== prev.showSrc ||
        s.showBld !== prev.showBld ||
        s.showRoof !== prev.showRoof ||
        s.showMan !== prev.showMan ||
        s.pose !== prev.pose ||
        s.skin !== prev.skin ||
        s.markups !== prev.markups ||
        s.height !== prev.height
      ) {
        viewer.rebuild();
      }
    });

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const st = useStudio.getState();
      st.setDist(Math.max(0.1, Math.min(8, st.dist * (1 + Math.sign(e.deltaY) * 0.1))));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    const onCtx = (e: Event) => e.preventDefault();
    canvas.addEventListener("contextmenu", onCtx);

    return () => {
      unsub();
      viewer.stop();
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onCtx);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="block h-full w-full touch-none"
      onPointerDown={(e) => {
        const s = useStudio.getState();
        drag.current = { x: e.clientX, y: e.clientY, az: s.az, el: s.el, pan: e.button === 2 || e.shiftKey };
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const dx = e.clientX - drag.current.x;
        const dy = e.clientY - drag.current.y;
        useStudio.getState().setOrbit(
          drag.current.az + dx * 0.006,
          Math.max(-0.7, Math.min(1.4, drag.current.el - dy * 0.005)),
        );
        drag.current.x = e.clientX;
        drag.current.y = e.clientY;
        drag.current.az = useStudio.getState().az;
        drag.current.el = useStudio.getState().el;
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    />
  );
}

export function PlanCanvas({ interactive }: { interactive: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const s = useStudio();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w < 2 || h < 2) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const navy = s.skin === "navy";
      ctx.fillStyle = navy ? PAL.navy : PAL.paper;
      ctx.fillRect(0, 0, w, h);
      const geom = PLAN;
      const pad = 48;
      const sx = (w - pad * 2) / 18;
      const sy = (h - pad * 2) / 7.2;
      const sc = Math.min(sx, sy);
      const ox = (w - 18 * sc) / 2;
      const oy = (h - 7.2 * sc) / 2;
      const to = (x: number, z: number): [number, number] => [ox + x * sc, oy + z * sc];
      ctx.strokeStyle = navy ? PAL.cyan : PAL.planInk;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const seg of geom.B) {
        if (Math.abs(seg[1] - seg[4]) > 0.2) continue;
        const a = to(seg[0], seg[2]);
        const b = to(seg[3], seg[5]);
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
      }
      ctx.stroke();
      ctx.strokeStyle = PAL.roof;
      ctx.beginPath();
      const outline = [to(0, 0), to(18, 0), to(18, 7.2), to(0, 7.2)];
      ctx.moveTo(outline[0][0], outline[0][1]);
      outline.slice(1).forEach((p) => ctx.lineTo(p[0], p[1]));
      ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = PAL.manual;
      ctx.fillStyle = PAL.manual;
      for (const m of s.markups) {
        if (m.points.length === 0) continue;
        ctx.beginPath();
        m.points.forEach((p, i) => {
          const q = to(p.x, p.y);
          if (i === 0) ctx.moveTo(q[0], q[1]);
          else ctx.lineTo(q[0], q[1]);
        });
        if (m.kind === "area") ctx.closePath();
        ctx.stroke();
        if (m.kind === "count") {
          const q = to(m.points[0].x, m.points[0].y);
          ctx.beginPath();
          ctx.arc(q[0], q[1], 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (s.pending.length) {
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        s.pending.forEach((p, i) => {
          const q = to(p.x, p.y);
          if (i === 0) ctx.moveTo(q[0], q[1]);
          else ctx.lineTo(q[0], q[1]);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [s.skin, s.markups, s.pending, s.sheet]);

  function toWorld(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = ref.current!;
    const r = canvas.getBoundingClientRect();
    const w = r.width;
    const h = r.height;
    const pad = 48;
    const sx = (w - pad * 2) / 18;
    const sy = (h - pad * 2) / 7.2;
    const sc = Math.min(sx, sy);
    const ox = (w - 18 * sc) / 2;
    const oy = (h - 7.2 * sc) / 2;
    return { x: (e.clientX - r.left - ox) / sc, y: (e.clientY - r.top - oy) / sc };
  }

  return (
    <canvas
      ref={ref}
      className="block h-full w-full touch-none"
      onPointerDown={(e) => {
        if (!interactive) return;
        const st = useStudio.getState();
        if (st.tool === "none") return;
        st.addPoint(toWorld(e));
      }}
      onDoubleClick={() => {
        if (interactive) useStudio.getState().commitPending();
      }}
    />
  );
}
