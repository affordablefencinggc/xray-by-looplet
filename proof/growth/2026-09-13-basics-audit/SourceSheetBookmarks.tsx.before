import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BookmarkPlus, Navigation, Trash2 } from "lucide-react";
import { useStudio } from "./store";
import { captureSheetBookmark, restoreSheetBookmark, type SheetBookmark } from "./sheetBookmarks.ts";
import { readSheetLifecycle, saveSheetLifecycle, sheetLifecycleStorageKey, sheetSourceIdentity, type SheetAction } from "./sheetLifecycle.ts";
import { notifySheetLifecycleChanged, useSheetLifecycle } from "./useSheetLifecycle.ts";
import "./sheetBookmarks.css";

/** Mount once beside a Measure/Sketch DocumentPreview. Page identity remains the original source index. */
export function SheetBookmarks(){
  const job=useStudio(s=>s.job),sheet=useStudio(s=>s.sheet),hydrated=useStudio(s=>s.persistenceHydrated);
  const source=job.documents.find(d=>d.id===job.activeDocumentId);
  const {value,error:readError,reload}=useSheetLifecycle(job.id,source);
  const identity=source?sheetSourceIdentity(job.id,source):null,key=identity?sheetLifecycleStorageKey(identity):"";
  const [name,setName]=useState(""),[message,setMessage]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const [restoring,setRestoring]=useState<{key:string;pageIndex:number;bookmark:SheetBookmark}|null>(null);
  const flight=useRef(false);
  useEffect(()=>{setName("");setMessage("");setError("");},[key]);
  useLayoutEffect(()=>{
    if(!restoring||restoring.key!==key)return;
    const viewport=document.querySelector('.measure-document-preview .document-preview-viewport');if(!viewport)return;
    let applying=false;
    const apply=()=>{
      const live=useStudio.getState();if(live.sheet!==restoring.pageIndex)return;
      const size=viewport.getBoundingClientRect();if(size.width<=0||size.height<=0)return;
      const view=restoreSheetBookmark(restoring.bookmark,size);
      applying=true;try{live.setZoom2d(view.zoom);live.setPan2d(view.pan);}finally{applying=false;}
    };
    apply();const observer=new ResizeObserver(apply);observer.observe(viewport);
    const unsubscribe=useStudio.subscribe((next,previous)=>{
      if(!applying&&(next.zoom2d!==previous.zoom2d||next.pan2d!==previous.pan2d||next.sheet!==restoring.pageIndex||next.job.activeDocumentId!==source?.id))setRestoring(null);
    });
    return()=>{observer.disconnect();unsubscribe();};
  },[restoring,key]);
  function problem(failure:unknown){setError(failure instanceof Error&&failure.name!=="ZodError"?failure.message:"The saved view did not pass validation. Existing saved views are unchanged.");}
  async function change(action:SheetAction){
    if(!value||flight.current)return;
    flight.current=true;setBusy(true);setError("");setMessage("");
    try{
      if(!navigator.locks)throw Error("Safe saved-view storage is unavailable in this browser. Use the desktop app or a secure browser connection.");
      await navigator.locks.request(key,()=>{
        const live=useStudio.getState(),doc=live.job.documents.find(d=>d.id===live.job.activeDocumentId),actual=doc&&sheetSourceIdentity(live.job.id,doc);
        if(!actual||sheetLifecycleStorageKey(actual)!==key||(action.type==="bookmark"&&live.sheet!==action.pageIndex))throw Error("The source page changed. Save its view again after it finishes loading.");
        saveSheetLifecycle(value,action,localStorage);notifySheetLifecycleChanged(key);
        setMessage(action.type==="bookmark"?"Saved view stored with this original page. It will remain available after reopening X-Ray.":"Saved view removed. The source page and drawing work are unchanged.");
        if(action.type==="bookmark")setName("");
      });
    }catch(failure){problem(failure);}finally{flight.current=false;setBusy(false);}
  }
  function save(){
    try{
      const live=useStudio.getState(),preview=document.querySelector<HTMLElement>('.measure-document-preview[data-source-ready="true"]');
      const image=preview?.querySelector<HTMLElement>('.document-source-page'),rendered=image?.getBoundingClientRect();
      if(!rendered||!live.showSrc)throw Error("Wait for the visible original source page before saving a view.");
      const bookmark=captureSheetBookmark(name,live.zoom2d,live.pan2d,rendered);
      void change({type:"bookmark",pageIndex:live.sheet,bookmark});
    }catch(failure){problem(failure);}
  }
  function open(pageIndex:number,bookmark:SheetBookmark){
    setError("");setMessage("");
    try{
      if(!identity)throw Error("Open the original source drawing before using this saved view.");
      const live=useStudio.getState();
      if(live.pending.length||live.calibrationCapture)throw Error("Finish or cancel the current drawing/calibration before opening a saved view.");
      const actualDoc=live.job.documents.find(d=>d.id===live.job.activeDocumentId),actual=actualDoc&&sheetSourceIdentity(live.job.id,actualDoc);
      if(!actual||sheetLifecycleStorageKey(actual)!==key)throw Error("The source drawing changed. Reload its saved views.");
      const latest=readSheetLifecycle(identity,localStorage),page=latest.pages.find(p=>p.pageIndex===pageIndex);
      const saved=page?.bookmarks?.find(b=>b.id===bookmark.id);
      if(!saved)throw Error("This saved view was removed in another window. Reload the list.");
      const viewport=document.querySelector('.measure-document-preview .document-preview-viewport')?.getBoundingClientRect();
      if(!viewport)throw Error("The drawing viewport is not ready.");
      restoreSheetBookmark(saved,viewport);
      live.setTool("none");live.setSheet(pageIndex);setRestoring({key,pageIndex,bookmark:saved});
      if(!live.showSrc)live.toggle("showSrc");
      setMessage(`Opened ${saved.name} on original page ${pageIndex+1}${page?.archived?" (archived sheet)":""}.`);
    }catch(failure){problem(failure);}
  }
  const bookmarks=value?.pages.flatMap(page=>(page.bookmarks??[]).map(bookmark=>({page,bookmark})))??[];
  return <section className="sheet-bookmarks" aria-label="Saved source views" data-saved-view-count={bookmarks.length} data-restored-view={restoring?.bookmark.id??""}>
    <form onSubmit={e=>{e.preventDefault();save();}}><label>Save this page view<input aria-label="Saved view name" value={name} onChange={e=>setName(e.target.value)} maxLength={120} placeholder={`Page ${sheet+1} detail`} disabled={busy}/></label><button className="pill" type="submit" disabled={!value||!hydrated||busy||!name.trim()}><BookmarkPlus size={15} aria-hidden="true"/>Save view</button></form>
    {(error||readError)&&<p role="alert">{error||readError}<button className="pill" onClick={()=>{reload();setError("");}} disabled={busy}>Reload saved views</button></p>}
    {message&&<p role="status">{message}</p>}
    <details><summary>Saved views ({bookmarks.length})</summary><p className="sheet-bookmarks-help">Saved locally with this source and included in project backups. A view keeps its original page, zoom and centre when the window size changes.</p>
      {!bookmarks.length?<p>No saved views yet. Zoom or pan to a detail, give it a name and save.</p>:<ul>{bookmarks.map(({page,bookmark})=><li key={bookmark.id}><div><strong>{bookmark.name}</strong><span>{page.name} · Original page {page.pageIndex+1} · {Math.round(bookmark.zoom*100)}%{page.archived?" · Archived":""}</span></div><button className="pill" aria-label={`Open saved view ${bookmark.name}`} disabled={busy} onClick={()=>open(page.pageIndex,bookmark)}><Navigation size={14} aria-hidden="true"/>Open</button><button className="pill" aria-label={`Remove saved view ${bookmark.name}`} disabled={busy} onClick={()=>void change({type:"remove-bookmark",pageIndex:page.pageIndex,bookmarkId:bookmark.id})}><Trash2 size={14} aria-hidden="true"/>Remove</button></li>)}</ul>}
    </details>
  </section>;
}
