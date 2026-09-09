import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateAssistantFile, MAX_ASSISTANT_FILE_BYTES, MAX_ASSISTANT_FILES, hashAttachment } from './attachmentFiles.ts';

for (const extension of ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'txt', 'md', 'csv', 'json', 'dxf', 'ifc', 'svg']) {
  test(`large ${extension} intake accepts the 500 MB boundary`, () => {
    assert.doesNotThrow(() => validateAssistantFile({ name: `technical.${extension}`, size: MAX_ASSISTANT_FILE_BYTES }));
    assert.throws(() => validateAssistantFile({ name: `technical.${extension}`, size: MAX_ASSISTANT_FILE_BYTES + 1 }), /500 MB/);
  });
}
test('unsupported, empty and invalid sizes fail before content is read', () => {
  for (const file of [{ name: 'design.exe', size: 1 }, { name: 'design.dwg', size: 1 }, { name: 'design.pdf', size: 0 }, { name: 'design.pdf', size: NaN }, { name: 'design.pdf', size: -1 }]) assert.throws(() => validateAssistantFile(file));
  assert.equal(MAX_ASSISTANT_FILES, 20);
});
test('chunked original-file hash matches independent SHA-256 across chunk boundaries', async () => {
  const bytes = new Uint8Array(3 * 1024 * 1024 + 17).map((_, i) => i % 251);
  const values: number[] = [];
  assert.equal(await hashAttachment(new Blob([bytes]), value => values.push(value)), createHash('sha256').update(bytes).digest('hex'));
  assert.equal(values.length, 4); assert.equal(values.at(-1), 1);
});
