import * as THREE from "three";
import type { SourceBuilding } from "./sourceBuilding";

/** Separate fixed jambs from leaf mullions in presentation-model door assemblies. */
export function prepareSourceWalkDoors(model: SourceBuilding, meshes: Map<string, THREE.Mesh>) {
  const extraMeshes: THREE.Mesh[] = [];
  const doors = model.objects.filter((part) => part.category === "door" && !part.id.endsWith("-frame"))
    .flatMap((part) => {
      const leaf = meshes.get(part.id);
      if (!leaf) return [];
      const leaves = [leaf], frame = meshes.get(part.id + "-frame");
      if (frame) {
        const geometry = frame.geometry, p = geometry.getAttribute("position"), index = geometry.index;
        geometry.computeBoundingBox();
        const bounds = geometry.boundingBox!, size = bounds.getSize(new THREE.Vector3());
        const axis = size.x >= size.z ? "x" : "z", fixed: number[] = [], moving: number[] = [];
        const vertex = new THREE.Vector3(), center = new THREE.Vector3();
        for (let i = 0; i < (index?.count ?? p.count); i += 3) {
          const triangle: number[] = [];
          center.set(0, 0, 0);
          for (let k = 0; k < 3; k++) {
            vertex.fromBufferAttribute(p, index ? index.getX(i + k) : i + k);
            triangle.push(vertex.x, vertex.y, vertex.z); center.add(vertex);
          }
          center.multiplyScalar(1 / 3);
          const perimeter = center[axis] <= bounds.min[axis] + 0.055 || center[axis] >= bounds.max[axis] - 0.055
            || center.y <= bounds.min.y + 0.055 || center.y >= bounds.max.y - 0.055;
          (perimeter ? fixed : moving).push(...triangle);
        }
        if (moving.length && fixed.length) {
          const make = (positions: number[]) => {
            const g = new THREE.BufferGeometry();
            g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
            g.computeVertexNormals(); return g;
          };
          frame.geometry = make(fixed);
          geometry.dispose();
          // Existing frame edge lines used the unsplit geometry. Rebuild them on each new piece.
          for (const child of frame.children) if (child instanceof THREE.LineSegments) {
            child.geometry.dispose(); child.geometry = new THREE.EdgesGeometry(frame.geometry, 28);
          }
          const mullions = new THREE.Mesh(make(moving), frame.material);
          mullions.userData = { ...frame.userData, partId: part.id };
          mullions.castShadow = frame.castShadow; mullions.receiveShadow = true;
          const frameEdge = frame.children.find((child) => child instanceof THREE.LineSegments);
          if (frameEdge instanceof THREE.LineSegments) {
            const edge = new THREE.LineSegments(new THREE.EdgesGeometry(mullions.geometry, 28), frameEdge.material);
            edge.userData.solidEdge = true; edge.raycast = () => {};
            mullions.add(edge);
          }
          frame.parent?.add(mullions);
          leaves.push(mullions); extraMeshes.push(mullions);
        }
      }
      const motion: "swing" | "slide" | "lift" = /sectional|roller|panel lift/i.test(part.label) ? "lift"
        : /slid|bifold/i.test(part.label) ? "slide" : "swing";
      return [{ id: part.id, label: part.label, meshes: leaves, motion }];
    });
  return { doors, extraMeshes };
}
