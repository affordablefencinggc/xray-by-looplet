import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
  type KeyboardEvent,
} from "react";
import {
  changeAssistantRect,
  defaultAssistantRect,
  fitAssistantRect,
  readAssistantRect,
  type AssistantRect,
} from "./panelGeometry";
import { resizeAssistantRectFromCorner, type Corner } from "./panelCorners";
// A new layout version restores the requested right-side default once. Keep the
// previous key intact; subsequent user drag/resize choices persist in v2.
const STORAGE = "xray:assistant-panel:v2";
const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });
/** Header drag moves the panel; any of the four corners pinches it (panelCorners.ts). */
export type PanelGestureMode = "move" | Corner;
const applyGesture = (rect: AssistantRect, dx: number, dy: number, mode: PanelGestureMode) =>
  mode === "move"
    ? changeAssistantRect(rect, dx, dy, "move", viewport())
    : resizeAssistantRectFromCorner(rect, mode, dx, dy, viewport());
export function useAssistantPanel() {
  const [rect, setRect] = useState<AssistantRect | null>(null),
    [gesturing, setGesturing] = useState(false);
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    rect: AssistantRect;
    mode: PanelGestureMode;
  } | null>(null);
  useEffect(() => {
    let saved = null;
    try {
      saved = localStorage.getItem(STORAGE);
    } catch {
      // Storage unavailable (private mode, blocked): fall back to the default rect.
    }
    setRect(readAssistantRect(saved, viewport()));
    const resize = () =>
      setRect((old) =>
        old ? fitAssistantRect(old, viewport()) : defaultAssistantRect(viewport()),
      );
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    if (rect && !gesturing)
      try {
        localStorage.setItem(STORAGE, JSON.stringify(rect));
      } catch {
        // Persisting the layout is best-effort.
      }
  }, [rect, gesturing]);
  const reset = () => setRect(defaultAssistantRect(viewport()));
  const pointerDown = (event: PointerEvent<HTMLElement>, mode: PanelGestureMode) => {
    if (!rect || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, rect, mode };
    setGesturing(true);
  };
  const pointerMove = (event: PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    setRect(applyGesture(g.rect, event.clientX - g.x, event.clientY - g.y, g.mode));
  };
  const pointerUp = () => {
    gesture.current = null;
    setGesturing(false);
  };
  const keyboard = (event: KeyboardEvent<HTMLElement>, mode: PanelGestureMode) => {
    if (event.key === "Home") {
      event.preventDefault();
      reset();
      return;
    }
    const amount = event.shiftKey ? 32 : 12,
      dx = event.key === "ArrowLeft" ? -amount : event.key === "ArrowRight" ? amount : 0,
      dy = event.key === "ArrowUp" ? -amount : event.key === "ArrowDown" ? amount : 0;
    if (dx || dy) {
      event.preventDefault();
      event.stopPropagation();
      setRect((old) => (old ? applyGesture(old, dx, dy, mode) : old));
    }
  };
  return { rect, gesturing, reset, pointerDown, pointerMove, pointerUp, keyboard };
}

// Rail mode (SC-14): WorkspaceRails stamps data-assistant-rail="true" on <html> while the panel is
// docked into the right menu. The header dock/undock button reads it live through a MutationObserver.
const RAIL_ATTRIBUTE = "data-assistant-rail";
const subscribeRail = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: [RAIL_ATTRIBUTE] });
  return () => observer.disconnect();
};
const readRail = () => document.documentElement.getAttribute(RAIL_ATTRIBUTE) === "true";
const railOnServer = () => false;
/** True while the live assistant is docked into the right menu (`html[data-assistant-rail="true"]`). */
export function useAssistantRailDocked(): boolean {
  return useSyncExternalStore(subscribeRail, readRail, railOnServer);
}
