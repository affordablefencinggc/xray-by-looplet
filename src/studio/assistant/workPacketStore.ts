import { workPacketSchema, type WorkPacket } from './workPacket.ts';

export const WORK_PACKET_DATABASE = 'xray-governed-work-v1';
export type WorkEvent = { id: string; packetId: string; projectId: string; sequence: number; at: string; kind: string; payload: unknown; previousHash: string | null; hash: string };
export async function hashEvent(value: Omit<WorkEvent, 'hash'>): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function verifyWorkJournal(packet: WorkPacket, events: WorkEvent[]): Promise<boolean> {
  if (events.length !== packet.sequence) return false;
  let previous: string | null = null;
  for (let i = 0; i < events.length; i++) {
    const { hash, ...event } = events[i];
    if (event.projectId !== packet.projectId || event.packetId !== packet.id || event.sequence !== i + 1 || event.previousHash !== previous || await hashEvent(event) !== hash) return false;
    previous = hash;
  }
  return previous === packet.auditHead;
}
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(Error('Work packet storage is unavailable. No assistant action was started.')); return; }
    const request = indexedDB.open(WORK_PACKET_DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('packets', { keyPath: 'id' }).createIndex('projectId', 'projectId');
      const events = request.result.createObjectStore('events', { keyPath: 'id' });
      events.createIndex('packetId', 'packetId');
      events.createIndex('packetSequence', ['packetId', 'sequence'], { unique: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? Error('Work packet storage failed.'));
    request.onblocked = () => reject(Error('Work packet storage is blocked by another window.'));
  });
}
/** Atomic compare-and-swap: state and event either both commit or neither does. No eviction. */
export async function saveWorkEvent(packet: WorkPacket, kind: string, payload: unknown): Promise<WorkPacket> {
  workPacketSchema.parse(packet);
  const base = { id: crypto.randomUUID(), packetId: packet.id, projectId: packet.projectId, sequence: packet.sequence + 1,
    at: new Date().toISOString(), kind, payload, previousHash: packet.auditHead };
  const event: WorkEvent = { ...base, hash: await hashEvent(base) };
  const next = workPacketSchema.parse({ ...packet, sequence: event.sequence, auditHead: event.hash, updatedAt: event.at });
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['packets', 'events'], 'readwrite'); let reason: Error | null = null;
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(reason ?? tx.error ?? Error('Work event could not be saved. Earlier records remain.'));
      tx.onerror = () => {};
      const store = tx.objectStore('packets'), request = store.get(packet.id);
      request.onsuccess = () => {
        try {
          const existing = request.result === undefined ? null : workPacketSchema.parse(request.result);
          if ((existing?.sequence ?? 0) !== packet.sequence || (existing?.auditHead ?? null) !== packet.auditHead || (existing && existing.projectId !== packet.projectId)) throw Error('Work packet changed in another action/window. Refresh before continuing.');
          store.put(next); tx.objectStore('events').add(event);
        } catch (e) { reason = e instanceof Error ? e : Error('Invalid work packet.'); tx.abort(); }
      };
    });
    return next;
  } finally { db.close(); }
}
export async function listWorkPackets(projectId: string): Promise<WorkPacket[]> {
  const db = await open();
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction('packets', 'readonly'), request = tx.objectStore('packets').index('projectId').getAll(projectId);
    request.onsuccess = () => { try { resolve(request.result.map(p => workPacketSchema.parse(p)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))); } catch (e) { reject(e); } };
    request.onerror = () => reject(request.error);
  }); } finally { db.close(); }
}
export async function readWorkEvents(packetId: string): Promise<WorkEvent[]> {
  const db = await open();
  try { return await new Promise((resolve, reject) => {
    const request = db.transaction('events', 'readonly').objectStore('events').index('packetId').getAll(packetId);
    request.onsuccess = () => resolve((request.result as WorkEvent[]).sort((a,b) => a.sequence - b.sequence));
    request.onerror = () => reject(request.error);
  }); } finally { db.close(); }
}
