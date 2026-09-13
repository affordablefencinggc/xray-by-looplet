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
const REPORT_HEADING = /\b(?:steps taken|actions (?:actually )?executed|tools? (?:actually )?executed|tool receipts|blockers|prerequisites|observations|results|work completed)\b/i;
// A following rhetorical heading ("Can a takeoff run?") is not asking the user
// to choose from the preceding factual list. Require a selection word here.
const FOLLOWING_CHOICE_CUE = /^(?:please\s+)?(?:which\b|choose\b|pick\b|select\b|(?:do|would) you (?:prefer|like (?:one|any) of these)\b|let me know (?:which|your (?:choice|preference))\b)/i;
const RECEIPT = /^\s*(?:Running .*…|Tool (?:completed|failed)\.?|Not executed:|\{|\[|"[^"]*"\s*:)/;

const stripMarkdown = (text: string) => text.replace(/\*\*|__|`/g, "").replace(/^\*(.+)\*$/, "$1").trim();
const clip = (text: string, max: number) => (text.length <= max ? text : text.slice(0, max - 1).trimEnd() + "…");

/** Text after an explicit option marker (number, letter, "Option X"), or undefined when the line carries none. */
const markedOption = (line: string) =>
  OPTION_WORD.exec(line)?.[1] ?? BULLET_MARKED.exec(line)?.[1] ?? NUMBERED.exec(line)?.[3] ?? LETTERED.exec(line)?.[3];

export function parseReplyOptions(text: string): ReplyOptions {
  // A self-assessment is commentary, never an instruction for the user to select.
  const lines = text.split(/\r?\n/).filter((() => {
    let reviewing = false;
    return (line: string) => {
      if (/^\s*(?:#{1,6}\s*)?(?:\*\*|__)?Developer review(?:\*\*|__)?\s*:?(?:\*\*|__)?\s*$/i.test(line)) { reviewing = true; return false; }
      if (reviewing && /^#{1,6}\s+/.test(line)) reviewing = false;
      return !reviewing;
    };
  })());
  const lists: { items: string[]; selectable: boolean; report: boolean }[] = [];
  const questions: string[] = [];
  let current: typeof lists[number] | null = null;
  let previousLine = "";
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim() || RECEIPT.test(line)) continue; // blank lines and receipts/JSON neither open nor close a list
    const marked = markedOption(line);
    const body = marked ?? BULLET.exec(line)?.[1];
    if (body !== undefined) {
      if (RECEIPT.test(body)) continue; // a marker in front of JSON or a receipt is still not a choice
      if (!current) {
        current = { items: [], selectable: CUE.test(previousLine), report: REPORT_HEADING.test(previousLine) };
        lists.push(current);
      }
      const item = stripMarkdown(body);
      if (item) current.items.push(item);
      continue;
    }
    const plain = stripMarkdown(line);
    // A question elsewhere in the response must not activate every earlier list.
    // Only the immediately adjacent prose can introduce or follow these choices.
    if (current && FOLLOWING_CHOICE_CUE.test(plain)) current.selectable = true;
    current = null;
    previousLine = plain;
    if (/\?$/.test(plain) && !questions.includes(plain)) questions.push(clip(plain, 240));
  }
  const options: ReplyOption[] = [];
  for (const list of lists) {
    if (!list.selectable || list.report || list.items.length > MAX_OPTIONS) continue;
    for (const item of list.items) {
      const send = item.length > OPTION_SEND_MAX ? item.slice(0, OPTION_SEND_MAX).trimEnd() : item;
      if (!send || options.some(option => option.send === send)) continue;
      options.push({ label: clip(item, OPTION_LABEL_MAX), send });
    }
  }
  return { options: options.slice(0, MAX_OPTIONS), questions };
}

export const SELECT_SHAPE_SUGGESTION = "Select a shape to reference";

/** Only choices in the current exchange replace fallback suggestions; old history does not. */
export function hasCurrentReplyChoices(entries: readonly { kind: string; text: string; selectableReference?: boolean }[]): boolean {
  let inspectedReply = false;
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index];
    if (entry.kind === 'user') break;
    if (entry.selectableReference) return true;
    if (entry.kind === 'assistant' && !inspectedReply) {
      inspectedReply = true;
      const reply = parseReplyOptions(entry.text);
      if (reply.options.length || reply.questions.length) return true;
    }
  }
  return false;
}
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
