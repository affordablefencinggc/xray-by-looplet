import { useState } from 'react';
import { confirmMonkey, monkeyFacts, nameMonkey, type MonkeyRecording } from './monkeyWorkflow';
import { TopDownMindMap } from './TopDownMindMap';
import { updateMonkey } from './monkeyRecorder';
import { storeAssistantFile } from './attachmentFiles';
import { ReplyBlocks } from './ReplyBlocks';

export function MonkeyPanel({record,error,busy,onReview,onSaved}:{record?:MonkeyRecording;error:string;busy:boolean;onReview:()=>void;onSaved:()=>void}) {
  const [name,setName]=useState(''),[message,setMessage]=useState(''),[saving,setSaving]=useState(false);
  if(!record&&!error)return null;
  const facts=record?monkeyFacts(record):null;
  const act=(fn:()=>void)=>{try{fn();setMessage('');}catch(e){setMessage(String(e));}};
  return <section className="assistant-monkey" aria-label="Monkey see, monkey do">
    {record&&<>
      <div className="assistant-monkey-bar"><strong>{error?'Recording needs attention':record.status==='recording'?'● Recording X-Ray actions':record.status==='saved'?`Workflow saved: ${record.name}`:'Monkey see, monkey do'}</strong><small>{record.events.length} actions</small>
        {['recording','review'].includes(record.status)&&<button type="button" disabled={(busy&&record.status!=='recording')||saving||!!error} onClick={onReview}>{record.status==='recording'?'Stop & review':record.review?'Review again':'Review with assistant'}</button>}
      </div>
      {record.note&&<small>{record.note}</small>}
      <details><summary>Recorded actions{record.review?' and review':''}</summary>
        <p>{facts!.clicks} clicks · {facts!.workspaceTransitions} workspace transitions · {facts!.otherEvents} other events</p>
        <p>Sequence: {facts!.sequence.join(' → ') || 'No workspace events yet'}</p>
        {facts!.sequence.length>0&&<TopDownMindMap label="Recorded sequence" root={{label:'Observed workspace sequence',children:facts!.sequence.slice(0,20).map((pane,i)=>({label:`${i+1}. ${pane}`,children:[]}))}}/>}
        {facts!.sequence.length>20&&<small>Map shows the first 20 positions; the full event list follows.</small>}
        <p>Local X-Ray actions only. Text entry, passwords, other apps and screen video are not recorded. Clicks and canvas positions do not prove geometry or successful edits.</p>
        <ol>{record.events.map((e,i)=><li key={i}>{e.action} <small>· {e.pane} · page {e.sheet}</small></li>)}</ol>
        {record.review&&<ReplyBlocks text={record.review}/>}
      </details>
      {record.status==='review'&&record.review&&<button type="button" disabled={busy||!!error} onClick={()=>act(()=>updateMonkey(confirmMonkey(record)))}>Confirm workflow</button>}
      {record.status==='confirmed'&&<form onSubmit={async e=>{
        e.preventDefault();if(saving)return;setSaving(true);setMessage('');
        try {
          const named=nameMonkey(record,name);
          const filename=`${named.name!.replace(/[^a-zA-Z0-9 _-]/g,'_')}.monkey.json`;
          const file=await storeAssistantFile(record.projectId,new File([JSON.stringify({schema:'xray.monkey-workflow/v1',...named},null,2)],filename,{type:'application/json'}));
          updateMonkey({...named,fileId:file.id});setName('');onSaved();
        }catch(e){setMessage(e instanceof Error?e.message:String(e));}finally{setSaving(false);}
      }}><label>Name this workflow<input value={name} maxLength={80} onChange={e=>setName(e.target.value)} disabled={saving}/></label><button disabled={saving||busy||!name.trim()||!!error}>Save named workflow</button></form>}
    </>}
    {(error||message)&&<p role="alert">{error||message}</p>}
  </section>;
}
