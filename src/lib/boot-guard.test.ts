/**
 * The boot guard's three outcomes, each asserted separately.
 *
 * The guard exists because a frozen global reaches no render boundary. A check
 * that only ever reports success is not a check, so the non-configurable case —
 * the one that actually produced a white screen — has its own test asserting a
 * named panel is painted.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { BOOT_GUARD_SOURCE, bootGuard } from "./boot-guard.ts";

/** Stands in for `#root` and the handful of DOM calls the guard makes. */
interface StubElement {
  attributes: Record<string, string>;
  children: StubElement[];
  cssText: string;
  style: { cssText: string };
  textContent: string;
  readonly childElementCount: number;
  readonly firstChild: StubElement | null;
  setAttribute(name: string, value: string): void;
  appendChild(child: StubElement): void;
  removeChild(child: StubElement): void;
}

function makeElement(): StubElement {
  const element: StubElement = {
    attributes: {},
    children: [],
    cssText: "",
    style: { cssText: "" },
    textContent: "",
    get childElementCount() {
      return element.children.length;
    },
    get firstChild() {
      return element.children[0] ?? null;
    },
    setAttribute(name, value) {
      element.attributes[name] = value;
    },
    appendChild(child) {
      element.children.push(child);
    },
    removeChild(child) {
      const at = element.children.indexOf(child);
      if (at !== -1) element.children.splice(at, 1);
    },
  };
  return element;
}

/** Runs the guard with `document` stubbed, restoring the global afterwards. */
function withGuard<T>(
  mutate: () => void,
  body: (root: ReturnType<typeof makeElement>) => T,
  options: { withRoot?: boolean } = {},
): T {
  const withRoot = options.withRoot !== false;
  const root = makeElement();
  const host = withRoot ? root : makeElement();
  const saved = Object.getOwnPropertyDescriptor(Object.prototype, "toString")!;
  const realDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id: string) => (withRoot && id === "root" ? root : null),
    querySelector: () => (withRoot ? null : host),
    body: host,
    createElement: () => makeElement(),
  } as unknown as Document;
  try {
    mutate();
    bootGuard();
    return body(withRoot ? root : host);
  } finally {
    globalThis.document = realDocument;
    try {
      Object.defineProperty(Object.prototype, "toString", saved);
    } catch {
      // The non-configurable case cannot be undone; Node exits on a fresh
      // process per test file, so the mutation cannot leak into another suite.
    }
  }
}

test("a writable toString is left alone and no panel is painted", () => {
  withGuard(
    () => {},
    (root) => {
      assert.equal(root.attributes["data-boot-failure"], undefined);
      assert.equal(root.childElementCount, 0);
    },
  );
});

test("a writable toString is still writable, so the library can assign to it", () => {
  withGuard(
    () => {},
    () => {
      const descriptor = Object.getOwnPropertyDescriptor(Object.prototype, "toString");
      assert.equal(descriptor?.writable, true);
    },
  );
});

test("a read-only but configurable toString is repaired rather than reported", () => {
  withGuard(
    (saved => () => {
      Object.defineProperty(Object.prototype, "toString", {
        value: saved.value,
        writable: false,
        enumerable: saved.enumerable,
        configurable: true,
      });
    })(Object.getOwnPropertyDescriptor(Object.prototype, "toString")!),
    (root) => {
      assert.equal(root.attributes["data-boot-failure"], undefined);
      assert.equal(
        Object.getOwnPropertyDescriptor(Object.prototype, "toString")?.writable,
        true,
      );
    },
  );
});

test("a read-only and non-configurable toString paints a named failure", () => {
  withGuard(
    () => {
      Object.freeze(Object.prototype);
    },
    (root) => {
      assert.equal(root.attributes["data-boot-failure"], "globals");
      const card = root.children[0];
      assert.ok(card, "a panel must be painted");
      const text = card.children.map((child) => child.textContent).join(" ");
      assert.match(text, /X-Ray could not start/);
      assert.match(text, /not configurable/);
      assert.match(text, /Object\.prototype\.toString is writable/);
    },
  );
});

/**
 * The server renders a startup skeleton ("Opening your workspace") before the
 * app mounts. A guard that refuses to touch a non-empty host would leave that
 * skeleton standing above the failure panel, and the page would still read as
 * a hang — which is the bug this replaced.
 */
test("the server's startup skeleton is replaced, not left above the panel", () => {
  const root = makeElement();
  const skeleton = makeElement();
  skeleton.textContent = "Opening your workspace";
  root.appendChild(skeleton);

  const saved = Object.getOwnPropertyDescriptor(Object.prototype, "toString")!;
  const realDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id: string) => (id === "root" ? root : null),
    querySelector: () => null,
    body: makeElement(),
    createElement: () => makeElement(),
  } as unknown as Document;
  try {
    Object.freeze(Object.prototype);
    bootGuard();
    assert.equal(root.attributes["data-boot-failure"], "globals");
    assert.equal(root.childElementCount, 1, "the skeleton must be gone");
    const card = root.children[0];
    assert.ok(card);
    assert.doesNotMatch(card.textContent, /Opening your workspace/);
  } finally {
    globalThis.document = realDocument;
    try {
      Object.defineProperty(Object.prototype, "toString", saved);
    } catch {
      // see above — nothing to restore once the prototype is frozen
    }
  }
});

/**
 * The regression that shipped a no-op guard: the TanStack Start document has no
 * `#root`, so a guard that bails when `getElementById("root")` misses never runs
 * at all. The host must be resolved when the failure is reported, not up front.
 */
test("a document with no #root still gets a named failure", () => {
  withGuard(
    () => {
      Object.freeze(Object.prototype);
    },
    (host) => {
      assert.equal(host.attributes["data-boot-failure"], "globals");
      const card = host.children[0];
      assert.ok(card, "a panel must be painted into the fallback host");
      const text = card.children.map((child) => child.textContent).join(" ");
      assert.match(text, /X-Ray could not start/);
    },
    { withRoot: false },
  );
});

test("the exported source is the guard itself, ready to run inline", () => {
  assert.match(BOOT_GUARD_SOURCE, /^\(function bootGuard\(\)/);
  assert.match(BOOT_GUARD_SOURCE, /Object\.getOwnPropertyDescriptor/);
  // A guard that never inspects the descriptor cannot detect the condition.
  assert.match(BOOT_GUARD_SOURCE, /data-boot-failure/);
});
