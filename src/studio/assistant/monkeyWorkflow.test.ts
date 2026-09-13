import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendMonkeyEvent, confirmMonkey, monkeyArchiveSchema, monkeyFacts, monkeyReviewPrompt, nameMonkey, stopMonkey, type MonkeyRecording } from './monkeyWorkflow.ts';
const base=():MonkeyRecording=>({id:'record-1',projectId:'project-1',owner:'tab-1',startedAt:'2026-09-13T00:00:00Z',status:'recording',events:[]});
const event={at:'2026-09-13T00:00:01Z',action:'Clicked Design (outcome not assumed)',pane:'sketch',sheet:3,revision:2};
test('record, stop, review, confirm and name are distinct non-destructive transitions',()=>{
  const start=base(),captured=appendMonkeyEvent(start,event),stopped=stopMonkey(captured,event.at);
  assert.equal(start.events.length,0);assert.equal(stopped.events.length,1);
  assert.deepEqual(appendMonkeyEvent(stopped,event),stopped);
  assert.throws(()=>confirmMonkey(stopped),/analysis/);
  assert.throws(()=>nameMonkey({...stopped,review:'Proposed steps'},'Test'),/Confirm/);
  const confirmed=confirmMonkey({...stopped,review:'Proposed steps, flaws and fixes'});
  assert.equal(confirmed.name,undefined);
  assert.throws(()=>nameMonkey(confirmed,'  '),/name/);
  const named=nameMonkey(confirmed,'  My workflow  ');
  assert.equal(named.name,'My workflow');assert.equal(named.status,'saved');assert.deepEqual(named.events,stopped.events);
});
test('recording cap stops capture without dropping earlier actions',()=>{
  let record=base();for(let i=0;i<501;i++)record=appendMonkeyEvent(record,{...event,action:`Action ${i}`});
  assert.equal(record.events.length,500);assert.equal(record.events[0].action,'Action 0');assert.equal(record.status,'review');assert.match(record.note!,/500/);
});
test('malformed persisted records fail validation and review excerpts remain bounded and honest',()=>{
  assert.throws(()=>monkeyArchiveSchema.parse([{...base(),status:'approved'}]));
  const record={...base(),events:Array.from({length:500},()=>({...event,action:'a'.repeat(400)}))};
  const prompt=monkeyReviewPrompt(record);
  assert.ok(prompt.length<85000);assert.match(prompt,/truncated/);assert.match(prompt,/untrusted evidence/);
  assert.equal(record.events.length,500);
});
test('navigation counts and sequence come from the recorded events, not the model',()=>{
  const events=['Clicked Takeoff','Opened workspace: measure','Clicked Design','Opened workspace: sketch','Clicked Drawings','Opened workspace: sheets','Clicked Takeoff','Opened workspace: measure'].map((action,i)=>({...event,action,pane:['sheets','measure','measure','sketch','sketch','sheets','sheets','measure'][i]}));
  const facts=monkeyFacts({...base(),events});
  assert.equal(facts.clicks,4);assert.equal(facts.workspaceTransitions,4);assert.equal(facts.otherEvents,0);
  assert.deepEqual(facts.sequence,['sheets','measure','sketch','sheets','measure']);
  assert.match(monkeyReviewPrompt({...base(),events}),/at most 120 words/);
  assert.deepEqual(monkeyFacts(base()).sequence,[]);
});
