import test from 'node:test';
import assert from 'node:assert/strict';
import { footprint, inspectCourtyard } from './courtyard.mjs';
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
function fixture() {
  let id=0;const levels=[{id:'ground',elevation:0,height:3600},{id:'upper',elevation:3600,height:3600}];
  const slab=(points,levelId)=>({id:`s${id++}`,points,levelId,thickness:250,offset:0});
  return {id:'oracle-test',revision:1,units:'mm',levels,
    walls:levels.flatMap(l=>footprint.map((a,i)=>({id:`w${id++}`,levelId:l.id,a,b:footprint[(i+1)%8],height:3600}))),
    slabs:[slab(footprint,'ground'),...[rect(0,0,6000,3000),rect(0,10200,6000,7800),rect(0,3000,2400,7200),rect(3600,3000,2400,7200),rect(18000,0,6000,18000),rect(6000,12000,12000,6000)].map(p=>slab(p,'upper'))],
    roofs:[{id:'roof',levelId:'upper',offset:3600,points:footprint,eaves:0,edges:footprint.map(()=>({pitch:0}))}],openings:[]};
}
test('independent oracle accepts dimensioned fixture with actual stairwell void',()=>{
  const result=inspectCourtyard(fixture());assert.equal(result.passed,result.total);
});
for(const [label,change,expected] of [
  ['courtyard filled',p=>{p.slabs[0].points=rect(0,0,24000,18000);},'ground-floor-union'],
  ['duplicate overlapping floor',p=>{p.slabs.push({...p.slabs[1],id:'duplicate'});},'upper-floor-union'],
  ['stairwell covered',p=>{p.slabs.push({id:'cap',levelId:'upper',points:rect(2400,3000,1200,7200),thickness:250,offset:0});},'stairwell-void'],
  ['disconnected wall',p=>{p.walls[0]={...p.walls[0],b:[6001.1,0]};},'level-0-boundary'],
  ['incorrect storey',p=>{p.levels[1].elevation=3500;},'levels'],
  ['courtyard roofed',p=>{p.roofs[0].points=rect(0,0,24000,18000);},'roof-footprint'],
])test(`oracle detects ${label}`,()=>{
  const p=fixture();change(p);assert.equal(inspectCourtyard(p).checks.find(c=>c.id===expected).pass,false);
});
test('detailed stage does not award absent stairs, openings, pond, planters or site',()=>{
  const result=inspectCourtyard(fixture(),{stage:2});
  for(const id of ['doors','windows','stair-treads','stair-run','pond','planters','site'])assert.equal(result.checks.find(c=>c.id===id).pass,false);
});
