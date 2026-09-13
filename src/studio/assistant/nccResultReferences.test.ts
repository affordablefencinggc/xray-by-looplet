import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readNccMatches, nccDocumentLabel } from './nccResultReferences.ts';
const match = {id:'one',documentId:'document',documentName:'NCC_2022_Volume_Two.pdf',edition:'2022',sha256:'a'.repeat(64),page:110,section:null,text:'Source excerpt',score:1};
test('reference pills retain source identity and deduplicate repeated pages', () => {
  assert.deepEqual(readNccMatches([match,{...match,id:'duplicate'}]),[match]);
  assert.equal(nccDocumentLabel(match.documentName),'NCC 2022 Volume Two');
});
test('invalid or oversized source receipts cannot become reference pills', () => {
  for (const changed of [{sha256:'missing'},{page:0},{page:1.5},{text:'x'.repeat(20001)},{section:42}]) {
    assert.deepEqual(readNccMatches([{...match,...changed}]),[]);
  }
  assert.deepEqual(readNccMatches({matches:[match]}),[]);
});
