import { z } from 'zod';
import { assistantContentSchema, assistantSourceSchema } from './contract.ts';
import { workPacketSchema, type WorkPacket } from './workPacket.ts';
import type { ChatEntry } from './useAssistantChat.ts';
import type { AssistantContent } from './contract.ts';
import type { WorkEvent } from './workPacketStore.ts';

export type SavedChat = { id: string; startedAt?: string; updatedAt: string; entries: ChatEntry[]; contents: AssistantContent[]; error: string | null; busy: boolean; workPacket?: WorkPacket; archivedAt?: string };
export type ChatArchive = { projectId: string; revision: number; activeId: string; threads: SavedChat[] };
const entrySchema = z.object({ id: z.string(), kind: z.enum(['user','assistant','tool']), text: z.string(),
  timestamp: z.string().datetime().optional(),
  images: z.array(z.object({data:z.string(),mimeType:z.enum(['image/png','image/jpeg','image/webp'])})).optional(),
  sources:z.array(assistantSourceSchema).optional(),toolName:z.string().optional(),toolCallId:z.string().optional(),failed:z.boolean().optional(),
  projectName:z.string().optional(),projectRevision:z.number().int().positive().optional(),
}).strict();
const threadSchema = z.object({ id: z.string(), startedAt: z.string().datetime().optional(), updatedAt: z.string(), entries: z.array(entrySchema), contents: z.array(assistantContentSchema), error: z.string().nullable(), busy: z.boolean(), workPacket: workPacketSchema.optional(), archivedAt: z.string().optional() });
const archiveSchema = z.object({ projectId: z.string(), revision: z.number().int().nonnegative(), activeId: z.string(), threads: z.array(threadSchema) });

export function parseChatArchive(value: unknown, projectId: string): ChatArchive {
  const archive = archiveSchema.parse(value) as ChatArchive;
  if (archive.projectId !== projectId || !archive.threads.some(t => t.id === archive.activeId)
    || new Set(archive.threads.map(t => t.id)).size !== archive.threads.length
    || archive.threads.some(t => t.workPacket && t.workPacket.projectId !== projectId)) throw Error('Chat history belongs to a different project or is incomplete. Saved records were preserved.');
  return archive;
}
export function restoreChat(thread: SavedChat): SavedChat {
  if (!thread.busy) return thread;
  return { ...thread, busy: false, error: 'This response was interrupted by a reload. Completed actions remain; review the saved task before continuing.',
    entries: thread.entries.map(e => e.kind === 'tool' && /^Running .*…$/.test(e.text)
      ? { ...e, failed: true, text: 'Response interrupted. Check the saved task and current state before retrying.' } : e) };
}
export function putChat(archive: ChatArchive, thread: SavedChat): ChatArchive {
  return { ...archive, activeId: thread.id, threads: [...archive.threads.filter(t => t.id !== thread.id), thread] };
}
export const chatTitle = (thread: Pick<SavedChat, 'entries'>) => thread.entries.find(e => e.kind === 'user')?.text.slice(0, 90) || 'New chat';

/** Archiving hides a thread from the main list; it never deletes its messages. */
export function archiveChat(archive: ChatArchive, id: string, fallback: SavedChat, now = new Date().toISOString()): ChatArchive {
  if (!archive.threads.some(t => t.id === id)) throw Error('Chat was not found.');
  const threads = archive.threads.map(t => t.id === id ? {...t, archivedAt: now} : t);
  if (archive.activeId !== id) return {...archive, threads};
  const replacement = threads.slice().reverse().find(t => !t.archivedAt);
  if (replacement) return {...archive, threads, activeId: replacement.id};
  return {...archive, threads: [...threads, fallback], activeId: fallback.id};
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open('xray-chat-history-v1',1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects',{keyPath:'projectId'});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || Error('Chat storage unavailable.'));
    request.onblocked = () => reject(Error('Chat storage is blocked by another window.'));
  });
}
export async function readChatArchive(projectId: string): Promise<ChatArchive | null> {
  const db = await open();
  try { return await new Promise((resolve,reject) => {
    const request = db.transaction('projects').objectStore('projects').get(projectId);
    request.onsuccess = () => { try { resolve(request.result === undefined ? null : parseChatArchive(request.result,projectId)); } catch(e) { reject(e); } };
    request.onerror = () => reject(request.error);
  }); } finally { db.close(); }
}
/** Atomic version check prevents another tab from silently overwriting this project's chats. */
export async function saveChatArchive(archive: ChatArchive, expectedRevision: number): Promise<number> {
  parseChatArchive(archive,archive.projectId);
  const db = await open();
  try { return await new Promise((resolve,reject) => {
    const tx = db.transaction('projects','readwrite'), store = tx.objectStore('projects');
    let reason: unknown;
    const request = store.get(archive.projectId);
    request.onsuccess = () => {
      try {
        const current = request.result === undefined ? null : parseChatArchive(request.result,archive.projectId);
        if ((current?.revision ?? 0) !== expectedRevision) throw Error('Chat history changed in another window. Reload to read the saved conversation; this window has not overwritten it.');
        store.put({ ...archive, revision: expectedRevision + 1 });
      } catch(e) { reason=e; tx.abort(); }
    };
    tx.oncomplete = () => resolve(expectedRevision + 1);
    tx.onabort = () => reject(reason || tx.error || Error('Chat could not be saved.'));
    tx.onerror = () => {};
  }); } finally { db.close(); }
}

/** Recover older task journals once, without inventing missing replies or replaying any action. */
export function recoverTaskChat(packet: WorkPacket, events: WorkEvent[]): SavedChat {
  const entries: ChatEntry[] = [{id:packet.id+':user',kind:'user',text:packet.objective}];
  for (const event of events) {
    const payload = event.payload as Record<string, unknown>;
    if (event.kind === 'model-response-unreviewed') {
      const parsed = assistantContentSchema.safeParse(payload.content);
      if (!parsed.success) continue;
      const text = parsed.data.parts.filter(p => !p.thought).map(p => p.text || '').join('\n').trim();
      if (text) entries.push({id:event.id,kind:'assistant',text});
    } else if (event.kind === 'tool-result') {
      const result = payload.result as { isError?: boolean; content?: {type:string;text?:string;data?:string;mimeType?:string}[] };
      if (!result || !Array.isArray(result.content) || typeof payload.tool !== 'string') continue;
      entries.push({id:event.id,kind:'tool',toolName:payload.tool,failed:!!result.isError,
        text:result.content.filter(p=>p.type==='text').map(p=>p.text||'').join('\n'),
        projectName:packet.snapshot.projectName,projectRevision:packet.snapshot.projectRevision});
    }
  }
  return {id:'recovered:'+packet.id,updatedAt:packet.updatedAt,entries,contents:[],busy:false,workPacket:packet,
    error:'Recovered from saved task records. Earlier chat-only messages may be unavailable; recovered replies remain unreviewed.'};
}
