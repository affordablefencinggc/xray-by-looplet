import { measureCanvasDistanceM } from "../calibration.ts";
import { missingRunSpecificationFields, type FenceRun, type FencingJob } from "../domain.ts";

export type ConstructionRunQuantity = {
  value: number | null;
  unit: "m" | "m²" | "m³";
  formula: string;
  reason: string | null;
};

/** Gross geometry only: openings, waste, packaging and mass require their own rules. */
export function constructionRunQuantity(job: FencingJob, run: FenceRun, sourceReady: boolean): ConstructionRunQuantity {
  const spec = run.specification.construction;
  const unit = spec?.quantity === "volume" ? "m³" : spec?.quantity === "area" ? "m²" : "m";
  const unavailable = (reason: string): ConstructionRunQuantity => ({ value: null, unit, formula: "", reason });
  if (!spec || run.specification.constructionEnabled === false) return unavailable("Select a general construction takeoff.");
  const missing = missingRunSpecificationFields(run.specification);
  if (missing.length) return unavailable(`Required: ${missing.join(", ")}.`);
  const doc = job.documents.find((entry) => entry.id === job.activeDocumentId);
  if (!sourceReady || !doc?.sha256 || doc.source === "sample") return unavailable("Verify the original source drawing before calculating.");
  if (doc.pageCount !== null && run.sheet >= doc.pageCount) return unavailable("The run sheet is outside the source drawing.");
  const calibration = job.calibrations.find((entry) => entry.sheet === run.sheet);
  const candidate = calibration?.candidates.find((entry) => entry.id === calibration.selectedCandidateId);
  if (!calibration?.locked || calibration.coordinateSpace !== "source-page-v1" || !candidate ||
      candidate.provenance.documentId !== doc.id || calibration.source === "unverified") {
    return unavailable("Lock a source-bound calibration for this run's sheet.");
  }
  if (Math.abs(candidate.metresPerUnit - calibration.metresPerUnit) > 1e-9 * Math.max(candidate.metresPerUnit, calibration.metresPerUnit)) {
    return unavailable("The scale no longer matches its reviewed candidate.");
  }
  let length = 0;
  try {
    for (let i = 1; i < run.points.length; i++) length += measureCanvasDistanceM(run.points[i - 1], run.points[i], calibration, run.sheet);
  } catch {
    return unavailable("The run geometry could not be measured with this calibration.");
  }
  if (!Number.isFinite(length) || length <= 0) return unavailable("Trace a positive run length.");
  const width = spec.quantity === "length" ? 1 : spec.widthM!;
  const depth = spec.quantity === "volume" ? spec.depthM! : 1;
  const value = length * width * depth;
  if (!Number.isFinite(value) || value <= 0) return unavailable("The quantity must be positive and finite.");
  const format = (n: number) => Number(n.toPrecision(10)).toString();
  const formula = `${format(length)} m${spec.quantity !== "length" ? ` × ${format(width)} m` : ""}${spec.quantity === "volume" ? ` × ${format(depth)} m` : ""}`;
  return { value, unit, formula, reason: null };
}
