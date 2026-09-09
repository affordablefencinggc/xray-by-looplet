import type { ChatImage } from "./conversation";

/**
 * Rich replies: turns the assistant's own text into clickable choices, and offers
 * context-aware next steps. Nothing here contacts a provider; a pill only sends
 * the text the user clicks.
 */
export type ReplyOption = { label: string; send: string };
export type ReplyOptions = { options: ReplyOption[]; questions: string[] };
export const MAX_OPTIONS = 8;
export const OPTION_SEND_MAX = 160;
export const OPTION_LABEL_MAX = 72;

const NUMBERED = /^\s*(?:\(?(\d{1,2})[.):]|(\d{1,2})\))\s+(.+?)\s*$/;
const LETTERED = /^\s*(?:\(?([A-Ha-h])[.):]|([A-Ha-h])\))\s+(.+?)\s*$/;
const OPTION_WORD = /^\s*(?:[-*•]\s*)?Option\s+(?:[A-Za-z]|\d{1,2})\s*[:.)\-–—]\s*(.+?)\s*$/i;
const BULLET_MARKED = /^\s*[-*•]\s+(?:\(?(?:\d{1,2}|[A-Ha-h])[.):])\s+(.+?)\s*$/;
const BULLET = /^\s*[-*•]\s+(.+?)\s*$/;
const CUE = /\?\s*$|\boptions?\b|\bchoose\b|\bwould you like\b|\bwhich (?:one|of these|do you)\b|\bpick\b|\bprefer\b|\bselect one\b|\blet me know\b/i;
const RECEIPT = /^\s*(?:Running .*…|Tool (?:completed|failed)\.?|Not executed:|\{|\[|"[^"]*"\s*:)/;

const stripMarkdown = (text: string) => text.replace(/\*\*|__|`/g, "").replace(/^\*(.+)\*$/, "$1").trim();
const clip = (text: string, max: number) => (text.length <= max ? text : text.slice(0, max - 1).trimEnd() + "…");

/** Text after an explicit option marker (number, letter, "Option X"), or undefined when the line carries none. */
const markedOption = (line: string) =>
  OPTION_WORD.exec(line)?.[1] ?? BULLET_MARKED.exec(line)?.[1] ?? NUMBERED.exec(line)?.[3] ?? LETTERED.exec(line)?.[3];

export function parseReplyOptions(text: string): ReplyOptions {
  const lines = text.split(/\r?\n/);
  const lists: string[][] = [];
  const questions: string[] = [];
  let current: string[] | null = null;
  let bulletsAllowed = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim() || RECEIPT.test(line)) continue; // blank lines and receipts/JSON neither open nor close a list
    const marked = markedOption(line);
    const body = marked ?? (bulletsAllowed ? BULLET.exec(line)?.[1] : undefined);
    if (body !== undefined) {
      if (RECEIPT.test(body)) continue; // a marker in front of JSON or a receipt is still not a choice
      if (!current) { current = []; lists.push(current); }
      const item = stripMarkdown(body);
      if (item) current.push(item);
      continue;
    }
    current = null;
    bulletsAllowed = CUE.test(line);
    const plain = stripMarkdown(line);
    if (/\?$/.test(plain) && !questions.includes(plain)) questions.push(clip(plain, 240));
  }
  // A list is only a set of choices when the reply asks for one somewhere (before or after it);
  // "steps taken" recaps, receipts and headings never become clickable instructions.
  const asksForChoice = lines.some(line => CUE.test(stripMarkdown(line)));
  const options: ReplyOption[] = [];
  for (const list of asksForChoice ? lists : []) {
    if (list.length > MAX_OPTIONS) continue;
    for (const item of list) {
      const send = item.length > OPTION_SEND_MAX ? item.slice(0, OPTION_SEND_MAX).trimEnd() : item;
      if (!send || options.some(option => option.send === send)) continue;
      options.push({ label: clip(item, OPTION_LABEL_MAX), send });
    }
  }
  return { options: options.slice(0, MAX_OPTIONS), questions };
}

export const SELECT_SHAPE_SUGGESTION = "Select a shape to reference";
export const USE_IMAGE_SUGGESTION = "Use this image as a reference";
export const SUGGESTION_MIN = 3;
export const SUGGESTION_MAX = 4;
const DRAWING_REPLY = /\b(drew|drawn|draw|created|added|placed|extruded|updated|moved|removed|walls?|slabs?|roofs?|levels?|storeys?|doors?|windows?|openings?|footprint)\b/i;

export type SuggestionContext = { pane: string; lastReplyText: string; hasDesign: boolean; native: boolean; hasImages: boolean };

/** Three to four next-step pills. Order: mandatory canvas pill, image pill, context pills, fallbacks. */
export function suggestionsFor(context: SuggestionContext): string[] {
  const out: string[] = [];
  const add = (...items: string[]) => { for (const item of items) if (!out.includes(item) && out.length < SUGGESTION_MAX) out.push(item); };
  const canvas = context.hasDesign || context.pane === "model";
  if (canvas) add(SELECT_SHAPE_SUGGESTION);
  if (context.hasImages) add(USE_IMAGE_SUGGESTION);
  const reply = context.lastReplyText.trim();
  if (context.hasDesign && reply && DRAWING_REPLY.test(reply)) add("Show all levels in 3D", "Export as DXF", "Undo that");
  if (context.pane === "model") { add("Describe the selected part"); if (!context.native) add("Generate a real-life view"); }
  if (/\?$/.test(reply)) add("Yes, go ahead");
  if (context.hasDesign) add("Draw a room 6 m × 4 m", "Add a level above", "Show all levels in 3D");
  if (context.pane === "measure") add("Calibrate this sheet", "Measure the longest wall");
  if (context.pane === "sheets") add("Summarise this sheet", "Find the site plan");
  if (context.pane === "cost") add("Estimate the materials", "Review the takeoff");
  if (context.pane === "model") add("List the storeys", "Capture this view");
  add("What can you do here?", "Describe the current view", "Save the project");
  return out.slice(0, Math.max(SUGGESTION_MIN, Math.min(SUGGESTION_MAX, out.length)));
}

/** The most recent image the assistant or a tool produced in the latest exchange (trailing non-user entries). */
export function latestReplyImage<T extends { kind: string; images?: ChatImage[] }>(entries: readonly T[]): ChatImage | null {
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index];
    if (entry.kind === "user") return null;
    if (entry.images?.length) return entry.images[0];
  }
  return null;
}
