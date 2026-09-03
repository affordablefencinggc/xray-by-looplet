import type { Pane, Tool } from "./store";

export interface KeyboardShortcutActions {
  setPane: (pane: Pane) => void;
  setTool: (tool: Tool) => void;
  toggleSnapping: () => void;
  clearPending: () => void;
  commitPending: () => void;
  pendingLength: number;
}

export function shouldIgnoreShortcuts(activeElement: Element | null): boolean {
  if (!activeElement) return false;

  const tagName = activeElement.tagName.toUpperCase();
  if (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    ("isContentEditable" in activeElement && (activeElement as any).isContentEditable)
  ) {
    return true;
  }
  return false;
}

export function handleStudioKeyDown(
  e: { key: string; preventDefault: () => void },
  actions: KeyboardShortcutActions,
  panes: { id: Pane; label: string }[]
) {
  const key = e.key;

  if (key === "l" || key === "L") {
    e.preventDefault();
    actions.setPane("measure");
    actions.setTool("length");
  } else if (key === "a" || key === "A") {
    e.preventDefault();
    actions.setPane("measure");
    actions.setTool("area");
  } else if (key === "c" || key === "C") {
    e.preventDefault();
    actions.setPane("measure");
    actions.setTool("count");
  } else if (key === "m" || key === "M") {
    e.preventDefault();
    actions.setPane("sketch");
    actions.setTool("sketch");
  } else if (key === "s" || key === "S") {
    e.preventDefault();
    actions.toggleSnapping();
  } else if (key === "Escape") {
    e.preventDefault();
    actions.clearPending();
    actions.setTool("none");
  } else if (key === "Enter") {
    if (actions.pendingLength > 0) {
      e.preventDefault();
      actions.commitPending();
    }
  } else if (key >= "1" && key <= "9") {
    const idx = parseInt(key, 10) - 1;
    if (panes[idx]) {
      e.preventDefault();
      actions.setPane(panes[idx].id);
    }
  }
}
