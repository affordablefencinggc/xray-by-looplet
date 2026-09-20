import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { useStudio } from "../store";
import { createBrowserPlanStore } from "../documents";
import { createBrowserPhotoStore } from "../evidence";
import { BACKUP_EXCLUSIONS, backupContents, captureProjectBackup, parseProjectBackup, type ProjectBackup } from "../projectBackup";
import { readBackupRecords } from "../projectBackupStorage";
import { BackupRestoreReview } from "../BackupRestoreReview";
import { createProjectArchive, MAX_ARCHIVE_BYTES, parseProjectArchive } from "./projectArchive";

type Props = { busy: boolean; ready: boolean; onBusyChange(value: boolean): void };
export function ProjectPortableArchive({ busy, ready, onBusyChange }: Props) {
  const [client, setClient] = useState("");
  const [notice, setNotice] = useState(""), [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [preview, setPreview] = useState<{ backup: ProjectBackup; client: string | null } | null>(null);
  const input = useRef<HTMLInputElement>(null), flight = useRef(false);
  async function run(action: () => Promise<void>) {
    if (busy || flight.current) return;
    flight.current = true; setWorking(true); onBusyChange(true); setError(""); setNotice("");
    try { await action(); }
    catch (failure) { setError(failure instanceof Error && failure.name !== "ZodError" ? failure.message : "Archive validation failed. No saved project was changed."); }
    finally { flight.current = false; setWorking(false); onBusyChange(false); }
  }
  async function exportCurrent() {
    await run(async () => {
      const state = useStudio.getState();
      if (!state.persistenceHydrated || state.hydrationStatus !== "ready" || state.persistenceRecoveryBlocked)
        throw Error("Wait for the workspace to finish opening before exporting.");
      if (state.persistenceError || state.bomPersistenceError || state.inventoryPersistenceError)
        throw Error("Resolve the workspace save errors before exporting its archive.");
      const plans = createBrowserPlanStore(), photos = createBrowserPhotoStore();
      const backup = await captureProjectBackup(state.job, state.job.name.slice(0, 120), {
        records: readBackupRecords, plan: id => plans.get(id), photo: id => photos.get(id),
        currentJob: () => useStudio.getState().job,
      });
      const archive = await createProjectArchive(backup, client.trim() || null);
      const url = URL.createObjectURL(new Blob([Uint8Array.from(archive.bytes).buffer], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url; a.download = `${backup.job.name.replace(/[^a-zA-Z0-9 _-]/g, "_").slice(0, 100) || "Project"}.xray`;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
      setNotice(`Archive prepared for ${backup.job.name}, revision ${backup.job.revision}. Download requested; retain the file outside this app.`);
    });
  }
  async function importFile(file: File) {
    await run(async () => {
      setPreview(null);
      if (!file.size || file.size > MAX_ARCHIVE_BYTES) throw Error("Select a nonempty archive no larger than 200 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
        const value = await parseProjectArchive(bytes);
        setPreview({ backup: value.backup, client: value.manifest.client ?? null });
      } else {
        setPreview({ backup: await parseProjectBackup(new TextDecoder("utf-8", { fatal: true }).decode(bytes)), client: null });
      }
      setNotice("Archive verified. Review the restore impact before replacing saved work.");
    });
  }
  return <section className="project-archive-review" aria-label="Portable project archive" aria-busy={working}>
    <h3>Portable project archive</h3>
    <p>Keep saved design, measurements, schedules and stored original drawings together in a .xray file.</p>
    <label>Client for archive (optional)<input value={client} maxLength={300} disabled={busy} onChange={e => setClient(e.target.value)} /></label>
    <div className="project-library-toolbar">
      <button className="pill" disabled={busy || !ready} onClick={() => void exportCurrent()}><Download size={15} />Export Portable Archive (.xray)</button>
      <button className="pill" disabled={busy || !ready} onClick={() => input.current?.click()}><Upload size={15} />Import Archive</button>
      <input ref={input} type="file" hidden aria-label="Import portable archive file" accept=".xray,.zip,.json" onChange={e => {
        const file = e.target.files?.[0]; e.target.value = ""; if (file) void importFile(file);
      }} />
    </div>
    <details><summary>Archive contents and limits</summary>
      <p>Includes saved project records and every referenced original PDF, DXF, SVG and photo held in this workspace. Every file is checked before restoration. Original DWG source bytes are not yet retained by this archive workflow.</p>
      <ul>{BACKUP_EXCLUSIONS.map(item => <li key={item}>{item}</li>)}</ul>
      <p>Legacy JSON backups remain readable. The current recovery reader has a 200 MB limit, including its encoded drawing data.</p>
    </details>
    {working && <p role="status">Preparing and verifying project files…</p>}
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
    {preview && <section aria-label="Portable archive contents">
      <h4>{preview.backup.job.name} · revision {preview.backup.job.revision}</h4>
      <p>{backupContents(preview.backup).plans} original drawings · {backupContents(preview.backup).photos} photos · file hashes verified</p>
      {preview.client && <p>Client: {preview.client}</p>}
      <BackupRestoreReview backup={preview.backup} />
      <button className="pill" disabled={busy} onClick={() => setPreview(null)}>Close archive review</button>
    </section>}
  </section>;
}
