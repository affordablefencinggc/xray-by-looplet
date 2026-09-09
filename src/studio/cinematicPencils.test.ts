import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCinematicPencils, pencilBeat, pencilFizz, PENCIL_COUNT } from './cinematicPencils.ts';

test('transfer flutter pulses at lift and arrival and settles before scribbling', () => {
  assert.equal(pencilFizz(0.1, 0), 0);
  assert.equal(pencilFizz(0.2, 0), 0);
  assert.equal(pencilFizz(0.86, 0), 0);
  assert.ok(pencilFizz(0.2 + 0.66 * 0.16, 0) > 0.4);
  assert.ok(pencilFizz(0.2 + 0.66 * 0.84, 0) > 0.4);
  assert.ok(pencilFizz(0.53, 0) < 0.01);
});

test('each beat scribbles for 0.2 seconds then eases through its orbital transfer', () => {
  assert.equal(pencilBeat(0, 0).scribbling, true);
  assert.equal(pencilBeat(0.199, 0).scribbling, true);
  assert.equal(pencilBeat(0.2, 0).scribbling, false);
  assert.equal(pencilBeat(0.2, 0).travel, 0);
  assert.ok(pencilBeat(0.859, 0).travel > 0.999);
  assert.equal(pencilBeat(0.86, 0).scribbling, true);
});

test('pencils retain distinct cadences instead of rejoining one synchronized beat', () => {
  assert.equal(new Set(Array.from({ length: PENCIL_COUNT }, (_, i) => pencilBeat(0, i).cycleSeconds)).size, PENCIL_COUNT);
  for (const seconds of [0, 0.86, 1.72, 3.44, 6.88]) {
    const beats = Array.from({ length: PENCIL_COUNT }, (_, i) => pencilBeat(seconds, i));
    assert.ok(new Set(beats.map(b => Math.round(b.local * 100))).size >= 4);
    assert.ok(beats.some(b => !b.scribbling), 'The ensemble must not all stop to scribble together');
  }
});

test('five upright pencils follow real transformed edges with deterministic seek and clean disposal', () => {
  const bounds = new THREE.Box3(new THREE.Vector3(-10, 0, -10), new THREE.Vector3(10, 50, 10));
  const wire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(20, 50, 20)));
  wire.position.y = 25;
  const scene = new THREE.Scene(); scene.add(wire);
  const ensemble = createCinematicPencils({ bounds, lines: [wire], duration: 7, color: '#1877f2', scale: 1 });
  scene.add(ensemble.group);
  const pencils = ensemble.group.children.filter(c => c.name.startsWith('cinematic-pencil-'));
  assert.equal(pencils.length, PENCIL_COUNT);
  const poses = () => pencils.map(p => [...p.position.toArray(), ...p.quaternion.toArray()]);
  ensemble.update(0.08);
  const start = poses();
  ensemble.update(1.31);
  assert.notDeepEqual(poses(), start);
  ensemble.update(0.08);
  assert.deepEqual(poses(), start);
  let initialHeight = 0, finalHeight = 0;
  for (let t = 0; t <= 7; t += 0.017) {
    ensemble.update(t);
    for (const pencil of pencils) {
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(pencil.quaternion);
      assert.ok(up.y > Math.cos(12 * Math.PI / 180), 'Pencil must remain within 12 degrees of vertical');
      assert.ok(pencil.position.toArray().every(Number.isFinite));
    }
    if (t === 0) initialHeight = pencils.reduce((s, p) => s + p.position.y, 0);
    finalHeight = pencils.reduce((s, p) => s + p.position.y, 0);
  }
  assert.ok(finalHeight > initialHeight + 50, 'Ensemble must ascend');
  // Both sides of a beat boundary remain continuous, including the first nib lift.
  ensemble.update(0.2 - 1e-6); const left = pencils[0].position.clone();
  ensemble.update(0.2 + 1e-6); assert.ok(left.distanceTo(pencils[0].position) < 0.001);
  ensemble.update(0.86 - 1e-6); const before = pencils[0].position.clone();
  ensemble.update(0.86 + 1e-6); assert.ok(before.distanceTo(pencils[0].position) < 0.001);
  ensemble.dispose();
  assert.equal(scene.children.includes(ensemble.group), false);
  wire.geometry.dispose(); (wire.material as THREE.Material).dispose();
});
