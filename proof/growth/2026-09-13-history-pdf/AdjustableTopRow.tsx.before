import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import "./adjustableTopRow.css";

/** Shared chrome for top menus. Keep content mounted while its row is collapsed. */
export function AdjustableTopRow({ id, label, minHeight, children }: {
  id: string; label: string; minHeight: number; children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [height, setHeight] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const row = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; height: number } | null>(null);
  const key = `xray:top-row:${id}:v1`;
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "null");
      setCollapsed(saved?.collapsed === true);
      if (typeof saved?.height === "number" && Number.isFinite(saved.height)) {
        setHeight(Math.max(minHeight, Math.min(240, saved.height)));
      }
    } catch { /* Invalid or unavailable storage uses the natural row size. */ }
    setReady(true);
  }, [key, minHeight]);
  useEffect(() => {
    if (ready) try { localStorage.setItem(key, JSON.stringify({ collapsed, height })); } catch { /* Storage unavailable. */ }
  }, [key, collapsed, height, ready]);
  const resize = (value: number) => {
    setCollapsed(false);
    setHeight(Math.max(minHeight, Math.min(240, value)));
  };
  const end = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <div ref={row} className="adjustable-top-row" data-top-row={id} data-collapsed={collapsed}
    style={{ height: collapsed ? 18 : height ?? undefined, minHeight: collapsed ? 18 : minHeight }}>
    <div id={`top-row-${id}`} className="adjustable-top-content" hidden={collapsed}>{children}</div>
    {collapsed && <span className="top-row-caption" aria-hidden="true">{label}</span>}
    <button type="button" className="top-row-toggle" aria-label={`${collapsed ? "Expand" : "Collapse"} ${label.toLowerCase()}`}
      aria-expanded={!collapsed} aria-controls={`top-row-${id}`} title={`${collapsed ? "Expand" : "Collapse"} ${label.toLowerCase()}`}
      onClick={() => setCollapsed(value => !value)}>
      {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
    </button>
    {!collapsed && <div role="separator" tabIndex={0} className="top-row-resizer" aria-label={`Resize ${label.toLowerCase()}`}
      aria-orientation="horizontal" aria-valuemin={minHeight} aria-valuemax={240} aria-valuenow={height ?? minHeight}
      title="Drag to resize · arrow keys adjust · double-click resets"
      onDoubleClick={() => setHeight(null)}
      onKeyDown={event => {
        if (!["ArrowUp", "ArrowDown", "Home"].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        if (event.key === "Home") setHeight(null);
        else resize((row.current?.getBoundingClientRect().height ?? minHeight) + (event.key === "ArrowDown" ? 8 : -8));
      }}
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault();
        drag.current = { y: event.clientY, height: row.current?.getBoundingClientRect().height ?? minHeight };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        if (drag.current && event.currentTarget.hasPointerCapture(event.pointerId)) resize(drag.current.height + event.clientY - drag.current.y);
      }}
      onPointerUp={end} onPointerCancel={end} />}
  </div>;
}
