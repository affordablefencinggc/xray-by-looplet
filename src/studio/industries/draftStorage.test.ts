import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIndustryDraftLibrary, updateIndustryDraft } from './draftStorage.ts';

test('drafts merge by industry while stale edits to the same form are rejected', () => {
  const roof = updateIndustryDraft(null, 'job-a', 'roofing', 0, { area: '80' });
  const both = updateIndustryDraft(JSON.stringify(roof), 'job-a', 'hvac', 0, { length: '10' }, roof.generation ?? null);
  assert.deepEqual(both.drafts.roofing, roof.drafts.roofing);
  const revised = updateIndustryDraft(JSON.stringify(both), 'job-a', 'roofing', 1, { area: '90' }, both.generation ?? null);
  assert.deepEqual(revised.drafts.hvac, both.drafts.hvac);
  assert.equal(revised.drafts.roofing?.revision, 2);
  assert.throws(() => updateIndustryDraft(JSON.stringify(revised), 'job-a', 'roofing', 1, { area: 'old' }, revised.generation ?? null), /another window/);
  assert.equal(roof.drafts.roofing?.form.area, '80');
});

test('foreign, malformed and overflowing draft revisions cannot be silently replaced', () => {
  const original = updateIndustryDraft(null, 'job-a', 'roofing', 0, { area: '', reference: '' });
  assert.throws(() => parseIndustryDraftLibrary(JSON.stringify(original), 'job-b'), /another project/);
  assert.throws(() => updateIndustryDraft('broken data', 'job-a', 'roofing', 0, {}));
  assert.throws(() => updateIndustryDraft(JSON.stringify({ ...original, revision: Number.MAX_SAFE_INTEGER }), 'job-a', 'roofing', 1, {}, original.generation ?? null));
  assert.throws(() => updateIndustryDraft(JSON.stringify(original), 'job-b', 'roofing', 0, {}));
  assert.deepEqual(parseIndustryDraftLibrary(JSON.stringify(original), 'job-a'), original);
});

test('restoration invalidates delayed writes even when slot revisions coincide or the restored library is empty', () => {
  const old = updateIndustryDraft(null, 'job-a', 'roofing', 0, { area: '80' });
  const restored = { ...old, generation: crypto.randomUUID() };
  assert.throws(() => updateIndustryDraft(JSON.stringify(restored), 'job-a', 'roofing', 1, { area: 'late' }, old.generation ?? null), /restored or replaced/);
  const empty = { ...restored, revision: 0, drafts: {} };
  assert.throws(() => updateIndustryDraft(JSON.stringify(empty), 'job-a', 'hvac', 0, { length: 'late' }, null), /restored or replaced/);
  const next = updateIndustryDraft(JSON.stringify(empty), 'job-a', 'hvac', 0, { length: '10' }, empty.generation);
  assert.equal(next.drafts.hvac?.revision, 1);
});
