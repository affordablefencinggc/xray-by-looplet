import { Box3, Matrix3, Matrix4, Vector3 } from "three";
import { OBB } from "three/examples/jsm/math/OBB.js";

type Point = [number, number, number];
/** Shared unrolled frame: local Z follows the run; local Y stays as upright as possible.
 * End caps stop at the entered endpoints. Round runs use a enclosing square only
 * for clash screening; that box must never be described as an exact cylinder. */
export function hvacRunFrame(a: Point, b: Point) {
  const start = new Vector3(...a), end = new Vector3(...b);
  const forward = end.clone().sub(start), length = forward.length();
  if (length === 0) return null;
  forward.divideScalar(length);
  const right = new Vector3(0, 1, 0).cross(forward);
  if (right.lengthSq() < 1e-10) right.set(1, 0, 0).addScaledVector(forward, -forward.x);
  right.normalize();
  const up = forward.clone().cross(right).normalize();
  return { length, center: start.add(end).multiplyScalar(.5), rotation: new Matrix4().makeBasis(right, up, forward) };
}

export function hvacRunIntersectsBeam(a: Point, b: Point, width: number, height: number, insulation: number, beam: { min: Point; max: Point }) {
  const frame = hvacRunFrame(a, b);
  if (!frame) return false;
  const envelope = new OBB(frame.center, new Vector3(width / 2 + insulation, height / 2 + insulation, frame.length / 2), new Matrix3().setFromMatrix4(frame.rotation));
  return envelope.intersectsBox3(new Box3(new Vector3(...beam.min), new Vector3(...beam.max)));
}
