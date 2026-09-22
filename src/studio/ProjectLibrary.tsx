import { useEffect, useState } from "react";
import { FolderOpen } from "lucide-react";
import { useStudio } from "./store";
import { saveFencingJob } from "./persistence";
import { defaultProjectText, switchProject } from "./assistant/projectSwitch";
import { PROJECT_REGISTRY_KEY, entriesNewestFirst, parseRegistry, upsertEntry, type ProjectSummary } from "./projectRegistry";
import { PROJECT_LIBRARY_CHANGED, setProjectArchived, withProjectLifecycle } from "./projectArchive";
import { assessStorageQuota } from "./persistence/storageQuotaManager";
import { WorkspaceDialog } from "./WorkspaceDialog";
import { ProjectPortableArchive } from "./persistence/ProjectPortableArchive";
import "./projectLibrary.css";

export function ProjectLibrary() {
  const [open, setOpen] = useState(false);
  return <><button className="pill project-library-trigger" onClick={() => setOpen(true)}><FolderOpen size={14} />Project library</button>
    {open && <WorkspaceDialog title="Project library" onClose={() => setOpen(false)}><LibraryContents /></WorkspaceDialog>}</>;
}

function LibraryContents() {
  const job = useStudio(s => s.job), ready = useStudio(s => s.hydrationStatus === "ready" && !s.persistenceRecoveryBlocked);
  const [raw, setRaw] = useState<string | null>(null), [filter, setFilter] = useState("");
  const [archived, setArchived] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [name, setName] = useState("");
  const [review, setReview] = useState<ProjectSummary | null>(null);
  const [reviewRaw, setReviewRaw] = useState<string | null>(null);
  const [quotaNotice, setQuotaNotice] = useState("");
  const refresh = () => { try { setRaw(localStorage.getItem(PROJECT_REGISTRY_KEY)); } catch { setError("Project storage is unavailable."); } };
  useEffect(() => {
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(PROJECT_LIBRARY_CHANGED, refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener(PROJECT_LIBRARY_CHANGED, refresh); };
  }, [job.id]);
  useEffect(() => {
    const estimate = navigator.storage?.estimate?.bind(navigator.storage);
    if (!estimate) return;
    let cancelled = false;
    void estimate().then((value) => {
      if (cancelled) return;
      const assessment = assessStorageQuota(value);
      setQuotaNotice(assessment.promptArchive
        ? "Storage is above 80% of its quota. Archive completed projects. Only the temporary render cache can be cleared."
        : "");
    }).catch(() => { if (!cancelled) setQuotaNotice(""); });
    return () => { cancelled = true; };
  }, []);
  const registry = upsertEntry(parseRegistry(raw), job);
  const rows = entriesNewestFirst(registry).filter(e => Boolean(e.archived) === archived && `${e.name} ${e.id}`.toLowerCase().includes(filter.toLowerCase()));
  const clearRenderCache = () => {
    try { localStorage.removeItem("transient-render-cache"); setNotice("Temporary render cache cleared. Saved projects were kept."); }
    catch { setError("The temporary render cache could not be cleared."); }
  };
  async function openProject(id: string | null) {
    if (busy) return;
    setBusy(true); setError(""); setNotice(""); setReview(null);
    try {
      const result = await switchProject(id, {
        store: { getState: useStudio.getState, setState: patch => useStudio.setState(patch) },
        storage: localStorage, saveJob: (value, options) => saveFencingJob(value, undefined, options), busy: false,
        createJobText: () => { const value = JSON.parse(defaultProjectText()); value.name = name.trim() || "New project"; return JSON.stringify(value); },
      });
      if (!result.ok) throw Error(result.error);
      setNotice(`Opened ${result.target.name}.`); setName(""); setArchived(false); setFilter("");
      window.dispatchEvent(new Event(PROJECT_LIBRARY_CHANGED)); refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Project could not be opened."); }
    finally { setBusy(false); }
  }
  async function changeArchive(entry: ProjectSummary, value: boolean) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await withProjectLifecycle(async () => setProjectArchived(localStorage, entry.id, value, value ? reviewRaw : raw));
      setReview(null); setNotice(`${entry.name} ${value ? "archived. Its saved work is kept on this device." : "restored to Active projects."}`);
      window.dispatchEvent(new Event(PROJECT_LIBRARY_CHANGED)); refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Project archive change failed."); }
    finally { setBusy(false); }
  }
  return <section className="project-library" aria-busy={busy}>
    <p>Open saved projects or put finished work away. Archiving keeps drawings, design, rates and conversation history on this device.</p>
    {quotaNotice && <p role="status">{quotaNotice} <button className="pill" type="button" onClick={clearRenderCache}>Clear render cache</button></p>}
    <ProjectPortableArchive busy={busy} ready={ready} onBusyChange={setBusy} />
    <div className="project-library-new"><label>New project name<input aria-label="New project name" maxLength={120} value={name} onChange={e => setName(e.target.value)} disabled={busy} placeholder="Project name" /></label>
      <button className="pill" disabled={busy || !ready} onClick={() => void openProject(null)}>Create project</button></div>
    <div className="project-library-toolbar"><div role="group" aria-label="Project list"><button className="pill" aria-pressed={!archived} onClick={() => { setArchived(false); setReview(null); }}>Active</button><button className="pill" aria-pressed={archived} onClick={() => { setArchived(true); setReview(null); }}>Archived</button></div>
      <label>Find a project<input aria-label="Find a project" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Name or project ID" /></label><button className="pill" disabled={busy} onClick={() => { refresh(); setReview(null); }}>Refresh</button></div>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {review && <section className="project-archive-review" aria-label="Archive project review"><h3>Archive {review.name}?</h3><p>This removes it from Active projects and the assistant's project tabs. Its saved records and original files stay intact. Restore it from Archived whenever you need it.</p><p>Project ID: <code>{review.id}</code></p><div><button className="pill" disabled={busy} onClick={() => void changeArchive(review, true)}>Confirm archive</button><button className="pill" disabled={busy} onClick={() => setReview(null)}>Cancel</button></div></section>}
    <ul className="project-library-list" aria-label={archived ? "Archived projects" : "Active projects"}>{rows.map(entry => <li key={entry.id} data-project-id={entry.id}>
      <div><strong>{entry.name}</strong><small>{entry.id === job.id ? "Open now · " : ""}Revision {entry.revision} · {new Date(entry.updatedAt).toLocaleDateString()}</small><code>{entry.id}</code></div>
      <div className="project-library-actions">{archived ? <button className="pill" disabled={busy || !ready} onClick={() => void changeArchive(entry, false)}>Restore</button> : <><button className="pill" disabled={busy || !ready || entry.id === job.id} onClick={() => void openProject(entry.id)}>Open</button><button className="pill" disabled={busy || !ready || entry.id === job.id} title={entry.id === job.id ? "Open another project before archiving this one" : "Archive project"} onClick={() => { setError(""); setReviewRaw(raw); setReview(entry); }}>Archive</button></>}</div>
    </li>)}</ul>
    {!rows.length && <p>{filter ? "No projects match your search." : archived ? "No archived projects." : "No active projects."}</p>}
    {!archived && <p className="project-library-note">To archive the open project, first open or create another project. Active and Archived lists stay on this device; export a portable archive to keep a separate copy.</p>}
  </section>;
}
