import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  acceptSelectedPart,
  architect3dViewReference,
  architectPlanViewReference,
  beginPress,
  CANVAS_INTENTS,
  clampMenuPosition,
  filterForShell,
  menuCaption,
  menuIndexForKey,
  menuItemsFor,
  MENU_VIEWPORT_MARGIN,
  nextMenuIndex,
  pressStayedPut,
  resolveMenuTarget,
  resolvePickTarget,
  sheetViewReference,
  sourceBuildingViewReference,
  trackPress,
  type ElementProbe,
} from "./canvasContextMenuModel.ts";
import type { CanvasReference } from "./assistant/canvasReference.ts";

/** Minimal fake DOM: tag, classes and attributes, with the simple selectors the resolvers use. */
type Fake = ElementProbe & { tag: string; classes: Set<string>; attrs: Map<string, string>; parent: Fake | null; children: Fake[] };
function matchesOne(node: Fake, selector: string): boolean {
  const tag = /^[a-z][a-z0-9-]*/i.exec(selector)?.[0];
  if (tag && node.tag !== tag) return false;
  const rest = tag ? selector.slice(tag.length) : selector;
  for (const cls of rest.match(/\.[\w-]+/g) ?? []) if (!node.classes.has(cls.slice(1))) return false;
  for (const attr of rest.match(/\[[^\]]+\]/g) ?? []) {
    const parsed = /^\[([\w-]+)(?:="?([^"\]]*)"?)?\]$/.exec(attr);
    if (!parsed) throw Error(`unsupported selector ${selector}`);
    const value = node.attrs.get(parsed[1]);
    if (value === undefined || (parsed[2] !== undefined && value !== parsed[2])) return false;
  }
  return true;
}
function el(tag: string, options: { className?: string; attrs?: Record<string, string>; children?: Fake[] } = {}): Fake {
  const node: Fake = {
    tag,
    classes: new Set((options.className ?? "").split(/\s+/).filter(Boolean)),
    attrs: new Map(Object.entries(options.attrs ?? {})),
    parent: null,
    children: options.children ?? [],
    matches: selectors => selectors.split(",").some(part => matchesOne(node, part.trim())),
    closest(selectors) {
      for (let current: Fake | null = node; current; current = current.parent) if (current.matches(selectors)) return current;
      return null;
    },
    getAttribute: name => node.attrs.get(name) ?? null,
    querySelector(selectors) {
      for (const child of node.children) {
        if (child.matches(selectors)) return child;
        const deep = child.querySelector!(selectors);
        if (deep) return deep;
      }
      return null;
    },
  };
  for (const child of node.children) child.parent = node;
  return node;
}

const wallPath = el("path", { attrs: { "data-entity-id": "w1" } });
const gridRect = el("rect");
const threeCanvas = el("canvas", { attrs: { "aria-label": "Live architectural 3D model" } });
el("section", {
  className: "architect-workspace",
  attrs: { "data-design-revision": "7", "data-design-id": "job-1" },
  children: [el("div", { className: "arch-canvases with-three", children: [el("svg", { className: "architect-plan", children: [gridRect, el("g", { children: [wallPath] })] }), el("div", { className: "architect-three", children: [threeCanvas] })] })],
});
const selectedCanvas = el("canvas", { attrs: { "data-selected-part": "p-1" } });
const emptyCanvas = el("canvas", { attrs: { "data-selected-part": "" } });
const toolbarButton = el("button");
el("div", { className: "source-building", children: [el("div", { className: "building-workspace", children: [el("div", { className: "building-canvas", children: [selectedCanvas] }), el("div", { className: "building-toolbar", children: [toolbarButton] })] })] });
const buildingOverlay = el("div", { className: "building-overlay" });
el("div", { className: "building-canvas", children: [emptyCanvas, buildingOverlay] });
const sheetImage = el("img", { className: "document-source-page" });
const traceCanvas = el("canvas");
const measureButton = el("button", { className: "pill" });
const inspectorPhoto = el("img");
el("div", { className: "measure-workspace", children: [el("div", { className: "measure-main-column", children: [sheetImage, traceCanvas, measureButton] }), el("aside", { className: "measure-inspector", children: [inspectorPhoto] })] });
const unrelated = el("button");
el("div", { className: "studio-header", children: [unrelated] });

describe("resolveMenuTarget", () => {
  it("finds the plan entity under the cursor and an empty plan area", () => {
    assert.deepEqual(resolveMenuTarget(wallPath), { kind: "architect-plan", entityId: "w1" });
    assert.deepEqual(resolveMenuTarget(gridRect), { kind: "architect-plan", entityId: null });
  });
  it("reads the design revision for the live 3D canvas", () => {
    assert.deepEqual(resolveMenuTarget(threeCanvas), { kind: "architect-3d", designRevision: "7" });
  });
  it("reads the viewer's selected part from the model canvas and ignores its toolbar", () => {
    assert.deepEqual(resolveMenuTarget(selectedCanvas), { kind: "source-building", selectedPart: "p-1" });
    assert.deepEqual(resolveMenuTarget(emptyCanvas), { kind: "source-building", selectedPart: null });
    assert.deepEqual(resolveMenuTarget(buildingOverlay), { kind: "source-building", selectedPart: null }, "an overlay inside the host still targets the model");
    assert.equal(resolveMenuTarget(toolbarButton), null);
  });
  it("targets the sheet surfaces of the measure workspace only", () => {
    assert.deepEqual(resolveMenuTarget(sheetImage), { kind: "source-sheet" });
    assert.deepEqual(resolveMenuTarget(traceCanvas), { kind: "source-sheet" });
    assert.equal(resolveMenuTarget(measureButton), null, "tool buttons keep the browser menu");
    assert.equal(resolveMenuTarget(inspectorPhoto), null, "evidence photos in the inspector are not sheets");
  });
  it("leaves everything else to the browser", () => {
    assert.equal(resolveMenuTarget(unrelated), null);
    assert.equal(resolveMenuTarget(null), null);
  });
});

describe("resolvePickTarget", () => {
  it("resolves plan entities immediately and defers model clicks to the viewer selection", () => {
    assert.deepEqual(resolvePickTarget(wallPath), { kind: "architect-entity", entityId: "w1" });
    assert.equal(resolvePickTarget(gridRect), null, "empty plan clicks stay in pick mode");
    assert.deepEqual(resolvePickTarget(selectedCanvas), { kind: "source-building" });
    assert.equal(resolvePickTarget(threeCanvas), null);
    assert.equal(resolvePickTarget(sheetImage), null);
  });
  it("accepts a changed selection at once but an unchanged one only after it settles", () => {
    assert.equal(acceptSelectedPart("p-1", "p-2", 50), "p-2");
    assert.equal(acceptSelectedPart("p-1", "p-1", 50), null);
    assert.equal(acceptSelectedPart("p-1", "p-1", 150), "p-1");
    assert.equal(acceptSelectedPart(null, "p-3", 50), "p-3");
    assert.equal(acceptSelectedPart("p-1", "", 600), null);
  });
});

const wall: CanvasReference = { kind: "architect-entity", entity: "wall", id: "w1", levelId: "lv-ground", levelName: "Ground", summary: "North wall" };
const part: CanvasReference = { kind: "source-part", building: "redburn", partId: "p-1", category: "wall", label: "North wall", storey: "upper", evidenceState: "traced", summary: "s" };
const planView: CanvasReference = { kind: "view", target: "architect-plan", summary: "plan" };

describe("menuItemsFor", () => {
  it("offers every AI action for an entity, in order, and never sends anything itself", () => {
    const items = menuItemsFor(wall, { native: false });
    assert.deepEqual(items.map(item => item.id), ["reference", "explain", "improve", "modify", "draw", "render", "pick"]);
    assert.deepEqual(items.map(item => item.label), ["Reference in chat", "Explain this", "Suggest improvements", "Modify with AI…", "Draw something like this here", "Real-life view of this", "Select a shape to reference…"]);
    assert.deepEqual(items[0].action, { type: "insert" });
    assert.deepEqual(items[1].action, { type: "insert", intent: CANVAS_INTENTS.explain });
    assert.deepEqual(items[2].action, { type: "insert", intent: "Suggest specific improvements for this. List the exact edits with IDs before making any change." });
    assert.deepEqual(items[3].action, { type: "modify" });
    assert.deepEqual(items[4].action, { type: "insert", intent: "Draw a similar element next to this one on the same level. Ask before overlapping existing elements." });
    assert.deepEqual(items[5].action, { type: "insert", intent: "Generate a real-life render of this view." });
    assert.deepEqual(items[6].action, { type: "pick" });
    assert.ok(items.every(item => !item.disabled));
  });
  it("hides the web-only render item in the native shell", () => {
    assert.deepEqual(menuItemsFor(wall, { native: true }).map(item => item.id), ["reference", "explain", "improve", "modify", "draw", "pick"]);
    assert.deepEqual(menuItemsFor(part, { native: true }).map(item => item.id), ["reference", "explain", "improve", "modify", "draw", "pick"]);
    assert.deepEqual(filterForShell(menuItemsFor(wall, { native: false }), true).map(item => item.id), ["reference", "explain", "improve", "modify", "draw", "pick"]);
  });
  it("gives view targets the view set only", () => {
    const items = menuItemsFor(planView, { native: false });
    assert.deepEqual(items.map(item => item.id), ["reference", "explain", "improve", "modify", "render", "pick"]);
    assert.equal(items[0].label, "Reference this view in chat");
    assert.deepEqual(menuItemsFor(planView, { native: true }).map(item => item.id), ["reference", "explain", "improve", "modify", "pick"]);
  });
  it("adds a disabled 'select a part first' line when the model has no selection", () => {
    const items = menuItemsFor(sourceBuildingViewReference({ id: "redburn", title: "Redburn BR250157" }), { native: false, awaitingSelection: true });
    assert.deepEqual(items.map(item => item.id), ["reference", "select-note", "explain", "improve", "modify", "render", "pick"]);
    assert.equal(items[1].label, "Select a part first (left-click it)");
    assert.equal(items[1].disabled, true);
    assert.deepEqual(items[1].action, { type: "note" });
  });
});

describe("captions and view references", () => {
  it("captions entities, parts and views so the user sees what will be referenced", () => {
    assert.deepEqual(menuCaption(wall), { title: "wall · w1", detail: "Level Ground" });
    assert.deepEqual(menuCaption(part), { title: "wall · North wall", detail: "redburn part p-1 · storey upper" });
    assert.deepEqual(menuCaption(planView), { title: "Architectural plan view", detail: "plan" });
  });
  it("summarises the design cheaply and falls back when the workspace cannot be read", () => {
    const project = { name: "Sivyer house", revision: 12, levels: [1, 2], walls: [1, 2, 3], openings: [1] };
    assert.equal(architectPlanViewReference(project).summary, 'architectural plan of "Sivyer house" revision 12: 2 levels, 3 walls, 1 opening');
    assert.equal(architectPlanViewReference(null).summary, "current architectural plan view");
    assert.equal(architect3dViewReference(project, "12").summary, 'current 3D view of the architectural "Sivyer house" revision 12: 2 levels, 3 walls, 1 opening');
    assert.equal(architect3dViewReference(null, "12").summary, "current 3D view of the architectural design, revision 12");
    assert.equal(architect3dViewReference(null, null).summary, "current 3D view of the architectural design");
    assert.equal(sourceBuildingViewReference(null).summary, "current Model viewer 3D view");
    assert.deepEqual(sheetViewReference("site-plan.pdf", 2), { kind: "view", target: "source-sheet", summary: '"site-plan.pdf", sheet 3' });
    assert.equal(sheetViewReference(null, 0).summary, "sheet 1, no source document loaded");
  });
});

describe("clampMenuPosition", () => {
  const menu = { width: 280, height: 360 };
  const viewport = { width: 1024, height: 768 };
  it("keeps a menu that fits where the pointer is", () => {
    assert.deepEqual(clampMenuPosition({ x: 100, y: 120 }, menu, viewport), { x: 100, y: 120 });
  });
  it("pulls the menu back inside the right and bottom edges", () => {
    assert.deepEqual(clampMenuPosition({ x: 1000, y: 700 }, menu, viewport), { x: 1024 - 8 - 280, y: 768 - 8 - 360 });
  });
  it("never leaves the top-left margin, even for a menu larger than the viewport", () => {
    assert.deepEqual(clampMenuPosition({ x: -20, y: -5 }, menu, viewport), { x: MENU_VIEWPORT_MARGIN, y: MENU_VIEWPORT_MARGIN });
    assert.deepEqual(clampMenuPosition({ x: 300, y: 300 }, { width: 400, height: 900 }, { width: 360, height: 640 }), { x: 8, y: 8 });
    assert.deepEqual(clampMenuPosition({ x: 10.4, y: 10.6 }, menu, viewport), { x: 10, y: 11 }, "whole pixels");
  });
});

describe("right-drag rule", () => {
  it("opens for a still right-click and not for a pan", () => {
    const press = beginPress(200, 300, 1000);
    assert.equal(pressStayedPut(press, { x: 202, y: 301 }, 1100), true);
    assert.equal(pressStayedPut(press, { x: 200, y: 340 }, 1100), false, "released far away");
    const dragged = trackPress(trackPress(press, 200, 320), 200, 300);
    assert.equal(dragged.travelled, 20);
    assert.equal(pressStayedPut(dragged, { x: 200, y: 300 }, 1100), false, "dragged out and back");
    assert.equal(trackPress(press, 201, 301).travelled < 4, true);
    assert.equal(pressStayedPut(trackPress(press, 204, 300), { x: 204, y: 300 }, 1100), true, "exactly at the 4 px threshold");
    assert.equal(pressStayedPut(trackPress(press, 205, 300), { x: 205, y: 300 }, 1100), false);
  });
  it("treats a missing or stale press as a keyboard-invoked menu", () => {
    assert.equal(pressStayedPut(null, { x: 0, y: 0 }, 5000), true);
    const old = beginPress(10, 10, 0);
    assert.equal(pressStayedPut(old, { x: 900, y: 900 }, 2501), true);
    assert.equal(pressStayedPut(old, { x: 900, y: 900 }, 2400), false);
  });
});

describe("keyboard navigation", () => {
  it("wraps arrow keys and jumps with Home and End", () => {
    assert.equal(nextMenuIndex(-1, 1, 5), 0);
    assert.equal(nextMenuIndex(-1, -1, 5), 4);
    assert.equal(nextMenuIndex(4, 1, 5), 0);
    assert.equal(nextMenuIndex(0, -1, 5), 4);
    assert.equal(nextMenuIndex(2, 1, 5), 3);
    assert.equal(nextMenuIndex(0, 1, 0), -1);
    assert.equal(menuIndexForKey("ArrowDown", 1, 3), 2);
    assert.equal(menuIndexForKey("ArrowUp", 0, 3), 2);
    assert.equal(menuIndexForKey("Home", 2, 3), 0);
    assert.equal(menuIndexForKey("End", 0, 3), 2);
    assert.equal(menuIndexForKey("Enter", 0, 3), null);
    assert.equal(menuIndexForKey("Home", 0, 0), -1);
  });
});
