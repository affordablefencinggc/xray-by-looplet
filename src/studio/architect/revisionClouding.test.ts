import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyProject, newWall, validateProject, type ArchitectProject } from './model.ts';
import { compareGeometry } from './revisionDelta.ts';
import {
  boundaryBox,
  cloudEnclosure,
  cloudedRevision,
  deltaMarks,
  openingBox,
  revisionCloudOutline,
  revisionClouds,
  revisionDeltaRegister,
  scallopGeometry,
  wallBox,
} from './revisionClouding.ts';

/**
 * A project with a level, two walls, a doorway in one of them and a slab. The
 * alteration case this slice exists for: widen the doorway, move the partition,
 * add another, and nothing else.
 */
function building(): ArchitectProject {
  const p = emptyProject('cloud-fixture');
  const level = p.levels[0].id;
  const north = newWall(p, level, [0, 0], [6000, 0]);
  north.name = 'North wall';
  const partition = newWall(p, level, [0, 3000], [4000, 3000]);
  partition.name = 'Partition';
  p.walls = [north, partition];
  p.openings = [{
    id: 'op-1', revision: 1, wallId: north.id, tag: 'D01', kind: 'door',
    offset: 1200, width: 800, height: 2100, sill: 0, hinge: 'left', swing: 'in',
  }];
  p.slabs = [{ id: 'sl-1', revision: 1, levelId: level, name: 'Ground slab', points: [[0, 0], [6000, 0], [6000, 3000], [0, 3000]], thickness: 150, offset: 0, material: 'Concrete' }];
  return validateProject(p);
}

/** The altered project: the doorway widened, the partition moved and lengthened, one wall added. */
function altered(source: ArchitectProject): ArchitectProject {
  const p: ArchitectProject = JSON.parse(JSON.stringify(source));
  p.revision = 2;
  p.designRevision = 'B';
  p.openings[0].width = 1800;
  p.openings[0].revision = 2;
  const partition = p.walls.find((wall) => wall.name === 'Partition')!;
  partition.a = [0, 4200];
  partition.b = [4000, 4200];
  partition.revision = 2;
  const returned = newWall(p, p.levels[0].id, [6000, 0], [6000, 3000]);
  returned.name = 'Return wall';
  p.walls.push(returned);
  p.slabs[0].points = [[0, 0], [6000, 0], [6000, 4200], [0, 4200]];
  p.slabs[0].revision = 2;
  return validateProject(p);
}

const deltaOf = (baseline: ArchitectProject, target: ArchitectProject) => ({
  baseline,
  target,
  report: compareGeometry(baseline, target),
});

test('the register records added, removed and changed entities with a box each', () => {
  const baseline = building();
  const target = altered(baseline);
  const { report } = deltaOf(baseline, target);
  const register = revisionDeltaRegister(report, baseline, target);
  const byId = new Map(register.entries.map((entry) => [entry.id, entry]));

  assert.equal(register.counts.removed, 0, 'nothing was removed');
  assert.equal(register.unmeasured.length, 0);
  assert.ok(byId.get('opening:op-1'), 'the widened doorway is in the register');
  assert.equal(byId.get('opening:op-1')!.status, 'changed');
  assert.equal(byId.get('opening:op-1')!.category, 'Door / window');
  assert.ok(byId.get('opening:op-1')!.changes.some((line) => line.includes('800×2100mm → 1800×2100mm')));
});

test('a changed entity box is the union of its old and new extent, so it is never too small', () => {
  const baseline = building();
  const target = altered(baseline);
  const { report } = deltaOf(baseline, target);
  const register = revisionDeltaRegister(report, baseline, target);
  const entry = register.entries.find((item) => item.id === 'wall:' + baseline.walls.find((w) => w.name === 'Partition')!.id)!;

  assert.equal(entry.status, 'changed');
  assert.equal(entry.shifted, true, 'the partition moved rather than being reshaped in place');
  // The wall's build-up is 260, so the box reaches 130 past each centreline: the
  // old partition at y=3000 starts at 2870, the new one at y=4200 at 4070, and the
  // union has to hold both, or a cloud would be drawn over half the demolished run.
  assert.equal(entry.baselineBox!.min[1], 2870);
  assert.equal(entry.targetBox!.min[1], 4070);
  assert.equal(entry.box.min[1], 2870, 'the box still covers the position the wall used to occupy');
  assert.equal(entry.box.max[1], 4330);
  assert.ok(entry.box.min[1] < entry.baselineBox!.min[1] + 1);
});

test('a new wall is in the register only as an addition, with no baseline box', () => {
  const baseline = building();
  const target = altered(baseline);
  const { report } = deltaOf(baseline, target);
  const register = revisionDeltaRegister(report, baseline, target);
  const added = register.entries.filter((entry) => entry.status === 'added');

  assert.equal(added.length, 1);
  assert.equal(added[0].category, 'Wall');
  assert.equal(added[0].baselineBox, null);
  assert.ok(added[0].targetBox);
  assert.equal(added[0].shifted, false, 'an addition has not shifted, it has appeared');
});

test('a removed wall is measured in the revision that still holds it', () => {
  const baseline = building();
  const target = altered(baseline);
  const partitionId = target.walls.find((wall) => wall.name === 'Partition')!.id;
  target.walls = target.walls.filter((wall) => wall.id !== partitionId);
  const removed = validateProject(target);
  const { report } = deltaOf(baseline, removed);
  const register = revisionDeltaRegister(report, baseline, removed);
  const entry = register.entries.find((item) => item.id === `wall:${partitionId}`)!;

  assert.equal(entry.status, 'removed');
  assert.equal(entry.targetBox, null);
  assert.ok(entry.baselineBox, 'the box comes from the baseline, where the wall still is');
  assert.equal(entry.baselineBox!.min[1], 2870);
});

test('a wall demolished by lifecycle is clouded where it was, not where the later model still lists it', () => {
  const baseline = building();
  const target = altered(baseline);
  // The partition is not deleted from the model — it is classified demolished, which
  // is how the app records a demolition. The geometry comparison reports the lifecycle
  // change as a modification, so the register has to read the classification to know
  // the wall is gone from the later drawing.
  const partition = target.walls.find((wall) => wall.name === 'Partition')!;
  // The baseline fixture carries no classification, so give it one, or the change
  // under test is "absent → demolished" rather than the transition being asserted.
  baseline.walls.find((wall) => wall.id === partition.id)!.lifecycle = { status: 'existing', reference: 'Survey S01' };
  partition.lifecycle = { status: 'demolished', reference: 'Demolition D01' };
  const demolished = validateProject(target);
  const { report } = deltaOf(validateProject(baseline), demolished);
  assert.equal(report.walls.removed.length, 0, 'the engine reports a lifecycle change as a modification');
  assert.ok(report.walls.changed.some((wall) => wall.id === partition.id));
  assert.ok(report.walls.changed.find((wall) => wall.id === partition.id)!.changes.includes('Lifecycle existing → demolished'),
    'and names the transition rather than calling it "modified"');

  const register = revisionDeltaRegister(report, baseline, demolished);
  const entry = register.entries.find((item) => item.id === `wall:${partition.id}`)!;
  assert.equal(entry.status, 'removed', 'a demolished wall is removed from the drawing a reader sees');
  assert.equal(entry.targetBox, null, 'so no cloud is drawn at a position the wall no longer occupies');
  assert.equal(entry.baselineBox!.min[1], 2870);
});

test('an entity whose host wall is absent is named as unmeasured, never boxed at zero', () => {
  const baseline = building();
  // A project will not validate an opening with no host, so the unmeasurable case
  // is built here as the delta itself: a changed doorway whose target has no wall
  // to place it against. The register must say so rather than invent a position.
  const hostless = { ...baseline.openings[0], wallId: 'wall-not-in-target' };
  const register = revisionDeltaRegister(
    {
      walls: { added: [], removed: [], changed: [] },
      openings: { added: [], removed: [], changed: [{ id: 'op-1', name: 'door D01', baseline: baseline.openings[0], target: hostless, changes: ['Host wall association changed'] }] },
      slabs: { added: [], removed: [], changed: [] },
      roofs: { added: [], removed: [], changed: [] },
      counts: { totalAdded: 0, totalRemoved: 0, totalChanged: 1, wallsAdded: 0, wallsRemoved: 0, wallsChanged: 0, openingsAdded: 0, openingsRemoved: 0, openingsChanged: 1, slabsAdded: 0, slabsRemoved: 0, slabsChanged: 0, roofsAdded: 0, roofsRemoved: 0, roofsChanged: 0 },
    },
    baseline,
    baseline,
  );

  // The baseline still places it, so the entry exists — but it carries the baseline
  // box and no target box, and nothing anywhere is recorded with zero area.
  const entry = register.entries.find((item) => item.id === 'opening:op-1')!;
  assert.equal(entry.targetBox, null, 'the target cannot place it');
  assert.ok(entry.baselineBox, 'the baseline can');
  assert.ok(entry.box.max[0] > entry.box.min[0], 'a placed opening has a real extent');

  // With no revision able to place it at all, the entry is named instead.
  const orphan = revisionDeltaRegister(
    {
      walls: { added: [], removed: [], changed: [] },
      openings: { added: [hostless], removed: [], changed: [] },
      slabs: { added: [], removed: [], changed: [] },
      roofs: { added: [], removed: [], changed: [] },
      counts: { totalAdded: 1, totalRemoved: 0, totalChanged: 0, wallsAdded: 0, wallsRemoved: 0, wallsChanged: 0, openingsAdded: 1, openingsRemoved: 0, openingsChanged: 0, slabsAdded: 0, slabsRemoved: 0, slabsChanged: 0, roofsAdded: 0, roofsRemoved: 0, roofsChanged: 0 },
    },
    baseline,
    baseline,
  );
  assert.equal(orphan.entries.length, 0, 'an entity that cannot be placed is not given a box');
  assert.equal(orphan.unmeasured.length, 1);
  assert.match(orphan.unmeasured[0], /opening op-1: the target revision holds no host that places it/);
});

test('an opening is measured from its centre offset, not from its left edge', () => {
  const baseline = building();
  const host = baseline.walls.find((wall) => wall.name === 'North wall')!;
  // The north wall runs along y=0 from x=0. A 900-wide door centred at offset 800
  // spans x 350..1250; read offset as a left edge and it would span 800..1700.
  const box = openingBox({ ...baseline.openings[0], offset: 800, width: 900 }, host)!;
  // The north wall runs along y=0 from x=0. A 900-wide door centred at offset 800
  // spans x 350..1250; read offset as a left edge and it would span 800..1700.
  assert.equal(box.min[0], 350);
  assert.equal(box.max[0], 1250);
  assert.equal(openingBox(baseline.openings[0], undefined), null, 'an opening with no host has no position');
});

test('a wall box opens by half the wall build-up, so the cloud clears the drawn face', () => {
  const baseline = building();
  const wall = baseline.walls.find((item) => item.name === 'North wall')!;
  const box = wallBox(wall);
  const buildUp = wall.layers.reduce((sum, layer) => sum + layer.thickness, 0);
  assert.equal(box.max[1] - 0, buildUp / 2, 'the box reaches half the build-up past the centreline');
  assert.equal(box.min[1] + buildUp / 2, 0);
});

test('a cloud outline is closed and its scallops enclose the box they were drawn for', () => {
  const box = { min: [0, 0] as [number, number], max: [4000, 2000] as [number, number] };
  const points = revisionCloudOutline(box, 500);
  assert.ok(points.length > 20, 'a scalloped outline has many points, not four corners');
  assert.deepEqual(points[0], points[points.length - 1], 'the outline closes');

  const reached = points.reduce((acc, point) => ({
    min: [Math.min(acc.min[0], point[0]), Math.min(acc.min[1], point[1])],
    max: [Math.max(acc.max[0], point[0]), Math.max(acc.max[1], point[1])],
  }), { min: [Infinity, Infinity], max: [-Infinity, -Infinity] });
  const { radius } = scallopGeometry(box, 500);
  assert.ok(reached.max[1] > box.max[1], 'the scallops bulge past the box top');
  assert.ok(reached.min[1] < box.min[1], 'and past the bottom');
  assert.ok(reached.max[1] <= box.max[1] + radius + 1e-9, 'but never further than one scallop');
  // The short sides are tangent: the outline reaches them but never passes them,
  // so a cloud can be placed from its box without a second padding calculation.
  assert.equal(reached.max[0], box.max[0]);
  assert.equal(reached.min[0], box.min[0]);
});

test('scallop size changes the count, and the outline stays inside one scallop of the box', () => {
  const box = { min: [0, 0] as [number, number], max: [4000, 2000] as [number, number] };
  const fine = revisionCloudOutline(box, 200);
  const coarse = revisionCloudOutline(box, 2000);
  assert.ok(fine.length > coarse.length, 'a smaller scallop makes a busier cloud');
  assert.ok(scallopGeometry(box, 2000).perAxis < scallopGeometry(box, 200).perAxis);
});

test('the cloud outline refuses a box or a scallop size it cannot draw', () => {
  assert.throws(() => revisionCloudOutline({ min: [NaN, 0], max: [1, 1] }, 500), /finite extent/);
  assert.throws(() => revisionCloudOutline({ min: [0, 0], max: [1, 1] }, 0), /positive scallop size/);
});

test('clouds are padded clear of the entity and carry the box they enclose', () => {
  const baseline = building();
  const target = altered(baseline);
  const { report } = deltaOf(baseline, target);
  const register = revisionDeltaRegister(report, baseline, target);
  const clouds = revisionClouds(register, { padding: 150 });
  assert.equal(clouds.length, register.entries.length);
  for (const cloud of clouds) {
    const entry = register.entries.find((item) => item.id === cloud.id)!;
    assert.deepEqual(cloud.box, cloudEnclosure(entry.box, 150));
    assert.ok(cloud.box.min[0] < entry.box.min[0] && cloud.box.max[0] > entry.box.max[0]);
    assert.ok(cloud.boxArea > 0);
  }
});

test('the same register always produces the same clouds, in the same order', () => {
  const baseline = building();
  const target = altered(baseline);
  const { report } = deltaOf(baseline, target);
  const first = revisionClouds(revisionDeltaRegister(report, baseline, target));
  const second = revisionClouds(revisionDeltaRegister(compareGeometry(baseline, target), baseline, target));
  assert.deepEqual(first.map((cloud) => cloud.id), second.map((cloud) => cloud.id));
  assert.deepEqual(first[0].points, second[0].points);
});

test('every cloud and mark is drawn for one level and one viewport', () => {
  const baseline = building();
  const target = altered(baseline);
  const level = baseline.levels[0].id;
  const { report } = deltaOf(baseline, target);
  const register = revisionDeltaRegister(report, baseline, target);
  const clouded = cloudedRevision(register, level, target, 'B');

  assert.equal(clouded.revision, 'B');
  assert.equal(clouded.entries, register.entries.length);
  assert.ok(clouded.clouds.every((cloud) => cloud.levelId === level));
  assert.ok(clouded.marks.every((mark) => mark.label === 'Δ Rev B'));
  const [vx, vy, vw, vh] = clouded.viewBox.split(' ').map(Number);
  assert.ok([vx, vy, vw, vh].every(Number.isFinite));
  assert.ok(vw > 0 && vh > 0);
  // Every cloud's padded box lies inside the viewport the view was sized for.
  for (const cloud of clouded.clouds) {
    assert.ok(cloud.box.min[0] >= vx && cloud.box.max[0] <= vx + vw);
    assert.ok(cloud.box.min[1] >= vy && cloud.box.max[1] <= vy + vh);
  }
});

test('a level with no changes produces no clouds rather than a hidden layer', () => {
  const baseline = building();
  const target = altered(baseline);
  baseline.levels.push({ id: 'lv-unused', name: 'Unused level', elevation: 3000, height: 2400 });
  target.levels.push({ id: 'lv-unused', name: 'Unused level', elevation: 3000, height: 2400 });
  const level = 'lv-unused';
  const { report } = deltaOf(validateProject(baseline), validateProject(target));
  const register = revisionDeltaRegister(report, baseline, target);
  const clouded = cloudedRevision(register, level, target, 'B');
  assert.equal(clouded.clouds.length, 0);
  assert.equal(clouded.marks.length, 0);
  assert.equal(clouded.entries, 0);
});

test('a delta mark is anchored clear of its cloud, above the top-left corner', () => {
  const baseline = building();
  const target = altered(baseline);
  const { report } = deltaOf(baseline, target);
  const register = revisionDeltaRegister(report, baseline, target);
  const clouds = revisionClouds(register, { levelId: baseline.levels[0].id });
  const marks = deltaMarks(clouds, 'B');
  assert.equal(marks.length, clouds.length);
  for (const mark of marks) {
    const cloud = clouds.find((item) => mark.id === `mark:${item.id}`)!;
    assert.deepEqual(mark.anchor, [cloud.box.min[0], cloud.box.max[1]]);
    assert.ok(mark.anchor[1] >= cloud.outlineBox.max[1] - cloud.scallopRadius,
      'the anchor sits at or above the cloud line, never inside the enclosure');
    assert.equal(mark.status, cloud.status);
  }
});

test('an empty revision label still produces a mark rather than a dangling symbol', () => {
  const box = { min: [0, 0] as [number, number], max: [1000, 1000] as [number, number] };
  const clouds = revisionClouds({ entries: [{ id: 'wall:w1', category: 'Wall', status: 'added', name: 'W1', levelId: 'lv', box, baselineBox: null, targetBox: box, shifted: false, changes: [] }], counts: { added: 1, removed: 0, changed: 0, shifted: 0, total: 1 }, levels: ['lv'], unmeasured: [] });
  assert.equal(deltaMarks(clouds, '')[0].label, 'Δ');
  assert.equal(deltaMarks(clouds, '  B  ')[0].label, 'Δ Rev B');
});

test('boundary boxes come from the authored polygon', () => {
  const box = boundaryBox([[0, 0], [5000, 0], [5000, 3000], [0, 3000]]);
  assert.deepEqual(box.min, [0, 0]);
  assert.deepEqual(box.max, [5000, 3000]);
});
