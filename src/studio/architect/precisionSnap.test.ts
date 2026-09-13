import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProject, newWall } from './model.ts';
import { SNAP_KINDS, snapPoint } from './precision.ts';
import { rooms } from './geometry.ts';

test('clicking just beyond a wall joins its endpoint instead of leaving an extension gap', () => {
  const project = emptyProject('snap-review');
  const level = project.levels[0].id;
  project.walls.push(newWall(project, level, [0, 0], [6000, 0]));
  const result = snapPoint([6008, 1], project, level, 160, SNAP_KINDS);
  assert.equal(result.kind, 'endpoint');
  assert.deepEqual(result.point, [6000, 0]);
});

test('extension remains available away from endpoints or when endpoint snaps are disabled', () => {
  const project = emptyProject('extension-review');
  const level = project.levels[0].id;
  project.walls.push(newWall(project, level, [0, 0], [6000, 0]));
  assert.deepEqual(snapPoint([6500, 2], project, level, 160, SNAP_KINDS), { point: [6500, 0], kind: 'extension' });
  assert.deepEqual(snapPoint([6008, 1], project, level, 160, ['extension']), { point: [6008, 0], kind: 'extension' });
});

test('a return started just beyond the first wall still closes into a measurable room', () => {
  const project = emptyProject('room-snap-review');
  const level = project.levels[0].id;
  project.walls.push(newWall(project, level, [0, 0], [6000, 0]));
  const start = snapPoint([6008, 1], project, level, 160, SNAP_KINDS).point;
  project.walls.push(newWall(project, level, start, [start[0], 4000]));
  project.walls.push(newWall(project, level, [start[0], 4000], [0, 4000]));
  const close = snapPoint([-8, -1], project, level, 160, SNAP_KINDS, [0, 4000]).point;
  project.walls.push(newWall(project, level, [0, 4000], close));
  assert.deepEqual(project.walls[0].b, project.walls[1].a);
  assert.deepEqual(project.walls[3].b, project.walls[0].a);
  assert.equal(rooms(project, level).length, 1);
});
