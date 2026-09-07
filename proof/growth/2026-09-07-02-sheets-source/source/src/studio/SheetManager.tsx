import { useEffect, useState } from "react";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Pencil, Download } from "lucide-react";
import { useStudio } from "./store";
import { exportSheetRegister, readSheetLifecycle, saveSheetLifecycle, sheetArchiveImpact, sheetLifecycleStorageKey, sheetSourceIdentity, type SheetAction, type SheetLifecycle } from "./sheetLifecycle.ts";
import { notifySheetLifecycleChanged, SHEET_LIFECYCLE_CHANGED } from "./useSheetLifecycle";
import "./sheetManager.css";

const errorText = (error: unknown) => error instanceof Error && error.name !== "ZodError" ? error.message : "Saved sheet organisation could not be read. The original drawings are preserved.";

export function SheetManager() {
  const job = useStudio(s => s.job), sheet = useStudio(s => s.sheet), hydrated = useStudio(s => s.persistenceHydrated);
  const source = job.documents.find(d => d.id === job.activeDocumentId);
  const identity = source ? sheetSourceIdentity(job.id, source) : null;
  const sourceKey = identity ? sheetLifecycleStorageKey(identity) : "";
  const [saved, setSaved] = useState<SheetLifecycle | null>(null), [error, setError] = useState("");
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [archived, setArchived] = useState(false), [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<number | null>(null), [name, setName] = useState("");
  const [discipline,setDiscipline]=useState(""),[disciplineFilter,setDisciplineFilter]=useState("");
  const [archiveReview, setArchiveReview] = useState<{ key: string; pageIndex: number; job: typeof job; impact: ReturnType<typeof sheetArchiveImpact> } | null>(null);
  const current = saved && sourceKey === sheetLifecycleStorageKey(saved.identity) ? saved : null;
  function refresh() {
    setError(""); setRenaming(null); setArchiveReview(null);
    try { setSaved(identity ? readSheetLifecycle(identity, window.localStorage) : null); }
    catch (failure) { setSaved(null); setError(errorText(failure)); }
  }
  useEffect(() => {
    refresh(); setQuery(""); setDisciplineFilter(""); setArchived(false); setMessage("");
    const update = (event: StorageEvent) => { if (event.key === sourceKey || event.key === null) refresh(); };
    const local = (event: Event) => { if ((event as CustomEvent<{key:string}>).detail?.key === sourceKey) refresh(); };
    window.addEventListener("storage", update);
    window.addEventListener(SHEET_LIFECYCLE_CHANGED, local);
    return () => { window.removeEventListener("storage", update); window.removeEventListener(SHEET_LIFECYCLE_CHANGED, local); };
  }, [sourceKey]);
  async function mutate(action: SheetAction) {
    if (!current || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      if (!navigator.locks) throw Error("Saving sheet organisation is unavailable in this browser. Open X-Ray in its desktop app or a secure browser window.");
      await navigator.locks.request(sourceKey, () => {
        const live = useStudio.getState().job;
        const doc = live.documents.find(d => d.id === live.activeDocumentId);
        const liveIdentity = doc && sheetSourceIdentity(live.id, doc);
        if (!liveIdentity || sheetLifecycleStorageKey(liveIdentity) !== sourceKey) throw Error("The source drawing changed. Reload its sheet list before editing.");
        if (action.type === "archive" && (!archiveReview || archiveReview.key !== sourceKey || archiveReview.pageIndex !== action.pageIndex || archiveReview.job !== live)) throw Error("The project changed after this review. Cancel and review the sheet again before archiving.");
        const next = saveSheetLifecycle(current, action, window.localStorage);
        setSaved(next); setRenaming(null); setArchiveReview(null); notifySheetLifecycleChanged(sourceKey);
        setMessage(action.type === "archive" ? "Sheet archived. Its source and measurements are preserved." : action.type === "recover" ? "Sheet recovered to the active list." : "Sheet organisation saved.");
      });
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }
  function reviewArchive(pageIndex: number) {
    if (!identity) return;
    try {
      const live = useStudio.getState().job;
      setArchiveReview({ key: sourceKey, pageIndex, job: live, impact: sheetArchiveImpact(live, identity, pageIndex) }); setRenaming(null); setError("");
    } catch (failure) { setError(errorText(failure)); }
  }
  async function selectSource(documentId: string) {
    setBusy(true); setError("");
    try { await useStudio.getState().selectDocument(documentId); }
    catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }
  function exportRegister(){
    if(!current||!source)return;
    try{
      const value=readSheetLifecycle(current.identity,localStorage);
      const url=URL.createObjectURL(new Blob([exportSheetRegister(value,source.name)],{type:"application/json"}));
      const link=document.createElement("a");link.href=url;link.download=`${source.name.replace(/[^a-z0-9_-]/gi,"_")}.sheet-register.json`;document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),30000);setMessage("Ordered sheet register exported, including discipline groups, archived pages and saved views.");
    }catch(failure){setError(errorText(failure));}
  }
  const active = current?.pages.filter(p => !p.archived) ?? [];
  const archiveCount = current?.pages.filter(p => p.archived).length ?? 0;
  const pages = current?.pages.filter(p => p.archived === archived && (!disciplineFilter||(p.discipline??"Ungrouped")===disciplineFilter) && `${p.name} ${p.discipline??""} ${p.pageIndex + 1}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())) ?? [];
  const disciplines=[...new Set(current?.pages.map(p=>p.discipline??"Ungrouped")??[])].sort();
  const documents = job.documents.filter(d => d.source !== "sample");
  return <section className="sheet-manager" aria-label="Manage source sheets">
    <div className="sheet-manager-heading"><div><h2>Sheet register</h2><p>Name, arrange and archive pages for this project. Original page numbers stay fixed for evidence links.</p></div>
      <button className="pill" onClick={refresh} disabled={busy}>Reload list</button></div>
    {documents.length > 0 && <label>Source drawing<select aria-label="Source drawing" value={job.activeDocumentId ?? ""} onChange={e => void selectSource(e.target.value)} disabled={busy || !hydrated}>{documents.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
    {error && <p role="alert" className="sheet-manager-notice">{error}</p>}
    {message && <p role="status" className="sheet-manager-notice">{message}</p>}
    {!identity && <p>Import a drawing with verified source pages to organise its sheets.</p>}
    {current && <>
      <div className="sheet-manager-toolbar"><div role="group" aria-label="Sheet list filter"><button className="pill" aria-pressed={!archived} onClick={() => { setArchived(false); setRenaming(null); }}>Active ({active.length})</button><button className="pill" aria-pressed={archived} onClick={() => { setArchived(true); setRenaming(null); }}>Archived ({archiveCount})</button></div><label>Find a sheet<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Name or original page" /></label></div>
      <div className="sheet-manager-toolbar"><label>Discipline group<select aria-label="Filter discipline group" value={disciplineFilter} onChange={e=>setDisciplineFilter(e.target.value)}><option value="">All disciplines</option>{disciplines.map(d=><option key={d}>{d}</option>)}</select></label><button className="pill" disabled={busy||!!query||!!disciplineFilter} onClick={()=>void mutate({type:"group"})}>Group by discipline</button><button className="pill" disabled={busy} aria-label="Export sheet register" onClick={exportRegister}><Download size={14} aria-hidden="true"/>Export sheet register</button></div>
      {archived && <p className="sheet-manager-help">Archived sheets are hidden from active sheet navigation. They remain in the original drawing and evidence. View or recover them here.</p>}
      <ol className="sheet-manager-list">{pages.map((page,index) => <li key={page.pageIndex} data-original-page={page.pageIndex+1} data-discipline={page.discipline??"Ungrouped"}>
        {(index===0||pages[index-1].discipline!==page.discipline)&&<h3 className="sheet-discipline-heading">{page.discipline??"Ungrouped"}</h3>}
        <div className="sheet-manager-title"><strong>{page.name}</strong><span>Original page {page.pageIndex + 1}{sheet === page.pageIndex ? " · Viewing" : ""}{page.bookmarks?.length?` · ${page.bookmarks.length} saved views`:""}</span></div>
        {archiveReview?.key === sourceKey && archiveReview.pageIndex === page.pageIndex ? <div className="sheet-archive-review" role="region" aria-label={`Review archive ${page.name}`}>
          <strong>Archive {page.name}?</strong><p>This removes original page {page.pageIndex + 1} from active sheet navigation. The original drawing and all saved work stay intact. Recover it at any time from Archived.</p>
          <dl><div><dt>Calibrations retained</dt><dd>{archiveReview.impact.calibrations}</dd></div><div><dt>Measured traces retained</dt><dd>{archiveReview.impact.traces}</dd></div><div><dt>Located items retained</dt><dd>{archiveReview.impact.items}</dd></div><div><dt>Annotations retained</dt><dd>{archiveReview.impact.annotations}</dd></div><div><dt>Linked photos retained</dt><dd>{archiveReview.impact.linkedPhotos}</dd></div></dl>
          <p>Estimates and evidence totals are unchanged. Unlinked document photos are also preserved.</p><div className="sheet-manager-actions"><button className="pill" disabled={busy} onClick={() => void mutate({type:"archive",pageIndex:page.pageIndex})}>Confirm archive</button><button className="pill" disabled={busy} onClick={() => setArchiveReview(null)}>Cancel</button></div>
        </div> : renaming === page.pageIndex ? <form className="sheet-manager-rename" onSubmit={e => { e.preventDefault(); void mutate({ type: "rename", pageIndex: page.pageIndex, name, discipline }); }}><label>Sheet name<input autoFocus value={name} onChange={e => setName(e.target.value)} maxLength={120} disabled={busy} /></label><label>Discipline<input list="sheet-discipline-suggestions" value={discipline} onChange={e=>setDiscipline(e.target.value)} maxLength={80} placeholder="Architecture, civil, electrical…" disabled={busy}/></label><datalist id="sheet-discipline-suggestions">{[...new Set(["Architecture","Civil","Electrical","Fire services","Hydraulics","Landscape","Mechanical","Structural",...disciplines.filter(d=>d!=="Ungrouped")])].map(d=><option key={d} value={d}/>)}</datalist><button className="pill" type="submit" disabled={busy || !name.trim()}>Save name</button><button className="pill" type="button" disabled={busy} onClick={() => setRenaming(null)}>Cancel</button></form> : <div className="sheet-manager-actions">
          <button className="pill" disabled={busy || !hydrated} onClick={() => useStudio.getState().setSheet(page.pageIndex)}>View page {page.pageIndex + 1}</button>
          <button className="pill" disabled={busy} aria-label={`Rename ${page.name}`} onClick={() => { setRenaming(page.pageIndex); setName(page.name); setDiscipline(page.discipline??""); }}><Pencil size={14} aria-hidden="true" />Edit sheet</button>
          {!archived && <><button className="pill" disabled={busy || !!query || !!disciplineFilter || active[0]?.pageIndex === page.pageIndex} aria-label={`Move ${page.name} up`} onClick={() => void mutate({ type: "move", pageIndex: page.pageIndex, direction: -1 })}><ArrowUp size={14} aria-hidden="true" /></button><button className="pill" disabled={busy || !!query || !!disciplineFilter || active.at(-1)?.pageIndex === page.pageIndex} aria-label={`Move ${page.name} down`} onClick={() => void mutate({ type: "move", pageIndex: page.pageIndex, direction: 1 })}><ArrowDown size={14} aria-hidden="true" /></button></>}
          <button className="pill" disabled={busy} aria-label={`${archived ? "Recover" : "Archive"} ${page.name}`} onClick={() => archived ? void mutate({ type: "recover", pageIndex: page.pageIndex }) : reviewArchive(page.pageIndex)}>{archived ? <ArchiveRestore size={14} aria-hidden="true" /> : <Archive size={14} aria-hidden="true" />}{archived ? "Recover" : "Archive"}</button>
        </div>}
      </li>)}</ol>
      {!pages.length && <p>{query ? "No sheets match your search." : archived ? "No archived sheets." : "All sheets are archived. Recover a sheet from the Archived list."}</p>}
      <p className="sheet-manager-help">Names, disciplines and order are saved with this source. Group by discipline sorts groups alphabetically, keeping each group's current order. Export includes every original page. Drawing files and original page numbers stay intact.</p>
    </>}
  </section>;
}
