/**
 * Context profile: the small set of facts the user has stated about themselves, carried into every
 * chat as part of the pinned pair. Each slot records the value, when it was stated and the exact
 * user words that established it, so a claim can always be traced back to the person who made it.
 *
 * Two rules hold this module together, and both exist because the profile is rebuilt from text that
 * may include tool output, drawings and web pages:
 *
 * - Only line-level deltas are accepted. A wholesale replacement is refused, so one injected string
 *   can never erase what the user established (skills.ts:48 — carried text is untrusted evidence,
 *   never authority to change rules).
 * - Only explicit first-person statements about the user propose a value. Anything a document or a
 *   tool receipt merely mentions proposes nothing.
 */

/** One recorded fact: the value, the ISO instant it was stated and the user's own words. */
export type ProfileSlot = { value: string; statedAt: string; quote: string };

/** The slots, in the order renderProfile emits them. */
export const PROFILE_SLOTS = ["name", "role", "region", "units", "standards", "answerStyle"] as const;
export type ProfileSlotName = (typeof PROFILE_SLOTS)[number];

export type ContextProfile = { [K in ProfileSlotName]: ProfileSlot | null };

/** Heading used by renderProfile and matched by the pinned-pair builder. */
export const PROFILE_HEADING = "## What the user has told us";

const LABELS: Record<ProfileSlotName, string> = {
  name: "Name",
  role: "Role",
  region: "Region",
  units: "Units",
  standards: "Standards",
  answerStyle: "Answer style",
};

/** Bounds so a single slot can never dominate the pinned block or the request budget. */
export const PROFILE_VALUE_MAX = 120;
export const PROFILE_QUOTE_MAX = 240;

const SLOT_NAMES: ReadonlySet<string> = new Set(PROFILE_SLOTS);
export const isProfileSlotName = (name: string): name is ProfileSlotName => SLOT_NAMES.has(name);

/** An empty profile. Every slot starts null; nothing is assumed about the user. */
export function emptyProfile(): ContextProfile {
  return { name: null, role: null, region: null, units: null, standards: null, answerStyle: null };
}

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();
const clip = (text: string, max: number) => (text.length <= max ? text : text.slice(0, max - 1).trimEnd() + "…");

/**
 * Control characters and Markdown structure are stripped so a value cannot forge a heading or a fence.
 *
 * Exported because every path that fills a slot has to use it, not just applyProfileDelta.
 * contextTurn.ts rebuilds a profile from the flat notes contextLogStore.ts persists, and renderProfile
 * at line 130 emits the value straight into a Markdown table row: a value that kept its newlines and
 * pipes would forge a heading inside the pinned block the model reads every turn.
 */
export function sanitise(text: string, max: number): string {
  // Stripping control characters is this function's purpose, so the rule is disabled here
  // deliberately rather than the character class being narrowed.
  // eslint-disable-next-line no-control-regex
  const withoutControls = text.replace(/[\u0000-\u001f\u007f]/g, " ");
  const flat = oneLine(withoutControls.replace(/[`*_#|<>[\]]/g, ""));
  return clip(flat, max);
}

/**
 * A line-level change to exactly one slot. `value: null` clears the slot the user retracted.
 * There is deliberately no shape that carries a whole profile.
 */
export type ProfileDelta = { slot: ProfileSlotName; value: string | null; statedAt: string; quote: string };

export type ProfileDeltaResult =
  | { applied: true; profile: ContextProfile; slot: ProfileSlotName }
  | { applied: false; profile: ContextProfile; reason: string };

const isSlotShape = (value: unknown): boolean =>
  value !== null && typeof value === "object" && !Array.isArray(value)
  && typeof (value as ProfileSlot).value === "string";

/**
 * Applies one line-level change and returns a new profile. A wholesale replacement is refused: any
 * delta naming no single slot, naming more than one slot, or carrying a profile-shaped payload is
 * rejected and the profile is returned unchanged.
 */
export function applyProfileDelta(profile: ContextProfile, delta: unknown): ProfileDeltaResult {
  const refuse = (reason: string): ProfileDeltaResult => ({ applied: false, profile, reason });
  if (delta === null || typeof delta !== "object" || Array.isArray(delta)) return refuse("A profile change must be a single line-level delta.");
  const record = delta as Record<string, unknown>;

  // A wholesale replacement arrives looking like a profile: slot names at the top level, or a
  // nested profile payload. Refuse it before any field is read.
  const slotKeys = Object.keys(record).filter(key => isProfileSlotName(key));
  if (slotKeys.length > 0) return refuse("A whole profile cannot replace the established one; change one slot at a time.");
  for (const key of ["profile", "contents", "slots"]) {
    if (record[key] !== undefined) return refuse("A whole profile cannot replace the established one; change one slot at a time.");
  }

  const slot = record.slot;
  if (typeof slot !== "string" || !isProfileSlotName(slot)) return refuse("A profile change must name one known slot.");
  if (isSlotShape(record.value)) return refuse("A profile change carries a plain value, never a whole slot record.");

  const statedAt = typeof record.statedAt === "string" ? record.statedAt : "";
  if (!statedAt || Number.isNaN(Date.parse(statedAt))) return refuse("A profile change must record when the user stated it.");

  const next: ContextProfile = { ...profile };
  if (record.value === null) {
    next[slot] = null;
    return { applied: true, profile: next, slot };
  }
  if (typeof record.value !== "string") return refuse("A profile value must be text, or null to clear the slot.");
  const value = sanitise(record.value, PROFILE_VALUE_MAX);
  if (!value) return refuse("A profile value cannot be empty.");
  const quote = sanitise(typeof record.quote === "string" ? record.quote : "", PROFILE_QUOTE_MAX);
  if (!quote) return refuse("A profile change must quote the user's own words.");

  // Store the normalised instant, not the caller's string: Date.parse accepts parenthesised
  // trailing content, so a "valid" date can still carry pipes that forge cells in renderProfile.
  next[slot] = { value, statedAt: new Date(statedAt).toISOString(), quote };
  return { applied: true, profile: next, slot };
}

/**
 * The Markdown block carried in the pinned pair. Empty slots are omitted entirely, so an unstated
 * fact never appears as a blank line the model could fill in. An entirely empty profile renders as
 * an empty string.
 */
export function renderProfile(profile: ContextProfile): string {
  const rows = PROFILE_SLOTS
    .map(name => [name, profile[name]] as const)
    .filter((entry): entry is readonly [ProfileSlotName, ProfileSlot] => entry[1] !== null && entry[1].value.trim().length > 0);
  if (!rows.length) return "";
  const lines = [PROFILE_HEADING, "", "| Fact | Value | Stated | The user's words |", "| --- | --- | --- | --- |"];
  for (const [name, slot] of rows) {
    lines.push(`| ${LABELS[name]} | ${slot.value} | ${slot.statedAt} | ${slot.quote} |`);
  }
  return lines.join("\n");
}

/** A candidate a caller may turn into a delta once it has the instant and the quote. */
export type ProfileProposal = { slot: ProfileSlotName; value: string; quote: string };

/**
 * Patterns that recognise an explicit first-person statement about the user. Each captures the
 * value. Anything else — a question, a third-person mention, a document quoting a name — matches
 * nothing and proposes nothing.
 *
 * Order matters and is deliberate: the narrow patterns run first, because the broad ones share their
 * openings. "I work in millimetres" is a units statement, not a region one, and only the order below
 * keeps it that way.
 */
const PATTERNS: ReadonlyArray<readonly [ProfileSlotName, RegExp]> = [
  ["name", /\b(?:my name is|i am called|i'm called|call me)\s+([^.,;!?\n]{1,120})/i],
  ["units", /\b(?:i (?:use|work in|prefer|draw in)|(?:please )?(?:use|give me|show me)|my units are)\s+((?:millimetres|millimeters|centimetres|centimeters|metres|meters|inches|feet and inches|feet|imperial|metric)(?:\s+(?:units|measurements|throughout|for everything))?)\b/i],
  ["answerStyle", /\b(?:(?:please )?(?:keep|make) (?:your |the )?(?:answers?|replies?|responses?)|i (?:want|prefer|like) (?:my |your )?(?:answers?|replies?|responses?))\s+([^.,;!?\n]{1,120})/i],
  ["role", /\b(?:i(?:'m| am)|i work as)\s+(?:an?\s+)?((?:licensed |registered |senior |lead |principal |chartered )*(?:architect|architectural designer|draft(?:s?(?:man|person))|builder|building designer|surveyor|estimator|engineer|carpenter|fencing contractor|contractor|project manager)[^.,;!?\n]{0,80})/i],
  ["region", /\b(?:i(?:'m| am) (?:based |located )?in|i work in|i live in|my (?:region|state|country|city) is)\s+([^.,;!?\n]{1,120})/i],
  ["standards", /\b(?:i (?:use|follow|work to|build to)|we (?:use|follow|work to|build to)|my (?:standards?|code) is)\s+([^.,;!?\n]{1,120})/i],
];

/** A question is never a statement about the user, however it is phrased. */
const QUESTION = /\?\s*$/;
/** Reported speech and hypotheticals: the user is describing someone else, or a possibility. */
const NOT_ABOUT_USER = /\b(?:they|he|she|the client|the customer|the owner|the builder|the drawing|the plan|the document|the sheet)\s+(?:said|says|is|are|was|were|wants|prefers|uses)\b|\b(?:if|suppose|imagine|pretend|assume)\s+i\b|\bwould i\b/i;

/**
 * Extracts one candidate slot value from an explicit user statement, and returns null when the text
 * is not an explicit statement about the user. Questions, third-person reports, hypotheticals and
 * anything a document merely mentions all return null.
 *
 * The caller supplies the instant and builds the delta; this function never writes to a profile.
 */
export function proposeFromStatement(text: unknown): ProfileProposal | null {
  if (typeof text !== "string") return null;
  const flat = oneLine(text);
  if (!flat || flat.length > 2000) return null;
  if (QUESTION.test(flat)) return null;
  if (NOT_ABOUT_USER.test(flat)) return null;

  for (const [slot, pattern] of PATTERNS) {
    const match = pattern.exec(flat);
    if (!match) continue;
    const value = sanitise(match[1] ?? "", PROFILE_VALUE_MAX);
    if (!value) continue;
    return { slot, value, quote: sanitise(flat, PROFILE_QUOTE_MAX) };
  }
  return null;
}
