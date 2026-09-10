/**
 * Reproduces, under bare Node, the exact transcript the browser assembled in the
 * wiring-desktop run, and measures it with the same estimator the on-screen meter uses.
 *
 * The browser meter read 369 tokens after the first send. If that number is reproduced here
 * from the seeded profile and digest, the carried context demonstrably rode with the message;
 * a bare send would measure far less. Run: node proof/growth/2026-09-10-context-wiring/measure-pinned.mjs
 */
import { assembleTurn } from '../../../src/studio/assistant/contextTurn.ts';
import { emptyProfile } from '../../../src/studio/assistant/contextProfile.ts';
import { measureContext } from '../../../src/studio/assistant/contextBudget.ts';
import { profileFromNotes } from '../../../src/studio/assistant/contextTurn.ts';

const JOB = 'job-eacfc346-470e-42a1-9225-38e4d1470dfa';

// Byte-for-byte what the scenario seeded into IndexedDB.
const notes = ['role: fencing contractor in Queensland', 'units: millimetres on every drawing'];
const entries = [{
  id: JOB + '-seed-1',
  jobId: JOB,
  at: '2026-09-10T04:00:00.000+10:00',
  topic: 'Northern boundary fence',
  summary: 'Traced the northern boundary and confirmed the 900 mm setback.',
  evidence: 'tool-receipt',
  tools: ['xray_read_architect_design'],
}];

// Exactly the text the scenario typed, wrapped the way send() wraps it.
const today = {
  role: 'user',
  parts: [{ text: `Current X-Ray project ID: ${JOB}\nIn one short sentence, what units does this project use?` }],
};

const withCarried = assembleTurn({
  base: [],
  carried: { profile: profileFromNotes(notes), entries, failed: false, reason: '' },
  carriedCallIds: [],
  today,
});

const withoutCarried = assembleTurn({
  base: [],
  carried: { profile: emptyProfile(), entries: [], failed: false, reason: '' },
  carriedCallIds: [],
  today,
});

const a = measureContext(withCarried.contents);
const b = measureContext(withoutCarried.contents);

console.log(JSON.stringify({
  browserMeterAfterFirstSend: 369,
  withCarriedContext: { tokens: a.tokens, entries: a.count, pinned: withCarried.pinned },
  withoutCarriedContext: { tokens: b.tokens, entries: b.count, pinned: withoutCarried.pinned },
  carriedContextCostsTokens: a.tokens - b.tokens,
  matchesBrowser: a.tokens === 369,
}, null, 2));
