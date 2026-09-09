import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import * as THREE from "three";
import { parseSourceBuilding } from "./sourceBuilding.ts";
import { createMagicPencilDraftsman } from "./MagicPencilDraftsman.ts";

test("closing drafting restores clipping, transparency and camera without changing model geometry", async () => {
  const model = parseSourceBuilding(JSON.parse(await readFile(new URL("../../public/models/caroline/source-building.json", import.meta.url), "utf8")));
  const part = model.objects[0];
  const originalGeometry = JSON.stringify(model);
  const scene = new THREE.Scene();
  const planes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 2)];
  const linePlanes = [new THREE.Plane(new THREE.Vector3(1, 0, 0), 3)];
  const material = new THREE.MeshStandardMaterial({ opacity: 0.42, transparent: true, depthWrite: false, clippingPlanes: planes });
  const geometry = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(part.positions, 3));
  const mesh = new THREE.Mesh(geometry, material); mesh.visible = false;
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xabcdef, opacity: 0.37, transparent: false, clippingPlanes: linePlanes });
  const line = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), lineMaterial); line.visible = false; mesh.add(line); scene.add(mesh);
  const camera = new THREE.PerspectiveCamera(); camera.position.set(13, 17, 19);
  const target = new THREE.Vector3(2, 3, 4); const originalTarget = target.clone();
  const draftsman = createMagicPencilDraftsman({ scene, model, meshMap: new Map([[part.id, mesh]]), domElement: { dataset: {} } as unknown as HTMLCanvasElement, invalidate: () => {}, camera, controls: { target, update: () => {} } });
  draftsman.seek(0.4); draftsman.setSectionCut("section-x"); draftsman.setCinematicOrbit(true); draftsman.tick(1000); draftsman.tick(1500);
  assert.notEqual(material.clippingPlanes, planes);
  draftsman.dispose();
  assert.equal(mesh.visible, false); assert.equal(line.visible, false);
  assert.equal(material.opacity, 0.42); assert.equal(material.transparent, true); assert.equal(material.depthWrite, false);
  assert.equal(material.clippingPlanes, planes); assert.equal(lineMaterial.clippingPlanes, linePlanes);
  assert.equal(lineMaterial.transparent, false); assert.equal(lineMaterial.opacity, 0.37); assert.equal(lineMaterial.color.getHex(), 0xabcdef);
  assert.deepEqual(camera.position.toArray(), [13, 17, 19]); assert.deepEqual(target.toArray(), originalTarget.toArray());
  assert.equal(JSON.stringify(model), originalGeometry);
  assert.equal(draftsman.getStatus().mode, "idle");
  geometry.dispose(); material.dispose(); line.geometry.dispose(); lineMaterial.dispose();
});

test("MagicPencilDraftsman initializes, sorts storeys and drives procedural drawing phases", async () => {
  const raw = JSON.parse(
    await readFile(new URL("../../public/models/crown-wharf/source-building.json", import.meta.url), "utf8"),
  );
  const model = parseSourceBuilding(raw);

  const scene = new THREE.Scene();
  const meshMap = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>();

  // Create lightweight mock meshes and lines for testing
  for (const part of model.objects) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(part.positions, 3));
    const mat = new THREE.MeshStandardMaterial({ color: 0x888888, opacity: 1.0 });
    const mesh = new THREE.Mesh(geo, mat);
    const line = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo, 28),
      new THREE.LineBasicMaterial({ color: 0x222222 }),
    );
    mesh.add(line);
    mesh.userData = { partId: part.id, baseMaterial: mat };
    meshMap.set(part.id, mesh);
    scene.add(mesh);
  }

  // Create mock canvas
  const canvas = {
    dataset: {} as Record<string, string>,
  } as unknown as HTMLCanvasElement;

  let invalidateCalled = 0;
  const draftsman = createMagicPencilDraftsman({
    scene,
    model,
    meshMap,
    domElement: canvas,
    invalidate: () => {
      invalidateCalled++;
    },
    durationSeconds: 10,
  });

  // Test Phase 1: Datum Grid (progress <= 0.15)
  draftsman.seek(0.08);
  let status = draftsman.getStatus();
  assert.equal(status.phase, "datum_grid");
  assert.equal(status.visibleMeshCount, 0);
  assert.equal(canvas.dataset.drawPhase, "datum_grid");
  assert.equal(canvas.dataset.drawMode, "active");

  // Test Phase 2: Ascending Wireframe Tracing (0.15 < progress <= 0.65)
  draftsman.seek(0.40);
  status = draftsman.getStatus();
  assert.equal(status.phase, "ascending_wireframe");
  assert.ok(status.visibleMeshCount > 0);
  assert.ok(status.visibleMeshCount < model.objects.length);
  assert.equal(canvas.dataset.drawPhase, "ascending_wireframe");
  assert.ok(Number(canvas.dataset.drawVisibleMeshes) > 0);
  assert.ok(Number(canvas.dataset.drawElevation) > model.bounds.min[1]);

  // Test Phase 3: Technical Ink Strengthening (0.65 < progress <= 0.82)
  draftsman.seek(0.75);
  status = draftsman.getStatus();
  assert.equal(status.phase, "ink_strengthening");
  assert.equal(status.visibleMeshCount, model.objects.length);
  assert.equal(canvas.dataset.drawPhase, "ink_strengthening");

  // Test Phase 4: Material Wash & Solid Shading (0.82 < progress < 1.0)
  draftsman.seek(0.90);
  status = draftsman.getStatus();
  assert.equal(status.phase, "material_wash");
  assert.equal(status.visibleMeshCount, model.objects.length);
  assert.equal(canvas.dataset.drawPhase, "material_wash");

  // Test Phase 5: Complete (progress = 1.0)
  draftsman.seek(1.0);
  status = draftsman.getStatus();
  assert.equal(status.phase, "complete");
  assert.equal(status.mode, "complete");

  // Verify tick playback animation
  draftsman.replay();
  assert.equal(draftsman.getStatus().progress, 0);
  assert.equal(draftsman.getStatus().mode, "drawing");

  const advanced = draftsman.tick(1000); // initial tick sets lastTime
  assert.equal(advanced, true);
  draftsman.tick(2000); // 1 second delta at 10s duration -> +0.10 progress
  assert.ok(draftsman.getStatus().progress > 0.05);

  draftsman.pause();
  assert.equal(draftsman.getStatus().mode, "paused");

  draftsman.setSpeed(2.0);
  assert.equal(draftsman.getStatus().speed, 2.0);

  draftsman.finish();
  assert.equal(draftsman.getStatus().phase, "complete");
  assert.equal(draftsman.getStatus().mode, "complete");
  assert.equal(draftsman.getStatus().progress, 1.0);

  draftsman.restoreOriginal();
  assert.equal(canvas.dataset.drawMode, "inactive");
  assert.equal(canvas.dataset.drawState, "idle");

  draftsman.dispose();
});

test("MagicPencilDraftsman runs on Caroline model with two floors", async () => {
  const raw = JSON.parse(
    await readFile(new URL("../../public/models/caroline/source-building.json", import.meta.url), "utf8"),
  );
  const model = parseSourceBuilding(raw);
  const scene = new THREE.Scene();
  const meshMap = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>();

  for (const part of model.objects) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(part.positions, 3));
    const mat = new THREE.MeshStandardMaterial({ color: 0x666666, opacity: 1.0 });
    const mesh = new THREE.Mesh(geo, mat);
    const line = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo, 28),
      new THREE.LineBasicMaterial({ color: 0x111111 }),
    );
    mesh.add(line);
    mesh.userData = { partId: part.id, baseMaterial: mat };
    meshMap.set(part.id, mesh);
    scene.add(mesh);
  }

  const canvas = {
    dataset: {} as Record<string, string>,
  } as unknown as HTMLCanvasElement;

  const draftsman = createMagicPencilDraftsman({
    scene,
    model,
    meshMap,
    domElement: canvas,
    invalidate: () => {},
  });

  draftsman.play();
  assert.equal(draftsman.getStatus().mode, "drawing");
  draftsman.seek(0.5);
  assert.equal(draftsman.getStatus().phase, "ascending_wireframe");
  assert.ok(draftsman.getStatus().visibleMeshCount > 0);
  draftsman.dispose();
});

test("MagicPencilDraftsman supports section cuts and dimensions, and refuses headless image export", async () => {
  const raw = JSON.parse(
    await readFile(new URL("../../public/models/crown-wharf/source-building.json", import.meta.url), "utf8"),
  );
  const model = parseSourceBuilding(raw);
  const scene = new THREE.Scene();
  const meshMap = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>();

  for (const part of model.objects) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(part.positions, 3));
    const mat = new THREE.MeshStandardMaterial({ color: 0x888888, opacity: 1.0 });
    const mesh = new THREE.Mesh(geo, mat);
    const line = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo, 28),
      new THREE.LineBasicMaterial({ color: 0x222222 }),
    );
    mesh.add(line);
    mesh.userData = { partId: part.id, baseMaterial: mat };
    meshMap.set(part.id, mesh);
    scene.add(mesh);
  }

  const canvas = {
    width: 800,
    height: 600,
    dataset: {} as Record<string, string>,
  } as unknown as HTMLCanvasElement;

  const draftsman = createMagicPencilDraftsman({
    scene,
    model,
    meshMap,
    domElement: canvas,
    invalidate: () => {},
  });

  draftsman.play();
  draftsman.seek(0.35);

  // Status has sectionCut and dimensions
  const s0 = draftsman.getStatus();
  assert.equal(s0.sectionCut, "none");
  assert.equal(s0.dimensionsVisible, false);
  assert.ok(s0.dimensions);
  assert.equal(canvas.dataset.drawSection, "none");
  assert.equal(canvas.dataset.drawDimensions, "inactive");

  // Toggle section cut modes
  const cut1 = draftsman.toggleSectionCut();
  assert.equal(cut1, "plan");
  assert.equal(draftsman.getStatus().sectionCut, "plan");
  assert.equal(canvas.dataset.drawSection, "plan");

  const cut2 = draftsman.toggleSectionCut();
  assert.equal(cut2, "section-x");
  assert.equal(draftsman.getStatus().sectionCut, "section-x");
  assert.equal(canvas.dataset.drawSection, "section-x");

  const cut3 = draftsman.toggleSectionCut();
  assert.equal(cut3, "section-z");
  assert.equal(draftsman.getStatus().sectionCut, "section-z");
  assert.equal(canvas.dataset.drawSection, "section-z");

  const cut4 = draftsman.toggleSectionCut();
  assert.equal(cut4, "none");
  assert.equal(draftsman.getStatus().sectionCut, "none");

  // Toggle dimensions
  const dimsOn = draftsman.toggleDimensions();
  assert.equal(dimsOn, true);
  assert.equal(draftsman.getStatus().dimensionsVisible, true);
  assert.equal(canvas.dataset.drawDimensions, "active");

  const dimsOff = draftsman.toggleDimensions();
  assert.equal(dimsOff, false);
  assert.equal(draftsman.getStatus().dimensionsVisible, false);
  assert.equal(canvas.dataset.drawDimensions, "inactive");

  // A model alone cannot prove rendered sheets; real canvas/PDF output is tested separately.
  assert.throws(() => draftsman.capturePlanBook(), /requires a browser canvas/);

  draftsman.dispose();
});
