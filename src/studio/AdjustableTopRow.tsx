import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import "./adjustableTopRow.css";

/** Shared chrome for top menus. Keep content mounted while its row is collapsed. */
export function AdjustableTopRow({ id, label, minHeight, compact = false, children }: {
  id: string; label: string; minHeight: number; compact?: boolean; children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [height, setHeight] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const row = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; height: number } | null>(null);
  const expandedMinimum = minHeight + (compact ? 0 : 18);
  const key = `xray:top-row:${id}:v1`;
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "null");
      setCollapsed(saved?.collapsed === true);
      if (typeof saved?.height === "number" && Number.isFinite(saved.height)) {
        // Remove the former arrow gutter once, retaining the user's resize above it.
        setHeight(Math.max(expandedMinimum, Math.min(240, saved.height - (compact && !saved.compact ? 18 : 0))));
      }
    } catch { /* Invalid or unavailable storage uses the natural row size. */ }
    setReady(true);
  }, [key, expandedMinimum, compact]);
  useEffect(() => {
    if (ready) try { localStorage.setItem(key, JSON.stringify({ collapsed, height, compact })); } catch { /* Storage unavailable. */ }
  }, [key, collapsed, height, ready, compact]);
  useEffect(() => {
    const expand = (event: Event) => { if ((event as CustomEvent).detail === id) setCollapsed(false); };
    window.addEventListener("xray:expand-top-row", expand);
    return () => window.removeEventListener("xray:expand-top-row", expand);
  }, [id]);
  const resize = (value: number) => {
    setCollapsed(false);
    setHeight(Math.max(expandedMinimum, Math.min(240, value)));
  };
  const end = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <div ref={row} className="adjustable-top-row" data-top-row={id} data-collapsed={collapsed} data-compact={compact}
    style={{ height: collapsed ? 28 : height ?? undefined, minHeight: collapsed ? 28 : expandedMinimum }}>
    <div id={`top-row-${id}`} className="adjustable-top-content" hidden={collapsed}>{children}</div>
    {collapsed ? <button type="button" className="top-row-expand" aria-label={`Expand ${label.toLowerCase()}`}
      aria-expanded={false} aria-controls={`top-row-${id}`} onClick={() => setCollapsed(false)}>
      <span className="top-row-caption">{label}</span><ChevronDown className="top-row-chevron" size={12} />
    </button> : <button type="button" className="top-row-toggle" aria-label={`Collapse ${label.toLowerCase()}`}
      aria-expanded={true} aria-controls={`top-row-${id}`} title={`Collapse ${label.toLowerCase()}`}
      onClick={() => setCollapsed(true)}><ChevronUp size={12} /></button>}
    {!collapsed && <div role="separator" tabIndex={0} className="top-row-resizer" aria-label={`Resize ${label.toLowerCase()}`}
      aria-orientation="horizontal" aria-valuemin={expandedMinimum} aria-valuemax={240} aria-valuenow={height ?? expandedMinimum}
      title="Drag to resize · arrow keys adjust · double-click resets"
      onDoubleClick={() => setHeight(null)}
      onKeyDown={event => {
        if (!["ArrowUp", "ArrowDown", "Home"].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        if (event.key === "Home") setHeight(null);
        else resize((row.current?.getBoundingClientRect().height ?? expandedMinimum) + (event.key === "ArrowDown" ? 8 : -8));
      }}
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault();
        drag.current = { y: event.clientY, height: row.current?.getBoundingClientRect().height ?? expandedMinimum };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        if (drag.current && event.currentTarget.hasPointerCapture(event.pointerId)) resize(drag.current.height + event.clientY - drag.current.y);
      }}
      onPointerUp={end} onPointerCancel={end} />}
  </div>;
}
