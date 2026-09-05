import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { readLedger, validate, hash, inputDigest, sliceStatus, artifactAllowed, render } from '../../../scripts/industry-ledger.mjs';

test('independent gallery: live ledger embeds images and local metadata', () => {
  const data=readLedger(); const result=validate(data); assert.equal(result.ok,true,JSON.stringify(result));
  const html=render(data); assert.ok((html.match(/<img /g)||[]).length>=19);
  assert.match(html,/Latest local proof/); assert.match(html,/Source report/);
});

test('independent gallery: screenshot removal prevents verified UI and nonvisual claims', () => {
  for(const visual of [true,false]) {
    const data=readLedger(), task=data.tasks[0], path='scripts/industry-ledger.mjs';
    task.visual=visual;task.inputs=[path];task.startupHandover=path;task.completionHandover=path;task.status='verified';
    const digest=inputDigest(task),sha256=hash(readFileSync(path));
    task.evidence=(visual?['patch','executed','before','before-mobile','after-desktop','after-mobile']:['patch','executed','execution-capture']).map(kind=>({kind,path,sha256,revision:task.revision,inputDigest:digest}));
    task.review={reviewer:'independent-gallery-fixture',decision:'approved',reviewedAt:new Date().toISOString(),path,sha256,revision:task.revision,inputDigest:digest};
    for(const slice of data.slices)slice.status=sliceStatus(data.tasks.filter(t=>t.slice===slice.id));
    const result=validate(data);assert.equal(result.ok,false);assert.match(result.errors.join('\n'),/visible screenshot metadata/);
  }
});

test('independent gallery: nonlocal origin and malformed viewport reject', () => {
  for(const change of [e=>e.screenshot.url='https://localhost.external.example/',e=>e.screenshot.viewport.width=0,e=>e.screenshot.reportSha256='0'.repeat(64)]) {
    const data=readLedger(),e=data.tasks.flatMap(t=>t.evidence).find(e=>e.screenshot);change(e);assert.equal(validate(data).ok,false);
  }
});

test('FINDING GALLERY-01: capture source report must be an allowlisted accessible artifact', () => {
  const data=readLedger(),e=data.tasks.flatMap(t=>t.evidence).find(e=>e.screenshot);
  e.screenshot.reportPath='package.json';e.screenshot.reportSha256=hash(readFileSync('package.json'));
  const result=validate(data);
  console.log(JSON.stringify({case:'GALLERY-01',accepted:result.ok,reportAllowed:artifactAllowed(e.screenshot.reportPath,data)}));
  assert.equal(result.ok,false,'A screenshot should not validate when its attached source report is inaccessible to the gallery');
});

test('FINDING GALLERY-02: verified image evidence cannot be arbitrary text with a png extension', () => {
  const data=readLedger(),task=data.tasks[0],source='scripts/industry-ledger.mjs';
  const screenshot=structuredClone(data.tasks.flatMap(t=>t.evidence).find(e=>e.screenshot));
  task.visual=false;task.inputs=[source];task.startupHandover=source;task.completionHandover=source;task.status='verified';
  const digest=inputDigest(task),sha256=hash(readFileSync(source));
  task.evidence=['patch','executed'].map(kind=>({kind,path:source,sha256,revision:task.revision,inputDigest:digest}));
  const path='proof/audit/IW-GALLERY-REVIEW/not-an-image.png';writeFileSync(path,'This is deliberately not an image.');
  Object.assign(screenshot,{kind:'execution-capture',path,sha256:hash(readFileSync(path)),revision:task.revision,inputDigest:digest});task.evidence.push(screenshot);
  task.review={reviewer:'independent-gallery-fixture',decision:'approved',reviewedAt:new Date().toISOString(),path:source,sha256,revision:task.revision,inputDigest:digest};
  for(const slice of data.slices)slice.status=sliceStatus(data.tasks.filter(t=>t.slice===slice.id));
  const result=validate(data);
  console.log(JSON.stringify({case:'GALLERY-02',accepted:result.ok,imageBytes:readFileSync(path).length,verifiedStatus:task.status}));
  assert.equal(result.ok,false,'Mandatory screenshot evidence must at least decode as the declared image format');
});
