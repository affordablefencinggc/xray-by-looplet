import { readExecutionBudget } from './executionBudget';
import { prohibitsAllTools } from './discussionOnly.ts';
import { useEffect } from 'react';
import { create } from 'zustand';
import { browserSingleton } from '../browserSingleton';
import { useStudio } from '../store';
import { assistantTurn } from './transport';
import { providerSupportsTool, useAssistantProvider } from './provider';
import { callAssistantTool, getAssistantMcp } from './session';
import { appendChatEvent, runConversation, type ChatEvent, type ChatImage } from './conversation';
import type { AssistantContent } from './contract';
import { assistantToolAllowed } from './skills';
import { gateToolCall, usePermissions } from './permissions';
import { HANDOVER_CONTINUED_PREFIX, applyContextFloor, buildHandover, contextState, measureContext, readContextFloor, type ContextMeasure, type ContextState } from './contextBudget';
// [SC-22 context] begin
import { beginGovernedWork, shortInteraction } from './workPacketRuntime';
import type { WorkPacket } from './workPacket';
import { assembleTurn, chooseBase, readCarriedContext } from './contextTurn';
import { readContextLog, readContextProfile } from './contextLogStore';

/** Shown when the carried profile and digest could not be read, so the loss is visible not silent. */
export const CONTEXT_CARRIED_UNAVAILABLE = 'Carried context (your saved profile and project digest) could not be read, so this message was sent without it. Your message was still sent.';
// [SC-22 context] end
// [SC-22 capture] begin
import { captureTurn } from './contextCapture';
import { captureScreenContext } from './screenContext';
import { useDeveloperMode } from './developerPreferences';
import { developerReviewInstruction, hasDeveloperReview } from './developerMode';
import { worksheetExplanationGuidance } from './worksheetExplanationGuidance';
import { archiveChat, chatTitle, putChat, readChatArchive, recoverTaskChat, restoreChat, saveChatArchive, type ChatArchive, type SavedChat } from './chatHistory';
import { listWorkPackets, readWorkEvents, verifyWorkJournal } from './workPacketStore';
// [SC-22 capture] end
export type ChatEntry = Omit<ChatEvent, 'kind'> & { id: string; kind: 'user' | 'assistant' | 'tool';
  timestamp?: string;
  /** [PROVENANCE] The project a tool row acted on, stamped when the row is created. */
  projectName?: string; projectRevision?: number };
/** `tokens`/`context` are derived from `contents` on every update so the panel can meter the provider transcript. */
type Conversation = SavedChat & { estimate: ContextMeasure; tokens: number; context: ContextState };
const empty = (): Conversation => ({ id: crypto.randomUUID(), startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), entries: [], contents: [], busy: false, error: null, estimate: { tokens: 0, bytes: 0, count: 0 }, tokens: 0, context: contextState(0) });
const blank = empty();
// A panel remount or hot module replacement must not create a second, empty chat
// store while the original model request is still writing to the first one.
const runtime = browserSingleton('xray.assistant-chat-runtime.v1', () => ({
  useChats: create<{ records: Record<string, Conversation>; ready: Record<string, boolean> }>(() => ({ records: {}, ready: {} })),
  controllers: new Map<string, AbortController>(),
  histories: new Map<string, { archive: ChatArchive; revision: number; queue: Promise<void>; failure: string | null }>(),
  loads: new Map<string, Promise<void>>(),
  changingChats: new Set<string>(),
}));
const { useChats, controllers, histories, loads, changingChats } = runtime.value;
if (runtime.created && typeof window !== 'undefined') {
  useStudio.subscribe(state => {
    for (const [projectId, controller] of controllers) {
      if (state.job.id !== projectId || state.persistenceRecoveryBlocked) controller.abort();
    }
  });
}
const saved = (value: Conversation): SavedChat => ({id:value.id,startedAt:value.startedAt,updatedAt:new Date().toISOString(),entries:value.entries,contents:value.contents,busy:value.busy,error:value.error,...(value.workPacket?{workPacket:value.workPacket}:{})});
const restored = (value: SavedChat): Conversation => {
  const thread = restoreChat(value), estimate = measureContext(thread.contents);
  return {...thread,estimate,tokens:estimate.tokens,context:contextState(estimate.tokens,{count:estimate.count,bytes:estimate.bytes})};
};
function persistenceError(jobId: string, error: unknown) {
  const message = error instanceof Error ? error.message : 'Chat history could not be saved.';
  const h = histories.get(jobId); if(h) h.failure = message;
  useChats.setState(s => ({records:{...s.records,[jobId]:{...(s.records[jobId]||empty()),error:message}}}));
}
async function ensureChat(jobId: string) {
  if(useChats.getState().ready[jobId]) return;
  if(loads.has(jobId)) return loads.get(jobId)!;
  const loading = (async()=>{
    let archive = await readChatArchive(jobId);
    if(!archive) {
      const threads: SavedChat[] = [];
      for(const packet of (await listWorkPackets(jobId)).reverse()) {
        const events = await readWorkEvents(packet.id);
        if(!await verifyWorkJournal(packet,events)) throw Error('Saved task history failed its integrity check. Original records have been preserved.');
        threads.push(recoverTaskChat(packet,events));
      }
      if(!threads.length) threads.push(saved(empty()));
      archive = {projectId:jobId,revision:0,activeId:threads.at(-1)!.id,threads};
    }
    histories.set(jobId,{archive,revision:archive.revision,queue:Promise.resolve(),failure:null});
    useChats.setState(s=>({records:{...s.records,[jobId]:restored(archive!.threads.find(t=>t.id===archive!.activeId)!)},ready:{...s.ready,[jobId]:true}}));
  })();
  loads.set(jobId,loading);
  try { await loading; } catch(e) { persistenceError(jobId,e); throw e; } finally { loads.delete(jobId); }
}
function persist(jobId: string, value: Conversation) {
  const h = histories.get(jobId); if(!h || h.failure) return;
  h.archive = putChat(h.archive,saved(value));
  const snapshot = structuredClone(h.archive);
  h.queue = h.queue.then(async()=>{ if(h.failure)return; h.revision = await saveChatArchive(snapshot,h.revision); }).catch(e=>persistenceError(jobId,e));
}
async function flushChat(jobId: string) {
  const h=histories.get(jobId); if(!h)throw Error('Chat history is still loading.');
  await h.queue; if(h.failure)throw Error(h.failure);
}
async function activateChat(jobId: string, next: Conversation): Promise<boolean> {
  if(changingChats.has(jobId)||controllers.has(jobId))return false;
  changingChats.add(jobId);
  try {
    await flushChat(jobId);
    const h=histories.get(jobId)!;
    const archive=putChat(h.archive,saved(next));
    const revision=await saveChatArchive(archive,h.revision);
    h.archive={...archive,revision};h.revision=revision;
    // Only replace the visible conversation once the new active thread is durable.
    useChats.setState(s=>({records:{...s.records,[jobId]:restored(next)}}));
    return true;
  } catch(e) { persistenceError(jobId,e);throw e; }
  finally {changingChats.delete(jobId);}
}
function update(jobId: string, action: (record: Conversation) => Conversation) {
  useChats.setState(state => {
    const previous = state.records[jobId] || empty();
    const next = action(previous);
    if (next.entries !== previous.entries) {
      const existing = new Set(previous.entries.map(entry => entry.id));
      const now = new Date().toISOString();
      next.entries = next.entries.map(entry => existing.has(entry.id) || entry.timestamp ? entry : {...entry, timestamp: now});
    }
    const estimate = next.contents === previous.contents ? previous.estimate : measureContext(next.contents);
    // The QA floor (localStorage) can only raise the estimate; see contextBudget.ts.
    const tokens = applyContextFloor(estimate.tokens, readContextFloor(typeof localStorage === 'undefined' ? null : localStorage));
    return { records: { ...state.records, [jobId]: { ...next, estimate, tokens, context: contextState(tokens, { count: estimate.count, bytes: estimate.bytes }) } } };
  });
  persist(jobId,useChats.getState().records[jobId]);
}
export const HANDOVER_ACKNOWLEDGEMENT = 'Understood. I have the handover; tell me what to do next.';
export function useAssistantChat(jobId: string) {
  const workspaceReady = useStudio(state => state.persistenceHydrated && !state.persistenceRecoveryBlocked);
  const record = useChats(state => state.records[jobId] || blank);
  const historyReady = useChats(state => workspaceReady && !!state.ready[jobId]);
  useEffect(() => {
    // This effect exists because the chat identity changed. A "for this chat" permission grant is
    // part of that identity: without this, a grant given in one project's chat answered for the same
    // tool name in another project's chat, where the user was never asked.
    usePermissions.getState().scopeChatGrants(jobId);
    if (workspaceReady) void ensureChat(jobId).catch(()=>{});
  },[jobId, workspaceReady]);
  // View changes, docking and React refresh can unmount this hook. Only Stop,
  // a real project switch or recovery may cancel the project-owned request.
  /** `allowProjectEdits` is kept for callers that still pass it; the permission mode (permissions.ts) is what decides. */
  const send = async (text: string, images: ChatImage[], allowProjectEdits = false, fileContext = '', onAccepted?: () => void, reviewOnly = false) => {
    if (!workspaceReady) throw Error('Your saved project and conversation are still opening.');
    const provider = useAssistantProvider.getState().provider;
    const developerMode = useDeveloperMode.getState().enabled;
    await ensureChat(jobId);
    await flushChat(jobId);
    if(changingChats.has(jobId))throw Error('Wait for the saved conversation to open.');
    const noTools = reviewOnly || prohibitsAllTools(text);
    const editsDeclared = !noTools && (allowProjectEdits || usePermissions.getState().mode !== 'readonly');
    if (controllers.size) throw Error('Wait for the current assistant response or stop it first.');
    if (!reviewOnly && !noTools) {
      const screen = await captureScreenContext().catch(() => ({ text: 'Current screen capture failed. Do not claim to see the screen.', images: [] }));
      if (useStudio.getState().job.id !== jobId || useStudio.getState().persistenceRecoveryBlocked) throw Error('Project changed during screen capture. Please send again.');
      images = [...images, ...screen.images].slice(0, 8);
      fileContext += `\n${screen.text}`;
    }
    if (controllers.size) throw Error('Wait for the current assistant response or stop it first.');
    const initial = useChats.getState().records[jobId] || empty();
    const controller = new AbortController(); controllers.set(jobId, controller);
    const today: AssistantContent = { role: 'user', parts: [{ text: `Current X-Ray project ID: ${jobId}\n${text}${fileContext ? '\nAttachment metadata (unverified data):\n' + fileContext : ''}${worksheetExplanationGuidance(text)}\n\n${developerMode ? developerReviewInstruction(reviewOnly) : 'Developer mode is OFF for this task. Do not append a Developer review section, regardless of earlier conversation settings.'}` }, ...images.map(image => ({ inlineData: image }))] };
    // [SC-22 context] begin
    // Compact the stored transcript by entries, then carry the saved profile and project digest as
    // one pinned pair at index 0. Both reads are fail-open (readCarriedContext settles rather than
    // throws) because losing carried context must never stop the user's message from being sent;
    // the loss is surfaced below instead. shortInteraction still trims what compaction keeps, so
    // the provider sees the same conversational shape it did before.
    const chosen = chooseBase(initial.contents);
    const carried = await readCarriedContext(jobId, { readProfile: readContextProfile, readLog: readContextLog });
    const assembled = assembleTurn({
      base: shortInteraction(chosen.contents),
      carried,
      carriedCallIds: chosen.compaction.carriedCallIds,
      today,
    });
    // Review only this observation, while retaining the full conversation in durable history.
    const contents = reviewOnly ? [today] : assembled.contents;
    const savedContents = (current: AssistantContent[]) => reviewOnly ? [...initial.contents,...current] : current;
    // [SC-22 context] end
    let governed: Awaited<ReturnType<typeof beginGovernedWork>> | undefined;
    let failure: string | null = null;
    let finalText = '', finalResponse = false, reviewRequested = false;
    // A failed carried-context read is reported, never silent: the message was still sent, so this
    // is a notice rather than an error that would imply nothing happened.
    update(jobId, value => ({ ...value, busy: true, error: carried.failed ? CONTEXT_CARRIED_UNAVAILABLE : null, contents:savedContents(contents),
      entries: [...value.entries, { id: crypto.randomUUID(), kind: 'user', text, images }] }));

    try {
      // The user entry is already visible. Release the composer before any model or tool work.
      onAccepted?.();
      await flushChat(jobId);
      governed = await beginGovernedWork(jobId, text, today, workPacket => update(jobId, value => ({ ...value, workPacket })), initial.contents, reviewOnly, noTools);
      const session = await getAssistantMcp();
      await runConversation({
        contents, signal: controller.signal, execution: readExecutionBudget(localStorage),
        declarations: noTools ? [] : session.tools.filter(tool => assistantToolAllowed(tool.name, editsDeclared) && providerSupportsTool(provider, tool.name)).map(tool => ({ name: tool.name, description: tool.description || tool.name, parametersJsonSchema: tool.inputSchema })),
        turn: async (request, signal) => {
          const prepared = await governed!.prepare(request);
          const response = await assistantTurn(prepared, signal, provider);
          finalResponse = !response.content.parts.some(part=>part.functionCall);
          finalText = response.content.parts.filter(part=>!part.thought).map(part=>part.text||'').join('\n');
          await governed!.response(response);
          return response;
        },
        call: async (name, args, signal) => {
          if (noTools) throw Error('Tools are prohibited for this request; no project action was executed.');
          // Ask / edit freely / read only, plus per-call prompts in ask mode (permissions.ts). A refusal is a tool error the model can read.
          return governed!.call(name, args, () => callAssistantTool(name, args, signal, { allowProjectEdits: !reviewOnly, provider }),
            () => allowProjectEdits ? Promise.resolve(null) : gateToolCall(name, args, signal));
        },
        assertContext: () => { const current = useStudio.getState(); if (current.job.id !== jobId || current.persistenceRecoveryBlocked) throw Error('Project changed or recovery is active. Assistant stopped before the next action.'); },
        beforeFinal: async () => {
          const required = await governed!.reviewFinal();
          if (required) return required;
          if (developerMode && !hasDeveloperReview(finalText) && !reviewRequested) {
            reviewRequested=true;
            return `[xray:developer-review] The task answer is ready. Do not repeat any actions. Return that answer with the missing self-assessment appended. ${developerReviewInstruction(reviewOnly)}`;
          }
          return null;
        },
        // [PROVENANCE] Every tool row records the project it acted on and that project's revision
        // afterwards, so the transcript itself proves which job each action touched. Read from the
        // live store at emit time rather than from the closure, so a stale value cannot be recorded.
        emit: event => update(jobId, value => ({ ...value, entries: appendChatEvent(value.entries, { ...event,
          ...(developerMode && finalResponse && event.kind==='assistant' && !hasDeveloperReview(event.text||'') ? {text:`${event.text||''}\n\n### Developer review\nThe model did not provide its self-review after a reminder. No performance verdict was inferred.`} : {}), id: crypto.randomUUID(),
          ...(event.kind === 'tool' ? { projectName: useStudio.getState().job.name, projectRevision: useStudio.getState().job.revision } : {}) }) })),
        checkpoint: history => update(jobId, value => ({ ...value, contents: structuredClone(savedContents(history)) })),
      });
      return true;
    } catch (error) {
      failure = error instanceof Error ? error.message : 'Assistant failed.';
      update(jobId, value => ({ ...value, error: controller.signal.aborted ? 'Assistant stopped. Completed tool actions remain in the project; review the activity below before retrying.' : error instanceof Error ? error.message : 'Assistant failed.' }));
      return false;
    } finally {
      if (governed) {
        try { await governed.finish(failure); }
        catch (error) { update(jobId, value => ({ ...value, error: error instanceof Error ? error.message : 'Task checkpoint could not be saved. Review before retrying.' })); }
      }
      controllers.delete(jobId); update(jobId, value => ({ ...value, busy: false }));
      await histories.get(jobId)?.queue;
      // [SC-22 capture] begin
      // One entry per completed turn. Only the entries this turn added are read, so a long chat
      // never re-summarises its own history. captureTurn swallows a storage failure (contextCapture.ts)
      // because the user's work is already done by the time this runs.
      const before = initial.entries.length;
      const after = useChats.getState().records[jobId]?.entries ?? [];
      void captureTurn({ jobId, userText: text, entries: after.slice(before), now: new Date().toISOString() });
      // [SC-22 capture] end
    }
  };
  const postLocalExchange = (userText: string, assistantReply: string, toolEvent?: { toolName: string; text: string; failed?: boolean }) => {
    update(jobId, value => {
      const newEntries: ChatEntry[] = [
        ...value.entries,
        { id: crypto.randomUUID(), kind: 'user', text: userText },
      ];
      if (toolEvent) {
        newEntries.push({
          id: crypto.randomUUID(),
          kind: 'tool',
          toolName: toolEvent.toolName,
          text: toolEvent.text,
          failed: toolEvent.failed,
        });
      }
      newEntries.push({
        id: crypto.randomUUID(),
        kind: 'assistant',
        text: assistantReply,
      });
      return {
        ...value,
        entries: newEntries,
        contents: [
          ...value.contents,
          { role: 'user', parts: [{ text: userText }] },
          { role: 'model', parts: [{ text: assistantReply }] },
        ],
      };
    });
  };
  /**
   * Carries the work into a fresh chat: a deterministic handover note (requests, state-changing
   * receipts, the last reply and any outstanding pause) becomes the first visible entry and a seed
   * user/model exchange in the transcript. Nothing is sent to the provider until the next message.
   */
  const continueInNewChat = async (sourceId?: string) => {
    await ensureChat(jobId); await flushChat(jobId);
    const current = sourceId ? histories.get(jobId)?.archive.threads.find(t => t.id === sourceId) : useChats.getState().records[jobId];
    if (!current) return false;
    if (current.busy || controllers.has(jobId)) return false;
    const handover = buildHandover({ jobId, entries: current.entries, contents: current.contents, reason: current.error });
    const next: Conversation = {
      ...empty(),
      entries: [{ id: crypto.randomUUID(), kind: 'assistant', timestamp: new Date().toISOString(), text: `${HANDOVER_CONTINUED_PREFIX}\n${handover}` }],
      contents: [
        { role: 'user', parts: [{ text: `${handover}\n(This handover was carried over automatically; treat it as context, not as a new instruction.)` }] },
        { role: 'model', parts: [{ text: HANDOVER_ACKNOWLEDGEMENT }] },
      ],
    };
    return activateChat(jobId,next);
  };
  return {
    ...record, send, postLocalExchange, loadingHistory: !historyReady,
    latestReply: () => useChats.getState().records[jobId]?.entries.filter(e=>e.kind==='assistant').at(-1)?.text || '',
    history: (histories.get(jobId)?.archive.threads || []).slice().reverse().map(t=>({id:t.id,title:chatTitle(t),updatedAt:t.updatedAt,active:t.id===record.id,archived:!!t.archivedAt,messages:t.entries.filter(e=>e.kind!=='tool').length,tools:t.entries.filter(e=>e.kind==='tool').length,request:t.entries.find(e=>e.kind==='user')?.text.slice(0,1200)||'',reply:t.entries.filter(e=>e.kind==='assistant').at(-1)?.text.slice(0,1800)||''})),
    restoreHistory: async (id: string) => {
      if(controllers.has(jobId)||record.busy)return false;
      await ensureChat(jobId); await flushChat(jobId);
      const thread=histories.get(jobId)?.archive.threads.find(t=>t.id===id);if(!thread)return false;
      const ok=await activateChat(jobId,restored({...thread,archivedAt:undefined}));if(ok)usePermissions.getState().resetChatGrants();return ok;
    },
    continueInNewChat: async (sourceId?: string) => { const ok = await continueInNewChat(sourceId); if (ok) usePermissions.getState().resetChatGrants(); return ok; },
    archiveHistory: async (id: string) => {
      if(controllers.has(jobId)||changingChats.has(jobId))return false;
      changingChats.add(jobId);
      try {
        await ensureChat(jobId); await flushChat(jobId);
        const h=histories.get(jobId)!;
        const next=archiveChat(h.archive,id,saved(empty()));
        const revision=await saveChatArchive(next,h.revision);
        h.archive={...next,revision};h.revision=revision;
        useChats.setState(s=>({records:{...s.records,[jobId]:restored(next.threads.find(t=>t.id===next.activeId)!)}}));
        if(next.activeId!==record.id)usePermissions.getState().resetChatGrants();
        return true;
      } finally { changingChats.delete(jobId); }
    },
    stop: () => controllers.get(jobId)?.abort(),
    clear: async () => { if(record.busy||controllers.has(jobId))return false; await ensureChat(jobId);const ok=await activateChat(jobId,empty());if(ok)usePermissions.getState().resetChatGrants();return ok; },
  };
}
