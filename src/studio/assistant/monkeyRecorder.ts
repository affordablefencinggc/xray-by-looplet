import { create } from 'zustand';
import { browserSingleton } from '../browserSingleton';
import { useStudio } from '../store';
import { appendMonkeyEvent, monkeyArchiveSchema, monkeyKey, stopMonkey, type MonkeyRecording } from './monkeyWorkflow';

const singleton=browserSingleton('xray.monkey-recorder.v1',()=>({
  store:create<{records:MonkeyRecording[];error:string}>(()=>({records:[],error:''})), projectId:'', owner:'',
}));
const runtime=singleton.value;
export const useMonkeyRecorder=runtime.store;
function load(projectId:string) {
  runtime.projectId=projectId;
  try {runtime.store.setState({records:monkeyArchiveSchema.parse(JSON.parse(localStorage.getItem(monkeyKey(projectId))||'[]')),error:''});}
  catch {runtime.store.setState({records:[],error:'The action recording could not be read. Existing data has been preserved; recording is unavailable.'});}
}
export function updateMonkey(record:MonkeyRecording) {
  if(runtime.projectId!==record.projectId)throw Error('Return to the recorded project first.');
  const state=runtime.store.getState();
  if(state.error)throw Error(state.error);
  const rows=monkeyArchiveSchema.parse(state.records.some(r=>r.id===record.id)?state.records.map(r=>r.id===record.id?record:r):[...state.records,record]);
  try {localStorage.setItem(monkeyKey(record.projectId),JSON.stringify(rows));}
  catch {runtime.store.setState({error:'Recording storage is full or unavailable. Capture has stopped; earlier saved actions are preserved.'});throw Error(runtime.store.getState().error);}
  runtime.store.setState({records:rows});
}
export function startMonkey(projectId:string):MonkeyRecording {
  if(runtime.projectId!==projectId)load(projectId);
  const current=runtime.store.getState();
  if(current.error)throw Error(current.error);
  const active=current.records.find(r=>r.status==='recording');
  if(active){if(active.owner!==runtime.owner)throw Error('This project is being recorded in another tab. Stop it there first.');return active;}
  if(current.records.length>=20)throw Error('This project already has 20 recordings. Earlier recordings are preserved.');
  const record:MonkeyRecording={id:crypto.randomUUID(),projectId,owner:runtime.owner,startedAt:new Date().toISOString(),status:'recording',events:[]};
  updateMonkey(record);return record;
}
export function finishMonkey():MonkeyRecording {
  const rows=runtime.store.getState().records;
  const record=rows.find(r=>r.status==='recording')||rows.filter(r=>r.status==='review').at(-1);
  if(!record)throw Error('Start with /monkeysee and demonstrate a workflow first.');
  if(record.owner!==runtime.owner&&record.status==='recording')throw Error('Stop the recording in the tab where it was started.');
  const next=stopMonkey(record,new Date().toISOString());updateMonkey(next);return next;
}
function capture(action:string) {
  const state=runtime.store.getState();
  const record=state.records.find(r=>r.status==='recording'&&r.owner===runtime.owner);
  if(!record||state.error)return;
  const studio=useStudio.getState();
  if(studio.job.id!==record.projectId||!studio.persistenceHydrated||studio.persistenceRecoveryBlocked)return;
  try {updateMonkey(appendMonkeyEvent(record,{at:new Date().toISOString(),action:action.slice(0,400),pane:studio.pane,sheet:studio.sheet+1,revision:studio.job.revision}));}
  catch {/* Persistent status explains stopped capture. */}
}
if(singleton.created&&typeof window!=='undefined') {
  try {runtime.owner=sessionStorage.getItem('xray:monkey-tab')||crypto.randomUUID();sessionStorage.setItem('xray:monkey-tab',runtime.owner);}
  catch {runtime.owner=crypto.randomUUID();}
  load(useStudio.getState().job.id);
  useStudio.subscribe((state,previous)=>{
    if(state.job.id!==previous.job.id) {
      const active=runtime.store.getState().records.find(r=>r.status==='recording'&&r.owner===runtime.owner);
      if(active)try{updateMonkey(stopMonkey(active,new Date().toISOString(),'Stopped because the project changed.'));}catch{/* Status preserved. */}
      load(state.job.id);return;
    }
    if(state.pane!==previous.pane)capture(`Opened workspace: ${state.pane}`);
    if(state.sheet!==previous.sheet)capture(`Selected source PDF page ${state.sheet+1}`);
    if(state.job.revision!==previous.job.revision)capture(`Project revision changed: ${previous.job.revision} → ${state.job.revision}; persistence must be checked separately`);
  });
  window.addEventListener('storage',e=>{if(e.key===monkeyKey(runtime.projectId))load(runtime.projectId);});
  const eligible=(event:Event)=>event.isTrusted&&event.target instanceof Element&&!event.target.closest('.live-assistant, input[type=password], [contenteditable=true]');
  document.addEventListener('click',event=>{
    if(!eligible(event))return;
    const target=(event.target as Element).closest('button, a, summary, [role=button]');
    if(!target)return;
    const label=target.getAttribute('aria-label')||target.textContent||target.getAttribute('title')||'';
    if(label.trim())capture(`Clicked ${label.trim().replace(/\s+/g,' ').slice(0,180)} (click observed; outcome not assumed)`);
  },true);
  document.addEventListener('change',event=>{
    if(!eligible(event))return;
    const target=event.target;
    if(!(target instanceof HTMLInputElement||target instanceof HTMLSelectElement))return;
    const label=target.getAttribute('aria-label')||target.labels?.[0]?.textContent?.trim()||target.name||'field';
    const value=target instanceof HTMLInputElement&&['checkbox','radio'].includes(target.type)?String(target.checked):target instanceof HTMLInputElement&&['number','range'].includes(target.type)?target.value:'value not captured';
    capture(`Changed ${label.slice(0,100)}: ${value.slice(0,80)}`);
  },true);
  document.addEventListener('pointerup',event=>{
    if(!eligible(event))return;
    const surface=(event.target as Element).closest('canvas,svg');if(!surface||surface.closest('button'))return;
    const rect=surface.getBoundingClientRect();if(!rect.width||!rect.height)return;
    capture(`Canvas pointer released at normalised x=${((event.clientX-rect.left)/rect.width).toFixed(4)}, y=${((event.clientY-rect.top)/rect.height).toFixed(4)}; surface ${Math.round(rect.width)}×${Math.round(rect.height)}; gesture only, geometry not inferred`);
  },true);
}
