import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChatArchive, putChat, restoreChat, type ChatArchive, type SavedChat } from './chatHistory.ts';
const thread = (id:string):SavedChat=>({id,updatedAt:'2026-09-10T00:00:00Z',entries:[{id:id+':u',kind:'user',text:'Keep '+id}],contents:[],error:null,busy:false});
test('new chats retain prior conversations and switching history preserves every thread',()=>{
  const first=thread('first'),second=thread('second');
  const original:ChatArchive={projectId:'project-a',revision:0,activeId:first.id,threads:[first]};
  const next=putChat(original,second);
  assert.equal(next.activeId,'second');assert.equal(next.threads.length,2);
  const restored=putChat(next,first);
  assert.equal(restored.activeId,'first');assert.equal(restored.threads.length,2);
  assert.deepEqual(original.threads,[first]);
});
test('restoring an interrupted response does not leave a tool permanently working',()=>{
  const value=thread('a');value.busy=true;value.entries.push({id:'tool',kind:'tool',toolName:'save_project',text:'Running save_project…'});
  const restored=restoreChat(value);
  assert.equal(restored.busy,false);assert.match(restored.error!,/interrupted/);
  assert.equal(restored.entries[1].failed,true);assert.doesNotMatch(restored.entries[1].text,/Running/);
  assert.equal(value.busy,true);
});
test('foreign, incomplete or duplicate history is rejected without manufacturing an empty replacement',()=>{
  const value:ChatArchive={projectId:'a',revision:1,activeId:'one',threads:[thread('one')]};
  assert.equal(parseChatArchive(value,'a').threads[0].entries[0].text,'Keep one');
  assert.throws(()=>parseChatArchive(value,'b'));
  assert.throws(()=>parseChatArchive({...value,activeId:'missing'},'a'));
  assert.throws(()=>parseChatArchive({...value,threads:[thread('one'),thread('one')]},'a'));
});
