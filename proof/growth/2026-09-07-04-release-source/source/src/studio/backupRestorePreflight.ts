import { fencingJobSchema, parseFencingJob, type FencingJob } from "./domain.ts";
import { FENCING_JOB_STORAGE_KEY, LEGACY_FENCING_JOB_STORAGE_KEY } from "./persistence.ts";
import { architectKey } from "./architect/persistence.ts";
import { bomStorageKey } from "./bomPersistence.ts";
import { inventoryStorageKey } from "./construction/inventoryPersistence.ts";
import { fencingRecipeStorageKey } from "./fencingRecipePersistence.ts";
import { takeoffKey } from "./construction/altitudeTakeoff.ts";
import { trialKey } from "./construction/connectionTrial.ts";
import { MATERIALS_DB } from "./projectMaterialsPersistence.ts";
import { priceBookKey, parsePriceBookLibrary } from "./pricing/priceBooks.ts";
import { sheetLifecycleStorageKey, sheetSourceIdentity, validateJobSheetMetadata } from "./sheetLifecycle.ts";
import { PLAN_CONTENT_DB, PLAN_CONTENT_STORE, MAX_PLAN_BYTES, type StoredPlanContent } from "./documentContract.ts";
import { PHOTO_CONTENT_DB, PHOTO_CONTENT_STORE, MAX_PHOTO_BYTES, type StoredPhotoContent } from "./evidence.ts";
import { backupDigest, backupPhotos, emptyBackupRecords, parseProjectBackup, validateBackupRecords, type BackupRecords, type ProjectBackup } from "./projectBackup.ts";

export type BackupRestoreReadPorts = {
  currentJob(): FencingJob;
  readLocal(key: string): string | null | Promise<string | null>;
  readMaterials(jobId: string): Promise<string | null>;
  plan(id: string): Promise<StoredPlanContent | null>;
  photo(id: string): Promise<StoredPhotoContent | null>;
};
export type RestoreImpactAction = "add" | "replace" | "remove" | "unchanged" | "preserve" | "unsupported" | "conflict";
export type RestoreImpactRow = {
  id: string; label: string; storage: "localStorage" | "IndexedDB";
  key: string; database?: string; store?: string;
  scope: "workspace" | "target-project" | "current-project" | "global";
  action: RestoreImpactAction; existing: boolean; incoming: boolean; message: string;
};
export type BackupRestorePreflight = {
  project: { current: { id: string; name: string; revision: number }; target: { id: string; name: string; revision: number }; sameProject: boolean };
  rows: RestoreImpactRow[]; warnings: string[]; blockingIssues: string[];
  fingerprint: string; backupSha256: string; canApply: false;
};
export type BackupRestoreOptions = { expectedFingerprint?: string; restoreReferenceRates?: boolean };
type Target = Omit<RestoreImpactRow, "action" | "existing" | "incoming" | "message"> & {
  record?: keyof BackupRecords; owner?: FencingJob; next?: string | null; policy: "compare" | "preserve" | "unsupported";
};
type RawRead = { raw: string | null; digest: string | null; error: boolean };
type AssetRead = { present: boolean; digest: string | null; metadata: string | null; error: boolean; currentMismatch: boolean };
type Snapshot = { liveJob: string; raw: Map<string, RawRead>; assets: Map<string, AssetRead> };
const REFERENCE_KEY = "xray.price-sheet.v1";
const MAX_RECORD_BYTES = 30 * 1024 * 1024;
const local = (key: string) => `localStorage:${key}`;
const assetKey = (kind: "plan" | "photo", id: string) => `${kind}:${id}`;
const describeJob = (job: FencingJob) => ({ id: job.id, name: job.name, revision: job.revision });

/** Explicit record addresses only. No storage enumeration, mutation or restore capability. */
export async function assessBackupRestore(
  backup: ProjectBackup | string, ports: BackupRestoreReadPorts, options: BackupRestoreOptions = {},
): Promise<BackupRestorePreflight> {
  // Always parse the serialized value, including when the caller supplies an already-typed object.
  const serialized = typeof backup === "string" ? backup : JSON.stringify(backup);
  const target = await parseProjectBackup(serialized);
  const current = fencingJobSchema.parse(structuredClone(ports.currentJob()));
  const currentText = JSON.stringify(current), backupSha256 = await backupDigest(serialized);
  const warnings = ["Read-only impact review. No project, original file or saved setting has been changed. Applying a backup is not available.",
    "This review does not acquire a write lease or create a recovery journal. Repeat it after changes; a stable fingerprint is not permission to apply."];
  const blockingIssues: string[] = [], rows: RestoreImpactRow[] = [], targets = new Map<string, Target>();
  const put = (value: Target) => targets.set(value.id, value);
  put({ id: local(FENCING_JOB_STORAGE_KEY), label: "Active editing project", storage: "localStorage", key: FENCING_JOB_STORAGE_KEY, scope: "workspace", policy: "compare", next: JSON.stringify(target.job) });
  put({ id: local(LEGACY_FENCING_JOB_STORAGE_KEY), label: "Legacy saved project", storage: "localStorage", key: LEGACY_FENCING_JOB_STORAGE_KEY, scope: "workspace", policy: "preserve" });
  function addModules(job: FencingJob, incoming: boolean) {
    const scope = incoming ? "target-project" as const : "current-project" as const;
    const keys: [keyof BackupRecords, string, string][] = [
      ["architecture", "Architectural design", architectKey(job.id)], ["bom", "BOM and review", bomStorageKey(job.id)],
      ["components", "Component inventory", inventoryStorageKey(job.id)], ["recipes", "Saved recipes", fencingRecipeStorageKey(job.id)],
      ["sourceTakeoff", "Source-bound takeoff", takeoffKey(job.id)], ["connectionReview", "Source-bound connection review", trialKey(job.id)],
      ["priceBooks", "Supplier price books and worksheet", priceBookKey(job.id)],
    ];
    for (const [record, label, key] of keys) put({ id: local(key), label, storage: "localStorage", key, scope, record, owner: job,
      policy: !incoming ? "preserve" : target.records[record] === undefined ? "unsupported" : "compare", next: incoming ? target.records[record] : undefined });
    put({ id: `materials:${job.id}`, label: "Project materials", storage: "IndexedDB", database: MATERIALS_DB, store: "inventories", key: job.id,
      scope, record: "materials", owner: job, policy: incoming ? "compare" : "preserve", next: incoming ? target.records.materials : undefined });
    for (const doc of job.documents) {
      const identity = sheetSourceIdentity(job.id, doc);
      if (!identity) continue;
      const key = sheetLifecycleStorageKey(identity);
      put({ id: local(key), label: `Sheet organisation: ${doc.name}`, storage: "localStorage", key, scope, record: "sheetMetadata", owner: job, policy: "preserve" });
    }
  }
  addModules(current, false);
  addModules(target.job, true);
  const capturedSheets = target.records.sheetMetadata;
  const sheetValues = new Map(validateJobSheetMetadata(capturedSheets ?? null, target.job).map(value => [sheetLifecycleStorageKey(value.identity), JSON.stringify(value)]));
  // Include known current-only source identities when restoring the same project. A null v2 snapshot means absence.
  for (const entry of targets.values()) if (entry.record === "sheetMetadata" && (current.id === target.job.id || entry.scope === "target-project")) {
    entry.scope = "target-project";
    entry.policy = capturedSheets === undefined ? "unsupported" : "compare";
    entry.next = capturedSheets === undefined ? undefined : sheetValues.get(entry.key) ?? null;
  }
  if (capturedSheets === undefined) warnings.push("This package did not capture sheet organisation. Existing names, order and archive state cannot be reconstructed from it and would need to be explicitly preserved.");
  if (target.records.priceBooks === undefined) warnings.push("This package did not capture supplier price books or its priced worksheet. Those records are unsupported by this package and must not be silently cleared.");
  put({ id: local(REFERENCE_KEY), label: "Device-wide reference rates", storage: "localStorage", key: REFERENCE_KEY, scope: "global", record: "referenceRates",
    policy: options.restoreReferenceRates ? "compare" : "preserve", next: target.records.referenceRates });
  warnings.push(options.restoreReferenceRates ? "Reference-rate replacement is selected for this impact review. These settings are shared by other projects on this device." : "Device-wide reference rates are preserved by default, even when the backup contains different rates.");
  warnings.push("Only supported per-project stores and source identities listed here are inspected. Separate construction-runtime jobs, model preferences and unknown/orphaned source records are outside this package.");

  const originals = new Map<string, { kind: "plan" | "photo"; id: string; name: string; incoming: boolean; expected: string | null;
    currentPlan?: FencingJob["documents"][number]; currentPhoto?: FencingJob["photos"][number] }>();
  for (const doc of current.documents.filter(d => d.source !== "sample")) originals.set(assetKey("plan", doc.id), { kind: "plan", id: doc.id, name: doc.name, incoming: false, expected: null, currentPlan: doc });
  for (const photo of backupPhotos(current)) originals.set(assetKey("photo", photo.id), { kind: "photo", id: photo.id, name: photo.name, incoming: false, expected: null, currentPhoto: photo });
  for (const asset of target.assets) {
    const doc = target.job.documents.find(d => d.id === asset.id);
    const expected = asset.kind === "plan" ? JSON.stringify({ id: asset.id, name: asset.name, kind: doc!.kind, mimeType: asset.mimeType, sha256: asset.sha256 })
      : JSON.stringify({ id: asset.id, name: asset.name, mimeType: asset.mimeType, sha256: asset.sha256 });
    const key = assetKey(asset.kind, asset.id);
    originals.set(key, { ...originals.get(key), kind: asset.kind, id: asset.id, name: asset.name, incoming: true, expected });
  }
  async function capture(): Promise<Snapshot> {
    const liveJob = JSON.stringify(fencingJobSchema.parse(structuredClone(ports.currentJob())));
    const raw = new Map<string, RawRead>(), assets = new Map<string, AssetRead>();
    for (const entry of targets.values()) {
      try {
        const value = entry.storage === "localStorage" ? await ports.readLocal(entry.key) : await ports.readMaterials(entry.key);
        if (value !== null && (typeof value !== "string" || new Blob([value]).size > MAX_RECORD_BYTES)) throw Error("Unreadable record");
        raw.set(entry.id, { raw: value, digest: value === null ? null : await backupDigest(value), error: false });
      } catch { raw.set(entry.id, { raw: null, digest: null, error: true }); }
    }
    for (const [id, original] of originals) {
      try {
        const content = original.kind === "plan" ? await ports.plan(original.id) : await ports.photo(original.id);
        if (!content) { assets.set(id, { present: false, metadata: null, digest: null, error: false, currentMismatch: false }); continue; }
        if (!(content.bytes instanceof ArrayBuffer) || content.bytes.byteLength > (original.kind === "plan" ? MAX_PLAN_BYTES : MAX_PHOTO_BYTES)) throw Error("Unreadable original");
        const digest = await backupDigest(content.bytes);
        let metadata: string;
        if (original.kind === "plan") {
          const plan = content as StoredPlanContent;
          if (plan.sizeBytes !== plan.bytes.byteLength || plan.documentId !== original.id) throw Error("Original metadata mismatch");
          metadata = JSON.stringify({ id: plan.documentId, name: plan.name, kind: plan.kind, mimeType: plan.mimeType, sha256: plan.sha256 });
        } else {
          const photo = content as StoredPhotoContent;
          if (photo.id !== original.id) throw Error("Original identity mismatch");
          metadata = JSON.stringify({ id: photo.id, name: photo.name, mimeType: photo.mimeType, sha256: photo.sha256 });
        }
        const expectedCurrent = original.currentPlan ?? original.currentPhoto;
        const currentMismatch = !!expectedCurrent && (expectedCurrent.name !== content.name || expectedCurrent.sha256 !== digest ||
          (original.currentPlan ? original.currentPlan.kind !== (content as StoredPlanContent).kind :
            original.currentPhoto!.mimeType !== content.mimeType || original.currentPhoto!.sizeBytes !== content.bytes.byteLength));
        assets.set(id, { present: true, metadata, digest, error: digest !== content.sha256, currentMismatch });
      } catch { assets.set(id, { present: true, metadata: null, digest: null, error: true, currentMismatch: false }); }
    }
    return { liveJob, raw, assets };
  }
  const snapshotValue = (snapshot: Snapshot) => JSON.stringify({ backupSha256, restoreReferenceRates: options.restoreReferenceRates === true, liveJob: snapshot.liveJob,
    records: [...snapshot.raw].map(([id, value]) => [id, value.digest, value.error]), assets: [...snapshot.assets] });
  const first = await capture(), second = await capture();
  const fingerprint = await backupDigest(snapshotValue(second));
  if (first.liveJob !== currentText || second.liveJob !== currentText || snapshotValue(first) !== snapshotValue(second)) blockingIssues.push("The editing project or a saved target changed while this review was being prepared. Run the impact review again.");
  if (options.expectedFingerprint !== undefined && options.expectedFingerprint !== fingerprint) blockingIssues.push("The backup, editing project or target storage changed since the previous review. The earlier review is stale.");
  const activeRaw = second.raw.get(local(FENCING_JOB_STORAGE_KEY))!, legacyRaw = second.raw.get(local(LEGACY_FENCING_JOB_STORAGE_KEY))!;
  try {
    const stored = activeRaw.raw ?? legacyRaw.raw;
    if (stored === null) warnings.push("The current editing project has no saved main-job record. A recoverable before-restore snapshot has not been established.");
    else if (JSON.stringify(parseFencingJob(JSON.parse(stored))) !== currentText) blockingIssues.push("The open project differs from the saved main-job record. Preserve or reload the latest work before considering recovery.");
  } catch { blockingIssues.push("The existing main-job record is corrupt or unsupported. It has been preserved; resolve that recovery issue first."); }
  for (const entry of targets.values()) {
    const before = second.raw.get(entry.id)!;
    let action: RestoreImpactAction = entry.policy === "preserve" ? "preserve" : entry.policy === "unsupported" ? "unsupported"
      : before.raw === (entry.next ?? null) ? "unchanged" : entry.next == null ? "remove" : before.raw === null ? "add" : "replace";
    let message = action === "preserve" ? "Existing value remains untouched." : action === "unsupported" ? "Not captured by this package; absence cannot be inferred."
      : action === "remove" ? "The package records absence; a future restore would remove this saved target value after preserving a recovery copy."
      : action === "replace" ? "Different saved target data exists; a recovery before-image and explicit replacement review would be required."
      : action === "add" ? "No saved value exists at this exact target address." : "Saved value matches the package exactly.";
    if (before.error) { action = "conflict"; message = "Existing storage could not be read safely; no absence or replacement assumption is valid."; blockingIssues.push(`${entry.label}: existing storage is unreadable.`); }
    else if (before.raw !== null && entry.record && entry.scope !== "global") {
      try {
        if (entry.record === "priceBooks") parsePriceBookLibrary(before.raw, entry.owner!.id);
        else if (entry.record === "sheetMetadata") {
          const sheets = validateJobSheetMetadata(`[${before.raw}]`, entry.owner!);
          if (sheets.length !== 1 || sheetLifecycleStorageKey(sheets[0].identity) !== entry.key) throw Error("Wrong source key");
        } else await validateBackupRecords({ ...emptyBackupRecords(), [entry.record]: before.raw }, entry.owner!.id);
      } catch {
        action = "conflict"; message = "Existing project data is corrupt, unsupported or belongs to another identity. It has been preserved.";
        blockingIssues.push(`${entry.label}: existing project data failed validation.`);
      }
    }
    rows.push({ id: entry.id, label: entry.label, storage: entry.storage, key: entry.key, database: entry.database, store: entry.store, scope: entry.scope,
      action, existing: before.raw !== null || before.error, incoming: entry.next != null, message });
  }
  for (const [id, original] of originals) {
    const before = second.assets.get(id)!;
    const currentReferenced = !!(original.currentPlan || original.currentPhoto);
    const conflict = before.error || before.currentMismatch || (currentReferenced && !before.present) || (original.incoming && before.present && before.metadata !== original.expected);
    const action: RestoreImpactAction = conflict ? "conflict" : original.incoming ? before.present ? "unchanged" : "add" : "preserve";
    if (before.error || (original.incoming && before.present && before.metadata !== original.expected)) blockingIssues.push(`Original ${original.kind} “${original.name}” has a reused identity, different metadata or corrupt bytes. Existing originals must not be overwritten.`);
    if (currentReferenced && !before.present) blockingIssues.push(`Current original ${original.kind} “${original.name}” is missing; a complete before-restore backup cannot yet be made.`);
    if (before.currentMismatch) blockingIssues.push(`Current original ${original.kind} “${original.name}” does not match the open project's metadata; a complete before-restore backup cannot yet be made.`);
    rows.push({ id, label: `Original ${original.kind}: ${original.name}`, storage: "IndexedDB", key: original.id,
      database: original.kind === "plan" ? PLAN_CONTENT_DB : PHOTO_CONTENT_DB, store: original.kind === "plan" ? PLAN_CONTENT_STORE : PHOTO_CONTENT_STORE,
      scope: original.incoming ? "target-project" : "current-project", action, existing: before.present, incoming: original.incoming,
      message: conflict ? currentReferenced && !before.present ? "A current-project original is missing; incoming bytes do not establish a complete before-restore backup."
        : "Identity collision or corruption blocks reuse; no original was changed." : original.incoming ? before.present ? "Stored original metadata and actual byte digest match the verified package." : "Verified package original is absent locally; a future restore would add it without replacing other originals." : "Current-project original is retained." });
  }
  return { project: { current: describeJob(current), target: describeJob(target.job), sameProject: current.id === target.job.id }, rows, warnings,
    blockingIssues: [...new Set(blockingIssues)], fingerprint, backupSha256, canApply: false };
}
