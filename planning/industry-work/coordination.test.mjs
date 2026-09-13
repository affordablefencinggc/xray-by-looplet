import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignments, validateOwnership } from './coordination.mjs';

test('all 68 profiles are queued or assigned with disjoint worker ownership', () => {
  assert.deepEqual(validateOwnership(), { industries: 68, ownedPaths: 9 });
  assert.equal(assignments.filter(row => row.worker).length, 3);
});
test('rejects nested and duplicate ownership instead of allowing competing writers', () => {
  const row = (id, path) => ({ id, writePaths: [path] });
  assert.throws(() => validateOwnership([row('a', 'src/'), row('b', 'src/file.ts')]), /Overlapping/);
  assert.throws(() => validateOwnership([row('a', 'src/file.ts'), row('b', 'src/')]), /Overlapping/);
  assert.throws(() => validateOwnership([row('a', 'src/file.ts'), row('b', 'src/file.ts')]), /Overlapping/);
  assert.throws(() => validateOwnership([row('a', '../escape')]), /Invalid/);
});
