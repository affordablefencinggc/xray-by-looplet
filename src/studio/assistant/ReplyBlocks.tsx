import { useState, type ReactNode } from "react";
import {
  AlertTriangle, BrickWall, Calculator, ClipboardCheck, Compass, Copy, DoorOpen, FileDown, FileText, FolderKanban,
  Grid2x2, Home, Image, Layers, ListChecks, Reply, Ruler, Search, Square, Boxes,
} from "lucide-react";
import { layoutMindMap } from "./mindMapLayout";
import { parseReply, quoteForReply, blockText, type Block, type HeadingIcon, type Inline, type MindNode } from "./replyMarkdown";

const ICONS: Record<HeadingIcon, ((props: { size?: number }) => ReactNode) | null> = {
  roof: Home, wall: BrickWall, door: DoorOpen, window: Grid2x2, level: Layers, slab: Square, room: Boxes, sheet: FileText,
  measure: Ruler, cost: Calculator, export: FileDown, render: Image, project: FolderKanban, model: Compass, evidence: ClipboardCheck,
  summary: ListChecks, warning: AlertTriangle, search: Search, none: null,
};

export type ReplyBlocksProps = {
  text: string;
  /** "Reply" on a block: the block quoted into the composer. */
  onReply?: (quote: string, block: Block) => void;
  /** An entity ID chip clicked: reference that element in the chat. */
  onReference?: (id: string) => void;
  disabled?: boolean;
};

function Inlines({ inlines, onReference, disabled }: { inlines: Inline[]; onReference?: (id: string) => void; disabled?: boolean }) {
  return <>
    {inlines.map((inline, index) => {
      switch (inline.kind) {
        case "bold": return <strong key={index}>{inline.text}</strong>;
        case "italic": return <em key={index}>{inline.text}</em>;
        case "code": return <code key={index}>{inline.text}</code>;
        case "link": return <a key={index} href={inline.href} target="_blank" rel="noopener noreferrer">{inline.text}</a>;
        case "id": return <button key={index} type="button" className="assistant-id-chip" title={`Reference ${inline.id} in the chat`} aria-label={`Reference element ${inline.id.slice(0, 8)} in the chat`} disabled={disabled || !onReference} onClick={() => onReference?.(inline.id)}>{inline.id.slice(0, 8)}…</button>;
        default: return <span key={index}>{inline.text}</span>;
      }
    })}
  </>;
}

function MindMap({ root, source }: { root: MindNode; source: string }) {
  const layout = layoutMindMap(root);
  return <figure className="assistant-mindmap" role="img" aria-label={`Mind map: ${root.label}`}>
    <svg viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width} height={layout.height}>
      {layout.edges.map(edge => <path key={`${edge.from}-${edge.to}`} d={edge.path} className="assistant-mindmap-edge" />)}
      {layout.nodes.map(node => <g key={node.id} className={`assistant-mindmap-node depth-${node.depth}`} transform={`translate(${node.x} ${node.y})`}>
        <title>{node.full}</title>
        <rect width={node.width} height={node.height} rx={node.depth === 0 ? 13 : 8} />
        <text x={node.width / 2} y={node.height / 2 + 4} textAnchor="middle">{node.label}</text>
      </g>)}
    </svg>
    <details className="assistant-mindmap-source"><summary>Outline</summary><pre>{source}</pre></details>
  </figure>;
}

function CodeBlock({ text, lang }: { text: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ }
  };
  return <div className="assistant-code">
    <div className="assistant-code-bar"><span>Technical output kept out of the chat{lang ? ` (${lang})` : ""}</span><button type="button" className="assistant-block-action" aria-label="Copy the technical output" data-label={copied ? "Copied" : "Copy"} onClick={() => void copy()}><Copy size={13} /></button></div>
    <pre hidden aria-hidden="true"><code>{text}</code></pre>
  </div>;
}

/** Renders one assistant reply as real headings, lists, code, tables, quotes and mind maps; every text block gets a "Reply" action. */
export function ReplyBlocks({ text, onReply, onReference, disabled }: ReplyBlocksProps) {
  const blocks = parseReply(text);
  const reply = (block: Block) => onReply?.(quoteForReply(blockText(block)), block);
  const replyButton = (block: Block, label: string) => onReply
    ? <button type="button" className="assistant-block-action assistant-block-reply" aria-label={`Reply to this ${label}`} title="Quote this into your message" data-label="Reply" disabled={disabled} onClick={() => reply(block)}><Reply size={13} /></button>
    : null;
  return <div className="assistant-reply">
    {blocks.map((block, index) => {
      const key = `${block.kind}-${index}`;
      switch (block.kind) {
        case "heading": {
          const Icon = ICONS[block.icon];
          const Tag = block.level <= 2 ? "h3" : "h4";
          return <div key={key} className="assistant-block assistant-block-heading" data-icon={block.icon}>
            <Tag className="assistant-heading">{Icon ? <Icon size={15} /> : null}<span><Inlines inlines={block.inlines} onReference={onReference} disabled={disabled} /></span></Tag>
            {replyButton(block, "heading")}
          </div>;
        }
        case "paragraph":
          return <div key={key} className="assistant-block assistant-block-paragraph"><p><Inlines inlines={block.inlines} onReference={onReference} disabled={disabled} /></p>{replyButton(block, "paragraph")}</div>;
        case "list": {
          const Tag = block.ordered ? "ol" : "ul";
          return <div key={key} className="assistant-block assistant-block-list"><Tag>{block.items.map((item, itemIndex) => <li key={itemIndex}><Inlines inlines={item.inlines} onReference={onReference} disabled={disabled} /></li>)}</Tag>{replyButton(block, "list")}</div>;
        }
        case "quote":
          return <div key={key} className="assistant-block assistant-block-quote"><blockquote><Inlines inlines={block.inlines} onReference={onReference} disabled={disabled} /></blockquote>{replyButton(block, "quote")}</div>;
        case "code":
          return <div key={key} className="assistant-block"><CodeBlock text={block.text} lang={block.lang} /></div>;
        case "mindmap":
          return <div key={key} className="assistant-block assistant-block-mindmap"><MindMap root={block.root} source={block.text} />{replyButton(block, "mind map")}</div>;
        case "table":
          return <div key={key} className="assistant-block assistant-block-table"><div className="assistant-table-scroll"><table><thead><tr>{block.header.map((cell, cellIndex) => <th key={cellIndex}>{cell}</th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>{replyButton(block, "table")}</div>;
        case "rule":
          return <hr key={key} className="assistant-rule" />;
      }
    })}
  </div>;
}

/** Tool receipts: JSON is pretty-printed and trimmed so a receipt reads at a glance; other text stays as-is. */
export function formatToolText(text: string, max = 4000): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try { const pretty = JSON.stringify(JSON.parse(trimmed), null, 1); return pretty.length > max ? pretty.slice(0, max) + "\n…" : pretty; } catch { /* not JSON */ }
  }
  return trimmed.length > max ? trimmed.slice(0, max) + "…" : trimmed;
}
