import { alterationDraftRecordSchema, ALTERATION_DRAFT_MAX, ALTERATION_DRAFT_SOURCE_MAX, ALTERATION_DRAFT_SOURCE_BYTES_MAX, type AlterationDraftRecord } from "./alterationDraftSchema.ts";
export { alterationDraftRecordSchema, ALTERATION_DRAFT_MAX, ALTERATION_DRAFT_SOURCE_MAX, ALTERATION_DRAFT_SOURCE_BYTES_MAX, type AlterationDraftRecord } from "./alterationDraftSchema.ts";
import { validateProject, type ArchitectProject } from "./model.ts";
import { sha256Hex } from "./designedScene.ts";
import { resolveAlterationStage, type AlterationBasis, type AlterationStage } from "./alterationStage.ts";
import { exportAlterationStagePdf, type AlterationExportOptions } from "./alterationExport.ts";

/** Snapshots are deliberately nonrecursive and contain no generic issue history.
 * Original geometry, annotations, view settings and model revision are retained.
 */
function sourceSnapshot(project: ArchitectProject): ArchitectProject {
  const source = structuredClone(project);
  delete source.issues;
  delete source.alterationDrafts;
  return source;
}

function checkedRecord(value: unknown, projectId: string): { record: AlterationDraftRecord; source: ArchitectProject } {
  const record = alterationDraftRecordSchema.parse(value);
  if (record.projectId !== projectId) throw Error("Saved alteration draft belongs to another project.");
  if (sha256Hex(record.sourceJson) !== record.sourceSha256) throw Error("Saved alteration draft source hash does not match its frozen bytes.");
  let raw: unknown;
  try { raw = JSON.parse(record.sourceJson); } catch { throw Error("Saved alteration draft contains invalid source JSON."); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || "issues" in raw || "alterationDrafts" in raw) {
    throw Error("Saved alteration draft source must be a project without nested issue or alteration histories.");
  }
  // Histories were rejected before entering model validation. Its register
  // validator therefore cannot recurse into another saved source snapshot.
  const source = validateProject(raw);
  if (source.id !== record.projectId || source.revision !== record.projectRevision || source.designRevision !== record.designRevision) {
    throw Error("Saved alteration draft identity/revision does not match its frozen source.");
  }
  if (!source.levels.some((level) => level.id === record.selection.levelId)) throw Error("Saved alteration draft refers to a missing source level.");
  const result = resolveAlterationStage(source, record.basis, record.stage);
  if (!result.ready) throw Error("Saved alteration draft cannot resolve its frozen basis: " + result.blockers.map((blocker) => blocker.reason).join(" "));
  return { record, source };
}

/** Safe hook for validateProject after its outer schema parse. This function
 * never validates the outer project again; only nonrecursive frozen sources.
 */
export function validateAlterationDrafts(project: ArchitectProject): void {
  const records = project.alterationDrafts ?? [];
  if (records.length > ALTERATION_DRAFT_MAX) throw Error("A project can retain at most five saved alteration drafts.");
  const ids = new Set<string>();
  for (const value of records) {
    const { record } = checkedRecord(value, project.id);
    if (ids.has(record.id)) throw Error("Saved alteration draft identities must be unique.");
    ids.add(record.id);
  }
}

export function createAlterationDraft(
  project: ArchitectProject,
  basis: AlterationBasis | null,
  stage: AlterationStage,
  selection: AlterationExportOptions,
  metadata: { id: string; savedAt: string },
): AlterationDraftRecord {
  const source = sourceSnapshot(validateProject(project));
  const resolution = resolveAlterationStage(source, basis, stage);
  if (!resolution.ready) throw Error(resolution.blockers.map((blocker) => blocker.reason).join(" "));
  const sourceJson = JSON.stringify(source);
  if (sourceJson.length > ALTERATION_DRAFT_SOURCE_MAX || new TextEncoder().encode(sourceJson).byteLength > ALTERATION_DRAFT_SOURCE_BYTES_MAX) {
    throw Error("This alteration source is too large to save: maximum 256000 characters and 512000 UTF-8 bytes. Export a PDF instead.");
  }
  const record = alterationDraftRecordSchema.parse({
    format: "xray.alteration-draft/v1", ...metadata, stage,
    projectId: source.id, projectRevision: source.revision, designRevision: source.designRevision,
    basis: { reference: resolution.basisReference, fingerprint: basis!.fingerprint },
    selection, sourceJson, sourceSha256: sha256Hex(sourceJson),
    draftOnly: true, issued: false, quoteEligible: false, sharedAnnotationsReviewed: false,
  });
  return checkedRecord(record, source.id).record;
}

/** Append only a reviewed snapshot of the current source; editing the register
 * cannot retroactively change any record. Workspace commit owns undo/revisions.
 */
export function appendAlterationDraft(project: ArchitectProject, value: AlterationDraftRecord): ArchitectProject {
  const next = validateProject(project), { record } = checkedRecord(value, next.id);
  const records = next.alterationDrafts ?? [];
  if (records.length >= ALTERATION_DRAFT_MAX) throw Error("Five alteration drafts are already saved. Remove an unneeded draft before saving another.");
  if (records.some((prior) => prior.id === record.id)) throw Error("Saved alteration draft identity already exists.");
  if (record.sourceJson !== JSON.stringify(sourceSnapshot(next))) throw Error("The project changed after this alteration snapshot was prepared; review and save it again.");
  next.alterationDrafts = [...records, structuredClone(record)];
  return validateProject(next);
}

export function retrieveAlterationDraft(project: ArchitectProject, id: string): { record: AlterationDraftRecord; source: ArchitectProject } {
  const value = project.alterationDrafts?.find((record) => record.id === id);
  if (!value) throw Error("The selected saved alteration draft no longer exists.");
  return checkedRecord(value, project.id);
}

export function removeAlterationDraft(project: ArchitectProject, id: string): ArchitectProject {
  const next = validateProject(project);
  if (!next.alterationDrafts?.some((record) => record.id === id)) throw Error("The selected saved alteration draft no longer exists.");
  next.alterationDrafts = next.alterationDrafts.filter((record) => record.id !== id);
  return validateProject(next);
}

/** Regenerates a PDF from frozen data, not guaranteed byte-identical to a prior
 * PDF file. No current source geometry, current basis, or issued history is used.
 */
export async function exportSavedAlterationDraftPdf(project: ArchitectProject, id: string): Promise<Uint8Array> {
  const { record, source } = retrieveAlterationDraft(project, id);
  return exportAlterationStagePdf(source, record.basis, record.stage, record.selection);
}
