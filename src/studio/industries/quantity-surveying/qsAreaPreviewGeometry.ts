import * as T from "three";

type Point = Readonly<{ x: number; y: number }>;
export type QsAreaPreviewInput = Readonly<{
  entityId: string;
  entityType: string;
  points: readonly Point[];
  areaGeometry?: Readonly<{
    holes: readonly (readonly Point[])[];
    pitchDegrees: number | null;
    azimuthDegrees: number | null;
    basis: unknown;
  }>;
}>;
export type QsPreviewFrame = Readonly<{ centreX: number; centreY: number; scale: number }>;

export function qsAreaPreviewSlope(entity: QsAreaPreviewInput): { pitch: number; azimuth: number } | null {
  const pitch = entity.areaGeometry?.pitchDegrees, azimuth = entity.areaGeometry?.azimuthDegrees;
  return entity.entityType === "roof-plane" && typeof pitch === "number" && Number.isFinite(pitch) && pitch >= 0 && pitch < 90
    && typeof azimuth === "number" && Number.isFinite(azimuth) && azimuth >= 0 && azimuth < 360
    ? { pitch, azimuth } : null;
}

function contour(points: readonly Point[]): T.Vector2[] {
  if (points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) throw Error("Area preview contains non-finite source coordinates.");
  const result = points.map(point => new T.Vector2(point.x, point.y));
  if (result.length > 1 && result[0].equals(result[result.length - 1])) result.pop();
  if (result.length < 3 || Math.abs(T.ShapeUtils.area(result)) <= Number.EPSILON) throw Error("Area preview needs a nondegenerate source polygon.");
  return result;
}

/** Presentation only. This never computes or authenticates a takeoff quantity.
 * Roof rise azimuth is clockwise from source-page up: (sin(a), -cos(a)). */
export function createQsAreaPreviewGeometry(entity: QsAreaPreviewInput, frame: QsPreviewFrame) {
  if (entity.entityType !== "room-area" && entity.entityType !== "roof-plane") throw Error("Only polygon area families have area-preview faces.");
  if (![frame.centreX, frame.centreY, frame.scale].every(Number.isFinite) || frame.scale <= 0) throw Error("Invalid area presentation frame.");
  const sourceOuter = contour(entity.points), sourceHoles = (entity.areaGeometry?.holes ?? []).map(contour);
  const map = (point: T.Vector2) => new T.Vector2((point.x - frame.centreX) * frame.scale, (point.y - frame.centreY) * frame.scale);
  const outer = sourceOuter.map(map), holes = sourceHoles.map(ring => ring.map(map));
  const shape = new T.Shape(outer);
  for (const ring of holes) shape.holes.push(new T.Path(ring));
  const geometry = new T.ShapeGeometry(shape);
  if (!geometry.index?.count) { geometry.dispose(); throw Error("Area preview triangulation produced no faces."); }
  const roof = entity.entityType === "roof-plane";
  const slope = qsAreaPreviewSlope(entity), slopeKnown = slope !== null;
  const rise = slope ? Math.tan(slope.pitch * Math.PI / 180) : 0;
  const angle = slope ? slope.azimuth * Math.PI / 180 : 0;
  const riseX = Math.sin(angle), riseZ = -Math.cos(angle);
  // Height is relative to this face; no unsupported datum elevation is invented.
  const centreX = outer.reduce((sum, point) => sum + point.x, 0) / outer.length;
  const centreZ = outer.reduce((sum, point) => sum + point.y, 0) / outer.length;
  const rawHeight = (x: number, z: number) => ((x - centreX) * riseX + (z - centreZ) * riseZ) * rise;
  const minimum = Math.min(...outer.map(point => rawHeight(point.x, point.y)));
  const height = (x: number, z: number) => rawHeight(x, z) - minimum + 0.035;
  const positions = geometry.getAttribute("position");
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index), z = positions.getY(index);
    positions.setXYZ(index, x, height(x, z), z);
  }
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return {
    geometry,
    boundaries: [outer, ...holes].map(ring => ring.map(point => new T.Vector3(point.x, height(point.x, point.y), point.y))),
    roof,
    slopeKnown,
    annotationAvailable: entity.areaGeometry !== undefined,
    holeCount: holes.length,
    triangleCount: geometry.index.count / 3,
    status: roof ? slopeKnown ? "declared-slope-preview" as const : "projected-footprint-slope-unknown" as const : "room-polygon-preview" as const,
  };
}
