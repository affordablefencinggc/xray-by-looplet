import type { MindNode } from "./replyMarkdown";

/**
 * Mind map layout: a top-down tree (root above, children below, parents
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
    const placed: LaidOutNode[] = [];
    for(const [index,child] of children.entries()){if(count>=MIND_MAP.maxNodes)break;placed.push(place(child,depth+1,`${id}.${index}`));}
    laid.y = (placed[0].y + placed[placed.length - 1].y) / 2;
    nodes.push(laid);
    for (const child of placed) edges.push({ from: id, to: child.id, path: "" });
    return laid;
  };
  place(root, 0, "n");
  // Top-down: reserve a fixed column pitch per leaf, then centre each parent above its children.
  const pitch=Math.max(...nodes.map(node=>node.width))+MIND_MAP.columnGap;
  for(const node of nodes){const leafPosition=node.y/rowPitch;node.x=MIND_MAP.padding+leafPosition*pitch+(pitch-node.width)/2;node.y=MIND_MAP.padding+node.depth*(MIND_MAP.nodeHeight+40);}
  const byId=new Map(nodes.map(node=>[node.id,node]));
  for(const edge of edges){
    const from=byId.get(edge.from)!,to=byId.get(edge.to)!;
    const x1=from.x+from.width/2,y1=from.y+from.height,x2=to.x+to.width/2,y2=to.y,mid=(y1+y2)/2;
    edge.path=`M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
  }
  return {nodes:nodes.sort((a,b)=>a.depth-b.depth||a.x-b.x),edges,width:Math.max(...nodes.map(n=>n.x+n.width))+MIND_MAP.padding,height:Math.max(...nodes.map(n=>n.y+n.height))+MIND_MAP.padding};
}
