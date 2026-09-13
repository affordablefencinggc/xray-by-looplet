import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAssistantTurnGate } from './assistantTurnGate.ts';

test('three independent chats may run while duplicates and a fourth remain bounded', () => {
  const gate = createAssistantTurnGate();
  const slots = ['roofing', 'hvac', 'qs'].map(id => gate.acquire(id));
  assert.ok(slots.every(slot => slot.accepted));
  assert.deepEqual(gate.acquire('roofing'), { accepted: false, reason: 'duplicate' });
  assert.deepEqual(gate.acquire('fourth'), { accepted: false, reason: 'capacity' });
  if (slots[1].accepted) slots[1].release();
  assert.equal(gate.acquire('fourth').accepted, true);
});

test('releasing a completed slot twice cannot unlock a later request with the same id', () => {
  const gate = createAssistantTurnGate(1);
  const first = gate.acquire('a');
  assert.ok(first.accepted);
  first.release();
  const next = gate.acquire('a');
  assert.ok(next.accepted);
  first.release();
  assert.deepEqual(gate.acquire('b'), { accepted: false, reason: 'capacity' });
  next.release();
  assert.equal(gate.acquire('b').accepted, true);
});
