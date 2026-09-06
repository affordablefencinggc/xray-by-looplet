import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useStudio } from "./store";
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
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const rightCollapsed = useStudio(s => s.rightCollapsed);
  const collapsed = { left: leftCollapsed, right: rightCollapsed };
  const setCollapsed = (side: keyof RailWidths, value: boolean) => {
    if (side === "left") setLeftCollapsed(value);
    else useStudio.setState({ rightCollapsed: value });
  };
  const drag = useRef<{ side: keyof RailWidths; x: number; width: number; collapsed: boolean; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
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
            const node = ref.current?.querySelector<HTMLElement>(selector);
            if (node) {
              // A collapsed rail still needs a handle even though its own box is hidden.
              if (side === "left" && node.matches(".studio-left-rail") && innerWidth < 1180) continue;
              const r = collapsed[side] ? node.closest(".building-workspace,.studio-layout,.measure-workspace")!.getBoundingClientRect() : node.getBoundingClientRect();
              if (r.height > 0)
                next.push({
                  side,
                  left: collapsed[side] ? (side === "left" ? r.left : r.right - 10) : side === "left" ? r.right - 8 : r.left - 2,
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
  }, [pane, widths, leftCollapsed, rightCollapsed]);
  const change = (side: keyof RailWidths, value: number) =>
    setWidths((v) => ({
      ...v,
      [side]: railWidth(side, value, innerWidth, v[side === "left" ? "right" : "left"]),
    }));
  const pointerDown = (side: keyof RailWidths, e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    suppressClick.current = false;
    drag.current = { side, x: e.clientX, width: widths[side], collapsed: collapsed[side], moved: false };
  };
  const pointerMove = (e: PointerEvent<HTMLElement>) => {
    const start = drag.current;
    if (!start || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const delta = (e.clientX - start.x) * (start.side === "left" ? 1 : -1);
    if (Math.abs(delta) < 5 && !start.moved) return;
    start.moved = true;
    suppressClick.current = true;
    if (start.collapsed && delta <= 0) return;
    const width = (start.collapsed ? 0 : start.width) + delta;
    const shouldCollapse = !start.collapsed && width < 80;
    setCollapsed(start.side, shouldCollapse);
    if (!shouldCollapse) change(start.side, width);
  };
  const pointerEnd = (e: PointerEvent<HTMLElement>) => {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  return (
    <div
      ref={ref}
      className="workspace-rails"
      data-pane={pane}
      data-left-collapsed={leftCollapsed}
      data-right-collapsed={rightCollapsed}
      style={
        {
          "--left-menu-width": `${widths.left}px`,
          "--right-menu-width": `${widths.right}px`,
          "--left-menu-track": leftCollapsed ? "0px" : `${widths.left}px`,
          "--right-menu-track": rightCollapsed ? "0px" : `${widths.right}px`,
        } as CSSProperties
      }
    >
      {children}
      {rects.map((r) => (
        <div key={r.side} className={`rail-controls rail-controls-${r.side}`}>
        <div
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
              setCollapsed(r.side, false);
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
            pointerDown(r.side, e);
          }}
          onPointerMove={pointerMove}
          onPointerUp={pointerEnd}
          onPointerCancel={pointerEnd}
        />
        <button
          type="button"
          className="rail-toggle"
          aria-label={`${collapsed[r.side] ? "Expand" : "Collapse"} ${r.side} menu`}
          aria-expanded={!collapsed[r.side]}
          title={`${collapsed[r.side] ? "Open" : "Collapse"} menu · drag to resize`}
          style={{ left: Math.max(0, Math.min(innerWidth - 24, r.left - 7)), top: r.top + r.height / 2 - 24 }}
          onPointerDown={e => pointerDown(r.side, e)}
          onPointerMove={pointerMove}
          onPointerUp={pointerEnd}
          onPointerCancel={pointerEnd}
          onClick={(e) => {
            if (suppressClick.current && e.detail !== 0) { suppressClick.current = false; return; }
            suppressClick.current = false;
            setCollapsed(r.side, !collapsed[r.side]);
          }}
        >
          {(r.side === "left") !== collapsed[r.side] ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>
        </div>
      ))}
    </div>
  );
}
