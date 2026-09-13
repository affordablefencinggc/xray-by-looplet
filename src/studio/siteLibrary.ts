import {inspectSiteFile} from './siteFile.ts';

export const SITE_LIBRARY_DB='xray-project-sites-v1';
export interface SavedSiteSummary {id:string;projectId:string;name:string;address:string|null;savedAt:string;sha256:string;sizeBytes:number}
const scope=(projectId:string)=>{if(typeof projectId!=='string'||!projectId.trim()||projectId.length>200)throw Error('Choose a project before saving or opening a site.');};
const digest=async(bytes:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
function database():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB){reject(Error('Device site storage is unavailable. Keep your exported GLB file.'));return;}
  let failed=false;
  const request=indexedDB.open(SITE_LIBRARY_DB,1);
  request.onupgradeneeded=()=>{
   const summaries=request.result.createObjectStore('summaries',{keyPath:['projectId','id']});
   summaries.createIndex('projectSavedAt',['projectId','savedAt','id']);
   request.result.createObjectStore('files');
  };
  request.onsuccess=()=>{if(failed)request.result.close();else resolve(request.result);};
  request.onerror=()=>{failed=true;reject(request.error??Error('Device site storage could not open.'));};
  request.onblocked=()=>{failed=true;reject(Error('Site storage is blocked by another open app window.'));};
 });
}
function summary(value:unknown,projectId:string):SavedSiteSummary{
 const r=value as SavedSiteSummary|null;
 if(!r||r.projectId!==projectId||typeof r.id!=='string'||!r.id||typeof r.name!=='string'||!r.name.trim()||r.name.length>200||!(r.address===null||typeof r.address==='string')||typeof r.savedAt!=='string'||!Number.isFinite(Date.parse(r.savedAt))||typeof r.sha256!=='string'||!/^[a-f0-9]{64}$/.test(r.sha256)||!Number.isSafeInteger(r.sizeBytes)||r.sizeBytes<20||r.sizeBytes>32*1024*1024)throw Error('Saved site information is invalid or belongs to another project. Original data is preserved.');
 return r;
}
function completed(tx:IDBTransaction):Promise<void>{return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??Error('Site storage transaction was aborted.'));tx.onerror=()=>reject(tx.error??Error('Site storage transaction failed.'));});}

/** Immutable, device/origin-local snapshot. No project/customer data leaves this device. */
export async function saveSite(projectId:string,input:{bytes:ArrayBuffer;name:string}):Promise<SavedSiteSummary>{
 scope(projectId);
 if(typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>200)throw Error('Give the site a name of up to 200 characters.');
 if(!(input.bytes instanceof ArrayBuffer)||input.bytes.byteLength>32*1024*1024)throw Error('Choose a Looplet site file smaller than 32 MB.');
 const bytes=input.bytes.slice(0),site=inspectSiteFile(bytes);
 const saved:SavedSiteSummary={id:crypto.randomUUID(),projectId,name:input.name.trim(),address:site.address,savedAt:new Date().toISOString(),sha256:await digest(bytes),sizeBytes:bytes.byteLength};
 const db=await database();
 try{const tx=db.transaction(['summaries','files'],'readwrite'),done=completed(tx);tx.objectStore('summaries').add(saved);tx.objectStore('files').add(bytes,[projectId,saved.id]);await done;return saved;}finally{db.close();}
}

/** Bounded summaries only: opening the list never loads twenty large GLB buffers. */
export async function listSites(projectId:string):Promise<SavedSiteSummary[]>{
 scope(projectId);const db=await database();
 try{
  const tx=db.transaction('summaries','readonly'),done=completed(tx),rows:SavedSiteSummary[]=[];
  const request=tx.objectStore('summaries').index('projectSavedAt').openCursor(IDBKeyRange.bound([projectId,'',''],[projectId,'\uffff','\uffff']),'prev');
  let invalid:unknown;
  request.onsuccess=()=>{try{const cursor=request.result;if(!cursor||rows.length>=20)return;rows.push(summary(cursor.value,projectId));if(rows.length<20)cursor.continue();}catch(e){invalid=e;tx.abort();}};
  try{await done;}catch(e){throw invalid??e;}return rows;
 }finally{db.close();}
}

export async function loadSite(projectId:string,id:string):Promise<{summary:SavedSiteSummary;bytes:ArrayBuffer;site:ReturnType<typeof inspectSiteFile>}>{
 scope(projectId);if(typeof id!=='string'||!id||id.length>200)throw Error('Choose a saved site.');
 const db=await database();let raw:unknown,bytes:unknown;
 try{const tx=db.transaction(['summaries','files'],'readonly'),done=completed(tx);const a=tx.objectStore('summaries').get([projectId,id]),b=tx.objectStore('files').get([projectId,id]);a.onsuccess=()=>{raw=a.result;};b.onsuccess=()=>{bytes=b.result;};await done;}finally{db.close();}
 if(!raw)throw Error('This site is not saved in the current project on this device.');
 const saved=summary(raw,projectId);
 if(saved.id!==id||!(bytes instanceof ArrayBuffer)||bytes.byteLength!==saved.sizeBytes)throw Error('Saved site data is incomplete. Original data is preserved.');
 const site=inspectSiteFile(bytes);
 if(await digest(bytes)!==saved.sha256||site.address!==saved.address)throw Error('Saved site integrity check failed. Original data is preserved.');
 return {summary:saved,bytes,site};
}
