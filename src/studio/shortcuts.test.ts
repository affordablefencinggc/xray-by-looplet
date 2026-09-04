import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { handleStudioKeyDown, shouldIgnoreShortcuts, type KeyboardShortcutActions } from "./shortcuts.ts";
import type { Pane, Tool } from "./store.ts";

const MOCK_PANES: { id: Pane; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "sheets", label: "Sheets" },
  { id: "measure", label: "Measure" },
  { id: "sketch", label: "Sketch" },
  { id: "components", label: "Components" },
  { id: "model", label: "Model" },
  { id: "review", label: "Review" },
  { id: "cost", label: "Cost" },
  { id: "proof", label: "Proof" },
];

function createMockActions(overrides?: Partial<KeyboardShortcutActions>) {
  const log: string[] = [];
  const actions: KeyboardShortcutActions = {
    setPane: (p: Pane) => {
      log.push(`setPane:${p}`);
    },
    setTool: (t: Tool) => {
      log.push(`setTool:${t}`);
    },
    toggleSnapping: () => {
      log.push("toggleSnapping");
    },
    clearPending: () => {
      log.push("clearPending");
    },
    commitPending: () => {
      log.push("commitPending");
    },
    pendingLength: 0,
    ...overrides,
  };
  return { actions, log };
}

describe("Keyboard Shortcuts Engine", () => {
  describe("shouldIgnoreShortcuts", () => {
    it("returns false for null activeElement", () => {
      assert.equal(shouldIgnoreShortcuts(null), false);
    });

    it("returns true for INPUT, TEXTAREA, and SELECT elements", () => {
      assert.equal(shouldIgnoreShortcuts({ tagName: "input" } as any), true);
      assert.equal(shouldIgnoreShortcuts({ tagName: "textarea" } as any), true);
      assert.equal(shouldIgnoreShortcuts({ tagName: "select" } as any), true);
    });

    it("returns true for contenteditable elements", () => {
      assert.equal(
        shouldIgnoreShortcuts({ tagName: "div", isContentEditable: true } as any),
        true
      );
    });

    it("returns false for standard elements", () => {
      assert.equal(
        shouldIgnoreShortcuts({ tagName: "div", isContentEditable: false } as any),
        false
      );
      assert.equal(shouldIgnoreShortcuts({ tagName: "button" } as any), false);
    });
  });

  describe("handleStudioKeyDown", () => {
    it("handles L for Length tool", () => {
      const { actions, log } = createMockActions();
      let prevented = false;
      const event = {
        key: "l",
        preventDefault: () => {
          prevented = true;
        },
      };

      handleStudioKeyDown(event, actions, MOCK_PANES);
      assert.equal(prevented, true);
      assert.deepEqual(log, ["setPane:measure", "setTool:length"]);
    });

    it("handles uppercase keys (A for Area)", () => {
      const { actions, log } = createMockActions();
      let prevented = false;
      const event = {
        key: "A",
        preventDefault: () => {
          prevented = true;
        },
      };

      handleStudioKeyDown(event, actions, MOCK_PANES);
      assert.equal(prevented, true);
      assert.deepEqual(log, ["setPane:measure", "setTool:area"]);
    });

    it("handles C for Count tool", () => {
      const { actions, log } = createMockActions();
      let prevented = false;
      const event = {
        key: "c",
        preventDefault: () => {
          prevented = true;
        },
      };

      handleStudioKeyDown(event, actions, MOCK_PANES);
      assert.equal(prevented, true);
      assert.deepEqual(log, ["setPane:measure", "setTool:count"]);
    });

    it("handles M as the visible Move tool without routing to the removed Sketch pane", () => {
      const { actions, log } = createMockActions();
      handleStudioKeyDown({ key: "m", preventDefault: () => {} }, actions, MOCK_PANES);
      assert.deepEqual(log, ["setPane:measure", "setTool:none"]);
    });

    it("handles Escape to cancel / clear pending", () => {
      const { actions, log } = createMockActions();
      let prevented = false;
      const event = {
        key: "Escape",
        preventDefault: () => {
          prevented = true;
        },
      };

      handleStudioKeyDown(event, actions, MOCK_PANES);
      assert.equal(prevented, true);
      assert.deepEqual(log, ["clearPending", "setTool:none"]);
    });

    it("handles Enter to commit pending if there are pending points", () => {
      const { actions, log } = createMockActions({ pendingLength: 3 });
      let prevented = false;
      const event = {
        key: "Enter",
        preventDefault: () => {
          prevented = true;
        },
      };

      handleStudioKeyDown(event, actions, MOCK_PANES);
      assert.equal(prevented, true);
      assert.deepEqual(log, ["commitPending"]);
    });

    it("does not handle Enter if pendingLength is 0", () => {
      const { actions, log } = createMockActions({ pendingLength: 0 });
      let prevented = false;
      const event = {
        key: "Enter",
        preventDefault: () => {
          prevented = true;
        },
      };

      handleStudioKeyDown(event, actions, MOCK_PANES);
      assert.equal(prevented, false);
      assert.deepEqual(log, []);
    });

    it("handles numeric keys (1-9) to switch panes", () => {
      const { actions, log } = createMockActions();
      let prevented = false;
      const event = {
        key: "3",
        preventDefault: () => {
          prevented = true;
        },
      };

      handleStudioKeyDown(event, actions, MOCK_PANES);
      assert.equal(prevented, true);
      assert.deepEqual(log, ["setPane:measure"]);
    });

    it("ignores keys that are not registered", () => {
      const { actions, log } = createMockActions();
      let prevented = false;
      const event = {
        key: "z",
        preventDefault: () => {
          prevented = true;
        },
      };

      handleStudioKeyDown(event, actions, MOCK_PANES);
      assert.equal(prevented, false);
      assert.deepEqual(log, []);
    });
  });
});
