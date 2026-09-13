import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readAttachment } from './readAttachment.ts';
import type { PlanBinary } from '../documentContract.ts';

function source(): PlanBinary {
  const bytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><text>Sheet 3 source</text></svg>');
  return { documentId: 'source-3', name: 'Sheet 3.svg', kind: 'svg', mimeType: 'image/svg+xml', sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), bytes };
}

test('an imported source can be read directly without an assistant attachment copy', async () => {
  const input = source();
  const result = await readAttachment('project-1', input.documentId, 1, 0, input);
  const payload = JSON.parse(result.content[0].text!);
  assert.equal(payload.id, input.documentId);
  assert.equal(payload.projectId, 'project-1');
  assert.equal(payload.origin, 'Imported project source');
  assert.equal(payload.sha256, input.sha256);
  assert.match(payload.text, /Sheet 3 source/);
});

test('changed source bytes and incorrect registered sizes are rejected', async () => {
  const input = source();
  await assert.rejects(readAttachment('project-1', input.documentId, 1, 0, { ...input, sha256: '0'.repeat(64) }), /do not match/);
  await assert.rejects(readAttachment('project-1', input.documentId, 1, 0, { ...input, sizeBytes: input.sizeBytes + 1 }), /do not match/);
});
