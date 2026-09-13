import { Fragment, memo, useEffect, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent } from "react";
import { Bot, ChevronLeft, ChevronRight } from "lucide-react";
import { LiveAssistant } from "./LiveAssistant";
const StableLiveAssistant = memo(LiveAssistant);
import { CanvasContextMenu } from "./CanvasContextMenu.tsx";
import { useStudio } from "./store";
import { useLiveAssistant } from "./liveAssistantState";
import {
  RAIL_WIDTHS_CHANGED_EVENT,
  CLOSE_SETTINGS_EVENT,
  DEFAULT_RAILS,
  RAIL_LAYOUT_KEY,
  railWidth,
  readRailWidths,
  type RailWidths,
} from "./railLayout";
import {
  ASSISTANT_RAIL_KEY,
  ASSISTANT_RAIL_TOGGLE_EVENT,
  assistantRailBox,
  assistantRailVars,
  nextRailState,
  readAssistantRail,
  serializeAssistantRail,
  type AssistantRailBox,
  type RailAction,
} from "./assistantRailMode";
import "./assistantRail.css";
import { CANVAS_FOCUS_EVENT } from "./canvasFocus";
import "./canvasFocus.css";

const ASSISTANT_RAIL_VARS = ["--assistant-rail-left", "--assistant-rail-top", "--assistant-rail-width", "--assistant-rail-height"];
/**
 * The right column's inner seam, in viewport pixels, published on <html>.
 *
 * The panel is portaled to document.body (LiveAssistant.tsx:1307), so it is outside this
 * component's subtree and cannot inherit --right-menu-width from the container style below. The
 * collapsed rail needs the seam to sit flush against it, and unlike the four --assistant-rail-*
 * vars this one must survive the panel closing: nextRailState clears rail mode on "assistant-closed",
 * which is exactly the state the collapsed rail renders in.
 */
const ASSISTANT_SEAM_VAR = "--assistant-seam-left";

export function WorkspaceRails({ children, pane }: { children: ReactNode; pane: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [widths, setWidths] = useState<RailWidths>(DEFAULT_RAILS);
  const [ready, setReady] = useState(false);
  const [canvasFocus, setCanvasFocus] = useState(false);
  useEffect(() => {
    const openCanvas = () => setCanvasFocus(true);
    window.addEventListener(CANVAS_FOCUS_EVENT, openCanvas);
    return () => window.removeEventListener(CANVAS_FOCUS_EVENT, openCanvas);
  }, []);
  useEffect(() => {
    if (pane !== "sketch" && pane !== "model") setCanvasFocus(false);
  }, [pane]);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const rightCollapsed = useStudio(s => s.rightCollapsed);
  const collapsed = { left: leftCollapsed, right: rightCollapsed };
  useEffect(() => {
    document.documentElement.setAttribute("data-right-menu-collapsed", String(rightCollapsed));
    return () => document.documentElement.removeAttribute("data-right-menu-collapsed");
  }, [rightCollapsed]);
  // Assistant rail mode: the right menu's box becomes the Live assistant (assistantRailMode.ts).
  const [railMode, setRailMode] = useState(false);
  const [dock, setDock] = useState<AssistantRailBox | null>(null);
  const assistantOpen = useLiveAssistant(s => s.open);
  const assistantWasOpen = useRef(false);
  const applyRail = (action: RailAction) => {
    const next = nextRailState({ rail: railMode, rightCollapsed }, action);
    setRailMode(next.rail);
    if (next.rightCollapsed !== rightCollapsed) useStudio.setState({ rightCollapsed: next.rightCollapsed });
    if (next.rail || action === "collapse-right") window.dispatchEvent(new Event(CLOSE_SETTINGS_EVENT));
    if (next.rail) useLiveAssistant.setState({ open: true });
  };
  const setCollapsed = (side: keyof RailWidths, value: boolean) => {
    if (side === "left") setLeftCollapsed(value);
    else applyRail(value ? "collapse-right" : "expand-right");
  };
  const drag = useRef<{ side: keyof RailWidths; x: number; width: number; collapsed: boolean; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const resizeFrame = useRef(0);
  const pendingResize = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelAnimationFrame(resizeFrame.current), []);
  const [rects, setRects] = useState<
    { side: keyof RailWidths; left: number; top: number; height: number; collapsed: boolean }[]
  >([]);
  useEffect(() => {
    try {
      setWidths(readRailWidths(localStorage.getItem(RAIL_LAYOUT_KEY)));
    } catch { /* storage unavailable */ }
    try {
      if (readAssistantRail(localStorage.getItem(ASSISTANT_RAIL_KEY))) {
        setRailMode(true);
        useStudio.setState({ rightCollapsed: false });
        useLiveAssistant.setState({ open: true });
      }
    } catch { /* storage unavailable */ }
    setReady(true);
    const update = (event: Event) =>
      setWidths(readRailWidths(JSON.stringify((event as CustomEvent).detail)));
    window.addEventListener("xray:rail-layout", update);
    return () => window.removeEventListener("xray:rail-layout", update);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
    if (ready)
      try {
        localStorage.setItem(RAIL_LAYOUT_KEY, JSON.stringify(widths));
      } catch { /* storage unavailable */ }
    if (ready) window.dispatchEvent(new CustomEvent(RAIL_WIDTHS_CHANGED_EVENT, { detail: widths }));
    }, 150);
    return () => clearTimeout(timer);
  }, [widths, ready]);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(ASSISTANT_RAIL_KEY, serializeAssistantRail(railMode));
      } catch { /* storage unavailable */ }
  }, [railMode, ready]);
  // The panel header's dock/undock button reaches rail mode through a window event.
  const applyRailRef = useRef(applyRail);
  applyRailRef.current = applyRail;
  useEffect(() => {
    const toggle = () => applyRailRef.current("toggle-rail");
    window.addEventListener(ASSISTANT_RAIL_TOGGLE_EVENT, toggle);
    return () => window.removeEventListener(ASSISTANT_RAIL_TOGGLE_EVENT, toggle);
  }, []);
  // Closing the assistant from its own header (open → false) hands the menu back.
  useEffect(() => {
    if (railMode && assistantWasOpen.current && !assistantOpen) {
      setRailMode(nextRailState({ rail: true, rightCollapsed }, "assistant-closed").rail);
      // The launcher the panel focuses is hidden in rail mode; hand focus to the mode toggle instead.
      requestAnimationFrame(() => document.querySelector<HTMLElement>(".rail-assistant-toggle")?.focus());
    }
    assistantWasOpen.current = assistantOpen;
  }, [assistantOpen, railMode, rightCollapsed]);
  // Publish the dock box for the portaled panel (assistantRail.css reads these on <html>).
  useEffect(() => {
    const root = document.documentElement;
    // Only a rect measured while the menu was expanded is the dock box; a stale collapsed rect waits for the re-measure.
    const rail = rects.find((r) => r.side === "right" && !r.collapsed);
    const box = railMode && !rightCollapsed
      ? assistantRailBox(rail ? { left: rail.left + 2, top: rail.top, height: rail.height } : null, innerWidth, innerHeight)
      : null;
    const vars = assistantRailVars(box);
    setDock((previous) => (JSON.stringify(previous) === JSON.stringify(box) ? previous : box));
    if (box) root.setAttribute("data-assistant-rail", "true");
    else root.removeAttribute("data-assistant-rail");
    for (const name of ASSISTANT_RAIL_VARS) {
      if (vars[name]) root.style.setProperty(name, vars[name]);
      else root.style.removeProperty(name);
    }
    return () => {
      root.removeAttribute("data-assistant-rail");
      for (const name of ASSISTANT_RAIL_VARS) root.style.removeProperty(name);
    };
  }, [railMode, rightCollapsed, rects]);
  // [SC-19 seam] begin: publish the right column's inner edge for the portaled panel.
  // Deliberately separate from the effect above, which only runs in rail mode: the collapsed rail
  // renders after rail mode has been cleared, so it needs a measurement that does not depend on it.
  // A collapsed column reports its own narrow box, which is the correct seam for that state too.
  useEffect(() => {
    const root = document.documentElement;
    // `rect.left` for the right side is the RESIZER HANDLE position, not the column edge: the
    // measurement at line 166 subtracts 2px so the drag separator straddles the seam. Using it raw
    // put the rail 2px inside the menu, overlapping it. The rail-mode dock at line 118 already
    // corrects the same way, so the +2 is the established convention rather than a magic number.
    // Keep the stored column width while the column is hidden or awaiting measurement.
    const right = rects.find((r) => r.side === "right" && !r.collapsed);
    if (right && right.left > 0) root.style.setProperty(ASSISTANT_SEAM_VAR, `${Math.round(right.left + 2)}px`);
    else root.style.setProperty(ASSISTANT_SEAM_VAR, `max(0px, calc(100vw - ${widths.right}px))`);
    const layout = ref.current?.querySelector<HTMLElement>(".studio-layout")?.getBoundingClientRect();
    root.style.setProperty("--assistant-column-top", `${Math.max(0, layout?.top ?? right?.top ?? 90)}px`);
    root.style.setProperty("--assistant-column-bottom", `${Math.max(0, innerHeight - (layout?.bottom ?? innerHeight))}px`);
    // Braced: removeProperty returns the old value, and a cleanup must return void or a destructor.
    return () => {
      root.style.removeProperty(ASSISTANT_SEAM_VAR);
      root.style.removeProperty("--assistant-column-top");
      root.style.removeProperty("--assistant-column-bottom");
    };
  }, [rects, widths.right]);
  // [SC-19 seam] end
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
            // Settings replaces the inspector; measure the visible drawer, not its hidden predecessor.
            const node = (side === "right" ? ref.current?.querySelector<HTMLElement>(".workspace-settings") : null)
              ?? ref.current?.querySelector<HTMLElement>(selector);
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
                  collapsed: collapsed[side],
                });
            }
          }
        // Drawings has no inspector DOM. Only an open assistant or an explicitly
        // collapsed rail needs synthetic seam controls; the closed bottom launcher
        // alone must not leave a floating divider button over the drawing canvas.
        if(innerWidth>940 && (assistantOpen || railMode || rightCollapsed) && !next.some(r=>r.side==='right')){
          const layout=ref.current?.querySelector('.studio-layout')?.getBoundingClientRect();
          const top=Math.max(0,layout?.top??90),bottom=Math.min(innerHeight,layout?.bottom??innerHeight);
          next.push({side:'right',left:rightCollapsed?innerWidth-10:innerWidth-widths.right-2,top,height:Math.max(0,bottom-top),collapsed:rightCollapsed});
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
    if (ref.current) mutation.observe(ref.current, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-settings-open", "data-wide"] });
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
  }, [pane, widths, leftCollapsed, rightCollapsed, assistantOpen, railMode]);
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
    pendingResize.current = () => {
      if (collapsed[start.side] !== shouldCollapse) setCollapsed(start.side, shouldCollapse);
      if (!shouldCollapse) change(start.side, width);
    };
    if (!resizeFrame.current) resizeFrame.current = requestAnimationFrame(() => {
      resizeFrame.current = 0;
      const resize = pendingResize.current; pendingResize.current = null;
      resize?.();
    });
  };
  const pointerEnd = (e: PointerEvent<HTMLElement>) => {
    cancelAnimationFrame(resizeFrame.current); resizeFrame.current = 0;
    const resize = pendingResize.current; pendingResize.current = null;
    resize?.();
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
      data-assistant-rail={railMode}
      data-canvas-focus={canvasFocus}
      style={
        {
          "--left-menu-width": `${widths.left}px`,
          "--right-menu-width": `${widths.right}px`,
          "--left-menu-track": leftCollapsed ? "0px" : `${widths.left}px`,
          "--right-menu-track": rightCollapsed ? "0px" : `${widths.right}px`,
          "--canvas-focus-top": `${rects.find(r => r.side === "right")?.top ?? 90}px`,
        } as CSSProperties
      }
    >
      {children}
      {canvasFocus && <button type="button" className="canvas-focus-exit" onClick={() => setCanvasFocus(false)}>Exit canvas</button>}
      <StableLiveAssistant />
      <CanvasContextMenu />
      {rects.map((r) => (
        <Fragment key={r.side}>
        <div className={`rail-controls rail-controls-${r.side}`}>
        <div
          role="separator"
          tabIndex={0}
          aria-label={`Resize ${r.side} menu`}
          aria-orientation="vertical"
          aria-valuemin={r.side === "left" ? 200 : 320}
          aria-valuemax={r.side === "left" ? 440 : 1000}
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
        {r.side === 'left' && <button
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
          {!collapsed[r.side] ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>}
        </div>
        {r.side === "right" && (
          <button
            type="button"
            className="rail-assistant-toggle"
            aria-label={rightCollapsed ? 'Expand assistant rail' : 'Collapse assistant rail'}
            aria-expanded={!rightCollapsed}
            title={rightCollapsed ? 'Open assistant rail' : 'Collapse rail · drag the vertical divider to resize'}
            style={{
              left: Math.max(0, Math.min(innerWidth - 48, (railMode && dock ? dock.left - 2 : r.left) - 7)),
              top: Math.max(0, r.top + r.height / 2 - 17.5),
            }}
            onClick={() => {
              if (rightCollapsed) applyRail('toggle-rail');
              else { applyRail('collapse-right'); useLiveAssistant.setState({open: false}); }
            }}
          >
            <Bot size={15} />{rightCollapsed ? <ChevronLeft className="rail-assistant-arrow" size={10} /> : <ChevronRight className="rail-assistant-arrow" size={10} />}
          </button>
        )}
        </Fragment>
      ))}
    </div>
  );
}
