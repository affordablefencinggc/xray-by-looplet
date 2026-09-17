import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createWorkPacket, refreshWorkPacket, checkPacketAction, checkPacketIntegrity, resolveGoverningSource, findingSchema, renderWorkPacket, type ProjectSnapshot } from './workPacket.ts';
import { hashEvent } from './workPacketStore.ts';
const snapshot: ProjectSnapshot = { projectId: 'p1', projectName: 'Tower A', projectRevision: 1, designRevision: 1, site: null,
  activeDocumentId: 's1', page: 6, recoveryBlocked: false, sources: [{ id: 's1', name: 'Structural P3.pdf', sha256: 'a'.repeat(64),
    revision: null, informationStatus: 'unknown', purpose: null, discipline: null, origin: 'desktop' }] };
test('ingested filename/hash do not confer revision, governing status or professional authority', () => {
  const packet = createWorkPacket('Check Level 6', snapshot);
  assert.equal(packet.professionalAuthority, 'unverified');
  assert.equal(packet.snapshot.sources[0].revision, null);
  assert.throws(() => resolveGoverningSource(snapshot.sources, { sourceId: 's1', revision: 'P3', purpose: 'construction', allowedStatuses: ['published'] }), /not been established/);
  assert.match(renderWorkPacket(packet), /Source candidates are not governing sources/);
});
test('governing source selection binds purpose, status, revision and hash; superseded never governs', () => {
  const source = { ...snapshot.sources[0], revision: 'P3', purpose: 'coordination', informationStatus: 'shared' as const };
  const selection = { sourceId: 's1', revision: 'P3', purpose: 'coordination', allowedStatuses: ['shared', 'superseded'] };
  assert.equal(resolveGoverningSource([source], selection).revision, 'P3');
  assert.throws(() => resolveGoverningSource([{ ...source, informationStatus: 'superseded' }], selection));
  assert.throws(() => resolveGoverningSource([source, source], selection));
  assert.throws(() => resolveGoverningSource([source], { ...selection, purpose: 'construction' }));
});
test('project switch, stale design, source replacement and pending action prevent execution', () => {
  const p = createWorkPacket('Draw a concept', snapshot);
  assert.doesNotThrow(() => checkPacketAction(p, 'draw_architect_elements', { expectedJobId: 'p1' }, snapshot));
  assert.throws(() => checkPacketAction(p, 'draw_architect_elements', {}, { ...snapshot, projectId: 'p2' }), /identity/);
  assert.throws(() => checkPacketAction(p, 'draw_architect_elements', {}, { ...snapshot, designRevision: 2 }), /stale/);
  assert.throws(() => checkPacketAction(p, 'draw_architect_elements', {}, { ...snapshot, sources: [] }), /stale/);
  assert.throws(() => checkPacketAction({ ...p, pendingAction: 'unfinished' }, 'draw_architect_elements', {}, snapshot), /durable outcome/);
  assert.doesNotThrow(() => checkPacketAction({ ...p, pendingAction: 'unfinished' }, 'read_architect_design', {}, snapshot));
});
test('app editing permission never supplies professional approval or external issue authority', () => {
  const p = createWorkPacket('Prepare an RFI', snapshot);
  for (const tool of ['send_rfi', 'issue_instruction', 'certify_design', 'approve_design', 'review_takeoff_item'])
    assert.throws(() => checkPacketAction(p, tool, { approved: true, approver: 'Engineer' }, snapshot), /verified human authority/);
});

test('the authority refusal is separable from the packet integrity checks', () => {
  // D6: the runtime runs the integrity checks before the permission prompt, so the prompt can be
  // reached at all, and the composed check (authority included) once the user has decided. Splitting
  // them must not weaken either: integrity still refuses identity, staleness and pending actions, and
  // the composed form still refuses every professional verb.
  const p = createWorkPacket('Prepare an RFI', snapshot);
  assert.doesNotThrow(() => checkPacketIntegrity(p, 'review_takeoff_item', { expectedJobId: 'p1' }, snapshot));
  assert.throws(() => checkPacketIntegrity(p, 'review_takeoff_item', { expectedJobId: 'p2' }, snapshot), /identity/);
  assert.throws(() => checkPacketIntegrity(p, 'draw_architect_elements', {}, { ...snapshot, designRevision: 2 }), /stale/);
  assert.throws(() => checkPacketIntegrity({ ...p, pendingAction: 'unfinished' }, 'draw_architect_elements', {}, snapshot), /durable outcome/);
  assert.doesNotThrow(() => checkPacketIntegrity({ ...p, pendingAction: 'unfinished' }, 'read_architect_design', {}, snapshot));
  // The authority refusal is not in the integrity check: a professional verb passes it untouched and
  // is stopped only by the composed form above.
  for (const tool of ['send_rfi', 'issue_instruction', 'certify_design', 'approve_design', 'review_takeoff_item'])
    assert.doesNotThrow(() => checkPacketIntegrity(p, tool, {}, snapshot), tool);
  // And the source order the whole fix rests on: the prompt is awaited before the authority refusal.
  const runtime = fs.readFileSync(new URL('./workPacketRuntime.ts', import.meta.url), 'utf8');
  assert.match(runtime, /checkPacketIntegrity\(packet, tool, args, snapshot\)/);
  assert.ok(runtime.indexOf('const refusal = await authorize?.();') > runtime.indexOf('checkPacketIntegrity(packet, tool, args, snapshot)'),
    'the packet checks must run before the permission prompt');
  assert.ok(runtime.indexOf('checkPacketAction(packet, tool, args, readLiveProjectSnapshot(projectId));') > runtime.indexOf('const refusal = await authorize?.();'),
    'the authority refusal must run after the user has decided');
});
test('unknown source governance and decision owner allow internal setup and illustrative drafting', () => {
  const p = createWorkPacket('Create an illustrative wireframe in Model', { ...snapshot, sources: [], activeDocumentId: null });
  assert.equal(p.decisionOwner, null);
  assert.ok(p.acceptance.some(check => check.result === 'unknown'));
  for (const tool of ['read_project_context', 'navigate_workspace', 'read_architect_design', 'draw_architect_elements', 'show_design_in_model'])
    assert.doesNotThrow(() => checkPacketAction(p, tool, { expectedJobId: 'p1' }, p.snapshot));
  assert.match(renderWorkPacket(p), /not universal execution blockers/);
  assert.throws(() => checkPacketAction(p, 'issue_instruction', { expectedJobId: 'p1' }, p.snapshot), /verified human authority/);
});
test('findings distinguish inference from observations and require a reproducible calculation method', () => {
  const finding = { id: 'f1', statement: 'Potential conflict', basis: 'inferred', status: 'draft', confidence: 'low', evidence: [], method: null, owner: null, review: 'unreviewed' };
  assert.ok(findingSchema.safeParse(finding).success);
  assert.equal(findingSchema.safeParse({ ...finding, basis: 'observed' }).success, false);
  assert.equal(findingSchema.safeParse({ ...finding, review: 'approved' }).success, false);
  assert.equal(findingSchema.safeParse({ ...finding, basis: 'calculated', evidence: [{ sourceId: 's1', sourceRevision: 'P3', sha256: 'a'.repeat(64), location: 'Grid C/7' }] }).success, false);
});
test('revision change invalidates conclusions without rewriting evidence or silently closing work', () => {
  const p = createWorkPacket('Check', snapshot);
  p.findings.push(findingSchema.parse({ id: 'f1', statement: 'Potential conflict', basis: 'inferred', status: 'draft', confidence: 'low', evidence: [], method: null, owner: null, review: 'unreviewed' }));
  const next = refreshWorkPacket(p, { ...snapshot, designRevision: 2 });
  assert.equal(next.findings[0].status, 'review-required');
  assert.equal(p.findings[0].status, 'draft');
  assert.match(next.unresolved.join(' '), /revision changed/);
});
test('audit event hash binds payload, project, predecessor and sequence', async () => {
  const event = { id: 'e1', projectId: 'p1', packetId: 'w1', sequence: 1, at: '2026-09-09T10:00:00.000Z', kind: 'tool-result', payload: { saved: true }, previousHash: null };
  const hash = await hashEvent(event);
  assert.equal(hash.length, 64); assert.equal(hash, await hashEvent(event));
  for (const changed of [{ ...event, payload: { saved: false } }, { ...event, projectId: 'p2' }, { ...event, sequence: 2 }]) assert.notEqual(hash, await hashEvent(changed));
});
