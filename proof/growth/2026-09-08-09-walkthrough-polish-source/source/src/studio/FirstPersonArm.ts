import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import type { WalkDoorState } from "./WalkDoors";

/** A real first-person rig, parented to the view so its shoulder stays at the body. */
export function createFirstPersonArm({ scene, camera, canvas, invalidate, loadAsset }: {
  scene: THREE.Scene; camera: THREE.PerspectiveCamera; canvas: HTMLCanvasElement; invalidate: () => void;
  loadAsset?: () => Promise<Pick<GLTF, "scene" | "animations">>;
}) {
  const anchor = new THREE.Group(), rig = new THREE.Group();
  anchor.name = "Walkthrough body"; anchor.matrixAutoUpdate = false; anchor.visible = false;
  anchor.add(rig); scene.add(anchor);
  let disposed = false, mixer: THREE.AnimationMixer | null = null;
  let action: THREE.AnimationAction | null = null, duration = 0;
  canvas.dataset.walkArmAsset = "loading";
  canvas.dataset.walkArmVisible = "false";
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  const load = (loadAsset?.() ?? new GLTFLoader().loadAsync("/assets/walkthrough/arms.glb")).then(gltf => {
    gltf.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry); object.frustumCulled = false;
      object.renderOrder = 10000; object.castShadow = false; object.receiveShadow = false;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material); material.depthTest = false; material.depthWrite = false;
        // Model glazing renders in the transparent queue; draw the view arm after it.
        material.transparent = true;
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      }
    });
    if (disposed) { release(); return; }
    rig.add(gltf.scene);
    // The authored first-person rig uses metre units and its own shoulder-relative origin.
    rig.position.set(0.1, -1.743155, -0.16);
    rig.rotation.y = Math.PI; // Authored reach is +Z; a Three.js camera looks along -Z.
    const clip = gltf.animations.find(clip => /grab[._ ]?r$/i.test(clip.name))
      ?? gltf.animations.find(clip => /push[._ ]?r$/i.test(clip.name));
    if (!clip) throw Error("First-person reach animation is missing");
    mixer = new THREE.AnimationMixer(gltf.scene);
    action = mixer.clipAction(clip); action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true; action.play(); duration = clip.duration;
    canvas.dataset.walkArmAsset = "ready"; canvas.dataset.walkArmAnimation = clip.name;
    canvas.dataset.walkArmAnchor = "camera-body";
    invalidate();
  }).catch(() => { if (!disposed) { canvas.dataset.walkArmAsset = "unavailable"; invalidate(); } });
  void load;
  function release() { for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); for (const t of textures) t.dispose(); }
  return {
    ready: load,
    tick(state: WalkDoorState | null) {
      if (disposed) return false;
      const reduce = canvas.ownerDocument.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const visible = Boolean(state?.busy && action && mixer && !reduce);
      anchor.visible = visible; canvas.dataset.walkArmVisible = String(visible);
      if (!visible || !state || !action || !mixer) return false;
      const t = THREE.MathUtils.clamp(state.open ? 1 - state.progress : state.progress, 0, 1);
      action.enabled = true; action.paused = true; action.time = t * duration;
      mixer.update(0);
      // This interaction uses the right hand; keep the resting left arm below view.
      rig.getObjectByName("shoulderL")?.scale.setScalar(0);
      camera.updateWorldMatrix(true, false); anchor.matrix.copy(camera.matrixWorld);
      anchor.matrixWorldNeedsUpdate = true;
      anchor.updateWorldMatrix(true, true);
      const hand = rig.getObjectByName("handR");
      if (hand) canvas.dataset.walkArmHandProjection = hand.getWorldPosition(new THREE.Vector3()).project(camera).toArray().join(",");
      canvas.dataset.walkArmProgress = String(t);
      return true;
    },
    dispose() {
      if (disposed) return; disposed = true;
      canvas.dataset.walkArmVisible = "false";
      mixer?.stopAllAction(); if (mixer) mixer.uncacheRoot(mixer.getRoot());
      anchor.removeFromParent(); release();
    },
  };
}
