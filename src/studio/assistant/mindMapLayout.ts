import type { MindNode } from "./replyMarkdown";

/**
 * Mind map layout: a tidy left-to-right tree (root on the left, children stacked, parents
 * centred on their children). Pure geometry so the chat can render it as inline SVG and
 * tests can pin the numbers. Labels are truncated for the box; the full label goes in a title.
 */
export type LaidOutNode = { id: string; label: string; full: string; depth: number; x: number; y: number; width: number; height: number };
export type LaidOutEdge = { from: string; to: string; path: string };
export type MindMapLayout = { nodes: LaidOutNode[]; edges: LaidOutEdge[]; width: number; height: number };
export const MIND_MAP = Object.freeze({ nodeHeight: 26, rowGap: 8, columnGap: 28, charWidth: 6.4, padding: 10, maxLabel: 26, maxDepth: 4, maxNodes: 60 });

export function truncateLabel(label: string, max = MIND_MAP.maxLabel): string {
  const clean = label.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : clean.slice(0, max - 1).trimEnd() + "…";
}

export function layoutMindMap(root: MindNode): MindMapLayout {
  const nodes: LaidOutNode[] = [];
  const edges: LaidOutEdge[] = [];
  const columnWidth: number[] = [];
  let row = 0, count = 0;
  const rowPitch = MIND_MAP.nodeHeight + MIND_MAP.rowGap;
  const measure = (label: string) => Math.max(48, Math.round(truncateLabel(label).length * MIND_MAP.charWidth) + 16);
  // First pass: assign rows (leaves take a row each; parents centre on their children) and column widths.
  const place = (node: MindNode, depth: number, id: string): LaidOutNode => {
    count++;
    const width = measure(node.label);
    columnWidth[depth] = Math.max(columnWidth[depth] ?? 0, width);
    const children = depth < MIND_MAP.maxDepth - 1 && count < MIND_MAP.maxNodes ? node.children.slice(0, MIND_MAP.maxNodes - count) : [];
    const laid: LaidOutNode = { id, label: truncateLabel(node.label), full: node.label, depth, x: 0, y: 0, width, height: MIND_MAP.nodeHeight };
    if (!children.length) { laid.y = row * rowPitch; row++; nodes.push(laid); return laid; }
    const placed = children.map((child, index) => place(child, depth + 1, `${id}.${index}`));
    laid.y = (placed[0].y + placed[placed.length - 1].y) / 2;
    nodes.push(laid);
    for (const child of placed) edges.push({ from: id, to: child.id, path: "" });
    return laid;
  };
  place(root, 0, "n");
  // Second pass: x from column widths, then edge paths (cubic curves from the parent's right edge to the child's left edge).
  const columnX: number[] = [];
  let x = MIND_MAP.padding;
  for (let depth = 0; depth < columnWidth.length; depth++) { columnX[depth] = x; x += columnWidth[depth] + MIND_MAP.columnGap; }
  for (const node of nodes) { node.x = columnX[node.depth]; node.y += MIND_MAP.padding; }
  const byId = new Map(nodes.map(node => [node.id, node]));
  for (const edge of edges) {
    const from = byId.get(edge.from)!, to = byId.get(edge.to)!;
    const x1 = from.x + from.width, y1 = from.y + from.height / 2, x2 = to.x, y2 = to.y + to.height / 2, mid = (x1 + x2) / 2;
    edge.path = `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
  }
  const width = x - MIND_MAP.columnGap + MIND_MAP.padding;
  const height = Math.max(...nodes.map(node => node.y + node.height)) + MIND_MAP.padding;
  return { nodes: nodes.sort((a, b) => a.depth - b.depth || a.y - b.y), edges, width, height };
}
