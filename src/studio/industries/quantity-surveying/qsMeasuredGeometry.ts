import type { FencingJob } from "../../domain.ts";
import { constructionRunQuantity } from "../../construction/runQuantity.ts";
import type { IndustryGeometryEntitySource } from "../draftPanel.ts";
import { calibrationIdentity } from "../sourceBinding.ts";

/** Preserve the numeric measurement without adding display rounding. Exact
 * decimal binding fields do not accept the exponent notation Number may use. */
function decimalQuantity(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0";
  const text = value.toString();
  if (!/[eE]/.test(text)) return text;
  const [coefficient, exponentText] = text.toLowerCase().split("e");
  const [whole, fraction = ""] = coefficient.split(".");
  const digits = whole + fraction;
  const decimalAt = whole.length + Number(exponentText);
  if (decimalAt <= 0) return `0.${"0".repeat(-decimalAt)}${digits}`;
  if (decimalAt >= digits.length) return digits + "0".repeat(decimalAt - digits.length);
  return `${digits.slice(0, decimalAt)}.${digits.slice(decimalAt)}`;
}

/** Current gross quantities derived from real geometry and its source-bound
 * calibration. Saved length caches never establish a measured binding. Invalid
 * candidates remain inspectable but cannot carry calibration/source authority. */
export function qsMeasuredGeometry(
  job: FencingJob,
  activeSheet: number,
  sourceReady: boolean,
): IndustryGeometryEntitySource[] {
  const document = job.documents.find(entry => entry.id === job.activeDocumentId);
  return job.runs.filter(run => run.sheet === activeSheet).map(run => {
    const measured = constructionRunQuantity(job, run, sourceReady);
    const valid = measured.value !== null;
    const calibration = job.calibrations.find(entry => entry.sheet === run.sheet);
    const assembly = run.specification.construction?.assembly;
    return {
      entityId: run.id,
      entityType: assembly === "conduit" ? "duct-run"
        : assembly === "wall" || assembly === "partition" ? "wall-run" : "construction-run",
      label: `${run.label} · ${valid ? "gross geometry" : `unverified: ${measured.reason}`}`,
      revision: run.revision ?? 1,
      points: run.points,
      measuredQuantity: decimalQuantity(measured.value ?? run.grossLengthM ?? run.lengthM),
      unit: valid ? measured.unit : "m",
      calibrationId: valid && calibration ? calibrationIdentity(calibration) : null,
      sourceSha256: valid ? document?.sha256 ?? null : null,
    };
  });
}
