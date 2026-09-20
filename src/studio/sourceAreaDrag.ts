import type { FencingJob } from "./domain.ts";

type Annotation = NonNullable<FencingJob["annotations"]>[number];
export type SourceAreaDrag = {
  documentId: string; sourceSha256: string | null; sheet: number; entityId: string; revision: number;
  ringIndex: number; vertexIndex: number; originalPoint: { x: number; y: number }; point: { x: number; y: number };
};

export function sourceAreaDragCommitPoint(drag: SourceAreaDrag | null, current: {
  documentId: string | null; sourceSha256: string | null; sheet: number; annotation?: Annotation; allowed: boolean;
}): { x: number; y: number } | null {
  const annotation = current.annotation;
  if (!drag || !current.allowed || !annotation?.measurement || drag.entityId !== annotation.id ||
    drag.documentId !== current.documentId || drag.documentId !== annotation.documentId ||
    drag.sourceSha256 !== current.sourceSha256 || drag.sourceSha256 !== annotation.sourceSha256 ||
    drag.sheet !== current.sheet || drag.sheet !== annotation.sheet || drag.revision !== annotation.measurement.revision) return null;
  const ring = drag.ringIndex === 0 ? annotation.points : annotation.measurement.holes[drag.ringIndex - 1];
  const original = ring?.[drag.vertexIndex];
  if (!original || original.x !== drag.originalPoint.x || original.y !== drag.originalPoint.y ||
    !Number.isFinite(drag.point.x) || !Number.isFinite(drag.point.y) ||
    (drag.point.x === original.x && drag.point.y === original.y)) return null;
  return { ...drag.point };
}
