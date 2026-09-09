/**
 * Rolling compressed log. Every chat turn is reduced to one short entry so a long project keeps a
 * readable history without keeping the whole transcript. The digest built here goes into the pinned
 * pair the assistant reads at the top of each chat, so it must stay small and stay honest.
 *
 * Summarisation is deterministic. It reads the user's own words and the tool names that ran; it
 * never calls a model, so the same turn always compresses to the same entry and a replayed log
 * cannot drift. Provider transcripts are measured elsewhere (contextBudget.ts:30 measureContext).
 *
 * The evidence field is load-bearing. A line derived from a tool receipt is measured, a line taken
 * from the user's own words is stated, and anything else is recalled. renderDigest labels the
 * recalled lines so a remembered number can never be read as a measured one.
 */

/** Where a summary's facts came from. Ordered strongest first; strongest wins on a tie. */
export type ContextEvidence = "tool-receipt" | "stated" | "inferred";

export type ContextLogEntry = {
  /** Stable identifier; also the IndexedDB key in contextLogStore.ts. */
  id: string;
  /** ISO 8601 instant with offset, matching the rest of the workspace record types. */
  at: string;
  /** Short noun phrase naming the turn. At most TOPIC_MAX_CHARS characters. */
  topic: string;
  /** One flat sentence. At most SUMMARY_MAX_CHARS characters. */
  summary: string;
  evidence: ContextEvidence;
  /** Tool names that ran during the turn, in order, deduplicated. */
  tools: string[];
};

export const TOPIC_MAX_CHARS = 60;
export const SUMMARY_MAX_CHARS = 160;
export const DIGEST_DEFAULT_LIMIT = 30;
/** Label carried by every recalled line so a remembered number is never read as a measured one. */
export const INFERRED_LABEL = "inferred";

/** A tool result as the chat already summarises it; see toolReceipt.ts summariseReceipt. */
export type ContextReceipt = { tool: string; summary: string; ok?: boolean };

const EVIDENCE_RANK: Record<ContextEvidence, number> = { "tool-receipt": 3, stated: 2, inferred: 1 };

/** Verbs that make a turn a request rather than a statement of fact about the project. */
const REQUEST_OPENERS = /^(please\s+|can you\s+|could you\s+|would you\s+|now\s+|then\s+)+/i;
/** Politeness at the end of a request carries no topic. */
const REQUEST_TAIL = /[\s,]+(please|thanks|thank you|for me)[\s.!?]*$/i;

const collapse = (text: string) => text.replace(/[\s]+/g, " ").trim();

/** Trim to a limit on a word boundary where one is near, adding an ellipsis only when text was cut. */
function clamp(text: string, limit: number): string {
  const value = collapse(text);
  if (value.length <= limit) return value;
  const cut = value.slice(0, limit - 1);
  const space = cut.lastIndexOf(" ");
  const kept = space >= Math.floor(limit * 0.6) ? cut.slice(0, space) : cut;
  return `${kept.replace(/[\s,;:.-]+$/, "")}…`;
}

/** First sentence of a body of text, before any clamping. */
function firstSentence(text: string): string {
  const value = collapse(text);
  if (!value) return "";
  const end = value.search(/(?<=[.!?])\s/);
  return end === -1 ? value : value.slice(0, end).trim();
}

const humaniseTool = (name: string) => collapse(name.replace(/[_-]+/g, " "));

const sentenceCase = (text: string) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

/**
 * Bounds matching contextLogStore.ts:28 entrySchema, which caps tools at 64 items of 120 characters
 * and rejects the whole entry when either is exceeded. Capture swallows that rejection
 * (contextCapture.ts:9), so an unclamped name would show only as a silently missing digest line.
 */
export const TOOLS_MAX_ITEMS = 64;
export const TOOL_NAME_MAX_CHARS = 120;

/** Tool names in order of first appearance, blanks and duplicates removed, clamped to store bounds. */
function normaliseTools(toolNames: readonly string[]): string[] {
  const seen = new Set<string>(), result: string[] = [];
  for (const raw of toolNames) {
    const name = collapse(String(raw ?? "")).slice(0, TOOL_NAME_MAX_CHARS);
    if (!name || seen.has(name)) continue;
    seen.add(name); result.push(name);
    if (result.length >= TOOLS_MAX_ITEMS) break;
  }
  return result;
}

function listPhrase(items: readonly string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** Topic from the user's words: the leading request verb is dropped, the object phrase kept. */
function topicFromText(userText: string): string {
  const sentence = firstSentence(userText).replace(REQUEST_OPENERS, "").replace(REQUEST_TAIL, "");
  const words = collapse(sentence).replace(/[?!.]+$/, "");
  return words ? clamp(sentenceCase(words), TOPIC_MAX_CHARS) : "";
}

function topicFromTools(tools: readonly string[]): string {
  if (tools.length === 0) return "";
  const lead = sentenceCase(humaniseTool(tools[0]!));
  const rest = tools.length - 1;
  return clamp(rest > 0 ? `${lead} and ${rest} more tool${rest === 1 ? "" : "s"}` : lead, TOPIC_MAX_CHARS);
}

/** Receipts that carry a usable sentence, in order, with blank summaries dropped. */
function usableReceipts(receipts: readonly ContextReceipt[]): ContextReceipt[] {
  return receipts.filter(receipt => receipt && collapse(String(receipt.summary ?? "")).length > 0);
}

/**
 * Compress one chat turn into a log entry, deterministically. Given the same user text, the same
 * tool names and the same receipts this always returns the same topic, summary and evidence.
 * No provider call is made; nothing here reads the model's prose.
 */
export function summariseTurn(
  userText: string,
  toolNames: readonly string[] = [],
  receipts: readonly ContextReceipt[] = [],
): { topic: string; summary: string; evidence: ContextEvidence; tools: string[] } {
  const tools = normaliseTools(toolNames);
  const said = collapse(String(userText ?? ""));
  const usable = usableReceipts(receipts);

  const topic = topicFromText(said) || topicFromTools(tools) || "Untitled turn";

  // A tool receipt is the strongest evidence available: it reports what the app actually did.
  if (usable.length > 0) {
    const failed = usable.filter(receipt => receipt.ok === false);
    const lead = firstSentence(usable[0]!.summary);
    const others = usable.length - 1;
    const tail = others > 0 ? ` (${others} further tool result${others === 1 ? "" : "s"})` : "";
    const warning = failed.length > 0 ? ` ${failed.length} tool${failed.length === 1 ? "" : "s"} failed.` : "";
    return { topic, summary: clamp(`${sentenceCase(lead)}${tail}.${warning}`, SUMMARY_MAX_CHARS), evidence: "tool-receipt", tools };
  }

  // No receipts: the user's own words are stated evidence for what they asked for.
  if (said) {
    const body = firstSentence(said);
    const ran = tools.length > 0 ? ` Ran ${listPhrase(tools.map(humaniseTool))}.` : "";
    return { topic, summary: clamp(`${sentenceCase(body)}${/[.!?]$/.test(body) ? "" : "."}${ran}`, SUMMARY_MAX_CHARS), evidence: "stated", tools };
  }

  // Neither words nor results: whatever is recorded is recalled, not measured.
  const ran = tools.length > 0 ? `Ran ${listPhrase(tools.map(humaniseTool))}.` : "No user text and no tool results were recorded for this turn.";
  return { topic, summary: clamp(ran, SUMMARY_MAX_CHARS), evidence: "inferred", tools };
}

const EVIDENCE_MARK: Record<ContextEvidence, string> = {
  "tool-receipt": "tool receipt",
  stated: "stated",
  inferred: INFERRED_LABEL,
};

/** Newest first, breaking a tie on the identifier so ordering never depends on input order. */
function newestFirst(entries: readonly ContextLogEntry[]): ContextLogEntry[] {
  return [...entries].sort((a, b) => (a.at === b.at ? b.id.localeCompare(a.id) : b.at.localeCompare(a.at)));
}

const escapeCell = (text: string) => collapse(text).replace(/\|/g, "\\|");

/**
 * The Markdown block that goes into the pinned pair. A table, because each line carries more than
 * two parallel facts. Every row states its evidence, and each recalled row is marked "inferred" so
 * a remembered number can never be mistaken for a measured one.
 */
export function renderDigest(entries: readonly ContextLogEntry[], limit: number = DIGEST_DEFAULT_LIMIT): string {
  const cap = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DIGEST_DEFAULT_LIMIT;
  const ordered = newestFirst(entries), shown = ordered.slice(0, cap);
  const lines = ["## Earlier in this project"];
  if (shown.length === 0) {
    lines.push("", "No earlier turns are recorded.");
    return lines.join("\n");
  }
  lines.push(
    "",
    "Newest first. Evidence states where each line came from. A line marked inferred is recalled, not measured; re-read the project or the design before relying on any number in it.",
    "",
    "| When | Topic | Evidence | Summary | Tools |",
    "| --- | --- | --- | --- | --- |",
  );
  for (const entry of shown) {
    const summary = entry.evidence === "inferred" ? `(${INFERRED_LABEL}) ${entry.summary}` : entry.summary;
    lines.push(`| ${escapeCell(entry.at)} | ${escapeCell(entry.topic)} | ${EVIDENCE_MARK[entry.evidence]} | ${escapeCell(summary)} | ${entry.tools.length > 0 ? escapeCell(entry.tools.join(", ")) : "none"} |`);
  }
  const hidden = ordered.length - shown.length;
  if (hidden > 0) lines.push("", `${hidden} older turn${hidden === 1 ? " is" : "s are"} held in the log and not shown here. Search the log by keyword to recall one.`);
  return lines.join("\n");
}

/** Query words, lowercased, punctuation dropped. Duplicates removed so a repeat cannot outscore. */
function queryTerms(query: string): string[] {
  const terms = collapse(String(query ?? "")).toLowerCase().split(/[^a-z0-9.]+/i).filter(term => term.length > 1);
  return [...new Set(terms)];
}

function haystack(entry: ContextLogEntry): { topic: string; summary: string; tools: string } {
  return {
    topic: entry.topic.toLowerCase(),
    summary: entry.summary.toLowerCase(),
    tools: entry.tools.join(" ").replace(/[_-]+/g, " ").toLowerCase(),
  };
}

/**
 * Deterministic keyword matching. No embeddings and no model call: a term matches when it appears
 * in the topic, the summary or a tool name. An entry must match every term. Results come back
 * newest first, so recall order matches the digest.
 */
export function searchLog(entries: readonly ContextLogEntry[], query: string): ContextLogEntry[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  return newestFirst(entries).filter(entry => {
    const fields = haystack(entry);
    return terms.every(term => fields.topic.includes(term) || fields.summary.includes(term) || fields.tools.includes(term));
  });
}

/** The stronger of two evidence values; used when turns are merged into a single entry. */
export function strongestEvidence(a: ContextEvidence, b: ContextEvidence): ContextEvidence {
  return EVIDENCE_RANK[a] >= EVIDENCE_RANK[b] ? a : b;
}
