/** Run only on DANS1. Exercises real model/parsing/measurement code, not a UI bridge. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { hostname } from 'node:os';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';

if (hostname().trim().toLowerCase() !== 'dans1') throw Error('Product fixture generation is DANS1-only');
const [sourceArgument, manifestArgument, outputArgument] = process.argv.slice(2);
if (!sourceArgument || !manifestArgument || !outputArgument) throw Error('Expected source, source manifest and NEW output directory');
const source = resolve(sourceArgument), output = resolve(outputArgument);
const manifest = JSON.parse(await readFile(manifestArgument, 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const verify = async () => {
  for (const entry of manifest.entries) {
    const target = resolve(source, entry.path), rel = relative(source, target);
    if (rel.startsWith('..') || isAbsolute(rel)) throw Error('Source manifest escaped snapshot');
    assert.equal(sha(await readFile(target)), entry.sha256, entry.path);
  }
};
await verify();
const importSource = file => import(pathToFileURL(join(source, file)).href);
const domain = await importSource('src/studio/domain.ts');
const documents = await importSource('src/studio/documents.ts');
const contract = await importSource('src/studio/documentContract.ts');
const persistence = await importSource('src/studio/persistence.ts');
const drafts = await importSource('src/studio/industries/draftStorage.ts');
const quantity = await importSource('src/studio/industries/quantity-surveying/quantityForm.ts');
const { qsMeasuredGeometry } = await importSource('src/studio/industries/quantity-surveying/qsMeasuredGeometry.ts');

const now = '2026-09-19T12:00:00.000Z';
const projectId = 'job-sc09-entity-highlight';
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="#f4f1e8"/><path d="M40 40H560V360H40Z M100 120H500 M100 280H420" fill="none" stroke="#77818c" stroke-width="2"/><text x="44" y="30" font-family="sans-serif" font-size="14">SC09 calibrated source geometry</text></svg>';
const bytes = new TextEncoder().encode(svg);
const inspected = await documents.inspectPlanBytes({ name: 'SC09 measured wall source Rev C.svg', bytes, source: 'web' }, now);
const document = { ...inspected.revision, id: 'doc-sc09-source' };
const binary = { ...inspected.binary, documentId: document.id };
assert.equal(document.sha256, '668ba07cfc41201c37ec87e2b1a151a51ed77b0a9518bd6ca4c424c415881d5c');
assert.equal(bytes.byteLength, 340);
const points = [{ x: 100, y: 40 }, { x: 500, y: 40 }];
const candidate = {
  id: 'cal-sc09-grid-5m', source: 'manual', metresPerUnit: 0.0125, confidence: 1,
  inputDistance: { value: 5, unit: 'm' }, knownDistanceM: 5, points,
  provenance: { method: 'two-point', evidence: 'SC09 controlled 5 m grid reference', documentId: document.id },
};
const calibration = domain.calibrationSchema.parse({
  sheet: 0, coordinateSpace: 'source-page-v1', metresPerUnit: candidate.metresPerUnit,
  source: 'manual', confidence: 1, locked: true, knownDistanceM: 5, points,
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  inputDistance: candidate.inputDistance, candidates: [candidate], selectedCandidateId: candidate.id, conflict: null,
});
const specification = assembly => ({
  ...domain.createRunSpecification(), constructionEnabled: true,
  construction: { assembly, trade: 'General construction', quantity: 'length', widthM: null, depthM: null,
    reference: 'SC09 source-bound measured geometry' },
});
const run = (id, label, y, end, length, assembly) => ({
  id, revision: 1, sheet: 0, label, points: [{ x: 100, y }, { x: end, y }],
  lengthM: length, grossLengthM: length, gateDeductionM: 0, netLengthM: length,
  specification: specification(assembly), photoIds: [], review: domain.createReviewDecision(),
});
const job = domain.fencingJobSchema.parse({
  ...domain.createDefaultJob(now), id: projectId, revision: 1, name: 'SC09 entity binding proof', updatedAt: now,
  documents: [document], activeDocumentId: document.id, activeSheet: 0, calibrations: [calibration],
  runs: [run('run-sc09-a', 'Measured wall A', 120, 500, 5, 'wall'), run('run-sc09-b', 'Measured wall B', 280, 420, 4, 'partition')],
  gates: [], photos: [], bom: [], quoteDraft: null, revisionHistory: [],
});
const form = quantity.quantityFormSchema.parse({
  hierarchyId: 'SC09 measured walls', hierarchyRevision: 'Rev C', calculated: false, binding: null,
  nodes: [{ key: 'node-wall-a', code: 'A', label: 'External wall', parentKey: '' }, { key: 'node-wall-b', code: 'B', label: 'Internal wall', parentKey: '' }],
  items: [{ key: 'item-wall-a', reference: 'QS-WALL-A', quantity: '5', unit: 'm', evidence: 'unverified', nodeKey: 'node-wall-a' },
    { key: 'item-wall-b', reference: 'QS-WALL-B', quantity: '4', unit: 'm', evidence: 'unverified', nodeKey: 'node-wall-b' }],
});
const library = drafts.updateIndustryDraft(null, projectId, 'quantity-surveying', 0, form);
assert.deepEqual(drafts.parseIndustryDraftLibrary(JSON.stringify(library), projectId), library);
const values = new Map();
const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
assert.equal(persistence.saveFencingJob(job, storage, { expectedRaw: null }).ok, true);
assert.deepEqual(persistence.loadFencingJob(storage).job, job);
const geometry = qsMeasuredGeometry(job, 0, true);
assert.deepEqual(geometry.map(entry => entry.measuredQuantity), ['5', '4']);
assert.ok(geometry.every(entry => entry.sourceSha256 === document.sha256 && entry.calibrationId));
assert.ok(qsMeasuredGeometry(job, 0, false).every(entry => entry.calibrationId === null && entry.sourceSha256 === null));
assert.ok(form.items.every(item => item.entityBinding == null));

const fixture = {
  format: 'xray.sc09-production-proof-fixture/v1',
  projectStorageKey: persistence.FENCING_JOB_STORAGE_KEY,
  industryStorageKey: drafts.industryDraftKey(projectId),
  planDatabase: contract.PLAN_CONTENT_DB, planStore: contract.PLAN_CONTENT_STORE,
  job, library, sourceBounds: { x: 0, y: 0, width: 600, height: 400 },
  source: { documentId: binary.documentId, name: binary.name, kind: binary.kind, mimeType: binary.mimeType,
    sizeBytes: binary.sizeBytes, sha256: binary.sha256, bytesBase64: Buffer.from(binary.bytes).toString('base64') },
};
await verify();
await mkdir(output); // unique destination: preserve previous fixture receipts
const fixtureBytes = JSON.stringify(fixture, null, 2) + '\n';
await writeFile(join(output, 'fixture.json'), fixtureBytes);
const result = {
  host: hostname(), owner: '/root/sc09_review', capturedAt: new Date().toISOString(), verdict: 'PASS',
  source, sourceArchiveSha256: manifest.archiveSha256, fixtureSha256: sha(fixtureBytes),
  sourceFilesVerifiedBeforeAndAfter: manifest.entries.length,
  checks: ['real SVG inspection and SHA-256', 'real calibration/job schema', 'real quantity form/draft parser',
    'real project persistence roundtrip', 'real measured geometry 5m/4m', 'missing-byte authority withheld', 'both QS rows unbound'],
  limits: ['Controlled fixture, not a user drawing', 'Fixture generation is not a production browser result'],
};
await writeFile(join(output, 'fixture-results.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
