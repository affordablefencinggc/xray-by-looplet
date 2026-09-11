import { useEffect, useRef, useState } from "react";
import { assessBackupRestore } from "./backupRestorePreflight";
import type { ProjectBackup } from "./projectBackup";
import { createBrowserPlanStore } from "./documents";
import { createBrowserPhotoStore } from "./evidence";
import { restoreMaterialDatabase } from "./projectMaterialsPersistence";
import { useStudio } from "./store";
import "./backupRestoreReview.css";
import { stageWorkspaceRestore } from "./workspaceRestoreStorage";
import { BACKUP_FORMAT } from "./projectBackup";

type Assessment = Awaited<ReturnType<typeof assessBackupRestore>>;
export function BackupRestoreReview({ backup }: { backup: ProjectBackup }) {
  const [review, setReview] = useState<Assessment | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [includeRates, setIncludeRates] = useState(false);
  const generation = useRef(0);
  useEffect(() => { generation.current++; setReview(null); setError(""); setBusy(false); }, [backup]);
  useEffect(() => () => { generation.current++; }, []);
  async function inspect(fresh = false) {
    const ticket = ++generation.current;
    setBusy(true); setError("");
    try {
      const state = useStudio.getState();
      if (!state.persistenceHydrated || state.hydrationStatus !== "ready" || state.persistenceError || state.bomPersistenceError || state.inventoryPersistenceError)
        throw Error("Resolve the current workspace's save or loading error before reviewing a replacement.");
      const plans = createBrowserPlanStore(), photos = createBrowserPhotoStore();
      const next = await assessBackupRestore(backup, {
        currentJob: () => useStudio.getState().job,
        readLocal: key => localStorage.getItem(key),
        readMaterials: async jobId => {
          const result = await restoreMaterialDatabase(jobId);
          if (result.blocked || result.error) throw Error(result.error ?? "Material inventory is unreadable.");
          return result.raw;
        },
        plan: id => plans.get(id), photo: id => photos.get(id),
      }, { restoreReferenceRates: includeRates, expectedFingerprint: fresh ? undefined : review?.fingerprint });
      if (ticket === generation.current) setReview(next);
    } catch (failure) {
      if (ticket === generation.current) {
        setReview(null);
        setError(failure instanceof Error ? failure.message : "Restore review failed. No project data was changed.");
      }
    } finally { if (ticket === generation.current) setBusy(false); }
  }
  return <section className="backup-restore-review" aria-label="Restore impact review" aria-busy={busy}>
    <h3>Review restoration</h3>
    <p>Check what this snapshot would replace and whether original files conflict with this device. This review does not change the editing workspace.</p>
    <label className="restore-rate-option"><input type="checkbox" checked={includeRates} disabled={busy} onChange={e => { setIncludeRates(e.target.checked); setReview(null); }} />Restore shared reference rates from this snapshot (affects all projects)</label>
    <div className="backup-actions">
      <button className="pill" disabled={busy} onClick={() => void inspect()}>{review ? "Recheck current workspace" : "Review restore impact"}</button>
      {review && <button className="pill" disabled={busy} onClick={() => void inspect(true)}>Start a fresh review</button>}
    </div>
    {busy && <p role="status">Verifying saved records and original file identities…</p>}
    {error && <p role="alert">{error}</p>}
    {review && <>
      <p className="restore-review-result" role="status">{review.blockingIssues.length ? "Conflicts need attention before a restore can be considered." : "Integrity review complete. Workspace unchanged."}</p>
      <p>Current: <b>{review.project.current.name}</b> · revision {review.project.current.revision}<br />Snapshot: <b>{review.project.target.name}</b> · revision {review.project.target.revision}</p>
      {review.blockingIssues.length > 0 && <ul className="restore-conflicts" aria-label="Restore conflicts">{review.blockingIssues.map((item, index) => <li key={index}>{item}</li>)}</ul>}
      <div className="restore-impact-list">{review.rows.map(row => <article key={row.id}>
        <div><strong>{row.label}</strong><span>{row.action}</span></div><p>{row.message}</p>
      </article>)}</div>
      {!!review.warnings.length && <details><summary>Scope and compatibility notes ({review.warnings.length})</summary><ul>{review.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
      <p>Restoring replaces the listed saved records, preserves a recovery copy and reloads the workspace. Close other X-Ray tabs first. Unsaved edits and assistant chats are not included in the snapshot.</p>
      <p>The restored project becomes active in the project library. If it is a different project, your current saved project remains in the library. Existing assistant conversations stay on this device.</p>
      <button className="pill" disabled={busy || review.blockingIssues.length > 0 || backup.format !== BACKUP_FORMAT} onClick={() => {
        setBusy(true); setError("");
        void stageWorkspaceRestore(backup, review.fingerprint, includeRates).then(() => location.reload()).catch(failure => {
          setReview(null); setError(failure instanceof Error ? failure.message : "Restore could not be prepared."); setBusy(false);
        });
      }}>Restore this snapshot and reload</button>
    </>}
  </section>;
}
