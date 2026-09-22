import { sha256 } from "@noble/hashes/sha2.js";
import { z } from "zod";

/** Disaster-recovery journal (SC-16).
 *
 * A save stages one before/after entry, writes the target, then commits. Boot playback rolls
 * back the single in-flight entry and leaves committed entries in place. Two in-flight entries
 * mean the journal itself was interrupted: playback quarantines and does not guess.
 */

export const RECOVERY_JOURNAL_SCHEMA = "xray.recovery-journal/v1" as const;
export const RECOVERY_BEFORE_SCHEMA = "xray.recovery-journal-before/v1" as const;
export const RECOVERY_JOURNAL_STORAGE_KEY = "xray.recovery-journal/v1";
export const RECOVERY_BEFORE_STORAGE_KEY = "xray.recovery-journal-before/v1";

const sha256Hex = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.string().datetime({ offset: true });

export const journalEntrySchema = z
  .object({
    format: z.literal(RECOVERY_JOURNAL_SCHEMA),
    sequence: z.number().int().nonnegative(),
    operation: z.string().min(1).max(120),
    targetKey: z.string().min(1).max(300),
    beforeSha256: sha256Hex.nullable(),
    afterSha256: sha256Hex,
    startedAt: timestamp,
    committedAt: timestamp.nullable(),
  })
  .strict();
export type JournalEntry = z.infer<typeof journalEntrySchema>;

export const recoveryJournalSchema = z
  .object({
    format: z.literal(RECOVERY_JOURNAL_SCHEMA),
    projectId: z.string().min(1).max(240),
    entries: z.array(journalEntrySchema),
  })
  .strict()
  .superRefine((journal, context) => {
    const issue = (path: (string | number)[], message: string) =>
      context.addIssue({ code: "custom", path, message });
    for (let index = 1; index < journal.entries.length; index += 1) {
      if (journal.entries[index].sequence <= journal.entries[index - 1].sequence)
        issue(["entries", index, "sequence"], "Journal sequences must strictly increase.");
    }
    if (journal.entries.filter((entry) => entry.committedAt === null).length > 1)
      issue(["entries"], "A journal with more than one uncommitted entry is corrupt and must not be replayed.");
  });
export type RecoveryJournal = z.infer<typeof recoveryJournalSchema>;

const beforeImageSchema = z
  .object({
    format: z.literal(RECOVERY_BEFORE_SCHEMA),
    sequence: z.number().int().nonnegative(),
    targetKey: z.string().min(1).max(300),
    text: z.string().nullable(),
  })
  .strict();
export type JournalBeforeImage = z.infer<typeof beforeImageSchema>;

export type JournalStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type PlaybackResult =
  | { status: "clean"; journal: RecoveryJournal }
  | { status: "rolled-back"; journal: RecoveryJournal; writes: Array<{ key: string; text: string | null }> }
  | { status: "quarantined"; reason: string };

const encoder = new TextEncoder();

export function digestText(text: string): string {
  return [...sha256(encoder.encode(text))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function emptyRecoveryJournal(projectId: string): RecoveryJournal {
  return recoveryJournalSchema.parse({ format: RECOVERY_JOURNAL_SCHEMA, projectId, entries: [] });
}

export function parseRecoveryJournal(value: unknown): RecoveryJournal {
  return recoveryJournalSchema.parse(value);
}

function corruptReason(raw: unknown): string {
  if (raw && typeof raw === "object" && Array.isArray((raw as { entries?: unknown }).entries)) {
    const inFlight = (raw as { entries: Array<{ committedAt?: unknown }> }).entries.filter((entry) => entry?.committedAt === null);
    if (inFlight.length > 1)
      return "A journal with more than one uncommitted entry is corrupt and must not be replayed.";
  }
  return "Recovery journal failed validation and was not replayed. Editing is paused and stored data was not changed.";
}

function withoutInFlight(journal: RecoveryJournal): RecoveryJournal {
  return recoveryJournalSchema.parse({
    ...journal,
    entries: journal.entries.filter((entry) => entry.committedAt !== null),
  });
}

/** Roll back at most one in-flight entry. Never throws: a corrupt journal is quarantined. */
export function playbackRecoveryJournal(
  rawJournal: unknown,
  rawBefore: unknown,
  read: (key: string) => string | null,
): PlaybackResult {
  const parsed = recoveryJournalSchema.safeParse(rawJournal);
  if (!parsed.success) return { status: "quarantined", reason: corruptReason(rawJournal) };
  const journal = parsed.data;
  const inFlight = journal.entries.filter((entry) => entry.committedAt === null);
  if (inFlight.length === 0) return { status: "clean", journal };
  const entry = inFlight[0];
  const beforeParsed = beforeImageSchema.safeParse(rawBefore);
  if (!beforeParsed.success || beforeParsed.data.sequence !== entry.sequence || beforeParsed.data.targetKey !== entry.targetKey)
    return { status: "quarantined", reason: "Recovery journal is missing the before-image for its in-flight save. Editing is paused and stored data was not changed." };
  const before = beforeParsed.data;
  const beforeSha = before.text === null ? null : digestText(before.text);
  if (beforeSha !== entry.beforeSha256)
    return { status: "quarantined", reason: "Recovery journal before-image does not match its recorded SHA-256. Editing is paused and stored data was not changed." };
  const current = read(entry.targetKey);
  const currentSha = current === null ? null : digestText(current);
  if (currentSha === entry.beforeSha256)
    return { status: "rolled-back", journal: withoutInFlight(journal), writes: [] };
  if (currentSha === entry.afterSha256)
    return { status: "rolled-back", journal: withoutInFlight(journal), writes: [{ key: entry.targetKey, text: before.text }] };
  return { status: "quarantined", reason: "Recovery journal in-flight save does not match the stored bytes or the previous bytes. Editing is paused and stored data was not changed." };
}

function readJson(storage: JournalStorage, key: string): unknown {
  const raw = storage.getItem(key);
  if (raw === null) return null;
  return JSON.parse(raw) as unknown;
}

export function recoverStoredJournal(storage: JournalStorage): PlaybackResult {
  let rawJournal: unknown;
  let rawBefore: unknown;
  try {
    rawJournal = readJson(storage, RECOVERY_JOURNAL_STORAGE_KEY);
    rawBefore = readJson(storage, RECOVERY_BEFORE_STORAGE_KEY);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: "quarantined", reason: `Recovery journal could not be read. Editing is paused. ${message}` };
  }
  if (rawJournal === null && rawBefore === null) return { status: "clean", journal: emptyRecoveryJournal("workspace") };
  if (rawJournal === null)
    return { status: "quarantined", reason: "Recovery journal is missing its entries but a before-image remains. Editing is paused and stored data was not changed." };
  const played = playbackRecoveryJournal(rawJournal, rawBefore, (key) => storage.getItem(key));
  if (played.status === "quarantined") return played;
  if (played.status === "clean") {
    if (rawBefore !== null) storage.removeItem(RECOVERY_BEFORE_STORAGE_KEY);
    return played;
  }
  for (const write of played.writes) {
    if (write.text === null) storage.removeItem(write.key);
    else storage.setItem(write.key, write.text);
  }
  storage.setItem(RECOVERY_JOURNAL_STORAGE_KEY, JSON.stringify(played.journal));
  storage.removeItem(RECOVERY_BEFORE_STORAGE_KEY);
  return played;
}

export type StagedWrite =
  | { status: "staged"; journal: RecoveryJournal }
  | { status: "quarantined"; reason: string };

/** Persist the in-flight entry and the target write. Commit is a separate step so a crash in between is recoverable. */
export function stageJournalledWrite(input: {
  storage: JournalStorage;
  projectId: string;
  operation: string;
  targetKey: string;
  next: string;
  now: Date;
}): StagedWrite {
  let existing: RecoveryJournal;
  try {
    const raw = readJson(input.storage, RECOVERY_JOURNAL_STORAGE_KEY);
    existing = raw === null ? emptyRecoveryJournal(input.projectId) : parseRecoveryJournal(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: "quarantined", reason: `Recovery journal could not be staged. The target was not written. ${message}` };
  }
  if (existing.projectId !== input.projectId) {
    // A fully committed journal holds nothing to roll back, so the storage slot can move to the
    // project now being saved (project switch or new project). An in-flight entry still refuses.
    if (existing.entries.some((entry) => entry.committedAt === null))
      return { status: "quarantined", reason: "Recovery journal belongs to another project. The target was not written." };
    existing = emptyRecoveryJournal(input.projectId);
  }
  if (existing.entries.some((entry) => entry.committedAt === null))
    return { status: "quarantined", reason: "A journalled save is already in flight. The new target was not written." };
  const previous = input.storage.getItem(input.targetKey);
  const sequence = existing.entries.at(-1)?.sequence ?? 0;
  const entry = journalEntrySchema.parse({
    format: RECOVERY_JOURNAL_SCHEMA,
    sequence: sequence + 1,
    operation: input.operation,
    targetKey: input.targetKey,
    beforeSha256: previous === null ? null : digestText(previous),
    afterSha256: digestText(input.next),
    startedAt: input.now.toISOString(),
    committedAt: null,
  });
  const journal = recoveryJournalSchema.parse({ ...existing, entries: [...existing.entries, entry] });
  const before = beforeImageSchema.parse({
    format: RECOVERY_BEFORE_SCHEMA,
    sequence: entry.sequence,
    targetKey: entry.targetKey,
    text: previous,
  });
  input.storage.setItem(RECOVERY_JOURNAL_STORAGE_KEY, JSON.stringify(journal));
  input.storage.setItem(RECOVERY_BEFORE_STORAGE_KEY, JSON.stringify(before));
  input.storage.setItem(input.targetKey, input.next);
  return { status: "staged", journal };
}

export function commitStagedWrite(storage: JournalStorage, committedAt: Date): RecoveryJournal {
  const journal = parseRecoveryJournal(readJson(storage, RECOVERY_JOURNAL_STORAGE_KEY));
  const inFlight = journal.entries.filter((entry) => entry.committedAt === null);
  if (inFlight.length !== 1) throw Error("Recovery journal has no single in-flight save to commit.");
  const next = recoveryJournalSchema.parse({
    ...journal,
    entries: journal.entries.map((entry) => entry.committedAt === null ? { ...entry, committedAt: committedAt.toISOString() } : entry),
  });
  storage.setItem(RECOVERY_JOURNAL_STORAGE_KEY, JSON.stringify(next));
  storage.removeItem(RECOVERY_BEFORE_STORAGE_KEY);
  return next;
}
