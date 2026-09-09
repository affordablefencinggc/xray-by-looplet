/**
 * Reply markdown: a small, safe parser that turns the assistant's Markdown-ish text into a block
 * tree the chat renders as real headings, lists, code, tables, quotes and mind maps. No HTML is
 * ever interpreted; links are kept only for http(s) URLs; entity IDs become reference chips.
 * Deterministic and dependency-free so it is unit-testable and identical on web and native.
 */
export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string }
  | { kind: "id"; id: string };
export type MindNode = { label: string; children: MindNode[] };
export type HeadingIcon =
  | "roof" | "wall" | "door" | "window" | "level" | "slab" | "room" | "sheet" | "measure" | "cost"
  | "export" | "render" | "project" | "model" | "evidence" | "summary" | "warning" | "search" | "none";
export type Block =
  | { kind: "heading"; level: 1 | 2 | 3 | 4; text: string; inlines: Inline[]; icon: HeadingIcon }
  | { kind: "paragraph"; text: string; inlines: Inline[] }
  | { kind: "list"; ordered: boolean; items: { text: string; inlines: Inline[] }[] }
  | { kind: "code"; lang: string; text: string }
  | { kind: "mindmap"; root: MindNode; text: string }
  | { kind: "quote"; text: string; inlines: Inline[] }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "rule" };

export const ENTITY_ID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
const BULLET = /^\s*[-*•]\s+(.*)$/;
const ORDERED = /^\s*(?:\d{1,3}[.)]|[a-hA-H][.)])\s+(.*)$/;
const FENCE = /^\s*```\s*([A-Za-z0-9_-]*)\s*$/;
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const QUOTE = /^\s*>\s?(.*)$/;
const TABLE_ROW = /^\s*\|(.+)\|\s*$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
/** Emoticon faces, hand gestures and the like; architectural and object emoji are left alone. */
const FACES = /[\u{1F600}-\u{1F64F}\u{1F910}-\u{1F92F}\u{1F970}-\u{1F97F}\u{1F9D0}-\u{1F9D2}\u{263A}\u{2639}\u{1F44B}-\u{1F450}\u{1F64C}\u{1F64F}\u{1F91D}\u{1F44D}\u{1F44E}]️?/gu;
const HEADING_ICONS: Array<[HeadingIcon, RegExp]> = [
  ["warning", /\b(warnings?|caution|limits?|limitations?|blockers?|cannot|unavailable|risks?)\b/i],
  ["roof", /\broofs?\b/i],
  ["door", /\b(doors?|openings?)\b/i],
  ["window", /\b(windows?|glazing)\b/i],
  ["wall", /\bwalls?\b/i],
  ["slab", /\b(slabs?|floor plates?|footings?)\b/i],
  ["level", /\b(levels?|storeys?|stories|story|floors?|elevations?)\b/i],
  ["room", /\b(rooms?|zones?|spaces?|corridors?|cores?|labs?)\b/i],
  ["sheet", /\b(sheets?|drawings?|pages?|register|pdf)\b/i],
  ["measure", /\b(measure\w*|calibrat\w*|traces?|takeoff|dimensions?|lengths?|areas?)\b/i],
  ["cost", /\b(costs?|prices?|pricing|rates?|quotes?|budget|suppliers?)\b/i],
  ["export", /\b(exports?|dxf|ifc|downloads?|files?)\b/i],
  ["render", /\b(renders?|rendering|visualisations?|visualizations?|images?|views?)\b/i],
  ["model", /\b(models?|3d|viewer|reconstructions?|draftsman)\b/i],
  ["evidence", /\b(evidence|verified|sources?|provenance|backups?)\b/i],
  ["search", /\b(search|research|web|references?)\b/i],
  ["project", /\b(projects?|workspaces?|navigation|panes?|context)\b/i],
  ["summary", /\b(summary|next steps?|overview|results?|done|options?|recommend\w*)\b/i],
];

/** Removes smiley-type emoji (the app adds its own restrained icons) and tidies LaTeX-style wrappers. */
export function tidyReplyText(text: string): string {
  return text
    .replace(FACES, "")
    .replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\$([^$\n]{1,80})\$/g, "$1")
    .replace(/[ \t]+$/gm, "");
}

export function headingIcon(text: string): HeadingIcon {
  for (const [icon, pattern] of HEADING_ICONS) if (pattern.test(text)) return icon;
  return "none";
}

const stripMarker = (text: string) => text.replace(/^\s*(?:#{1,6}\s+|[-*•]\s+|\d{1,3}[.)]\s+|[a-hA-H][.)]\s+)/, "").trim();

/** Inline tokenizer: bold, italic, code spans, [text](https://…) links, bare https URLs and entity IDs. */
export function parseInlines(text: string): Inline[] {
  const out: Inline[] = [];
  const push = (inline: Inline) => {
    const last = out[out.length - 1];
    if (inline.kind === "text" && last?.kind === "text") last.text += inline.text;
    else if (!(inline.kind === "text" && !inline.text)) out.push(inline);
  };
  const pattern = /(\*\*(.+?)\*\*|`([^`\n]+)`|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>)]+)|\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b|(?<![\w*])\*([^*\n]+?)\*(?![\w*])|(?<![\w_])_([^_\n]+?)_(?![\w_]))/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) push({ kind: "text", text: text.slice(last, index) });
    if (match[2] !== undefined) push({ kind: "bold", text: match[2] });
    else if (match[3] !== undefined) push(ENTITY_ID.test(match[3]) && match[3].trim().match(ENTITY_ID)?.[0] === match[3].trim() ? { kind: "id", id: match[3].trim() } : { kind: "code", text: match[3] });
    else if (match[4] !== undefined && match[5] !== undefined) push({ kind: "link", text: match[4], href: match[5] });
    else if (match[6] !== undefined) push({ kind: "link", text: match[6], href: match[6] });
    else if (match[7] !== undefined) push({ kind: "id", id: match[7] });
    else if (match[8] !== undefined) push({ kind: "italic", text: match[8] });
    else if (match[9] !== undefined) push({ kind: "italic", text: match[9] });
    last = index + match[0].length;
  }
  if (last < text.length) push({ kind: "text", text: text.slice(last) });
  return out;
}

/** An indented outline (two spaces or a tab per level, optional bullet markers) → a tree; the first line is the root. */
export function parseMindMap(text: string): MindNode | null {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) return null;
  const nodes: { depth: number; node: MindNode }[] = [];
  let root: MindNode | null = null;
  for (const raw of lines) {
    const indent = (raw.match(/^[ \t]*/)?.[0] ?? "").replace(/\t/g, "  ").length;
    const label = stripMarker(raw).replace(/\*\*|`/g, "").trim();
    if (!label) continue;
    const depth = root ? Math.max(1, Math.floor(indent / 2) + (/^\s*[-*•]/.test(raw) ? 1 : 0)) : 0;
    const node: MindNode = { label: label.slice(0, 60), children: [] };
    if (!root) { root = node; nodes.push({ depth: 0, node }); continue; }
    while (nodes.length > 1 && nodes[nodes.length - 1].depth >= depth) nodes.pop();
    nodes[nodes.length - 1].node.children.push(node);
    nodes.push({ depth, node });
  }
  return root;
}

const plainText = (inlines: Inline[]) => inlines.map(inline => (inline.kind === "id" ? inline.id : inline.text)).join("");

export function parseReply(raw: string): Block[] {
  const text = tidyReplyText(raw);
  const lines = text.split(/\r?\n/);
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];
  const flushParagraph = () => {
    if (!paragraph.length) return;
    const joined = paragraph.join(" ").replace(/\s+/g, " ").trim();
    if (joined) { const inlines = parseInlines(joined); blocks.push({ kind: "paragraph", text: plainText(inlines), inlines }); }
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push({ kind: "list", ordered: list.ordered, items: list.items.map(item => { const inlines = parseInlines(item); return { text: plainText(inlines), inlines }; }) });
    list = null;
  };
  const flushQuote = () => {
    if (!quote.length) return;
    const inlines = parseInlines(quote.join(" ").trim());
    blocks.push({ kind: "quote", text: plainText(inlines), inlines });
    quote = [];
  };
  const flushAll = () => { flushParagraph(); flushList(); flushQuote(); };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const fence = FENCE.exec(line);
    if (fence) {
      flushAll();
      const lang = (fence[1] || "").toLowerCase();
      const body: string[] = [];
      index++;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) body.push(lines[index++]);
      const code = body.join("\n").replace(/\s+$/, "");
      if (lang === "mindmap" || lang === "mind-map") {
        const root = parseMindMap(code);
        if (root) blocks.push({ kind: "mindmap", root, text: code }); else blocks.push({ kind: "code", lang, text: code });
      } else blocks.push({ kind: "code", lang, text: code });
      continue;
    }
    if (!line.trim()) { flushAll(); continue; }
    const heading = HEADING.exec(line);
    if (heading) {
      flushAll();
      const level = Math.min(4, Math.max(1, heading[1].length)) as 1 | 2 | 3 | 4;
      const inlines = parseInlines(heading[2]);
      const plain = plainText(inlines);
      blocks.push({ kind: "heading", level, text: plain, inlines, icon: headingIcon(plain) });
      continue;
    }
    if (RULE.test(line)) { flushAll(); blocks.push({ kind: "rule" }); continue; }
    const tableRow = TABLE_ROW.exec(line);
    if (tableRow && index + 1 < lines.length && TABLE_SEP.test(lines[index + 1])) {
      flushAll();
      const cells = (row: string) => row.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map(cell => cell.replace(/\*\*|`/g, "").trim());
      const header = cells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && TABLE_ROW.test(lines[index])) rows.push(cells(lines[index++]));
      index--;
      blocks.push({ kind: "table", header, rows: rows.slice(0, 40) });
      continue;
    }
    const quoted = QUOTE.exec(line);
    if (quoted) { flushParagraph(); flushList(); quote.push(quoted[1]); continue; }
    const bullet = BULLET.exec(line);
    const ordered = !bullet && ORDERED.exec(line);
    if (bullet || ordered) {
      flushParagraph(); flushQuote();
      const isOrdered = !!ordered;
      if (!list || list.ordered !== isOrdered) { flushList(); list = { ordered: isOrdered, items: [] }; }
      list.items.push((bullet ? bullet[1] : (ordered as RegExpExecArray)[1]).trim());
      continue;
    }
    if (list && /^\s{2,}\S/.test(line)) { list.items[list.items.length - 1] += " " + line.trim(); continue; }
    flushList(); flushQuote();
    paragraph.push(line.trim());
  }
  flushAll();
  return blocks;
}

/** The text a "Reply" button quotes into the composer: a Markdown quote of the block, bounded. */
export function quoteForReply(text: string, max = 280): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const clipped = clean.length > max ? clean.slice(0, max - 1).trimEnd() + "…" : clean;
  return "> " + clipped + "\n";
}

/** Plain text of a block, for reply quoting and tests. */
export function blockText(block: Block): string {
  switch (block.kind) {
    case "heading": case "paragraph": case "quote": return block.text;
    case "list": return block.items.map(item => item.text).join("; ");
    case "code": case "mindmap": return block.text;
    case "table": return [block.header, ...block.rows].map(row => row.join(" | ")).join("\n");
    case "rule": return "";
  }
}
