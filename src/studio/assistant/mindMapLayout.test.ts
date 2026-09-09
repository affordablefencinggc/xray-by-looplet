import test from "node:test";
import assert from "node:assert/strict";
import { MIND_MAP, layoutMindMap, truncateLabel } from "./mindMapLayout.ts";
import { parseMindMap } from "./replyMarkdown.ts";

test("a root with two children lays out left to right with the root centred on its children", () => {
  const layout = layoutMindMap(parseMindMap("Building\n  Ground\n  Roof")!);
  const root = layout.nodes.find(node => node.depth === 0)!;
  const children = layout.nodes.filter(node => node.depth === 1);
  assert.equal(children.length, 2);
  assert.equal(root.x, MIND_MAP.padding);
  assert.ok(children.every(child => child.x > root.x + root.width));
  assert.equal(root.y, (children[0].y + children[1].y) / 2);
  assert.equal(layout.edges.length, 2);
  assert.ok(layout.edges.every(edge => edge.path.startsWith("M ") && edge.path.includes(" C ")));
  assert.ok(layout.width > 0 && layout.height >= children[1].y + children[1].height);
});

test("deep trees are capped at four levels and sixty nodes; labels are truncated with the full text kept", () => {
  const deep = parseMindMap("A\n  B\n    C\n      D\n        E\n          F")!;
  const layout = layoutMindMap(deep);
  assert.equal(Math.max(...layout.nodes.map(node => node.depth)), MIND_MAP.maxDepth - 1);
  const wide = { label: "Root", children: Array.from({ length: 80 }, (_, index) => ({ label: `Leaf ${index} with a very long label that keeps going`, children: [] })) };
  const wideLayout = layoutMindMap(wide);
  assert.ok(wideLayout.nodes.length <= MIND_MAP.maxNodes);
  const leaf = wideLayout.nodes.find(node => node.depth === 1)!;
  assert.ok(leaf.label.endsWith("…") && leaf.label.length <= MIND_MAP.maxLabel);
  assert.ok(leaf.full.length > leaf.label.length);
  assert.equal(truncateLabel("short"), "short");
});
