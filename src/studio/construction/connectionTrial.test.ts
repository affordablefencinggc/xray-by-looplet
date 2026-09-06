import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { CONNECTION_SOURCE, TRIAL_CONNECTIONS, compileTrial, scheduledBoltCount, createTrial, trialSchema, trialKey, restoreTrial, saveTrial, trialExport } from "./connectionTrial.ts";
const memory = () => { const data = new Map<string,string>(); return { data, getItem: (k:string) => data.get(k) ?? null, setItem: (k:string,v:string) => { data.set(k,v); } }; };
test("bundled real PDF matches the frozen source identity", () => {
  assert.equal(createHash("sha256").update(readFileSync("public/sources/thornton-connection-trial/structural.pdf")).digest("hex"), CONNECTION_SOURCE.sha256);
});
test("bounded physical count reconciles to eight independently traced beam pairs", () => {
  const expected = ["I1","I2","I3","I4","I5","I6","I7","I8"];
  for (const beam of expected) assert.deepEqual(TRIAL_CONNECTIONS.filter(c=>c.beam===beam).map(c=>c.end).sort(), ["N","S"]);
  const result = compileTrial(); assert.equal(result.connectionCount,16); assert.equal(result.boltCount,32);
  assert.equal(new Set(result.bolts.map(b=>b.stableIdentifier)).size,32);
});
test("lesser nominal depth and schedule boundaries control the count", () => {
  assert.equal(scheduledBoltCount(10,24),2); assert.equal(scheduledBoltCount(24,10),2);
  for (const [d,n] of [[7,2],[8,2],[11,2],[12,3],[14,3],[15,4],[18,5],[21,6],[24,7],[29,7],[30,8],[33,9],[36,10]]) assert.equal(scheduledBoltCount(d,36),n);
  for (const n of [0,-1,10.5,37,NaN,Infinity]) assert.throws(()=>scheduledBoltCount(n,24));
});
test("different record IDs cannot duplicate a physical beam end", () => {
  assert.throws(()=>compileTrial([...TRIAL_CONNECTIONS,{...TRIAL_CONNECTIONS[0],id:"duplicate-record"}]),/Duplicate physical/);
});
test("additional drawing evidence never creates another bolt", () => {
  const result=compileTrial(TRIAL_CONNECTIONS.map(c=>({...c,evidence:[...c.evidence,"detail","section-view"]})));
  assert.equal(result.boltCount,32); assert.equal(result.bolts[0].evidence.filter(e=>e==="detail").length,1);
});
test("unreadable, newer and wrong-source snapshots are preserved and block ordinary saves", () => {
  for (const raw of ["broken",JSON.stringify({...createTrial("p"),schema:"future"}),JSON.stringify({...createTrial("p"),sourceSha256:"different"}),JSON.stringify({...createTrial("other")}),JSON.stringify({...createTrial("p"),definitionRevision:2})]) {
    const store=memory();store.setItem(trialKey("p"),raw);const session=restoreTrial(store,"p");assert.equal(session.blocked,true);
    assert.equal(saveTrial(store,session,createTrial("p")).blocked,true);assert.equal(store.getItem(trialKey("p")),raw);
  }
});
test("save/reload retains review, note and revision; duplicate reviews fail", () => {
  const store=memory(), session=restoreTrial(store,"p"),value=createTrial("p");value.reviews[0]={...value.reviews[0],reviewed:true,note:"S2.2 location and S5.1/1 checked",revision:2};
  const saved=saveTrial(store,session,value);assert.equal(saved.error,null);assert.deepEqual(restoreTrial(store,"p").value,value);
  value.reviews[1]={...value.reviews[0]};assert.equal(trialSchema.safeParse(value).success,false);
});
test("blank approval, denied write and concurrent update cannot erase previous work", () => {
  const store=memory(),first=saveTrial(store,restoreTrial(store,"p"),createTrial("p")), raw=first.raw;
  const invalid=createTrial("p");invalid.reviews[0].reviewed=true;assert.ok(saveTrial(store,first,invalid).error);assert.equal(store.getItem(trialKey("p")),raw);
  const denied={getItem:store.getItem,setItem:()=>{throw Error("quota")}};assert.ok(saveTrial(denied,first,createTrial("p")).error);assert.equal(store.getItem(trialKey("p")),raw);
  store.setItem(trialKey("p"),"newer session");assert.equal(saveTrial(store,first,createTrial("p")).blocked,true);assert.equal(store.getItem(trialKey("p")),"newer session");
});
test("export includes physical IDs, evidence, issue, exclusions and unknown material quantities", () => {
  const result=trialExport(createTrial("p"));assert.equal(result.bolts.length,32);assert.equal(result.nuts,null);assert.equal(result.washers,null);assert.equal(result.specifiedWeightKg,null);assert.equal(result.packedVolumeM3,null);
  assert.match(result.exclusions,/all other building hardware/);assert.equal(result.source.issue,"2024-09-27");assert.equal(result.connections.length,16);assert.equal(result.evidence.length,3);
});
