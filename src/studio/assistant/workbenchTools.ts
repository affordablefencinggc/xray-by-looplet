import { z } from "zod";
import { getJobBlockers, missingRunSpecificationFields, type FencingJob } from "../domain.ts";
import { readSheetLifecycle, saveSheetLifecycle, sheetArchiveImpact, sheetLifecycleStorageKey, sheetSourceIdentity, type SheetLifecycle, type SheetStorage } from "../sheetLifecycle.ts";
import type { PriceBookLibrary } from "../pricing/priceBooks.ts";

const id = z.string().min(1).max(100);
export const sheetReadSchema = z.object({ expectedJobId: id }).strict();
export const sheetActionSchema = z.object({
  expectedJobId: id, documentId: id, action: z.enum(["rename", "archive", "recover"]), pageIndex: z.number().int().nonnegative().max(9999),
  name: z.string().trim().min(1).max(120).optional(), discipline: z.string().trim().min(1).max(80).optional(),
}).strict();
export type SheetActionInput = z.infer<typeof sheetActionSchema>;
export const takeoffReadSchema = z.object({ expectedJobId: id, sheet: z.number().int().nonnegative().max(9999).optional() }).strict();
export const backupSchema = z.object({ expectedJobId: id, expectedRevision: z.number().int().positive(), name: z.string().trim().min(1).max(120) }).strict();

type SheetJob = Parameters<typeof sheetArchiveImpact>[0] & { annotations?: { sheet: number; documentId: string }[] };

function pageSummary(job: SheetJob, lifecycle: SheetLifecycle) {
  return lifecycle.pages.map(page => ({
    pageIndex: page.pageIndex, originalPage: page.pageIndex + 1, name: page.name, discipline: page.discipline ?? null, archived: page.archived,
    savedViews: page.bookmarks?.length ?? 0,
    evidence: (() => { const impact = sheetArchiveImpact(job, lifecycle.identity, page.pageIndex, lifecycle); return { calibrations: impact.calibrations, traces: impact.traces, items: impact.items, annotations: impact.annotations, linkedPhotos: impact.linkedPhotos }; })(),
  }));
}

/** Sheet register of the active source drawing, read from the same saved sidecar the Sheets pane uses. */
export function describeSourceSheets(job: SheetJob, storage: Pick<Storage, "getItem">) {
  const document = job.documents.find(doc => doc.id === job.activeDocumentId);
  if (!document) return { available: false as const, reason: "No source drawing is open." };
  const identity = sheetSourceIdentity(job.id, document);
  if (!identity) return { available: false as const, reason: document.source === "sample" ? "The active source is the bundled sample; sample sheets are not organised or renamed." : "The active source has no verified identity yet." };
  const lifecycle = readSheetLifecycle(identity, storage);
  return { available: true as const, documentId: document.id, sourceName: document.name, sourceSha256: identity.sha256, pageCount: identity.pageCount, lifecycleRevision: lifecycle.revision,
    pages: pageSummary(job, lifecycle), scope: "Names, disciplines and archive state only; original page numbers, drawing bytes, calibrations, traces and annotations are never changed by sheet organisation." };
}

/** Rename, archive or recover one sheet through the same saved sidecar as the Sheets pane; the whole change validates before it is written. */
export function applySheetAction(job: SheetJob, input: SheetActionInput, storage: SheetStorage) {
  const document = job.documents.find(doc => doc.id === job.activeDocumentId);
  if (!document || document.id !== input.documentId) throw Error("The active source drawing changed. Read the sheets again before editing.");
  const identity = sheetSourceIdentity(job.id, document);
  if (!identity) throw Error("Sample or unverified sources cannot be organised.");
  if (input.pageIndex >= identity.pageCount) throw Error("That page is not part of this source.");
  const current = readSheetLifecycle(identity, storage);
  const page = current.pages.find(item => item.pageIndex === input.pageIndex)!;
  const impact = sheetArchiveImpact(job, identity, input.pageIndex, current);
  let next: SheetLifecycle;
  if (input.action === "rename") {
    if (!input.name) throw Error("Give the sheet a name.");
    next = saveSheetLifecycle(current, { type: "rename", pageIndex: input.pageIndex, name: input.name, ...(input.discipline ? { discipline: input.discipline } : {}) }, storage);
  } else {
    if (input.action === "archive" && page.archived) throw Error("That sheet is already archived.");
    if (input.action === "recover" && !page.archived) throw Error("That sheet is not archived.");
    next = saveSheetLifecycle(current, { type: input.action, pageIndex: input.pageIndex }, storage);
  }
  const after = next.pages.find(item => item.pageIndex === input.pageIndex)!;
  return { documentId: document.id, storageKey: sheetLifecycleStorageKey(identity), action: input.action, pageIndex: input.pageIndex, originalPage: input.pageIndex + 1,
    before: { name: page.name, discipline: page.discipline ?? null, archived: page.archived }, after: { name: after.name, discipline: after.discipline ?? null, archived: after.archived },
    retained: impact, lifecycleRevision: next.revision, saved: true, readbackVerified: true };
}

/** Calibration, traces, located items and readiness blockers per sheet, read from the live project record. */
export function describeTakeoffEvidence(job: FencingJob, sheet?: number) {
  const document = job.documents.find(doc => doc.id === job.activeDocumentId);
  const sheets = sheet === undefined ? [...new Set([...job.calibrations.map(c => c.sheet), ...job.runs.map(r => r.sheet), ...job.gates.map(g => g.sheet)])].sort((a, b) => a - b) : [sheet];
  return {
    projectId: job.id, projectRevision: job.revision, activeDocument: document ? { id: document.id, name: document.name, source: document.source, sha256: document.sha256 ?? null, pageCount: document.pageCount ?? null } : null,
    sheets: sheets.map(index => {
      const calibration = job.calibrations.find(c => c.sheet === index);
      return {
        sheet: index, originalPage: index + 1,
        calibration: calibration ? { locked: calibration.locked, source: calibration.source, confidence: calibration.confidence, coordinateSpace: calibration.coordinateSpace ?? "legacy-procedural-v0", metresPerUnit: calibration.metresPerUnit, knownDistanceM: calibration.knownDistanceM, candidates: calibration.candidates.length, conflict: calibration.conflict !== null } : null,
        traces: job.runs.filter(r => r.sheet === index).map(run => ({ id: run.id, revision: run.revision, label: run.label, vertices: run.points.length, lengthM: run.lengthM, netLengthM: run.netLengthM ?? null, review: run.review.status, missingSpecification: missingRunSpecificationFields(run.specification), photos: run.photoIds.length })),
        items: job.gates.filter(g => g.sheet === index).map(gate => ({ id: gate.id, revision: gate.revision, label: gate.label, onTraceId: gate.runId, review: gate.review.status, photos: gate.photoIds.length })),
      };
    }),
    blockers: getJobBlockers(job),
    scope: "Lengths are only verified when the sheet's calibration is locked with source-page coordinates and the source identity matches; counts, lengths, areas and volumes stay separate. Nothing here is a quote.",
  };
}

/** Price-book library summary: books, revisions and worksheet lines, without every rate row. */
export function describePriceBooks(library: PriceBookLibrary, blocked: boolean, error: string | null) {
  return {
    jobId: library.jobId, libraryRevision: library.revision, blocked, error,
    books: library.books.map(book => ({ id: book.id, name: book.name, archived: book.archived, revisions: book.revisions.map(revision => ({ revision: revision.revision, importedAt: revision.importedAt, rows: revision.rows.length, metadata: revision.metadata })) })),
    worksheetLines: library.worksheet.length,
    scope: "Imported supplier rates and their revisions; quantities are entered by the user and quotes need separate approval. Rate rows are not listed here.",
  };
}
