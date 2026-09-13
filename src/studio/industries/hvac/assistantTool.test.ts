import { test } from 'node:test';
import assert from 'node:assert/strict';
import { name, inputSchema, execute } from './assistantTool.ts';

test('assistant adapter returns explicit duct area and mass without mutating the supplied schedule', () => {
  const operand = (value: number) => ({ value, sourceReference: 'User supplied synthetic QA fixture' });
  const input = { sections: [{ id: 'qa', shape: 'rectangular', lengthM: operand(10), widthM: operand(.5), heightM: operand(.3), sheetMassKgPerM2: operand(4) }] };
  const before = structuredClone(input);
  const result = execute(input);
  assert.equal(name, 'calculate_draft_duct_material');
  assert.equal(inputSchema.type, 'object');
  assert.equal(inputSchema.additionalProperties, false);
  assert.equal(result.developedAreaM2, 16);
  assert.equal(result.sheetMassKg, 64);
  assert.equal(result.verifiedQuoteEligible, false);
  assert.equal(result.status, 'draft-unverified');
  assert.deepEqual(input, before);
  assert.throws(() => execute({ sections: [{ ...input.sections[0], lengthM: { value: 10 } }] }));
  assert.throws(() => execute({ ...input, verified: true }));
});
