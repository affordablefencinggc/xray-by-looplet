/**
 * Shared rig for the SH-04 live assistant qualification.
 *
 * Both scenario builders import this, so batch 1 (scenarios 02-08, already recorded) and batch 2
 * (scenarios 09 onward) cannot drift apart in how a turn is driven or how freshness is proven.
 * The refactor is behaviour-preserving and that is checked, not assumed: regenerating batch 1
 * reproduces the exact scenario JSON the passing runs consumed, byte for byte.
 *
 * The two properties that make a result mean anything, both learned the hard way:
 *
 *  1. The CDP session reuses one browser profile, so localStorage - and with it the saved project
 *     and conversation - survives between scenario runs. A poller that accepts "any completed
 *     assistant entry" therefore returns the PREVIOUS run's answer within a second or two. Every
 *     turn records a baseline entry count before sending and only accepts entries appended after it.
 *  2. A restored conversation would also change what the app routes, so each scenario starts an
 *     explicit New chat and asserts the conversation is empty before sending.
 *
 * A turn is never re-sent to obtain a more favourable answer.
 */
export const DIR = "proof/growth/2026-09-16-live-assistant-rig";
export const SHOTS = `${DIR}/screenshots`;
export const BASE = "http://127.0.0.1:8085/";

export const READY = "document.querySelector('[data-hydration-status]')?.getAttribute('data-hydration-status')==='ready'";
export const COMPOSER = "textarea[placeholder^=\"Ask anything\"]";
export const SEND = "document.querySelector('button[aria-label=\"Send assistant message\"]')";

/** Return the live chat archive for the current project, with the fields SH-04 needs. */
export const READ = `(async()=>{const h=await import('/src/studio/assistant/chatHistory.ts');const a=await h.readChatArchive(window.__qaJob);
const t=a?.threads.find(x=>x.id===a.activeId);
return {projectId:a?.projectId??null,activeId:a?.activeId??null,threads:(a?.threads??[]).length,busy:t?.busy??null,error:t?.error??null,
workPacket:t?.workPacket?{state:t.workPacket.state,objective:(t.workPacket.objective||'').slice(0,300),nextAction:t.workPacket.nextAction??null,pendingAction:t.workPacket.pendingAction??null,routingFailure:t.workPacket.routing?.failure??null}:null,
entries:(t?.entries??[]).map(e=>({kind:e.kind,tool:e.toolName??null,failed:e.failed??null,origin:e.executionOrigin??null,projectName:e.projectName??null,projectRevision:e.projectRevision??null,text:e.text}))}})()`;

/** The live project revision, so a scenario can prove an edit did or did not land. */
export const REVISION = `(async()=>{const s=await import('/src/studio/store.ts');const j=s.useStudio.getState().job;return {id:j.id,revision:j.revision,name:j.name}})()`;

/** The permission gate's live state: the mode in force and any prompt waiting on the user. */
export const PERMISSIONS = `(async()=>{const p=await import('/src/studio/assistant/permissions.ts');const s=p.usePermissions.getState();
return {mode:s.mode,grants:[...s.grantedForChat],pending:s.pending?{id:s.pending.id,toolName:s.pending.toolName,title:s.pending.title,summary:s.pending.summary}:null}})()`;

/**
 * Fire the archive poll and stash the outcome on window.__qa.
 * The CDP runner's eval does not await a returned promise, so the wait that follows
 * polls a plain boolean instead - the reactive in-DOM telemetry the Fast CDP skill requires.
 *
 * Only entries appended AFTER the pre-send baseline count can satisfy it, so a restored
 * conversation from an earlier run can never be mistaken for this turn's answer.
 */
export const POLL = `(()=>{window.__qa=null;const END=Date.now()+600000;const tick=async()=>{try{const r=await ${READ};
const base=(window.__qaBase&&window.__qaBase.count>=0)?window.__qaBase.count:0;const fresh=r.entries.slice(base);
if(r.busy){if(Date.now()>END){window.__qa={state:'timeout',baseline:base,...r};return}setTimeout(tick,1000);return}
if(fresh.some(e=>e.kind==='assistant')){window.__qa={state:r.error?'done-with-error':'done',baseline:base,newEntryCount:fresh.length,newEntries:fresh,...r};return}
if(r.error&&fresh.length){window.__qa={state:'error',baseline:base,newEntryCount:fresh.length,newEntries:fresh,...r};return}
if(Date.now()>END){window.__qa={state:'timeout',baseline:base,newEntryCount:fresh.length,newEntries:fresh,...r};return}
setTimeout(tick,1000)}catch(e){window.__qa={state:'threw',detail:String(e)}}};tick();return 'polling'})()`;

/** Entry count before the send, so the poll can only accept this turn's appends. */
export const BASELINE = `(()=>{window.__qaBase=null;const tick=async()=>{try{const r=await ${READ};window.__qaBase={count:r.entries.length,kinds:r.entries.map(e=>e.kind)}}catch(e){window.__qaBase={count:-1,reason:String(e)}}};tick();return 'baseline'})()`;

/** Seed a project with one source drawing and a locked calibration, as the SH-05 campaign did. */
export const SEED = `(()=>{window.__qaSeed=null;(async()=>{try{
const store=await import('/src/studio/store.ts');const ws=await import('/src/studio/documentWorkspaces.ts');const domain=await import('/src/studio/domain.ts');
const revision={id:'doc-ground-floor',name:'Ground floor plan rev C.pdf',kind:'pdf',importedAt:new Date().toISOString(),pageCount:3,sha256:'${"c0ffee".repeat(10)}abcd',source:'web'};
const before=store.useStudio.getState().job;
Object.keys(localStorage).filter(k=>k.startsWith('xray.industry-drafts.v1:')).forEach(k=>localStorage.removeItem(k));
const opened=ws.restoreDocumentWorkspace({...before,documents:[...before.documents.filter(d=>d.id!==revision.id),revision]},revision);
const points=[{x:0,y:0},{x:400,y:0}];
const candidate={id:'cand-manual-1',source:'manual',metresPerUnit:0.0125,confidence:1,inputDistance:{value:5,unit:'m'},knownDistanceM:5,points,provenance:{method:'Two-point manual scale',evidence:'Measured between grid lines A and B on the source',documentId:revision.id}};
const calibration={...opened.calibrations[0],metresPerUnit:0.0125,source:'manual',confidence:1,locked:true,knownDistanceM:5,points,inputDistance:{value:5,unit:'m'},candidates:[candidate],selectedCandidateId:candidate.id};
let job;try{job=domain.fencingJobSchema.parse({...opened,calibrations:[calibration,...opened.calibrations.slice(1)]})}catch(failure){throw Error('seed rejected: '+JSON.stringify((failure.issues??[]).slice(0,4)))}
store.useStudio.setState({pane:'cost',job});
window.__qaJob=job.id;
window.__qaSeed={ok:true,jobId:job.id,documents:job.documents.length,activeDocumentId:job.activeDocumentId,calibrations:job.calibrations.length};
}catch(e){window.__qaSeed={ok:false,error:String(e&&e.message||e)}}})();return 'seeding'})()`;

/**
 * Idempotent: the panel's open state survives a reload, so clicking the launcher blindly
 * would close an already-open panel and the composer wait would then time out.
 */
export const openPanel = `(()=>{if(document.querySelector('${COMPOSER}'))return 'already-open';const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Live assistant');if(!b)throw Error('No Live assistant launcher');b.click();return 'opened'})()`;
export const waitPanel = `!!document.querySelector('${COMPOSER}')`;
export const bindJob = `(()=>{window.__qaJob=null;(async()=>{try{const store=await import('/src/studio/store.ts');window.__qaJob=store.useStudio.getState().job.id}catch(e){window.__qaJob='ERR:'+e}})();return 'binding'})()`;

/** Open the add menu so a following step can pick a menu item by its visible text. */
export const OPEN_MENU = [
  ["eval", `(()=>{const b=document.querySelector('button[aria-label="Add to assistant"]');if(!b)throw Error('No add-to-assistant trigger');b.click();return 'menu opened'})()`],
  ["wait", "--fn", "!!document.querySelector('[aria-label=\"Add to assistant menu\"]')", "--timeout", "30000"],
];
/** Scoped to the composer's own menu: [role="menuitem"] also appears in another panel. */
export const CLICK_MENU_ITEM = (label) => `(()=>{const root=document.querySelector('[aria-label="Add to assistant menu"]');if(!root)throw Error('Add menu is not open');const b=[...root.querySelectorAll('[role="menuitem"]')].find(x=>x.textContent.trim()===${JSON.stringify(label)});if(!b)throw Error('No menu item: '+${JSON.stringify(label)});if(b.disabled)throw Error('Menu item disabled: '+${JSON.stringify(label)});b.click();return 'clicked '+${JSON.stringify(label)}})()`;

/** Start a clean conversation and prove it is clean before anything is sent. */
export const freshChat = [
  ...OPEN_MENU,
  ["eval", CLICK_MENU_ITEM("New chat")],
  ["eval", `(()=>{window.__qaEmpty=null;const END=Date.now()+90000;const tick=async()=>{try{const r=await ${READ};
if(!r.entries.length){window.__qaEmpty={ok:true,entries:0,activeId:r.activeId};return}
if(Date.now()>END){window.__qaEmpty={ok:false,entries:r.entries.length,kinds:r.entries.map(e=>e.kind)};return}
setTimeout(tick,500)}catch(e){window.__qaEmpty={ok:false,reason:String(e)}}};tick();return 'awaiting empty conversation'})()`],
  ["wait", "--fn", "!!window.__qaEmpty", "--timeout", "120000"],
  ["eval", `(()=>{const f=window.__qaEmpty;if(!f.ok)throw Error('Conversation was not empty before the turn: '+JSON.stringify(f));return JSON.stringify({conversationEmptyBeforeTurn:true,activeId:f.activeId})})()`],
];

export const compose = (prompt) => `(()=>{const t=document.querySelector('${COMPOSER}');if(!t)throw Error('No composer');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,${JSON.stringify(prompt)});t.dispatchEvent(new Event('input',{bubbles:true}));return 'composed ' + t.value.length + ' chars'})()`;
export const send = `(()=>{${SEND}.click();return 'sent'})()`;
export const waitSendable = `${SEND}?.disabled===false`;
export const assertSeeded = `(()=>{const s=window.__qaSeed;if(!s)throw Error('Seed never resolved');if(!s.ok)throw Error('Seed failed: '+s.error);return JSON.stringify(s)})()`;

/** The provider is forced to MiniMax, matching the recorded live acceptance for this app. */
export const forceProvider = `(()=>{localStorage.setItem('xray:assistant-provider:v2','minimax');location.reload();return 'reloading-with-minimax'})()`;
export const providerCheck = `(()=>{window.__qaProvider=null;(async()=>{try{window.__qaProvider=await (await fetch('/api/minimax-ai')).json()}catch(e){window.__qaProvider={error:String(e)}}})();return 'checking'})()`;
export const providerAssert = `(()=>{const s=window.__qaProvider;if(!s||s.error)throw Error('Provider probe failed: '+JSON.stringify(s));if(!s.available)throw Error('Provider unavailable');if(s.model!=='MiniMax-M3')throw Error('Wrong model: '+s.model);return JSON.stringify({provider:s.provider,model:s.model,stored:localStorage.getItem('xray:assistant-provider:v2')})})()`;

/** Standard preamble: isolated origin, forced provider, verified provider, seeded project, empty chat. */
export const preamble = (name) => [
  ["set", "viewport", "1600", "1000"],
  ["open", BASE],
  ["wait", "--fn", READY, "--timeout", "180000"],
  ["eval", forceProvider],
  ["wait", "--fn", READY, "--timeout", "180000"],
  ["eval", providerCheck],
  ["wait", "--fn", "!!window.__qaProvider", "--timeout", "60000"],
  ["eval", providerAssert],
  ["eval", SEED],
  ["wait", "--fn", "!!window.__qaSeed", "--timeout", "120000"],
  ["eval", assertSeeded],
  ["eval", openPanel],
  ["wait", "--fn", waitPanel, "--timeout", "60000"],
  ["eval", bindJob],
  ["wait", "--fn", "typeof window.__qaJob==='string'", "--timeout", "30000"],
  ...freshChat,
  ["eval", "JSON.stringify({script:" + JSON.stringify(name) + ",jobId:window.__qaJob})"],
];

/** One live turn, ending with the archived outcome and its screenshots. */
export const turn = (prompt, shot) => [
  ["eval", compose(prompt)],
  ["wait", "--fn", waitSendable, "--timeout", "30000"],
  ["eval", BASELINE],
  ["wait", "--fn", "!!window.__qaBase", "--timeout", "30000"],
  ["screenshot", `${SHOTS}/${shot}-composed.png`],
  ["eval", send],
  ["eval", POLL],
  ["wait", "--fn", "!!window.__qa", "--timeout", "600000"],
  ["screenshot", `${SHOTS}/${shot}-replied.png`],
  ["eval", "JSON.stringify(window.__qa)"],
];

/** What the panel actually paints, so an internal marker cannot hide behind the archive. */
export const DOMREAD = `(()=>{const log=document.querySelector('.assistant-conversation[role="log"]')||document.querySelector('.assistant-conversation');
if(!log)throw Error('No assistant conversation log');const rows=[...log.querySelectorAll('.assistant-chat-entry')];
const nodes=rows.length?rows:[...log.children];const texts=nodes.map(x=>(x.textContent||'').trim()).filter(Boolean);
return JSON.stringify({rows:texts.length,markerVisibleToUser:texts.some(t=>t.includes('[xray:withheld-candidate]')),markerInBodyText:document.body.innerText.includes('[xray:withheld-candidate]'),lastEntry:(texts[texts.length-1]||'').slice(0,160)})})()`;

export const ROOF_PROMPT = "Execute calculate_draft_roof_sheet_coverage for this explicit QA rectangle: developedWidthM='8', developedRunM='9.8', effectiveCoverM='0.8', orderLengthM='5', endLapM='0.2', measurementReference='QA synthetic rectangle', supplierReference='QA supplied sheet specification'. Report the actual tool result and explain course steps and lap policy. Use supplied inputs only; do not change project or geometry.";

/**
 * Select a permission mode through the control the user actually works, not by writing storage,
 * so the scenario exercises the real switch and the mode the app then enforces.
 *
 * PermissionControls renders one of two shapes: radio buttons in the wide panel layout, and a
 * <select> when it is compact - which is how LiveAssistant.tsx:1192 mounts it. Both are handled,
 * because assuming the wrong one is exactly how a scenario silently stops testing anything.
 * A React-controlled control ignores a plain value assignment, so the prototype setter is used.
 */
export const setPermissionMode = (label) => `(()=>{
const sel=document.querySelector('select[aria-label="Assistant permissions"]');
if(sel){const opt=[...sel.options].find(o=>o.textContent.trim()===${JSON.stringify(label)});
if(!opt)throw Error('No permission mode option: '+${JSON.stringify(label)});
if(sel.disabled)throw Error('Permission mode select disabled');
Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(sel,opt.value);
sel.dispatchEvent(new Event('change',{bubbles:true}));return 'mode -> '+opt.value}
const b=[...document.querySelectorAll('button.assistant-permission-mode')].find(x=>x.textContent.trim()===${JSON.stringify(label)});
if(!b)throw Error('No permission mode control for: '+${JSON.stringify(label)});
if(b.disabled)throw Error('Permission mode control disabled: '+${JSON.stringify(label)});
b.click();return 'mode -> '+${JSON.stringify(label)}})()`;
/**
 * Read the mode the app is actually enforcing back into window.__qaMode.
 *
 * PERMISSIONS is a call expression that evaluates to a promise, not a promise literal, so it must
 * be awaited: without the await, p is the promise itself and p.mode is undefined, which reads as
 * "the mode was never set" and stalls the following wait rather than failing it.
 */
export const permissionModeIs = (mode) => `(()=>{window.__qaMode=null;(async()=>{try{const p=await ${PERMISSIONS};window.__qaMode=p.mode}catch(e){window.__qaMode='ERR:'+String(e)}})();return 'reading-mode'})()`;
export const assertPermissionMode = (mode) => `(()=>{if(window.__qaMode!==${JSON.stringify(mode)})throw Error('Permission mode is '+window.__qaMode+', expected '+${JSON.stringify(mode)});return 'permission mode confirmed: '+window.__qaMode})()`;
