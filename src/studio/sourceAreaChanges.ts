import { sourceAnnotationSchema, sourceAreaMeasurementSchema, type FencingJob, type SourceAreaMeasurement } from "./domain.ts";
import { appendJobRevision } from "./evidenceCommands.ts";
import { measureSourceArea } from "./sourceAreaMeasurement.ts";

export type SourceAreaChange =
  | { kind: "basis"; label: string; measurement: SourceAreaMeasurement }
  | { kind: "vertex"; ringIndex: number; vertexIndex: number; point: { x: number; y: number } };

/** One revision-safe mutation path for source areas. A changed polygon can be
 * invalid: retain it visibly, but measurement then fails closed. Never rebind QS. */
export function changeSourceArea(job: FencingJob, id: string, expectedRevision: number, change: SourceAreaChange): FencingJob {
  const annotation = job.annotations?.find(item => item.id === id);
  const document = job.documents.find(item => item.id === job.activeDocumentId);
  if (!annotation || annotation.kind !== "area") throw Error("The source area no longer exists.");
  if (job.annotations!.filter(item => item.id === id).length !== 1 || job.runs.some(run => run.id === id))
    throw Error("The source area identity is ambiguous; preserve it for review before editing.");
  if ((annotation.measurement?.revision ?? 0) !== expectedRevision) throw Error("This source area changed. Reopen it before editing.");
  if (!document?.sha256 || document.source === "sample" || annotation.documentId !== document.id ||
    annotation.sourceSha256 !== document.sha256 || annotation.coordinateSpace !== "source-page-v1")
    throw Error("The area must match the original source drawing and its revision before editing.");
  const calibration = job.calibrations.find(item => item.sheet === annotation.sheet);
  if (!calibration?.locked || calibration.coordinateSpace !== "source-page-v1")
    throw Error("Lock the source-page calibration before editing this area.");
  let next = structuredClone(annotation);
  if (change.kind === "basis") {
    next.label = change.label.trim();
    if (!next.label) throw Error("Name the source area before applying its measurement basis.");
    next.measurement = sourceAreaMeasurementSchema.parse({ ...change.measurement, revision: expectedRevision + 1 });
  } else {
    if (!next.measurement) throw Error("Classify the source area before editing its vertices.");
    if (!Number.isInteger(change.ringIndex) || !Number.isInteger(change.vertexIndex) || change.ringIndex < 0 || change.vertexIndex < 0 ||
      !Number.isFinite(change.point.x) || !Number.isFinite(change.point.y)) throw Error("Choose a valid source-area vertex.");
    const ring = change.ringIndex === 0 ? next.points : next.measurement.holes[change.ringIndex - 1];
    if (!ring?.[change.vertexIndex]) throw Error("That source-area vertex no longer exists.");
    ring[change.vertexIndex] = { ...change.point };
    next.measurement.revision = expectedRevision + 1;
  }
  next = sourceAnnotationSchema.parse(next);
  const measured = measureSourceArea(job, next, true);
  // This cache is only a legacy display value. All QS quantities use live geometry.
  next.value = measured.value ?? measured.projectedAreaM2 ?? 0;
  return appendJobRevision({ ...job, annotations: job.annotations!.map(item => item.id === id ? next : item) }, {
    entityType: "job", entityId: job.id, action: "update",
    summary: `${change.kind === "basis" ? "Updated measurement basis for" : "Moved source vertex of"} ${next.label}; quantity bindings require explicit review.`,
  });
}
