import { fencingJobSchema, type FencingJob, type DocumentRevision } from "./domain.ts";
import { createUnverifiedCalibration } from "./calibration.ts";

export function captureDocumentWorkspace(job: FencingJob, sheet: number): FencingJob {
  const document = job.documents.find((item) => item.id === job.activeDocumentId);
  if (!document) return job;
  const workspace = {
    documentId: document.id,
    sourceSha256: document.sha256 ?? null,
    sheet: Math.max(0, Math.min(sheet, (document.pageCount ?? 1) - 1)),
    calibrations: job.calibrations,
    runs: job.runs,
    gates: job.gates,
    annotations: job.annotations ?? [],
    photos: job.photos,
    bom: job.bom,
    quoteDraft: job.quoteDraft,
    status: job.status,
    revisionHistory: job.revisionHistory,
  };
  // Transitional object only: the active workspace entry is removed by restore before validation/publication.
  return {
    ...job,
    documentWorkspaces: { ...job.documentWorkspaces, [document.id]: structuredClone(workspace) },
  };
}

export function restoreDocumentWorkspace(job: FencingJob, document: DocumentRevision): FencingJob {
  const snapshots = { ...job.documentWorkspaces };
  const saved = snapshots[document.id];
  delete snapshots[document.id];
  if (
    saved &&
    (saved.documentId !== document.id || saved.sourceSha256 !== (document.sha256 ?? null))
  )
    throw Error("Saved workspace does not match this original source.");
  const empty = {
    calibrations: Array.from({ length: document.pageCount ?? 1 }, (_, sheet) =>
      createUnverifiedCalibration(sheet),
    ),
    runs: [],
    gates: [],
    annotations: [],
    photos: [],
    bom: [],
    quoteDraft: null,
    status: "draft" as const,
    revisionHistory: [],
  };
  const data = saved ?? empty;
  return fencingJobSchema.parse({
    ...job,
    calibrations: data.calibrations,
    runs: data.runs,
    gates: data.gates,
    annotations: data.annotations,
    photos: data.photos,
    bom: data.bom,
    quoteDraft: data.quoteDraft,
    status: data.status,
    revisionHistory: data.revisionHistory,
    activeDocumentId: document.id,
    activeSheet: saved?.sheet ?? 0,
    documentWorkspaces: snapshots,
  });
}

/** Verify/load first, then reject races before any active workspace is published. */
export async function prepareDocumentSelection<T>(
  before: {
    job: FencingJob;
    sheet: number;
    pending: readonly unknown[];
    calibrationCapture: unknown;
  },
  documentId: string,
  load: (document: DocumentRevision) => Promise<T>,
  stillCurrent: () => boolean,
) {
  if (before.pending.length || before.calibrationCapture)
    throw Error("Finish or cancel the current trace or calibration before switching plans.");
  const document = before.job.documents.find(
    (item) => item.id === documentId && item.source !== "sample",
  );
  if (!document) throw Error("The selected source plan is unavailable.");
  const binary = await load(document);
  if (!stillCurrent())
    throw Error(
      "The workbench changed while this plan loaded. Your current work was preserved; select the plan again.",
    );
  return {
    binary,
    job: restoreDocumentWorkspace(captureDocumentWorkspace(before.job, before.sheet), document),
  };
}
