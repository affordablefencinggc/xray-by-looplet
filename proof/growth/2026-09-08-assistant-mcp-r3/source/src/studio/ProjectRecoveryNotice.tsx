import { useState } from "react";
import { useStudio } from "./store";
import { FENCING_JOB_STORAGE_KEY, LEGACY_FENCING_JOB_STORAGE_KEY } from "./persistence";
import "./projectDetails.css";

/** A failed load never becomes permission to replace the unreadable project. */
export function ProjectRecoveryNotice() {
  const error = useStudio(s => s.persistenceError);
  const [downloadError, setDownloadError] = useState("");
  function downloadRecord() {
    try {
      const raw = localStorage.getItem(FENCING_JOB_STORAGE_KEY) ?? localStorage.getItem(LEGACY_FENCING_JOB_STORAGE_KEY);
      if (raw === null) throw Error("No saved project record is available to download.");
      const url = URL.createObjectURL(new Blob([raw], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = "xray-saved-project-record.txt";
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setDownloadError("");
    } catch (failure) { setDownloadError(failure instanceof Error ? failure.message : "The saved record could not be read."); }
  }
  return <section className="project-details" aria-label="Project recovery" data-project-recovery="blocked">
    <div><span className="kicker">Saved work needs attention</span><h2>Your saved project has been preserved</h2>
      <p role="alert">{error ?? "Project storage could not be restored safely."}</p>
      <p>Editing is paused so a blank workspace cannot replace your saved work. Retry loading after storage becomes available. Backups remain available from the header.</p></div>
    <button className="pill" onClick={() => void useStudio.getState().retryProjectLoad()}>Retry loading saved project</button>
    <button className="pill" onClick={downloadRecord}>Download saved project record</button>
    <small>The record download preserves the stored text, including unreadable content. It is a recovery aid, not a complete backup of drawings and photos.</small>
    {downloadError && <p role="alert">{downloadError}</p>}
  </section>;
}

export function ProjectSaveFailure() {
  const error = useStudio(s => s.persistenceError);
  if (!error) return null;
  return <section className="project-details" aria-label="Project save needs attention" data-project-save="unsaved">
    <div><strong>Project changes are not confirmed saved</strong><p role="alert">{error}</p><p>Keep this window open. Retry saving after resolving the storage problem.</p></div>
    <button className="pill" onClick={() => useStudio.getState().saveCurrentProject()}>Retry saving project</button>
  </section>;
}
