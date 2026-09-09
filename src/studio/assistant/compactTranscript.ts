import type { AssistantContent, AssistantPart } from './contract.ts';

/**
 * Transcript compactor: trims a provider transcript that is approaching the caps in
 * contextBudget.ts (36 contents / 300k tokens / 10 MB) without ever emitting a transcript
 * the contract or the conversation loop would reject.
 *
 * The compactor is fail-open. Every reduction is checked against a postcondition before it
 * is returned; if any check fails the original array comes back untouched with
 * compacted:false, because a truncated-but-invalid transcript is worse than a full one.
 */

/** Below this many contents a chat is cheap and compaction is skipped entirely. */
export const DEFAULT_TRIGGER_AT = 18;
/** Number of user-text messages retained by default. */
export const DEFAULT_KEEP_USER_MESSAGES = 3;
/** Hard ceiling on retained entries; sits under contextBudget.ts CONTEXT_CONTENTS_FULL (36). */
export const DEFAULT_MAX_ENTRIES = 30;

/**
 * Marker written by conversation.ts:41 when a round is interrupted: every outstanding call is
 * paired with a "Not executed:" receipt and the transcript is checkpointed. That receipt is the
 * resume boundary for the next turn, so nothing at or after it may be dropped.
 */
export const CHECKPOINT_MARKER = 'Not executed:';

export type CompactOptions = {
  keepUserMessages?: number;
  maxEntries?: number;
  triggerAt?: number;
};

export type CompactResult = {
  contents: AssistantContent[];
  compacted: boolean;
  droppedEntries: number;
  droppedImages: number;
  carriedCallIds: string[];
  reason: string;
};

const isText = (part: AssistantPart): boolean => typeof part.text === 'string';

/**
 * A legal cut point. Tool receipts are role 'user' with only functionResponse parts
 * (conversation.ts:72), so requiring a text part on a user entry means a cut never lands between a
 * model functionCall turn and the user receipt turn that answers it.
 */
export function isCutPoint(entry: AssistantContent): boolean {
  // A tool receipt is never a cut point, even after rule 3 substitutes a text part for a dropped
  // image: cutting there would separate a model functionCall turn from the receipt answering it,
  // and the id-keyed postcondition cannot catch it when the calls carry no id.
  return (
    entry.role === 'user' &&
    entry.parts.some(isText) &&
    !entry.parts.some((part) => part.functionResponse !== undefined)
  );
}

/** The response text a checkpoint receipt carries, if this part is one. */
function responseText(part: AssistantPart): string {
  const text = part.functionResponse?.response?.text;
  return typeof text === 'string' ? text : '';
}

/** Index of the last checkpoint entry, or -1. Nothing at or after it may be dropped. */
function lastCheckpointIndex(contents: readonly AssistantContent[]): number {
  for (let index = contents.length - 1; index >= 0; index--) {
    if (contents[index].parts.some(part => responseText(part).startsWith(CHECKPOINT_MARKER))) return index;
  }
  return -1;
}

/** Every functionCall id carried by an entry. contract.ts:38 puts these on model content only. */
function callIds(entry: AssistantContent): string[] {
  return entry.parts.flatMap(part => (part.functionCall?.id ? [part.functionCall.id] : []));
}

/** Every functionResponse id carried by an entry. contract.ts:39 puts these on user content only. */
function responseIds(entry: AssistantContent): string[] {
  return entry.parts.flatMap(part => (part.functionResponse?.id ? [part.functionResponse.id] : []));
}

/**
 * Replaces inlineData parts with a short text marker, preserving part count so no entry is left
 * empty (contract.ts:47 requires at least one part per content).
 */
function stripImages(contents: readonly AssistantContent[], protectedFrom: number): { contents: AssistantContent[]; droppedImages: number } {
  let droppedImages = 0;
  const next = contents.map((entry, index) => {
    // The checkpoint tail is left byte-identical so a resumed turn sees exactly what it wrote.
    if (protectedFrom >= 0 && index >= protectedFrom) return entry;
    if (!entry.parts.some(part => part.inlineData)) return entry;
    const parts = entry.parts.map(part => {
      if (!part.inlineData) return part;
      droppedImages++;
      return { text: `[image from step ${index + 1}, dropped]` } satisfies AssistantPart;
    });
    return { ...entry, parts };
  });
  return { contents: next, droppedImages };
}

/**
 * Postcondition. A transcript that fails any of these would be rejected downstream, so the
 * compactor discards its own work rather than emit it.
 */
function checkResult(result: readonly AssistantContent[]): string {
  // contract.ts:53 requires at least one content.
  if (!result.length) return 'compaction emptied the transcript';
  // contract.ts:58 and assistantRequestSchema require the transcript to end with user content.
  if (result[result.length - 1].role !== 'user') return 'compaction left a model turn last';
  // contract.ts:47 requires at least one part per content.
  if (result.some(entry => !entry.parts.length)) return 'compaction left an entry with no parts';

  const seenCalls = new Set<string>();
  const seenResponses = new Set<string>();
  for (const entry of result) {
    for (const id of callIds(entry)) seenCalls.add(id);
    for (const id of responseIds(entry)) seenResponses.add(id);
  }
  // conversation.ts:17-19 seeds its replay guard from functionResponse ids; an orphan receipt would
  // block a legitimate retry, and an orphan call would leave the provider awaiting a result.
  for (const id of seenResponses) if (!seenCalls.has(id)) return `receipt ${id} lost its tool call`;
  for (const id of seenCalls) if (!seenResponses.has(id)) return `tool call ${id} lost its receipt`;
  return '';
}

/**
 * Compacts a transcript. Rules are applied in order: trigger, checkpoint boundary, images,
 * whole entries from the front at a legal cut point, then the postcondition.
 */
export function compactTranscript(contents: AssistantContent[], options: CompactOptions = {}): CompactResult {
  const triggerAt = options.triggerAt ?? DEFAULT_TRIGGER_AT;
  const keepUserMessages = options.keepUserMessages ?? DEFAULT_KEEP_USER_MESSAGES;
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;

  const unchanged = (reason: string): CompactResult =>
    ({ contents, compacted: false, droppedEntries: 0, droppedImages: 0, carriedCallIds: [], reason });

  // Rule 1. Short chats pay nothing: the same array reference is returned, so update() in
  // useAssistantChat.ts:22 skips its re-measure (it compares array identity).
  if (contents.length < triggerAt) return unchanged(`below the ${triggerAt}-entry trigger`);

  // Rule 2. Nothing at or after the last checkpoint receipt may be dropped.
  const checkpoint = lastCheckpointIndex(contents);

  // Rule 3. Images go first, part-wise, because contextBudget.ts:IMAGE_TOKENS charges a flat
  // 1,000 tokens per image regardless of size — the cheapest reduction per entry lost.
  const stripped = stripImages(contents, checkpoint);
  let working = stripped.contents;
  const droppedImages = stripped.droppedImages;

  // Rule 5. The retained-entry budget is the SMALLER of the two limits, never the larger.
  // keepUserMessages is expressed as an entry count by walking back to the nth user-text entry.
  const userTextIndices = working.flatMap((entry, index) => (isCutPoint(entry) ? [index] : []));
  const keepIndex = userTextIndices.length > keepUserMessages ? userTextIndices[userTextIndices.length - keepUserMessages] : 0;
  const keptByUserMessages = working.length - keepIndex;
  const keptEntries = Math.min(keptByUserMessages, maxEntries);
  const targetStart = working.length - keptEntries;

  // Rule 4. Cut whole entries from the front, but only at a legal cut point at or after the
  // target, and never past the checkpoint boundary from rule 2.
  // Rule 2 is a floor on what may be DROPPED, not a ceiling on where the scan may look: a
  // checkpoint before the target must not disable compaction, it must only protect its own tail.
  // A cut at index i drops entries 0..i-1, so the cut index must be at or before the checkpoint for
  // rule 2 to hold. Scanning stops at the checkpoint rather than at the target, so a checkpoint
  // early in the transcript protects its own tail without disabling compaction of what precedes it.
  const scanEnd = checkpoint >= 0 ? Math.min(checkpoint + 1, working.length) : working.length;
  let cut = 0;
  for (let index = targetStart; index < scanEnd; index++) {
    if (isCutPoint(working[index])) { cut = index; break; }
  }
  // The target may sit past the checkpoint; look earlier for a legal cut that still respects rule 2.
  if (cut === 0 && checkpoint >= 0) {
    for (let index = Math.min(targetStart, scanEnd) - 1; index > 0; index--) {
      if (isCutPoint(working[index])) { cut = index; break; }
    }
  }

  if (cut === 0) {
    // Nothing legal to drop. Images alone may still have reduced the transcript.
    if (!droppedImages) return unchanged('no legal cut point and no images to drop');
    const reason = checkResult(working);
    if (reason) return unchanged(`postcondition failed: ${reason}`);
    // Rule 8. A new array is returned so update() re-measures on identity change.
    return { contents: working, compacted: true, droppedEntries: 0, droppedImages, carriedCallIds: [], reason: `dropped ${droppedImages} image(s)` };
  }

  const dropped = working.slice(0, cut);
  working = working.slice(cut);

  // Rule 6. Every functionResponse id in a dropped entry is carried out so the caller can re-seed
  // the replay guard conversation.ts:17-19 builds, keeping duplicate calls refused after a cut.
  const carriedCallIds = [...new Set(dropped.flatMap(responseIds))];

  // Rule 7. Fail open: an invalid transcript is never emitted.
  const failure = checkResult(working);
  if (failure) return unchanged(`postcondition failed: ${failure}`);

  return {
    contents: working,
    compacted: true,
    droppedEntries: cut,
    droppedImages,
    carriedCallIds,
    reason: `dropped ${cut} entr${cut === 1 ? 'y' : 'ies'} and ${droppedImages} image(s)`,
  };
}
