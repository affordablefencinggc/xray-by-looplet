import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareSourceRoom } from './sourceRoom.ts';
import { prepareArchitectElements } from './architectBridge.ts';
import { emptyProject } from '../architect/model.ts';
const g={sourceSha256:'a'.repeat(64),page:3,segments:[
  {id:'top',a:[0,0],b:[100,0]},{id:'right',a:[100,0],b:[100,60]},
  {id:'bottom',a:[100,60],b:[0,60]},{id:'left',a:[0,60],b:[0,0]},
  {id:'door',a:[80,60],b:[80,80]},
],scaleMapping:{segmentId:'door',knownLengthMm:800,mmPerPt:40}};
const args={boundaryIds:['top','right','bottom','left'],doorLeafId:'door',doorWallIndex:2,doorHingeEndpoint:'a',doorDirection:'forward',doorWidthMm:800,wallThicknessMm:100,wallHeightMm:2700,doorHeightMm:2100,levelName:'Source room'};
test('source room offsets wall centerlines without shrinking clear room dimensions and preserves door placement',()=>{
  const r=prepareSourceRoom(g,args),p=emptyProject('room');
  const built=prepareArchitectElements(p,{expectedJobId:p.id,expectedRevision:p.revision,operations:r.operations});
  const walls=built.draft.walls;
  for(const [point,expected] of [[walls[0].a,[-50,-50]],[walls[0].b,[4050,-50]]])
    point.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-6));
  assert.equal(walls.length,4);assert.equal(walls[0].layers.reduce((n,l)=>n+l.thickness,0),100);
  assert.equal(walls[0].layers[0].densityKgM3,null);assert.equal(walls[0].layers[0].rateM2,null);
  assert.equal(built.draft.openings[0].width,800);assert.equal(built.draft.openings[0].offset,1250);
  assert.equal(r.internalAreaMm2,4000*2400);assert.equal(r.sourceSha256,g.sourceSha256);
});
test('wrong source identity references, scale association and host wall are refused',()=>{
  assert.throws(()=>prepareSourceRoom(g,{...args,boundaryIds:['missing','right','bottom','left']}),/missing/);
  assert.throws(()=>prepareSourceRoom(g,{...args,doorWidthMm:900}),/Scale/);
  assert.throws(()=>prepareSourceRoom(g,{...args,doorWallIndex:0}),/hinge/);
  assert.throws(()=>prepareSourceRoom(g,{...args,boundaryIds:['top','bottom','right','left']}),/corner/);
});
test('explicit thickness cannot silently override an assembly template',()=>{
  const p=emptyProject('room');
  assert.throws(()=>prepareArchitectElements(p,{expectedJobId:p.id,expectedRevision:p.revision,operations:[{kind:'wall',levelId:p.levels[0].id,a:[0,0],b:[1000,0],thicknessMm:100,templateWallId:'other'}]}),/thickness or an assembly/);
});
