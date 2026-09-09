import type { AssistantContent } from "./contract";
import type { ChatImage } from "./conversation";
import { isAssistantEditTool } from "./skills.ts";

/**
 * Context budget: a cheap, deterministic estimate of how much of the provider
 * transcript the chat has used, and a handover note that carries the work into a
 * fresh chat once the limit is reached. No provider call is made here; the
 * estimate is ~4 characters per token plus a flat cost per image.
 */
export const CONTEXT_LIMIT_TOKENS = 300_000;
export const CONTEXT_WARN_TOKENS = 240_000;
export const IMAGE_TOKENS = 1_000;
/** Provider caps the guard must fire before: 40 contents (conversation.ts stops at > 38) and 12 MB per request. */
export const CONTEXT_CONTENTS_FULL = 36;
export const CONTEXT_CONTENTS_WARN = 30;
export const CONTEXT_BYTES_FULL = 10 * 1024 * 1024;
export const CONTEXT_BYTES_WARN = 8 * 1024 * 1024;
export const HANDOVER_MAX_CHARS = 6_000;
export const CONTEXT_FULL_MESSAGE =
  "This chat reached its 300,000-token context limit. Continue in a new chat to carry your work over.";

export type ContextLevel = "ok" | "warn" | "full";
export type ContextState = { level: ContextLevel; percent: number; tokens: number; limit: number };

const textTokens = (text: string) => Math.ceil(text.length / 4);

export type ContextMeasure = { tokens: number; bytes: number; count: number };
/** Tokens (≈ chars/4, flat per image), approximate request bytes and the number of contents in one pass. */
export function measureContext(contents: readonly AssistantContent[]): ContextMeasure {
  let tokens = 0, bytes = 0;
  for (const content of contents) {
    for (const part of content.parts) {
      if (typeof part.text === "string") { tokens += textTokens(part.text); bytes += part.text.length; }
      if (part.inlineData) { tokens += IMAGE_TOKENS; bytes += part.inlineData.data.length; }
      if (part.functionCall) { const json = JSON.stringify(part.functionCall); tokens += textTokens(json); bytes += json.length; }
      if (part.functionResponse) { const json = JSON.stringify(part.functionResponse); tokens += textTokens(json); bytes += json.length; }
    }
  }
  return { tokens, bytes, count: contents.length };
}
export function estimateContextTokens(contents: readonly AssistantContent[]): number {
  return measureContext(contents).tokens;
}

/**
 * The guard state. Besides the 300k-token budget it folds in the provider caps the conversation
 * would otherwise hit first (contents count, request bytes), so "full" always arrives with the
 * continue button rather than a dead chat.
 */
export function contextState(tokens: number, extra: { count?: number; bytes?: number } = {}): ContextState {
  const safe = Number.isFinite(tokens) && tokens > 0 ? Math.floor(tokens) : 0;
  const count = Number.isFinite(extra.count) ? Math.max(0, extra.count as number) : 0;
  const bytes = Number.isFinite(extra.bytes) ? Math.max(0, extra.bytes as number) : 0;
  const level: ContextLevel =
    safe >= CONTEXT_LIMIT_TOKENS || count >= CONTEXT_CONTENTS_FULL || bytes >= CONTEXT_BYTES_FULL ? "full"
    : safe >= CONTEXT_WARN_TOKENS || count >= CONTEXT_CONTENTS_WARN || bytes >= CONTEXT_BYTES_WARN ? "warn"
    : "ok";
  const ratio = Math.max(safe / CONTEXT_LIMIT_TOKENS, count / CONTEXT_CONTENTS_FULL, bytes / CONTEXT_BYTES_FULL);
  return { level, percent: Math.min(100, Math.round(ratio * 100)), tokens: safe, limit: CONTEXT_LIMIT_TOKENS };
}

/**
 * QA floor: a positive integer in localStorage under this key raises the estimate to at least
 * that many tokens (never lowers it), so the warn/full states can be exercised without a
 * 300,000-token transcript. It can only make the guard stricter.
 */
export const CONTEXT_FLOOR_KEY = "xray:assistant-context-floor";
export function readContextFloor(storage: Pick<Storage, "getItem"> | null | undefined): number {
  try {
    const raw = storage?.getItem(CONTEXT_FLOOR_KEY);
    if (!raw) return 0;
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}
export function applyContextFloor(tokens: number, floor: number): number {
  return Math.max(Number.isFinite(tokens) ? tokens : 0, Number.isFinite(floor) ? floor : 0);
}

/** Meter label and tooltip: "Context 12%" / "≈36,000 of 300,000 tokens". */
export function describeContext(tokens: number): { label: string; title: string; state: ContextState } {
  const state = contextState(tokens);
  const format = (value: number) => value.toLocaleString("en-US");
  return { label: `Context ${state.percent}%`, title: `≈${format(state.tokens)} of ${format(state.limit)} tokens`, state };
}

/** Structural view of a chat entry so the handover builder has no runtime dependency on the store. */
export type HandoverEntry = { kind: "user" | "assistant" | "tool"; text: string; toolName?: string; failed?: boolean; images?: ChatImage[] };
export const STATE_CHANGING_TOOL = /^(draw_|edit_|undo_|manage_|calibrate_|trace_|review_|remove_|import_|export_|capture_project_backup|save_project)/;
/** Every edit-permission tool (the same set skills.ts gates) plus the prefix list, so undo and future edit tools are never dropped from a handover. */
export const isStateChangingTool = (name: string) => isAssistantEditTool(name) || STATE_CHANGING_TOOL.test(name);
export const HANDOVER_HEADING = "Handover from the previous chat";
export const HANDOVER_CONTINUED_PREFIX = "Continued from the previous chat.";
const OUTSTANDING = /^Paused after eight assistant steps|^Paused at the 24-tool budget|context limit|^This conversation is full/;

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();
const clip = (text: string, max: number) => (text.length <= max ? text : text.slice(0, max - 1).trimEnd() + "…");

export function buildHandover(input: { jobId: string; entries: readonly HandoverEntry[]; contents?: readonly AssistantContent[]; reason?: string | null }): string {
  const requests = input.entries.filter(entry => entry.kind === "user" && entry.text.trim()).map(entry => clip(oneLine(entry.text), 300));
  const receipts = input.entries
    .filter(entry => entry.kind === "tool" && !entry.failed && entry.toolName && isStateChangingTool(entry.toolName) && !/^Running .*…$/.test(entry.text.trim()))
    .map(entry => `${entry.toolName}: ${clip(oneLine(entry.text) || "completed", 200)}`);
  const lastReply = [...input.entries].reverse().find(entry => entry.kind === "assistant" && entry.text.trim() && !entry.text.startsWith(HANDOVER_CONTINUED_PREFIX));
  const reason = input.reason?.trim() || "";
  const outstanding = OUTSTANDING.test(reason)
    ? `Outstanding: the previous chat stopped before finishing (${reason}). The last request may be incomplete; read the current project state before continuing.`
    : "";

  const assemble = (requestCount: number, receiptCount: number) => {
    const lines = [HANDOVER_HEADING, `Project: ${input.jobId}`];
    const keptRequests = requests.slice(requests.length - requestCount);
    lines.push(`Requests (oldest first${requests.length > keptRequests.length ? `, ${requests.length - keptRequests.length} earlier omitted` : ""}):`);
    lines.push(...(keptRequests.length ? keptRequests.map((text, index) => `${index + 1}. ${text}`) : ["(none)"]));
    const keptReceipts = receipts.slice(receipts.length - receiptCount);
    lines.push(`Changes made (tool receipts${receipts.length > keptReceipts.length ? `, ${receipts.length - keptReceipts.length} earlier omitted` : ""}):`);
    lines.push(...(keptReceipts.length ? keptReceipts.map(text => `- ${text}`) : ["- (no state-changing tools ran)"]));
    lines.push("Last assistant reply:", lastReply ? clip(lastReply.text.trim(), 1200) : "(none)");
    if (outstanding) lines.push(outstanding);
    return lines.join("\n");
  };

  let requestCount = requests.length, receiptCount = receipts.length;
  let text = assemble(requestCount, receiptCount);
  // Drop the oldest requests first, then the oldest receipts, until the note fits.
  while (text.length > HANDOVER_MAX_CHARS && (requestCount > 1 || receiptCount > 1)) {
    if (requestCount > 1 && (requestCount >= receiptCount || receiptCount <= 1)) requestCount--;
    else receiptCount--;
    text = assemble(requestCount, receiptCount);
  }
  return text.length > HANDOVER_MAX_CHARS ? clip(text, HANDOVER_MAX_CHARS) : text;
}
