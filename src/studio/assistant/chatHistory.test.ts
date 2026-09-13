import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveChat, parseChatArchive, putChat, restoreChat, type ChatArchive, type SavedChat } from './chatHistory.ts';
const thread = (id:string):SavedChat=>({id,updatedAt:'2026-09-10T00:00:00Z',entries:[{id:id+':u',kind:'user',text:'Keep '+id}],contents:[],error:null,busy:false});

test('model and app preflight receipts survive strict archive validation and interrupted restore',()=>{
  const saved=thread('receipts');saved.busy=true;
  saved.entries.push(
    {id:'model',kind:'tool',toolName:'read_project_context',executionOrigin:'model',text:'Project revision 1'},
    {id:'preflight',kind:'tool',toolName:'read_project_context',executionOrigin:'app-preflight',text:'App preflight: Running read_project_context…'},
  );
  const archive:ChatArchive={projectId:'p',revision:1,activeId:saved.id,threads:[saved]};
  const parsed=parseChatArchive(JSON.parse(JSON.stringify(archive)),'p');
  const restored=restoreChat(parsed.threads[0]);
  assert.equal(restored.entries[1].executionOrigin,'model');
  assert.equal(restored.entries[1].text,'Project revision 1');
  assert.equal(restored.entries[2].executionOrigin,'app-preflight');
  assert.equal(restored.entries[2].failed,true);
  assert.doesNotMatch(restored.entries[2].text,/Running/);
  assert.equal(restored.entries[0].executionOrigin,undefined);
  assert.throws(()=>parseChatArchive({...archive,threads:[{...saved,entries:[{...saved.entries[1],executionOrigin:'invented'}]}]},'p'));
});
test('message times and conversation start survive storage and reopening; legacy times stay unknown',()=>{
  const dated=thread('dated'); dated.startedAt='2026-09-13T05:10:00.000Z';
  dated.entries[0].timestamp='2026-09-13T05:11:00.000Z';
  const archive:ChatArchive={projectId:'p',revision:1,activeId:'dated',threads:[dated,thread('legacy')]};
  const parsed=parseChatArchive(JSON.parse(JSON.stringify(archive)),'p');
  const reopened=restoreChat(parsed.threads[0]);
  assert.equal(reopened.startedAt,dated.startedAt);
  assert.equal(reopened.entries[0].timestamp,dated.entries[0].timestamp);
  assert.equal(parsed.threads[1].startedAt,undefined);
  assert.equal(parsed.threads[1].entries[0].timestamp,undefined);
});
test('archiving is non-destructive, persists its marker and chooses another active conversation',()=>{
  const a=thread('a'),b=thread('b');
  const original:ChatArchive={projectId:'p',revision:0,activeId:'a',threads:[a,b]};
  const next=archiveChat(original,'a',thread('unused'),'today');
  assert.equal(next.activeId,'b');assert.equal(next.threads.length,2);
  assert.deepEqual(next.threads[0].entries,a.entries);
  assert.equal(parseChatArchive(JSON.parse(JSON.stringify(next)),'p').threads[0].archivedAt,'today');
  assert.equal(original.threads[0].archivedAt,undefined);
  const last=archiveChat(next,'b',thread('fresh'));
  assert.equal(last.activeId,'fresh');assert.equal(last.threads.length,3);
  assert.throws(()=>archiveChat(next,'missing',thread('x')));
});
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
