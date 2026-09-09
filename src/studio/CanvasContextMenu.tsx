import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { ArchitectProject } from "./architect/model";
import { hasArchitectController, requestArchitectTool } from "./assistant/architectBridge";
import { describeArchitectEntity, describeSourcePart, insertReference, useCanvasPick, type CanvasReference } from "./assistant/canvasReference";
import { hasDraftsmanController, requestDraftsmanTool } from "./assistant/draftsmanBridge";
import { isNativeShell } from "./assistant/renderTool";
import { loadCatalogScene } from "./assistant/workbenchStructure";
import { BUILDING_CATALOG } from "./sourceBuilding";
import { useStudio } from "./store";
import {
  acceptSelectedPart,
  architect3dViewReference,
  architectPlanViewReference,
  beginPress,
  BUILDING_CANVAS_SELECTOR,
  clampMenuPosition,
  menuCaption,
  menuIndexForKey,
  menuItemsFor,
  MODIFY_PLACEHOLDER,
  PICK_ACCEPT,
  PICK_PROMPT,
  PICK_SELECTION_POLL_MS,
  PICK_SELECTION_TIMEOUT_MS,
  pressStayedPut,
  resolveMenuTarget,
  resolvePickTarget,
  sheetViewReference,
  sourceBuildingViewReference,
  trackPress,
  type MenuItem,
  type MenuTarget,
  type Point,
  type PointerPress,
} from "./canvasContextMenuModel";
import "./canvasContextMenu.css";

/**
 * Global canvas right-click menu and "select a shape" pick mode. Mounted once next to the
 * Live assistant; renders nothing until a menu or a pick request is active. Every item only
 * puts a precise reference (plus an optional intent line) into the chat draft; nothing is sent.
 */

type Building = { id: string; title: string };
type MenuState = {
  key: number;
  anchor: Point;
  target: MenuTarget;
  ref: CanvasReference | null;
  items: MenuItem[];
  caption: { title: string; detail: string } | null;
  loading: boolean;
};

/** The mounted Architectural workspace is the only reader of the design; a closed workspace yields null, never a guess. */
async function readArchitectProject(): Promise<ArchitectProject | null> {
  if (!hasArchitectController()) return null;
  try {
    const result = (await requestArchitectTool("read", { expectedJobId: useStudio.getState().job.id })) as { project?: ArchitectProject } | null;
    return result?.project && Array.isArray(result.project.walls) ? result.project : null;
  } catch {
    return null;
  }
}

/** Same source read_draftsman_status uses (the viewer's model info); falls back to the viewer's active catalog button, then the matched source sha256. */
async function mountedBuilding(): Promise<Building | null> {
  const byId = (id: string | undefined | null) => BUILDING_CATALOG.find(entry => entry.id === id) ?? null;
  if (hasDraftsmanController()) {
    try {
      const status = (await requestDraftsmanTool("status", {})) as { model?: { id?: string } | null } | null;
      const found = byId(status?.model?.id);
      if (found) return { id: found.id, title: found.title };
    } catch {
      /* unmatched or loading model: the viewer refuses playback status; fall through to the DOM */
    }
  }
  const activeTitle = document.querySelector(".building-left-nav button.active")?.textContent?.trim();
  const byTitle = BUILDING_CATALOG.find(entry => entry.title === activeTitle);
  if (byTitle) return { id: byTitle.id, title: byTitle.title };
  const sha256 = useStudio.getState().activePlanBinary?.sha256;
  const bySource = BUILDING_CATALOG.find(entry => entry.sha256 === sha256);
  return bySource ? { id: bySource.id, title: bySource.title } : null;
}

async function describeSourcePartById(partId: string): Promise<{ ref: CanvasReference | null; building: Building | null }> {
  const building = await mountedBuilding();
  if (!building) return { ref: null, building };
  try {
    return { ref: describeSourcePart(await loadCatalogScene(building.id), building.id, partId), building };
  } catch {
    return { ref: null, building };
  }
}

async function describeTarget(target: MenuTarget): Promise<{ ref: CanvasReference; awaitingSelection: boolean }> {
  if (target.kind === "architect-plan") {
    const project = await readArchitectProject();
    const entity = project && target.entityId ? describeArchitectEntity(project, target.entityId) : null;
    return { ref: entity ?? architectPlanViewReference(project), awaitingSelection: false };
  }
  if (target.kind === "architect-3d") return { ref: architect3dViewReference(await readArchitectProject(), target.designRevision), awaitingSelection: false };
  if (target.kind === "source-building") {
    if (target.selectedPart) {
      const { ref, building } = await describeSourcePartById(target.selectedPart);
      if (ref) return { ref, awaitingSelection: false };
      return { ref: sourceBuildingViewReference(building), awaitingSelection: false };
    }
    return { ref: sourceBuildingViewReference(await mountedBuilding()), awaitingSelection: true };
  }
  const state = useStudio.getState();
  return { ref: sheetViewReference(state.activePlanBinary?.name ?? null, state.sheet), awaitingSelection: false };
}

/** Waits for the viewer's click handler to publish data-selected-part; a stale value must survive the settle window. */
function waitForSelectedPart(canvas: HTMLElement | null): Promise<string | null> {
  return new Promise(resolve => {
    if (!canvas) return resolve(null);
    const before = canvas.dataset.selectedPart || null, started = Date.now();
    const tick = () => {
      const elapsed = Date.now() - started;
      const accepted = acceptSelectedPart(before, canvas.dataset.selectedPart || null, elapsed);
      if (accepted) return resolve(accepted);
      if (elapsed >= PICK_SELECTION_TIMEOUT_MS) return resolve(null);
      setTimeout(tick, PICK_SELECTION_POLL_MS);
    };
    setTimeout(tick, PICK_SELECTION_POLL_MS);
  });
}

const focusableItems = (root: HTMLElement | null) => Array.from(root?.querySelectorAll<HTMLButtonElement>(".canvas-context-item:not(:disabled)") ?? []);

export function CanvasContextMenu({ native = isNativeShell() }: { native?: boolean } = {}) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [position, setPosition] = useState<Point | null>(null);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const request = useCanvasPick(state => state.request);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const press = useRef<PointerPress | null>(null);
  const opening = useRef(0);

  const close = useCallback(() => {
    opening.current++;
    setMenu(null);
    setPosition(null);
    setModifyOpen(false);
    setInstruction("");
  }, []);

  const open = useCallback((anchor: Point, target: MenuTarget) => {
    const key = ++opening.current;
    setPosition(null);
    setModifyOpen(false);
    setInstruction("");
    setMenu({ key, anchor, target, ref: null, items: [], caption: null, loading: true });
    void describeTarget(target).then(({ ref, awaitingSelection }) => {
      if (opening.current !== key) return;
      setMenu(current => current && current.key === key
        ? { ...current, ref, items: menuItemsFor(ref, { native, awaitingSelection }), caption: menuCaption(ref), loading: false }
        : current);
    }).catch(() => {
      // A design or scene that cannot be described still gets a menu: the view reference only.
      if (opening.current !== key) return;
      const ref: CanvasReference = { kind: "view", target: target.kind === "source-building" ? "source-building" : target.kind === "source-sheet" ? "source-sheet" : target.kind === "architect-3d" ? "architect-3d" : "architect-plan", summary: "current view (details unavailable)" };
      setMenu(current => current && current.key === key
        ? { ...current, ref, items: menuItemsFor(ref, { native, awaitingSelection: false }), caption: menuCaption(ref), loading: false }
        : current);
    });
  }, [native]);

  // Right-press tracking and the capture-phase contextmenu listener; the canvases keep their own handlers.
  useEffect(() => {
    const down = (event: PointerEvent) => {
      if (event.button === 2 || event.pointerType !== "mouse") press.current = beginPress(event.clientX, event.clientY, event.timeStamp);
    };
    const move = (event: PointerEvent) => {
      if (press.current) press.current = trackPress(press.current, event.clientX, event.clientY);
    };
    // A finished press must not gate a later keyboard-invoked menu (Shift+F10 / the Menu key).
    const up = (event: PointerEvent) => {
      if (press.current && event.button === 2) setTimeout(() => { press.current = null; }, 0);
    };
    const context = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target && root.current?.contains(target)) { event.preventDefault(); return; }
      const resolved = resolveMenuTarget(target);
      if (!resolved) return;
      if (!pressStayedPut(press.current, { x: event.clientX, y: event.clientY }, event.timeStamp)) return;
      event.preventDefault();
      const keyboard = event.clientX === 0 && event.clientY === 0 && target;
      const rect = keyboard ? target.getBoundingClientRect() : null;
      open(rect ? { x: rect.left + Math.min(rect.width / 2, 120), y: rect.top + Math.min(rect.height / 2, 80) } : { x: event.clientX, y: event.clientY }, resolved);
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", up, true);
    document.addEventListener("contextmenu", context, true);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", up, true);
      document.removeEventListener("contextmenu", context, true);
    };
  }, [open]);

  // Clamp inside the viewport once the menu has a size; re-run when the item list or the inline input changes it.
  useLayoutEffect(() => {
    const node = root.current;
    if (!menu || !node) return;
    const rect = node.getBoundingClientRect();
    const next = clampMenuPosition(menu.anchor, { width: rect.width, height: rect.height }, { width: window.innerWidth, height: window.innerHeight });
    setPosition(previous => (previous && previous.x === next.x && previous.y === next.y ? previous : next));
  }, [menu, modifyOpen]);

  useEffect(() => {
    if (!menu || menu.loading) return;
    if (modifyOpen) input.current?.focus();
    else focusableItems(root.current)[0]?.focus();
  }, [menu, modifyOpen]);

  // Click-outside, Escape (capture, so a focused plan cannot swallow it), and layout changes close the menu.
  useEffect(() => {
    if (!menu) return;
    const pointer = (event: PointerEvent) => {
      if (event.target instanceof Node && root.current?.contains(event.target)) return;
      // The dismissing click must not also draw on the plan or select a part.
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Tab") { close(); return; }
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    const away = () => close();
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("keydown", key, true);
    window.addEventListener("resize", away);
    window.addEventListener("scroll", away, true);
    window.addEventListener("blur", away);
    return () => {
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("keydown", key, true);
      window.removeEventListener("resize", away);
      window.removeEventListener("scroll", away, true);
      window.removeEventListener("blur", away);
    };
  }, [menu, close]);

  // Pick mode: the next plan entity or model part click becomes a reference; the click still reaches the app.
  useEffect(() => {
    if (!request) return;
    let disposed = false;
    document.body.classList.add("is-canvas-picking");
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || root.current?.contains(target) || target.closest(".canvas-pick-banner")) return;
      const picked = resolvePickTarget(target);
      if (!picked) return;
      if (picked.kind === "architect-entity") {
        void readArchitectProject().then(project => {
          if (disposed || !project) return;
          const ref = describeArchitectEntity(project, picked.entityId);
          if (ref) useCanvasPick.getState().resolve(ref);
        });
        return;
      }
      const host = target.closest<HTMLElement>(BUILDING_CANVAS_SELECTOR);
      const canvas = target instanceof HTMLCanvasElement ? target : host?.querySelector<HTMLCanvasElement>("canvas") ?? null;
      void waitForSelectedPart(canvas).then(async partId => {
        if (disposed || !partId) return;
        const { ref } = await describeSourcePartById(partId);
        if (ref && !disposed) useCanvasPick.getState().resolve(ref);
      });
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || root.current) return;
      useCanvasPick.getState().cancel();
    };
    document.addEventListener("click", click, true);
    document.addEventListener("keydown", key, true);
    return () => {
      disposed = true;
      document.body.classList.remove("is-canvas-picking");
      document.removeEventListener("click", click, true);
      document.removeEventListener("keydown", key, true);
    };
  }, [request]);

  function activate(item: MenuItem) {
    if (!menu?.ref || item.disabled) return;
    if (item.action.type === "insert") {
      insertReference(menu.ref, item.action.intent);
      close();
    } else if (item.action.type === "modify") {
      setModifyOpen(true);
    } else if (item.action.type === "pick") {
      close();
      useCanvasPick.getState().start({ prompt: PICK_PROMPT, accept: [...PICK_ACCEPT] });
    }
  }

  function submitInstruction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = instruction.trim();
    if (!menu?.ref || !text) return;
    insertReference(menu.ref, text);
    close();
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    const inInput = event.target instanceof HTMLInputElement;
    if (inInput && (event.key === "Home" || event.key === "End")) return;
    const items = focusableItems(root.current);
    const index = menuIndexForKey(event.key, items.indexOf(document.activeElement as HTMLButtonElement), items.length);
    if (index === null || index < 0) return;
    event.preventDefault();
    items[index].focus();
  }

  if (!menu && !request) return null;
  const at = position ?? menu?.anchor ?? { x: 0, y: 0 };
  return createPortal(
    <>
      {request && (
        <div className="canvas-pick-banner" role="status" aria-live="polite">
          <span className="canvas-pick-banner-text">{request.prompt}</span>
          <span className="canvas-pick-banner-hint"><kbd>Esc</kbd> cancels</span>
          <button type="button" onClick={() => useCanvasPick.getState().cancel()}>Cancel</button>
        </div>
      )}
      {menu && (
        <div
          ref={root}
          className="canvas-context-menu"
          role="menu"
          aria-label="Canvas AI actions"
          aria-busy={menu.loading}
          data-target={menu.target.kind}
          data-state={menu.loading ? "loading" : "ready"}
          style={{ left: at.x, top: at.y }}
          onKeyDown={onKeyDown}
          onContextMenu={event => event.preventDefault()}
        >
          <div className="canvas-context-caption" role="presentation">
            <strong>{menu.caption?.title ?? "Reading the canvas…"}</strong>
            {menu.caption && <span>{menu.caption.detail}</span>}
          </div>
          {menu.items.map(item => (
            <div key={item.id} role="presentation" className="canvas-context-row">
              <button
                type="button"
                role="menuitem"
                className={"canvas-context-item" + (item.action.type === "note" ? " is-note" : "")}
                data-item={item.id}
                disabled={item.disabled}
                aria-expanded={item.action.type === "modify" ? modifyOpen : undefined}
                onClick={() => activate(item)}
              >
                {item.label}
              </button>
              {item.action.type === "modify" && modifyOpen && (
                <form className="canvas-context-modify" onSubmit={submitInstruction}>
                  <label htmlFor="canvas-context-instruction">What should change?</label>
                  <input
                    ref={input}
                    id="canvas-context-instruction"
                    type="text"
                    value={instruction}
                    placeholder={MODIFY_PLACEHOLDER}
                    maxLength={500}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={event => setInstruction(event.target.value)}
                  />
                  <div className="canvas-context-modify-actions">
                    <button type="submit" disabled={!instruction.trim()}>Add to chat</button>
                    <span>Enter adds the reference and your instruction to the chat draft. Nothing is sent yet.</span>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </>,
    document.body,
  );
}
