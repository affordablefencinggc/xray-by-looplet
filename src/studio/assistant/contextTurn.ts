/**
 * Assembly of the provider transcript for one send. Everything here is pure and takes its readers
 * by injection, so the send path in useAssistantChat.ts stays a thin caller and the decisions below
 * are testable under bare Node (contextLogStore.ts opens IndexedDB, which no test process has).
 *
 * The order of operations is load-bearing:
 *
 * 1. Compact first. useAssistantChat.ts refuses a send when context.level is 'full', and that guard
 *    reads a measurement of the stored transcript. Compacting before the guard means the guard
 *    cannot refuse a turn that compaction would have rescued.
 * 2. Upsert the pinned pair onto the compacted base, never onto the raw one, so the pair is not
 *    among the entries a later compaction can cut and the two-entry overhead stays fixed
 *    (pinnedContext.ts documents the upsert-not-append rule).
 * 3. Append the new user entry last, so the array ends with role 'user' (contract.ts:58).
 */
import type { AssistantContent, AssistantPart } from "./contract.ts";
import { compactTranscript, type CompactOptions, type CompactResult } from "./compactTranscript.ts";
import { buildPinnedPair, upsertPinnedPair } from "./pinnedContext.ts";
import { renderDigest, type ContextLogEntry } from "./contextLog.ts";
import { emptyProfile, isProfileSlotName, renderProfile, sanitise, PROFILE_SLOTS, PROFILE_VALUE_MAX, PROFILE_QUOTE_MAX, type ContextProfile, type ProfileSlotName } from "./contextProfile.ts";

/**
 * Name carried by the marker receipt that re-seeds the replay guard. conversation.ts:17-19 builds
 * its duplicate-call guard from the functionResponse ids present in the transcript it is handed, so
 * an id whose receipt compaction dropped would stop being refused and a completed mutation could be
 * replayed. The ids are therefore re-emitted as functionResponse parts on the pinned USER entry:
 * contract.ts:39 allows functionResponse only on user content, which the pinned user entry is, and
 * assistantRequestSchema pairs no call with its response, so a receipt whose original call was cut
 * still validates and still seeds the guard. The name is a fixed identifier because the schema at
 * contract.ts:6 constrains what a tool name may contain.
 */
export const CARRIED_CALL_TOOL = "xray_context_carried_call";

/** Text the marker receipt carries, so a reader of the transcript can see why it is there. */
export const CARRIED_CALL_TEXT =
  "This tool call ran earlier in this conversation and its result was compacted away. The call is recorded only so it is not run a second time.";

/** How many ids may be carried. One part each, under the 64-parts-per-content cap (contract.ts:47). */
export const CARRIED_CALL_LIMIT = 48;

/** Ids accepted as markers: non-empty strings within the length the contract allows. */
const usableCallIds = (callIds: readonly string[]): string[] =>
  [...new Set(callIds.filter(id => typeof id === "string" && id.length > 0 && id.length <= 200))];

/**
 * Marker receipt parts for the ids whose real receipts compaction dropped.
 *
 * The MOST RECENT ids are kept when there are more than the limit. assembleTurn unions the markers
 * already in the transcript ahead of this turn's ids, so the oldest occupy the front of the array and
 * a slice from the front would discard exactly the freshly dropped receipts — the mutations that just
 * ran and are the ones the model is most likely to retry. Replay protection is worth least on the
 * oldest ids and most on the newest, so overflow is taken off the front.
 */
export function carriedCallParts(callIds: readonly string[]): AssistantPart[] {
  return usableCallIds(callIds).slice(-CARRIED_CALL_LIMIT).map(id => ({
    functionResponse: { name: CARRIED_CALL_TOOL, id, response: { isError: true, text: CARRIED_CALL_TEXT } },
  }));
}

/** How many ids overflowed CARRIED_CALL_LIMIT and carry no marker, so the loss is visible not silent. */
export function droppedCallIdCount(callIds: readonly string[]): number {
  return Math.max(0, usableCallIds(callIds).length - CARRIED_CALL_LIMIT);
}

/**
 * Ids already carried by markers in a transcript. upsertPinnedPair replaces the whole pinned pair,
 * so a marker written on an earlier turn would be lost unless it is harvested and re-supplied: the
 * ids are cumulative for the life of the conversation, because every compaction after the first
 * drops receipts the replay guard still has to refuse.
 */
export function existingCarriedCallIds(contents: readonly AssistantContent[]): string[] {
  const ids: string[] = [];
  for (const entry of contents ?? []) {
    for (const part of entry.parts ?? []) {
      const response = part.functionResponse;
      if (response?.name === CARRIED_CALL_TOOL && typeof response.id === "string") ids.push(response.id);
    }
  }
  return [...new Set(ids)];
}

/**
 * The base the turn builds on. The compactor returns the SAME array reference when it does not
 * compact (compactTranscript.ts rule 1), so identity is the honest signal of whether work happened
 * and is what update() in useAssistantChat.ts:22 uses to decide whether to re-measure.
 */
export type TurnBase = { contents: AssistantContent[]; compaction: CompactResult };

export function chooseBase(contents: AssistantContent[], options?: CompactOptions): TurnBase {
  const compaction = compactTranscript(contents, options);
  return { contents: compaction.compacted ? compaction.contents : contents, compaction };
}

/** The two async reads the pinned pair needs. Either may reject; neither may stop the send. */
export type ContextReaders = {
  readProfile: (jobId: string) => Promise<{ notes: string[] } | null>;
  readLog: (jobId: string) => Promise<ContextLogEntry[]>;
};

/** What the readers produced, with any failure recorded rather than thrown. */
export type CarriedContext = { profile: ContextProfile; entries: ContextLogEntry[]; failed: boolean; reason: string };

/** Separator between a slot name and its value in a stored profile note. */
const NOTE_SEPARATOR = ": ";

/** Lower-cased spelling to canonical slot name, so a stored note's capitalisation does not lose a slot. */
const SLOT_BY_LOWER: ReadonlyMap<string, ProfileSlotName> = new Map(PROFILE_SLOTS.map(name => [name.toLowerCase(), name]));

/** The canonical slot a stored note names, matched without regard to case, or null when it names none. */
function canonicalSlotName(name: string): ProfileSlotName | null {
  const exact = isProfileSlotName(name) ? name : SLOT_BY_LOWER.get(name.toLowerCase());
  return exact ?? null;
}

/** Placeholder for the instant a flat note cannot carry; renderProfile prints the column regardless. */
export const NOTE_STATED_AT = "recorded earlier";

/**
 * Rebuilds a slot profile from the flat note lines contextLogStore.ts persists. The store holds
 * `notes: string[]` while renderProfile reads the slot record from contextProfile.ts, so the two
 * shapes are bridged here rather than in either module. A note that names no known slot is ignored:
 * a stored line must never invent a slot, and one unreadable note is not worth failing a send over.
 */
export function profileFromNotes(notes: readonly string[] | undefined): ContextProfile {
  const profile = emptyProfile();
  for (const note of notes ?? []) {
    if (typeof note !== "string") continue;
    const cut = note.indexOf(NOTE_SEPARATOR);
    if (cut <= 0) continue;
    // Resolved without regard to case: a stored note may be capitalised ("Name: Bob"), which named no
    // slot under an exact match while " units : metric" parsed. Lower-casing alone is not enough
    // because PROFILE_SLOTS (contextProfile.ts:20) holds camelCase names such as "answerStyle", so
    // the canonical spelling is recovered by comparing case-insensitively against that list.
    const slot = canonicalSlotName(note.slice(0, cut).trim());
    const value = note.slice(cut + NOTE_SEPARATOR.length).trim();
    if (!slot || !value) continue;
    // Sanitised, never sliced raw. A note is rebuilt from text that may include tool output, drawings
    // and web pages (contextProfile.ts:6-7), and renderProfile at contextProfile.ts:130 emits the
    // value straight into a Markdown table row inside the pinned block the model reads every turn.
    // A bare slice would preserve newlines, pipes and control characters, letting a stored note forge
    // a heading that countermands an operating rule; sanitise strips exactly that structure.
    const safeValue = sanitise(value, PROFILE_VALUE_MAX);
    if (!safeValue) continue;
    // The flat note carries neither the instant nor the original quote, so the note itself stands as
    // the record of what was said and the instant is named as unrecorded rather than invented.
    profile[slot] = { value: safeValue, statedAt: NOTE_STATED_AT, quote: sanitise(note, PROFILE_QUOTE_MAX) };
  }
  return profile;
}

/**
 * Reads the profile and the log without letting either stop the turn. IndexedDB is absent in some
 * browsing modes and contextLogStore.ts rejects loudly when it is, so a rejection here degrades to
 * no carried context rather than a failed send: the pinned pair is optional background, and losing
 * it costs the model context, while losing the turn costs the user their message.
 */
export async function readCarriedContext(jobId: string, readers: ContextReaders): Promise<CarriedContext> {
  const [profileResult, logResult] = await Promise.allSettled([readers.readProfile(jobId), readers.readLog(jobId)]);
  const reasons: string[] = [];
  let profile = emptyProfile();
  let entries: ContextLogEntry[] = [];
  if (profileResult.status === "fulfilled") profile = profileFromNotes(profileResult.value?.notes);
  else reasons.push(profileResult.reason instanceof Error ? profileResult.reason.message : "The context profile could not be read.");
  if (logResult.status === "fulfilled") entries = Array.isArray(logResult.value) ? logResult.value : [];
  else reasons.push(logResult.reason instanceof Error ? logResult.reason.message : "The context log could not be read.");
  return { profile, entries, failed: reasons.length > 0, reason: reasons.join(" ") };
}

/**
 * Whether the pair earns its place. An empty profile and an empty log render to a pair that says
 * only that nothing has been carried forward yet, which costs two of the 38 contents
 * conversation.ts allows and tells the model nothing. Carried call ids alone are reason enough:
 * without the marker receipts the replay guard would be short an id.
 */
export function shouldPin(carried: CarriedContext, carriedCallIds: readonly string[]): boolean {
  if (carriedCallIds.length > 0) return true;
  if (carried.entries.length > 0) return true;
  return renderProfile(carried.profile).length > 0;
}

export type AssembleInput = {
  base: AssistantContent[];
  carried: CarriedContext;
  carriedCallIds: readonly string[];
  today: AssistantContent;
  digestLimit?: number;
};

/**
 * What the send path needs back: the array to send, and the transcript to store as its base.
 *
 * `droppedCallIds` counts the ids that overflowed CARRIED_CALL_LIMIT and therefore seed no marker.
 * Those calls are no longer refused by the replay guard conversation.ts:17-19 builds, so the overflow
 * is reported rather than left silent.
 */
export type AssembledTurn = { contents: AssistantContent[]; pinned: boolean; base: AssistantContent[]; droppedCallIds: number };

/**
 * Assembles the final array: the pinned pair (when it earns its place) onto the compacted base,
 * then today's user entry last so the array ends with role 'user' (contract.ts:58).
 *
 * `base` in the result is that same array without today's entry — what the record stores, so the
 * meter reflects the compacted transcript and the next turn upserts onto the same pinned pair
 * rather than growing a second one.
 */
export function assembleTurn(input: AssembleInput): AssembledTurn {
  // Markers already in the transcript are folded in, because upsertPinnedPair replaces the pair it
  // finds and would otherwise discard the ids an earlier compaction carried.
  const callIds = [...new Set([...existingCarriedCallIds(input.base), ...input.carriedCallIds])];
  const pinned = shouldPin(input.carried, callIds);
  if (!pinned) {
    const base = input.base.slice();
    return { contents: [...base, input.today], pinned: false, base, droppedCallIds: 0 };
  }
  const pair = buildPinnedPair(renderProfile(input.carried.profile), renderDigest(input.carried.entries, input.digestLimit));
  const markers = carriedCallParts(callIds);
  // The markers ride on the pinned user entry rather than a third content, so the pair stays the
  // fixed two-entry overhead pinnedContext.ts promises against the 38-content guard in
  // conversation.ts. upsertPinnedPair finds the pair by its sentinel first line, which the extra
  // parts leave untouched, so the marker parts round-trip through the next turn's upsert.
  const user: AssistantContent = markers.length ? { ...pair.user, parts: [...pair.user.parts, ...markers] } : pair.user;
  const base = upsertPinnedPair(input.base, { user, model: pair.model });
  return { contents: [...base, input.today], pinned: true, base, droppedCallIds: droppedCallIdCount(callIds) };
}
