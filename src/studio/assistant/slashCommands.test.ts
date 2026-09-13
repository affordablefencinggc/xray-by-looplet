import {test} from 'node:test';
import assert from 'node:assert/strict';
import {suggestSlashCommands} from './slashCommands.ts';
test('monkey prefix offers both start and stop and exact selection remains unambiguous',()=>{
  assert.deepEqual(suggestSlashCommands('/monkey').map(x=>x.command),['/monkeysee','/monkeydo']);
  assert.deepEqual(suggestSlashCommands(' /MONKEYDO ').map(x=>x.command),['/monkeydo']);
  assert.ok(suggestSlashCommands('/').length>0);
});
test('near miss offers a correction without treating ordinary prose as a command',()=>{
  assert.ok(suggestSlashCommands('/monkesee').some(x=>x.command==='/monkeysee'));
  for(const value of ['','review /monkeysee','/monkeysee then draw','/zzzzzzzzzzz'])assert.deepEqual(suggestSlashCommands(value),[]);
});
