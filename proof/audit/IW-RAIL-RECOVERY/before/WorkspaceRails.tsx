import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  DEFAULT_RAILS,
  RAIL_LAYOUT_KEY,
  railWidth,
  readRailWidths,
  type RailWidths,
} from "./railLayout";

export function WorkspaceRails({ children, pane }: { children: ReactNode; pane: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [widths, setWidths] = useState<RailWidths>(DEFAULT_RAILS);
  const [ready, setReady] = useState(false);
  const [rects, setRects] = useState<
    { side: keyof RailWidths; left: number; top: number; height: number }[]
  >([]);
  useEffect(() => {
    try {
      setWidths(readRailWidths(localStorage.getItem(RAIL_LAYOUT_KEY)));
    } catch {}
    setReady(true);
    const update = (event: Event) =>
      setWidths(readRailWidths(JSON.stringify((event as CustomEvent).detail)));
    window.addEventListener("xray:rail-layout", update);
    return () => window.removeEventListener("xray:rail-layout", update);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(RAIL_LAYOUT_KEY, JSON.stringify(widths));
      } catch {}
  }, [widths, ready]);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next: typeof rects = [];
        if (innerWidth > 940)
          for (const side of ["left", "right"] as const) {
            const selector =
              side === "left"
                ? ".studio-left-rail, .building-left-nav"
                : ".studio-right-rail, .building-inspector, .measure-inspector";
            const node = [...(ref.current?.querySelectorAll<HTMLElement>(selector) ?? [])].find(
              (n) => n.getBoundingClientRect().width > 0,
            );
            if (node) {
              const r = node.getBoundingClientRect();
              if (r.height > 0)
                next.push({
                  side,
                  left: side === "left" ? r.right - 8 : r.left - 2,
                  top: Math.max(r.top, 0),
                  height: Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)),
                });
            }
          }
        setRects((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next));
      });
    };
    const observer = new ResizeObserver(measure);
    if (ref.current) observer.observe(ref.current);
    for (const n of ref.current?.querySelectorAll(
      ".studio-layout,.building-workspace,.measure-workspace",
    ) ?? [])
      observer.observe(n);
    const mutation = new MutationObserver(measure);
    if (ref.current) mutation.observe(ref.current, { childList: true, subtree: true });
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    measure();
    return () => {
      observer.disconnect();
      mutation.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      cancelAnimationFrame(frame);
    };
  }, [pane, widths]);
  const change = (side: keyof RailWidths, value: number) =>
    setWidths((v) => ({
      ...v,
      [side]: railWidth(side, value, innerWidth, v[side === "left" ? "right" : "left"]),
    }));
  return (
    <div
      ref={ref}
      className="workspace-rails"
      style={
        {
          "--left-menu-width": `${widths.left}px`,
          "--right-menu-width": `${widths.right}px`,
        } as CSSProperties
      }
    >
      {children}
      {rects.map((r) => (
        <div
          key={r.side}
          role="separator"
          tabIndex={0}
          aria-label={`Resize ${r.side} menu`}
          aria-orientation="vertical"
          aria-valuemin={r.side === "left" ? 200 : 320}
          aria-valuemax={r.side === "left" ? 440 : 600}
          aria-valuenow={widths[r.side]}
          className="rail-resizer"
          title="Drag to resize · arrow keys adjust · double-click resets"
          style={{ left: r.left, top: r.top, height: r.height }}
          onDoubleClick={() => change(r.side, DEFAULT_RAILS[r.side])}
          onKeyDown={(e) => {
            if (["ArrowLeft", "ArrowRight", "Home"].includes(e.key)) {
              e.preventDefault();
              e.stopPropagation();
              change(
                r.side,
                e.key === "Home"
                  ? DEFAULT_RAILS[r.side]
                  : widths[r.side] +
                      (e.key === "ArrowRight" ? 20 : -20) * (r.side === "left" ? 1 : -1),
              );
            }
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            e.currentTarget.dataset.startX = String(e.clientX);
            e.currentTarget.dataset.startWidth = String(widths[r.side]);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              change(
                r.side,
                Number(e.currentTarget.dataset.startWidth) +
                  (e.clientX - Number(e.currentTarget.dataset.startX)) *
                    (r.side === "left" ? 1 : -1),
              );
          }}
          onPointerUp={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
          }}
        />
      ))}
    </div>
  );
}
