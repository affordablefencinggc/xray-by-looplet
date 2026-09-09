import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import {
  changeAssistantRect,
  defaultAssistantRect,
  fitAssistantRect,
  readAssistantRect,
  type AssistantRect,
} from "./panelGeometry";
const STORAGE = "xray:assistant-panel:v1";
const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });
export function useAssistantPanel() {
  const [rect, setRect] = useState<AssistantRect | null>(null),
    [gesturing, setGesturing] = useState(false);
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    rect: AssistantRect;
    mode: "move" | "resize";
  } | null>(null);
  useEffect(() => {
    let saved = null;
    try {
      saved = localStorage.getItem(STORAGE);
    } catch {}
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
      } catch {}
  }, [rect, gesturing]);
  const reset = () => setRect(defaultAssistantRect(viewport()));
  const pointerDown = (event: PointerEvent<HTMLElement>, mode: "move" | "resize") => {
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
    setRect(
      changeAssistantRect(g.rect, event.clientX - g.x, event.clientY - g.y, g.mode, viewport()),
    );
  };
  const pointerUp = () => {
    gesture.current = null;
    setGesturing(false);
  };
  const keyboard = (event: KeyboardEvent<HTMLElement>, mode: "move" | "resize") => {
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
      setRect((old) => (old ? changeAssistantRect(old, dx, dy, mode, viewport()) : old));
    }
  };
  return { rect, gesturing, reset, pointerDown, pointerMove, pointerUp, keyboard };
}
