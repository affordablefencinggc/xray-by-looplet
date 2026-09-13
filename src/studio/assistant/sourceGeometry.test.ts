import test from 'node:test';
import assert from 'node:assert/strict';
import { readSourceGeometry, sourceGeometryArgs } from './sourceGeometry.ts';
import { createHash } from 'node:crypto';
import type { PlanBinary } from '../documentContract.ts';

const bytes = new TextEncoder().encode('%PDF-test-source');
const source = { bytes, sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), kind: 'pdf', mimeType: 'application/pdf', documentId: 'document', name: 'plan.pdf' } as PlanBinary;
const args = { expectedJobId: 'project', page: 3 };
test('source geometry refuses bytes that differ from registered source before sending', async () => {
  let calls = 0;
  await assert.rejects(readSourceGeometry({...source, sha256:'0'.repeat(64)},args,async()=>{calls++;return Response.json({});}), /identity/);
  assert.equal(calls,0);
});
test('source geometry sends selected page and region and refuses wrong-page replies', async () => {
  await assert.rejects(readSourceGeometry(source,{...args,region:[.2,.3,.1,.2]},async(_url,init)=>{
    const body=JSON.parse(String(init?.body));
    assert.equal(body.page,3); assert.equal(body.sha256,source.sha256); assert.deepEqual(body.region,[.2,.3,.1,.2]);
    assert.equal(atob(body.pdfBase64),'%PDF-test-source');
    return Response.json({schema:'xray.assistant-source-geometry/v1',sourceSha256:source.sha256,page:2});
  }), /identity mismatch/);
});
test('unavailable Python is an explicit error, not a geometry fallback', async () => {
  await assert.rejects(readSourceGeometry(source,args,async()=>Response.json({error:'Python unavailable'},{status:503})),/Python unavailable/);
  assert.equal(sourceGeometryArgs.safeParse({...args,region:[.9,0,.2,1]}).success,false);
});
