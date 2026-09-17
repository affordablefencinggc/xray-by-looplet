/**
 * Post-fix verification of the defect register (D1-D8), batch 3: scenarios 20-22.
 * Run with: node proof/growth/2026-09-16-live-assistant-rig/build-scenarios-defects.mjs
 *
 * These are the three behaviours the sweep recorded as never once observed live:
 *
 *   20  D3  a tools-prohibited objective on a NON-discussion route. Scenario 08 delivered no answer
 *           at all: the app removed every tool the required step needed, demanded the step anyway,
 *           and discarded the reply. Same objective, verbatim, so the two runs are comparable.
 *   21  D8  the REFUSE half of read-only mode. Scenario 09 recorded the admit half by accident -
 *           `navigate_workspace` ran and switched the user's pane under read-only - and the review
 *           page corrects its own earlier claim that a refusal had been shown. This puts an
 *           effect-bearing, non-editing tool in front of read-only mode deliberately.
 *   22  D8  the same tool in front of ask mode, which is also where D4's user-facing title lands:
 *           the prompt the user reads must name the workspace move, not the raw tool id.
 *
 * The rig is shared with batches 1 and 2 (rig.mjs), so a turn is driven identically. As in both
 * earlier batches: a turn is never re-sent to obtain a more favourable answer.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import {
  DIR, SHOTS, READ, PERMISSIONS, POLL,
  preamble, turn, compose, send, waitSendable, BASELINE,
  setPermissionMode, permissionModeIs, assertPermissionMode,
} from "./rig.mjs";

mkdirSync(`${DIR}/scenarios`, { recursive: true });
mkdirSync(SHOTS, { recursive: true });

/** The pane the workspace is actually showing, so a navigation either landed or it did not. */
const PANE = `(async()=>{const s=await import('/src/studio/store.ts');const st=s.useStudio.getState();return {pane:st.pane}})()`;
const readPane = (slot) => `(()=>{window.${slot}=null;(async()=>{try{window.${slot}=await ${PANE}}catch(e){window.${slot}={error:String(e)}}})();return 'reading pane'})()`;
const assertSlot = (slot) => `(()=>{const v=window.${slot};if(!v)throw Error('${slot} never resolved');if(v.error)throw Error('${slot} failed: '+v.error);return JSON.stringify(v)})()`;

/** The pane must be exactly what it was: proof that the navigation never reached the workspace. */
const paneUnchanged = (before, after, label) => `(()=>{const a=window.${before},b=window.${after};
if(!a||!b||a.error||b.error)throw Error('Pane read failed: '+JSON.stringify({a,b}));
if(a.pane!==b.pane)throw Error(${JSON.stringify(label)}+': the workspace moved from '+a.pane+' to '+b.pane+' although the mode forbade it');
return JSON.stringify({label:${JSON.stringify(label)},pane:a.pane,unchanged:true})})()`;

/** Which tools the turn ran, and the reply the user actually received. */
const toolReport = `(()=>{const a=window.__qa;if(!a)throw Error('No turn archive');
const fresh=(a.newEntries||[]).length?a.newEntries:(a.entries||[]);
const rows=fresh.filter(e=>e.kind==='tool');
const reply=fresh.filter(e=>e.kind==='assistant').map(e=>e.text||'').join('\\n\\n');
return JSON.stringify({state:a.state,error:a.error??null,
tools:rows.map(r=>({tool:r.tool,failed:r.failed===true,text:(r.text||'').slice(0,300)})),
replyLength:reply.length})})()`;

const replyText = `(()=>{const a=window.__qa;if(!a)throw Error('No turn archive');
const fresh=(a.newEntries||[]).length?a.newEntries:(a.entries||[]);
return fresh.filter(e=>e.kind==='assistant').map(e=>e.text||'').join('\\n\\n')})()`;

/** What the panel painted, so an archive-only claim cannot stand in for what the user saw. */
const DOMREAD = `(()=>{const log=document.querySelector('.assistant-conversation[role="log"]')||document.querySelector('.assistant-conversation');
if(!log)throw Error('No assistant conversation log');
const rows=[...log.querySelectorAll('.assistant-chat-entry')];const nodes=rows.length?rows:[...log.children];
const texts=nodes.map(x=>(x.textContent||'').trim()).filter(Boolean);
return JSON.stringify({rows:texts.length,lastEntry:(texts[texts.length-1]||'').slice(0,400)})})()`;

const NAVIGATE_PROMPT = "Switch the workspace to the Measure pane.";

/** The live project revision, so a navigation turn can also be shown not to have saved anything. */
const readRevision = (slot) => `(()=>{window.${slot}=null;(async()=>{try{const s=await import('/src/studio/store.ts');const j=s.useStudio.getState().job;window.${slot}={id:j.id,revision:j.revision}}catch(e){window.${slot}={error:String(e)}}})();return 'reading revision'})()`;

const scenarios = {};

// --- 20: D3, verbatim the scenario-08 objective. Pre-fix this produced no assistant answer at all,
//         workPacket.state='blocked', and the error "Workflow incomplete after two correction
//         attempts." Post-fix the three-word answer must reach the user. ---
scenarios["20-d3-no-tool-answer-delivered"] = [
  ...preamble("20-d3-no-tool-answer-delivered"),
  ...turn("No tools. Reply with exactly: LIVE TURN OK", "20-d3-no-tool-answer"),
  ["eval", toolReport],
  ["eval", `(()=>{const a=window.__qa;if(!a)throw Error('No turn archive');
const fresh=(a.newEntries||[]).length?a.newEntries:(a.entries||[]);
const reply=fresh.filter(e=>e.kind==='assistant').map(e=>e.text||'').join('\\n\\n');
// The defect was that the answer was withheld and an error banner shown instead. Both halves are
// asserted: the answer is present, and no correction-limit error was raised.
if(!/LIVE TURN OK/.test(reply))throw Error('The requested three-word answer never reached the user. Reply: '+JSON.stringify(reply));
if(a.error)throw Error('The turn still failed: '+a.error);
if(/Workflow incomplete/.test(String(a.error||'')))throw Error('The unsatisfiable-workflow error is still raised for a tools-prohibited turn');
const rows=fresh.filter(e=>e.kind==='tool');
if(rows.length)throw Error('Tools ran although the user prohibited them: '+JSON.stringify(rows.map(r=>r.tool)));
return JSON.stringify({answerDelivered:true,workflowIncompleteError:false,toolsRun:0,replyLength:reply.length})})()`],
  ["eval", replyText],
  ["eval", DOMREAD],
  ["errors"],
];

// --- 21: D8 refuse half. Read-only mode must refuse an effect-bearing tool that is NOT a project
//         edit. navigate_workspace stays declared in read-only (assistantToolAllowed is true for it,
//         deliberately), so the model can attempt it and the runtime gate is the only thing that
//         can stop it. Pre-fix scenario 09 recorded it switching the pane to 'measure'. ---
scenarios["21-d8-readonly-refuses-navigation"] = [
  ...preamble("21-d8-readonly-refuses-navigation"),
  ["eval", setPermissionMode("Read only")],
  ["eval", permissionModeIs("readonly")],
  ["wait", "--fn", "typeof window.__qaMode==='string'", "--timeout", "30000"],
  ["eval", assertPermissionMode("readonly")],
  ["eval", readPane("__qaPaneBefore")],
  ["wait", "--fn", "!!window.__qaPaneBefore", "--timeout", "30000"],
  ["eval", assertSlot("__qaPaneBefore")],
  ["screenshot", `${SHOTS}/21-readonly-mode-selected.png`],
  ...turn(NAVIGATE_PROMPT, "21-d8-readonly-refuses-navigation"),
  ["eval", readPane("__qaPaneAfter")],
  ["wait", "--fn", "!!window.__qaPaneAfter", "--timeout", "30000"],
  ["eval", paneUnchanged("__qaPaneBefore", "__qaPaneAfter", "read-only navigation")],
  ["eval", toolReport],
  ["eval", `(()=>{const a=window.__qa;if(!a)throw Error('No turn archive');
const fresh=(a.newEntries||[]).length?a.newEntries:(a.entries||[]);
const rows=fresh.filter(e=>e.kind==='tool');
const reply=fresh.filter(e=>e.kind==='assistant').map(e=>e.text||'').join('\\n\\n');
const navigated=rows.filter(r=>r.tool==='navigate_workspace'&&r.failed!==true);
if(navigated.length)throw Error('navigate_workspace reported success under read-only mode: '+JSON.stringify(navigated.map(r=>(r.text||'').slice(0,200))));
// Reported, not asserted: whether the model attempted the tool at all is the model's choice on the
// turn. The hard property is that the workspace did not move and no call succeeded. If it did
// attempt, the refusal text must be visible rather than an unexplained silence.
const attempted=rows.filter(r=>r.tool==='navigate_workspace');
const refused=/read-only|read only|readonly/i.test(rows.map(r=>r.text||'').join(' '))||/read-only|read only|readonly/i.test(reply);
return JSON.stringify({navigateToolsSucceeded:0,navigateAttempts:attempted.length,refusalVisible:refused,
attempts:attempted.map(r=>({failed:r.failed===true,text:(r.text||'').slice(0,300)})),replyLength:reply.length,error:a.error??null})})()`],
  ["eval", replyText],
  ["eval", DOMREAD],
  ["errors"],
];

// --- 22: D8 gate entry + D4 title. Ask mode must present the prompt for an effect-bearing tool,
//         and the prompt the user reads must name the move in their own terms. Deny must leave the
//         pane exactly where it was.
//
//         The instrument is the CARD, not the store. `pending` lives in memory only, and a module
//         instance the page did not itself load reads it as null while the card is painted - which
//         is exactly what happened on the first two attempts (diagnostic run 23b: denyButton true,
//         storePending null). The card's own text is also the stronger evidence for D4, because it
//         is literally the sentence the user reads before deciding. ---
const POLL_CARD = `(()=>{window.__qaPerm=null;const END=Date.now()+180000;const started=Date.now();const tick=async()=>{try{
const p=await ${PERMISSIONS};const r=await ${READ};
const base=(window.__qaBase&&window.__qaBase.count>=0)?window.__qaBase.count:0;const fresh=r.entries.slice(base);
const card=document.querySelector('.assistant-permission-card');
const storePending=p.pending?{toolName:p.pending.toolName,title:p.pending.title,summary:p.pending.summary}:null;
const log=document.querySelector('.assistant-conversation[role="log"]')||document.querySelector('.assistant-conversation');
const rows=log?[...log.querySelectorAll('.assistant-chat-entry')].map(x=>(x.textContent||'').trim()):[];
const base_={outcome:null,elapsedMs:Date.now()-started,mode:p.mode,storePending,baseline:base,
cardTitle:card?((card.querySelector('strong')||{}).textContent||'').trim():null,
cardSummary:card?((card.querySelector('span')||{}).textContent||'').trim():null,
workingIndicator:/Assistant is working/i.test(document.body.innerText),
renderedRows:rows.length,renderedTail:rows.slice(-2)};
if(card){window.__qaPerm={...base_,outcome:'permission-card'};return}
if(!r.busy&&r.error){window.__qaPerm={...base_,outcome:'failed',error:r.error};return}
if(!r.busy&&fresh.some(e=>e.kind==='assistant')){window.__qaPerm={...base_,outcome:'finished-without-prompt',error:r.error??null,
reply:fresh.filter(e=>e.kind==='assistant').map(e=>e.text||'').join('\\n\\n')};return}
if(Date.now()>END){window.__qaPerm={...base_,outcome:'deadline',busy:r.busy,error:r.error??null};return}
setTimeout(tick,1000)}catch(e){window.__qaPerm={outcome:'threw',detail:String(e)}}};tick();return 'polling-for-card'})()`;

scenarios["22-d8-ask-prompts-for-navigation"] = [
  ...preamble("22-d8-ask-prompts-for-navigation"),
  ["eval", setPermissionMode("Ask before edits")],
  ["eval", permissionModeIs("ask")],
  ["wait", "--fn", "typeof window.__qaMode==='string'", "--timeout", "30000"],
  ["eval", assertPermissionMode("ask")],
  ["eval", readPane("__qaPaneBefore")],
  ["wait", "--fn", "!!window.__qaPaneBefore", "--timeout", "30000"],
  ["eval", assertSlot("__qaPaneBefore")],
  ["eval", readRevision("__qaRevBefore")],
  ["wait", "--fn", "!!window.__qaRevBefore", "--timeout", "30000"],
  ["eval", assertSlot("__qaRevBefore")],
  ["eval", `(()=>{const urls=performance.getEntriesByType('resource').map(e=>e.name).filter(u=>/assistant\\/permissions\\.ts/.test(u));
return JSON.stringify({permissionsModuleUrls:[...new Set(urls)],count:urls.length})})()`],
  ["eval", compose(NAVIGATE_PROMPT)],
  ["wait", "--fn", waitSendable, "--timeout", "30000"],
  ["eval", BASELINE],
  ["wait", "--fn", "!!window.__qaBase", "--timeout", "30000"],
  ["eval", send],
  ["eval", POLL_CARD],
  ["wait", "--fn", "!!window.__qaPerm", "--timeout", "240000"],
  ["screenshot", `${SHOTS}/22-d8-ask-navigation-prompt.png`],
  ["eval", `(()=>{const p=window.__qaPerm;
// The card is read from the DOM, which is what the user reads and clicks. The store probe is
// reported beside it rather than trusted: the pending request is in-memory, and a module instance the page
// did not itself load reads it as null even while the card is painted.
if(p.outcome!=='permission-card')return JSON.stringify({outcome:p.outcome,storePending:p.storePending,
note:'no permission card was painted before the workspace move',renderedTail:p.renderedTail,reply:(p.reply||'').slice(0,500)});
// D4: the card the user reads. A raw tool id here is the defect the register recorded.
if(/_/.test(String(p.cardTitle||'')))throw Error('The prompt names a raw tool id, not user-facing wording: '+p.cardTitle);
return JSON.stringify({outcome:'permission-card',cardTitle:p.cardTitle,cardSummary:p.cardSummary,
storePending:p.storePending,mode:p.mode,working:p.workingIndicator,elapsedMs:p.elapsedMs})})()`],
  ["eval", `(()=>{const b=document.querySelector('button.assistant-permission-deny');if(!b)throw Error('No Deny button in the permission card');b.click();return 'denied'})()`],
  ["eval", `(()=>{window.__qaCardGone=null;const END=Date.now()+60000;const tick=()=>{if(!document.querySelector('button.assistant-permission-deny')){window.__qaCardGone={gone:true};return}
if(Date.now()>END){window.__qaCardGone={gone:false};return}setTimeout(tick,250)};tick();return 'awaiting card dismissal'})()`],
  ["wait", "--fn", "!!window.__qaCardGone", "--timeout", "90000"],
  ["eval", "JSON.stringify(window.__qaCardGone)"],
  ["eval", readPane("__qaPaneAfterDeny")],
  ["wait", "--fn", "!!window.__qaPaneAfterDeny", "--timeout", "30000"],
  ["eval", paneUnchanged("__qaPaneBefore", "__qaPaneAfterDeny", "deny of the workspace move")],
  ["eval", POLL],
  ["wait", "--fn", "!!window.__qa", "--timeout", "600000"],
  ["eval", `(()=>{const a=window.__qa;if(!a)throw Error('No archive after the denied turn');
const fresh=(a.newEntries||[]).length?a.newEntries:(a.entries||[]);
const rows=fresh.filter(e=>e.kind==='tool');
const navigated=rows.filter(r=>r.tool==='navigate_workspace'&&r.failed!==true);
if(navigated.length)throw Error('navigate_workspace ran after the user denied it: '+JSON.stringify(navigated.map(r=>(r.text||'').slice(0,200))));
return JSON.stringify({state:a.state,navigateToolsSucceeded:0,denied:true,tools:rows.map(r=>({tool:r.tool,failed:r.failed===true,text:(r.text||'').slice(0,300)})),error:a.error??null})})()`],
  ["eval", readPane("__qaPaneFinal")],
  ["wait", "--fn", "!!window.__qaPaneFinal", "--timeout", "30000"],
  ["eval", paneUnchanged("__qaPaneBefore", "__qaPaneFinal", "final pane after the denied turn")],
  ["eval", DOMREAD],
  ["errors"],
];

// --- 23: diagnostic. Scenario 22 hung twice with no prompt, no assistant entry and no error visible
//         through POLL_PERMISSION, because that poll only settles on a prompt, an answer, or its own
//         600 s deadline - and the runner's spawn timeout fires first. This settles at 90 s and
//         reports the thread's actual state, so the hang is characterised rather than inferred. ---
/**
 * The archive is only written when a turn completes, so it reports an EMPTY, idle thread while the
 * turn is still in flight - which is why scenario 22's archive-only poll could not tell a hang from
 * a slow answer. The DOM is the honest instrument during a turn: the panel paints the user's own
 * message, the working spinner and the permission card as they happen.
 *
 * Settles on the first of: a permission card, a finished answer in the archive, a thread error, or
 * the 150 s deadline - and always reports the DOM and the store together.
 */
const DIAGNOSE = `(()=>{window.__qaDiag=null;const END=Date.now()+150000;const started=Date.now();const tick=async()=>{try{
const p=await ${PERMISSIONS};const r=await ${READ};
const log=document.querySelector('.assistant-conversation[role="log"]')||document.querySelector('.assistant-conversation');
const rows=log?[...log.querySelectorAll('.assistant-chat-entry')].map(x=>(x.textContent||'').trim()):[];
const deny=!!document.querySelector('button.assistant-permission-deny');
const working=/Assistant is working/i.test(document.body.innerText);
const snap=(outcome)=>({outcome,elapsedMs:Date.now()-started,mode:p.mode,
pending:p.pending?{toolName:p.pending.toolName,title:p.pending.title,summary:p.pending.summary}:null,
denyButton:deny,busy:r.busy,error:r.error??null,workPacketState:r.workPacket?r.workPacket.state:null,
nextAction:r.workPacket?r.workPacket.nextAction:null,archiveEntries:r.entries.length,
archiveKinds:r.entries.map(e=>e.kind),renderedRows:rows.length,renderedTail:rows.slice(-3),workingIndicator:working});
if(deny){window.__qaDiag=snap('permission-card');return}
if(!r.busy&&r.error){window.__qaDiag=snap('thread-error');return}
if(!r.busy&&r.entries.some(e=>e.kind==='assistant')){window.__qaDiag=snap('answered');return}
if(Date.now()>END){window.__qaDiag=snap('deadline');return}
setTimeout(tick,1000)}catch(e){window.__qaDiag={outcome:'threw',threw:String(e)}}};tick();return 'diagnosing'})()`;

scenarios["23-d8-ask-hang-diagnostic"] = [
  ...preamble("23-d8-ask-hang-diagnostic"),
  ["eval", setPermissionMode("Ask before edits")],
  ["eval", permissionModeIs("ask")],
  ["wait", "--fn", "typeof window.__qaMode==='string'", "--timeout", "30000"],
  ["eval", assertPermissionMode("ask")],
  ["eval", compose(NAVIGATE_PROMPT)],
  ["wait", "--fn", waitSendable, "--timeout", "30000"],
  ["eval", BASELINE],
  ["wait", "--fn", "!!window.__qaBase", "--timeout", "30000"],
  ["eval", send],
  ["eval", DIAGNOSE],
  ["wait", "--fn", "!!window.__qaDiag", "--timeout", "200000"],
  ["screenshot", `${SHOTS}/23-d8-ask-hang-diagnostic.png`],
  ["eval", "JSON.stringify(window.__qaDiag)"],
  ["eval", `(()=>{const log=document.querySelector('.assistant-conversation[role="log"]')||document.querySelector('.assistant-conversation');if(log)log.scrollTop=log.scrollHeight;return 'scrolled'})()`],
  ["screenshot", `${SHOTS}/23-d8-ask-hang-diagnostic-bottom.png`],
  ["errors"],
];

for (const [name, scenario] of Object.entries(scenarios)) {
  writeFileSync(`${DIR}/scenarios/${name}.json`, JSON.stringify(scenario, null, 2) + "\n");
  console.log(`wrote ${DIR}/scenarios/${name}.json with ${scenario.length} opcodes`);
}
