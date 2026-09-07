import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, ArchiveRestore, Download, FolderArchive, Save, Upload } from "lucide-react";
import { WorkspaceDialog } from "./WorkspaceDialog";
import { BackupRestoreReview } from "./BackupRestoreReview";
import { useStudio } from "./store";
import { createBrowserPlanStore } from "./documents";
import { createBrowserPhotoStore } from "./evidence";
import { BACKUP_EXCLUSIONS, MAX_BACKUP_BYTES, backupContents, captureProjectBackup, parseProjectBackup, type ProjectBackup } from "./projectBackup";
import { listProjectBackups, readBackupRecords, readProjectBackup, storeProjectBackup, updateBackupSummary, type BackupSummary } from "./projectBackupStorage";
import "./projectBackups.css";

const labels: Record<string, string> = { architecture: "Architectural design and sheet layout", bom: "BOM and review state",
  components: "Component inventory", recipes: "Fencing recipes", sourceTakeoff: "Source takeoff and material rates",
  connectionReview: "Connection review", materials: "Project materials and evidence", referenceRates: "Reference price sheet (unapplied)",
  sheetMetadata: "Source sheet names, order and archive state", priceBooks: "Supplier price books and priced worksheet" };
const size = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
function problem(error: unknown) {
  if (error instanceof Error && error.name === "ZodError") return "Saved data did not pass the supported backup format checks. Nothing was overwritten.";
  return error instanceof Error ? error.message : "The backup operation failed. Previous backups are preserved.";
}
function downloadBackup(serialized: string, name: string) {
  const url = URL.createObjectURL(new Blob([serialized], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url; a.download = `${name.replace(/[^a-zA-Z0-9 _-]/g, "_").slice(0, 100) || "X-Ray backup"}.xray-backup.json`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function ProjectBackups() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  // Keep the dialog within the theme root, outside responsive header visibility rules.
  return <><button ref={trigger} className="pill backup-trigger" onClick={() => setOpen(true)}><FolderArchive size={15} /> Backups</button>
    {open && createPortal(<BackupLibrary onClose={() => setOpen(false)} />, trigger.current?.closest(".workbench") ?? document.body)}</>;
}
function BackupLibrary({ onClose }: { onClose: () => void }) {
  const job = useStudio(s => s.job);
  const [items, setItems] = useState<BackupSummary[]>([]), [name, setName] = useState(`${job.name} — ${new Date().toLocaleDateString()}`);
  const [filter, setFilter] = useState(""), [archived, setArchived] = useState(false);
  const [busy, setBusy] = useState(false), [ready, setReady] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [preview, setPreview] = useState<{ value: ProjectBackup; imported: boolean; label: string } | null>(null);
  const [renaming, setRenaming] = useState<BackupSummary | null>(null), [newName, setNewName] = useState("");
  const input = useRef<HTMLInputElement>(null), flight = useRef(false);
  async function refresh() { setItems(await listProjectBackups()); setReady(true); }
  async function run(action: () => Promise<void>) {
    if (flight.current) return;
    flight.current = true; setBusy(true); setError(""); setMessage("");
    try { await action(); } catch (failure) { setError(problem(failure)); }
    finally { flight.current = false; setBusy(false); }
  }
  useEffect(() => { void run(refresh); }, []);
  async function save() {
    await run(async () => {
      const state = useStudio.getState();
      if (!state.persistenceHydrated || state.hydrationStatus !== "ready") throw Error("Wait for the workspace to finish restoring before saving a backup.");
      if (state.persistenceError || state.bomPersistenceError || state.inventoryPersistenceError)
        throw Error("Resolve the workspace's save errors before creating a backup, so no working data is omitted.");
      const plans = createBrowserPlanStore(), photos = createBrowserPhotoStore();
      const value = await captureProjectBackup(state.job, name, {
        records: readBackupRecords, plan: id => plans.get(id), photo: id => photos.get(id),
        currentJob: () => useStudio.getState().job,
      });
      await storeProjectBackup(value); await refresh(); setArchived(false); setFilter("");
      setMessage(`“${value.name}” saved and verified on this device. Download a copy to keep it outside this app.`);
    });
  }
  async function importFile(file: File) {
    await run(async () => {
      if (file.size > MAX_BACKUP_BYTES) throw Error("Backup exceeds the 200 MB package limit.");
      const value = await parseProjectBackup(await file.text());
      setPreview({ value, imported: true, label: value.name });
    });
  }
  const visible = items.filter(i => i.archived === archived && `${i.name} ${i.jobName}`.toLowerCase().includes(filter.toLowerCase()));
  return <WorkspaceDialog title="Project backups" onClose={() => { if (!flight.current) onClose(); }}>
    <div className="project-backups" aria-busy={busy}>
      <p>Keep a named copy of committed work and its original files. Backups stay on this device; download a package for storage elsewhere or a later handoff.</p>
      <div className="backup-save-row">
        <label>Backup name<input maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label>
        <button className="pill" disabled={busy || !ready || !name.trim()} onClick={() => void save()}><Save size={16} /> Save project backup</button>
        <button className="pill" disabled={busy} onClick={() => input.current?.click()}><Upload size={16} /> Import backup</button>
        <input ref={input} hidden aria-label="Import project backup file" type="file" accept=".json" onChange={e => {
          const file = e.target.files?.[0]; e.target.value = ""; if (file) void importFile(file);
        }} />
      </div>
      <details className="backup-scope"><summary>What this package includes</summary>
        <p>Current job, document workspaces, calibration, measurements, annotations and evidence; saved design, sheet layout, quantities, recipes, reviews, materials and reference rates; every referenced original plan and photo. Missing or corrupt originals block the backup.</p>
        <p>Not included:</p><ul>{BACKUP_EXCLUSIONS.map(item => <li key={item}>{item}</li>)}</ul>
        <p>New packages also include saved source sheet names, order and archive state, supplier price books and their priced worksheet. Format v2 requires an updated X-Ray reader; older v1 packages can still be inspected and imported.</p>
        <p>Import adds a verified package to this library. Applying a package to the editing workspace is not available yet. Stored backups are not cloud sync or a staff delivery receipt.</p>
      </details>
      {busy && <p role="status">Checking files and saving data…</p>}
      {message && <p className="backup-notice" role="status">{message}</p>}
      {error && <p className="backup-notice" role="alert">{error}</p>}
      {preview && <section className="backup-preview" aria-label="Backup contents review">
        <h3>{preview.imported ? "Review imported backup" : "Verified backup contents"}</h3>
        <b>{preview.label}</b>
        <p>{preview.value.job.name} · revision {preview.value.job.revision} · {new Date(preview.value.createdAt).toLocaleString()}</p>
        <p>{backupContents(preview.value).plans} original plans · {backupContents(preview.value).photos} original photos · hashes verified</p>
        <ul><li>Job, document workspaces, measurements and evidence</li>{backupContents(preview.value).records.map(key => <li key={key}>{labels[key]}</li>)}</ul>
        <p>The open workspace remains unchanged.</p>
        <BackupRestoreReview key={preview.value.createdAt + preview.value.job.id} backup={preview.value} />
        <div className="backup-actions">
          <button className="pill" disabled={busy} onClick={() => setPreview(null)}>{preview.imported ? "Cancel import" : "Close contents"}</button>
          {preview.imported && <button className="pill" disabled={busy} onClick={() => void run(async () => {
            await storeProjectBackup(preview.value); await refresh(); setPreview(null); setArchived(false); setFilter("");
            setMessage("Verified package added to the library. The open workspace was not changed.");
          })}>Add to backup library</button>}
        </div>
      </section>}
      {renaming && <form className="backup-rename" onSubmit={e => { e.preventDefault(); void run(async () => {
        await updateBackupSummary(renaming, { name: newName }); setRenaming(null); await refresh(); setMessage("Backup label updated. The original snapshot is unchanged.");
      }); }}>
        <label>New backup label<input value={newName} maxLength={120} onChange={e => setNewName(e.target.value)} autoFocus /></label>
        <button className="pill" disabled={busy || !newName.trim()} type="submit">Save label</button>
        <button className="pill" disabled={busy} type="button" onClick={() => setRenaming(null)}>Cancel rename</button>
      </form>}
      <div className="backup-toolbar">
        <label>Search backups<input type="search" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Name or project" /></label>
        <div className="backup-actions">
          <button className="pill" aria-pressed={!archived} onClick={() => setArchived(false)}>Active ({items.filter(i => !i.archived).length})</button>
          <button className="pill" aria-pressed={archived} onClick={() => setArchived(true)}>Archived ({items.filter(i => i.archived).length})</button>
          <button className="pill" disabled={busy} onClick={() => void run(refresh)}>Refresh library</button>
        </div>
      </div>
      <div className="backup-list">
        {!visible.length && ready && <p>{filter ? "No backups match this search." : archived ? "No archived backups. Archive a saved copy to store it away without deleting it." : "No active backups yet. Save the current project or import a package."}</p>}
        {visible.map(item => <article className="backup-item" key={item.id}>
          <div><h3>{item.name}</h3><p>{item.jobName} · revision {item.jobRevision} · {size(item.sizeBytes)}</p>
            <p>{item.plans} plans · {item.photos} photos · saved {new Date(item.storedAt).toLocaleString()}</p></div>
          <div className="backup-actions">
            <button className="pill" disabled={busy} onClick={() => void run(async () => {
              const { value } = await readProjectBackup(item.id); setPreview({ value, imported: false, label: item.name });
            })}>Inspect</button>
            <button className="pill" disabled={busy} onClick={() => void run(async () => {
              const { serialized } = await readProjectBackup(item.id); downloadBackup(serialized, item.name);
              setMessage("Package verified; download requested. Keep the file with your project records.");
            })}><Download size={15} /> Download</button>
            <button className="pill" disabled={busy} onClick={() => { setRenaming(item); setNewName(item.name); }}>Rename</button>
            <button className="pill" disabled={busy} onClick={() => void run(async () => {
              await updateBackupSummary(item, { archived: !item.archived }); await refresh();
              setMessage(item.archived ? "Backup returned to the active library." : "Backup archived. Its data is retained in Archived.");
            })}>{item.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}{item.archived ? "Unarchive" : "Archive"}</button>
          </div>
        </article>)}
      </div>
    </div>
  </WorkspaceDialog>;
}
