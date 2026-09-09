import { useEffect } from 'react';
import { create } from 'zustand';
import { useStudio } from '../store';
import { assistantTurn } from './transport';
import { callAssistantTool, getAssistantMcp } from './session';
import { runConversation, type ChatEvent, type ChatImage } from './conversation';
import type { AssistantContent } from './contract';
export type ChatEntry = Omit<ChatEvent, 'kind'> & { id: string; kind: 'user' | 'assistant' | 'tool' };
type Conversation = { entries: ChatEntry[]; contents: AssistantContent[]; busy: boolean; error: string | null };
const empty = (): Conversation => ({ entries: [], contents: [], busy: false, error: null });
const blank = empty();
const useChats = create<{ records: Record<string, Conversation> }>(() => ({ records: {} }));
const controllers = new Map<string, AbortController>();
function update(jobId: string, action: (record: Conversation) => Conversation) {
  useChats.setState(state => ({ records: { ...state.records, [jobId]: action(state.records[jobId] || empty()) } }));
}
export function useAssistantChat(jobId: string) {
  const record = useChats(state => state.records[jobId] || blank);
  useEffect(() => () => { controllers.get(jobId)?.abort(); }, [jobId]);
  const send = async (text: string, images: ChatImage[]) => {
    if (controllers.size) throw Error('Wait for the current assistant response or stop it first.');
    const controller = new AbortController(); controllers.set(jobId, controller);
    const initial = useChats.getState().records[jobId] || empty();
    const contents: AssistantContent[] = [...initial.contents, { role: 'user', parts: [{ text: `Current X-Ray project ID: ${jobId}\n${text}` }, ...images.map(image => ({ inlineData: image }))] }];
    update(jobId, value => ({ ...value, busy: true, error: null, entries: [...value.entries, { id: crypto.randomUUID(), kind: 'user', text, images }] }));
    try {
      const session = await getAssistantMcp();
      await runConversation({
        contents, signal: controller.signal,
        declarations: session.tools.map(tool => ({ name: tool.name, description: tool.description || tool.name, parametersJsonSchema: tool.inputSchema })),
        turn: assistantTurn, call: callAssistantTool,
        assertContext: () => { const current = useStudio.getState(); if (current.job.id !== jobId || current.persistenceRecoveryBlocked) throw Error('Project changed or recovery is active. Assistant stopped before the next action.'); },
        emit: event => update(jobId, value => ({ ...value, entries: [...value.entries, { ...event, id: crypto.randomUUID() }] })),
        checkpoint: history => update(jobId, value => ({ ...value, contents: structuredClone(history) })),
      });
      return true;
    } catch (error) {
      update(jobId, value => ({ ...value, error: controller.signal.aborted ? 'Assistant stopped. Completed tool actions remain in the project; review the activity below before retrying.' : error instanceof Error ? error.message : 'Assistant failed.' }));
      return false;
    } finally { controllers.delete(jobId); update(jobId, value => ({ ...value, busy: false })); }
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
  return { ...record, send, postLocalExchange, stop: () => controllers.get(jobId)?.abort(), clear: () => { if (!record.busy) update(jobId, () => empty()); } };
}

