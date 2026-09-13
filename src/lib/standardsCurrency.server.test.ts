import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkNccPublisher, publisherNotices, NCC_PUBLISHER } from './standardsCurrency.server.ts';

test('recognises explicit amendment and corrigendum notices, never infers latest', () => {
  assert.equal(publisherNotices('NCC 2022 is the latest').length, 0);
  assert.equal(publisherNotices('<script>NCC 2022 is superseded by NCC 2022 Amendment 1</script>').length, 0);
  assert.equal(publisherNotices('NCC 2022 Amendment 1 is superseded by <a>NCC 2022 Amendment 2</a>. NCC 2022 is superseded by NCC 2022 Amendment 1. NCC 2022 is to be read in conjunction with this corrigendum.').length, 3);
});
test('only a recognised publisher page produces a checked receipt', async () => {
  let requested = '';
  const check = await checkNccPublisher((async (url) => { requested = String(url); return new Response('National Construction Code 2022 Housing Provisions', {headers:{'content-type':'text/html'}}); }) as typeof fetch);
  assert.equal(requested, NCC_PUBLISHER); assert.equal(check.status, 'checked');
  assert.match(check.pageSha256!, /^[a-f0-9]{64}$/); assert.deepEqual(check.notices, []);
  for (const response of [new Response('Access denied', {headers:{'content-type':'text/html'}}), new Response('',{status:503}), new Response('National Construction Code 2022 Housing Provisions', {headers:{'content-type':'application/pdf'}})]) {
    const result = await checkNccPublisher((async () => response) as typeof fetch);
    assert.equal(result.status, 'unavailable'); assert.equal(result.pageSha256, undefined);
  }
});
test('network failure and oversized pages fail closed', async () => {
  const failed = await checkNccPublisher((async () => { throw Error('Offline'); }) as typeof fetch);
  assert.equal(failed.status,'unavailable');
  const large = await checkNccPublisher((async () => new Response('x'.repeat(2_000_001),{headers:{'content-type':'text/html'}})) as typeof fetch);
  assert.equal(large.status,'unavailable');
});
