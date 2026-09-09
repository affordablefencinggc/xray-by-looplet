/**
 * Turn capture: the seam between a finished chat turn and the rolling compressed log.
 *
 * One completed turn becomes at most one log entry. The chat entries the turn produced are read
 * for their tool names and receipts, contextLog.ts summariseTurn compresses them deterministically,
 * and the result is appended to the per-project store. Nothing here calls a model, so the same turn
 * always captures to the same entry.
 *
 * Failure posture is deliberately the opposite of contextLogStore.ts. The store rejects loudly so a
 * caller knows its bytes are unchanged; capture swallows that rejection, because a log write happens
 * after the user's work is already done and a full or blocked database must never turn a successful
 * send into a failed one. The entry is simply not recorded.
 *
 * The instant and the append function are injected rather than read from the ambient environment so
 * a test can pin both; useAssistantChat.ts passes neither and gets the real clock and store.
 */

import { summariseTurn, type ContextLogEntry, type ContextReceipt } from "./contextLog.ts";
import { appendContextLogEntry } from "./contextLogStore.ts";
import { proposeFromStatement, type ProfileProposal } from "./contextProfile.ts";
import { summariseReceipt } from "./toolReceipt.ts";

/** The shape of a chat entry this module reads; a structural subset of useAssistantChat.ts ChatEntry. */
export type CapturedEntry = {
  kind: "user" | "assistant" | "tool";
  text: string;
  toolName?: string;
  failed?: boolean;
};

/**
 * Placeholder text the conversation emits while a tool is still running; it carries no result.
 * Non-space is deliberate: conversation.ts only ever emits `Running ${call.name}…` and a tool name
 * never contains a space, so a genuine one-line result such as "Running the numbers…" must not be
 * mistaken for a placeholder and dropped from the log.
 */
const RUNNING = /^Running \S+…$/;

export type CaptureTurnInput = {
  jobId: string;
  /** The user's own words for this turn, without the project-id preamble useAssistantChat.ts adds. */
  userText: string;
  /** Entries produced during this turn only, in the order the conversation emitted them. */
  entries: readonly CapturedEntry[];
  /** Injected for tests; defaults to the IndexedDB store. */
  append?: (jobId: string, entry: ContextLogEntry) => Promise<unknown>;
  /** Injected ISO instant recorded as the entry's `at`. */
  now: string;
};

/** Tool entries only, ignoring the "Running…" placeholders that precede a result. */
function toolEntries(entries: readonly CapturedEntry[]): CapturedEntry[] {
  return entries.filter(entry => entry && entry.kind === "tool" && !RUNNING.test(String(entry.text ?? "").trim()));
}

/**
 * Receipts in the shape summariseTurn reads. Every result, failed or not, goes through
 * summariseReceipt: toolReceipt.ts:1 guarantees the chat never shows JSON or raw tool output, and
 * this summary is copied verbatim into the digest by contextLog.ts:182 renderDigest, so a failed
 * tool returning a JSON body would otherwise put that body — secret-shaped fields included — in
 * front of the model on every turn.
 *
 * A failed tool whose summary comes back empty still gets a line, because contextLog.ts:127 counts
 * failures and a blank summary would drop the failure from that count. The fallback is a stated
 * phrase rather than the raw first line: summariseReceipt already returns the first sentence of any
 * plain-text result (toolReceipt.ts:52), so an empty summary means the body was JSON, and copying
 * its first line back would reinstate the very leak this routes around.
 */
function receiptsFrom(tools: readonly CapturedEntry[]): ContextReceipt[] {
  const receipts: ContextReceipt[] = [];
  for (const entry of tools) {
    const tool = String(entry.toolName ?? "tool");
    const text = String(entry.text ?? "");
    const said = summariseReceipt(tool, text).trim();
    const summary = said || (entry.failed ? `${tool} failed` : "");
    if (!summary) continue;
    receipts.push({ tool, summary, ok: entry.failed ? false : true });
  }
  return receipts;
}

/**
 * Compresses one finished turn and stores it. Returns the entry that was stored, or null when the
 * turn is worth nothing to a later reader — no user words and no tool results — or when the write
 * was refused.
 *
 * A rejected append is swallowed: contextLogStore.ts leaves its bytes unchanged on a rejection, so
 * the only cost of a failed capture is a missing line in the digest, and that must never surface as
 * a failed send.
 */
export async function captureTurn(input: CaptureTurnInput): Promise<ContextLogEntry | null> {
  const entries = Array.isArray(input.entries) ? input.entries : [];
  const tools = toolEntries(entries);
  const userText = String(input.userText ?? "").trim();

  // Nothing said and nothing done: there is no fact to recall later, so no line is written.
  if (!userText && tools.length === 0) return null;

  const toolNames = tools.map(entry => String(entry.toolName ?? "")).filter(name => name.length > 0);
  const summary = summariseTurn(userText, toolNames, receiptsFrom(tools));

  const entry: ContextLogEntry = {
    id: crypto.randomUUID(),
    at: input.now,
    topic: summary.topic,
    summary: summary.summary,
    evidence: summary.evidence,
    tools: summary.tools,
  };

  const append = input.append ?? appendContextLogEntry;
  try { await append(input.jobId, entry); }
  catch { return null; }
  return entry;
}

/**
 * A candidate profile change from this turn's user text, or null when the user made no explicit
 * first-person statement. Only a proposal: contextProfile.ts:applyProfileDelta still refuses
 * anything that is not a single line-level delta, and the caller supplies the instant.
 */
export function proposeProfileUpdate(userText: unknown): ProfileProposal | null {
  return proposeFromStatement(userText);
}
