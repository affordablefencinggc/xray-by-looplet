import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir='proof/growth/structured-routing/';
const before=JSON.parse(fs.readFileSync('proof/growth/runner/2026-09-09T14-33-49-596Z-structured-routing.log','utf8'));
assert.equal(before.design.walls.length,8);
assert.equal(before.design.openings.length,9);
assert.equal(before.design.slabs.length,2);
assert.equal(before.design.roofs.length,1);
assert.ok(before.journals.every(Boolean));
assert.equal(before.packets[0].state,'review-required');
assert.equal(before.packets[0].routing.failure,null);
assert.ok(before.packets[0].routing.captured);
const deferred=before.events.flat().filter(e=>e.kind==='workflow-action-deferred');
assert.ok(deferred.some(e=>e.payload.tool==='draw_architect_elements'&&e.payload.next.tool==='read_architect_design'));
fs.writeFileSync(dir+'live-build.json',JSON.stringify(before,null,2));
console.log({phase:'build',revision:before.design.revision,counts:{walls:8,openings:9,slabs:2,roofs:1},liveDeferredStaleRead:deferred.length,allJournalsValid:true});
if(process.argv[2]) {
 const after=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 const a=after.design,b=before.design;
 assert.ok(after.journals.every(Boolean));
 assert.equal(after.packets[0].routing.failure,null);
 assert.equal(after.packets[0].state,'review-required');
 assert.ok(after.packets[0].routing.captured);
 for(const key of ['walls','levels','slabs','roofs'])assert.deepEqual(a[key],b[key]);
 assert.equal(a.openings.length,b.openings.length);
 for(const old of b.openings){
   const current=a.openings.find(x=>x.id===old.id); assert.ok(current,'stable ID retained');
   if(old.kind==='door')assert.deepEqual(current,old);
   else { assert.equal(current.width,1800);assert.equal(current.offset,old.offset);
     const host=a.walls.find(w=>w.id===current.wallId);assert.equal(current.offset,Math.hypot(host.b[0]-host.a[0],host.b[1]-host.a[1])/2);
     for(const key of Object.keys(old).filter(k=>!['width','offset','revision'].includes(k)))assert.deepEqual(current[key],old[key]); }
 }
 fs.writeFileSync(dir+'live-edit.json',JSON.stringify(after,null,2));
 fs.writeFileSync(dir+'live-validation.json',JSON.stringify({changedWindows:8,stableIdsPreserved:true,centresPreserved:true,unrelatedGeometryUnchanged:true,allJournalsValid:true,revision:a.revision},null,2));
 console.log({phase:'edit',revision:a.revision,changedWindows:8,stableIdsPreserved:true,unrelatedGeometryUnchanged:true});
}
