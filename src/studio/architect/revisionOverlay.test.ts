import test from 'node:test';
import assert from 'node:assert/strict';
import { demonstration } from './model.ts';
import { alignOverlayPoint, overlayPlan, overlayViewBox, overlayInk, originalAlignment } from './revisionOverlayGeometry.ts';

test('alignment rotates about model origin then translates in millimetres', () => {
 const p = alignOverlayPoint([1000, 0], {x:250,y:-100,rotation:90});
 assert.ok(Math.abs(p[0]-250)<1e-8); assert.ok(Math.abs(p[1]-900)<1e-8);
 assert.deepEqual(alignOverlayPoint([123,-456], originalAlignment),[123,-456]);
 assert.throws(()=>alignOverlayPoint([0,0],{x:NaN,y:0,rotation:0}),/finite/);
});
test('overlay bounds enclose translated and rotated baseline alongside target', () => {
 const old = [{kind:'line' as const,points:[[0,0],[1000,2000]] as [number,number][]}];
 const target = [{kind:'line' as const,points:[[-300,-400],[500,600]] as [number,number][]}];
 const alignment = {x:5000,y:-1000,rotation:90};
 const [x,y,w,h]=overlayViewBox(old,target,alignment).split(' ').map(Number);
 for(const p of [[0,0],[1000,2000],[0,2000],[1000,0]] as [number,number][]){ const [a,b]=alignOverlayPoint(p,alignment);assert.ok(a>=x&&a<=x+w&&b>=y&&b<=y+h); }
 assert.ok(x<=-300&&y<=-400&&x+w>=500&&y+h>=600);
});
test('plan projection and visual emphasis never mutate saved geometry', () => {
 const project=demonstration('overlay-test'), saved=JSON.stringify(project);
 const plan=overlayPlan(project,project.levels[0].id), original=JSON.stringify(plan);
 const id=project.walls[0].id;
 const highlighted=overlayInk(plan,'#176aaf',new Set([id]),true);
 assert.ok(highlighted.length>0); assert.ok(highlighted.every(p=>p.id===id));
 assert.ok(highlighted.filter(p=>p.kind!=='text').every(p=>p.width!>=28));
 assert.equal(JSON.stringify(plan),original);assert.equal(JSON.stringify(project),saved);
 assert.throws(()=>overlayPlan(project,'missing-level'),/not present/);
});
test('empty and extreme valid alignment still yields a finite positive preview box', () => {
 const box=overlayViewBox([],[],{x:1e6,y:-1e6,rotation:180}).split(' ').map(Number);
 assert.ok(box.every(Number.isFinite));assert.ok(box[2]>0&&box[3]>0);
});
