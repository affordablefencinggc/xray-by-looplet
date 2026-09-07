import { useState } from "react";
import { useStudio } from "./store";
import { FENCING_JOB_STORAGE_KEY, loadFencingJob } from "./persistence";
import "./projectDetails.css";

/** This status deliberately covers the main job only, not unsaved editors or cloud sync. */
export function ProjectDetails() {
  const job = useStudio(s => s.job), hydrated = useStudio(s => s.persistenceHydrated);
  const persistenceError = useStudio(s => s.persistenceError);
  const [edit, setEdit] = useState<{ name: string; jobText: string; stored: string | null } | null>(null);
  const [message, setMessage] = useState(""), [error, setError] = useState("");
  function begin() {
    try {
      const loaded = loadFencingJob();
      if (loaded.error) throw Error(loaded.error);
      if (loaded.job && JSON.stringify(loaded.job) !== JSON.stringify(useStudio.getState().job))
        throw Error("A different project revision is saved on this device. Reload the workspace before renaming so newer work is preserved.");
      setEdit({ name: job.name, jobText: JSON.stringify(job), stored: localStorage.getItem(FENCING_JOB_STORAGE_KEY) });
      setError(""); setMessage("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Project storage is unavailable. The current name is unchanged."); }
  }
  function save() {
    if (!edit?.name.trim()) return;
    try {
      if (JSON.stringify(useStudio.getState().job) !== edit.jobText || localStorage.getItem(FENCING_JOB_STORAGE_KEY) !== edit.stored)
        throw Error("The project changed while you edited its name. Cancel and reopen the name editor to use the latest version.");
      useStudio.getState().updateJobName(edit.name.trim());
      const current = useStudio.getState();
      if (current.persistenceError) throw Error(current.persistenceError);
      if (localStorage.getItem(FENCING_JOB_STORAGE_KEY) !== JSON.stringify(current.job))
        throw Error("The new name is in the open workspace but could not be verified in storage. Keep the app open and retry after resolving the save error.");
      setEdit(null); setMessage("Project name saved on this device. New backups use this name."); setError("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Project name could not be saved."); }
  }
  return <section className="project-details" aria-label="Current project">
    <div><span className="kicker">Current project</span><h2>{job.name}</h2>
      <p>{hydrated ? `Job revision ${job.revision} · local workspace` : "Restoring project…"}</p></div>
    <button className="pill" disabled={!hydrated || Boolean(persistenceError)} onClick={begin}>Rename project</button>
    {edit && <form onSubmit={e => { e.preventDefault(); save(); }}>
      <label>Project name<input value={edit.name} maxLength={200} onChange={e => setEdit({ ...edit, name: e.target.value })} autoFocus /></label>
      <button className="pill" disabled={!edit.name.trim()}>Save project name</button>
      <button className="pill" type="button" onClick={() => { setEdit(null); setError(""); }}>Cancel name edit</button>
    </form>}
    {(error || persistenceError) && <p role="alert">{error || persistenceError}</p>}
    {message && <p role="status">{message}</p>}
    <small>Original drawing names stay intact. Save a project backup to keep a portable copy of committed work and original files.</small>
  </section>;
}
