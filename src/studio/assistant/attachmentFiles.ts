import { sha256 } from '@noble/hashes/sha2.js';

export const MAX_ASSISTANT_FILE_BYTES = 500 * 1024 * 1024;
export const MAX_ASSISTANT_FILES = 20;
export const ASSISTANT_FILE_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv,.json,.dxf,.ifc,.svg';
export type AssistantFile = { id: string; projectId: string; name: string; size: number; type: string; sha256: string; createdAt: string };
const extensions = new Set(ASSISTANT_FILE_ACCEPT.split(',').map(v => v.slice(1)));
export function validateAssistantFile(file: { name: string; size: number }) {
  if (!file.name.trim() || file.name.length > 300 || !extensions.has(file.name.split('.').at(-1)!.toLowerCase())) throw Error('Choose PDF, PNG, JPEG, WebP, TXT, Markdown, CSV, JSON, DXF, IFC or SVG files.');
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_ASSISTANT_FILE_BYTES) throw Error('Each file must be non-empty and no larger than 500 MB.');
}
export async function hashAttachment(blob: Blob, progress: (fraction: number) => void = () => {}) {
  const hash = sha256.create();
  for (let offset = 0; offset < blob.size; offset += 1024 * 1024) {
    hash.update(new Uint8Array(await blob.slice(offset, offset + 1024 * 1024).arrayBuffer()));
    progress(Math.min(1, (offset + 1024 * 1024) / blob.size));
  }
  return Array.from(hash.digest(), b => b.toString(16).padStart(2, '0')).join('');
}
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('xray-assistant-files-v1', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('metadata', { keyPath: 'id' }).createIndex('projectId', 'projectId');
      request.result.createObjectStore('content');
    };
    request.onerror = () => reject(request.error ?? Error('File storage unavailable.'));
    request.onblocked = () => reject(Error('File storage is blocked by another window.'));
    request.onsuccess = () => resolve(request.result);
  });
}
export async function storeAssistantFile(projectId: string, file: File, progress?: (fraction: number) => void): Promise<AssistantFile> {
  validateAssistantFile(file);
  const estimate = await navigator.storage?.estimate?.();
  if (estimate?.quota && estimate.quota - (estimate.usage ?? 0) < file.size * 1.1) throw Error('Not enough browser storage for this file. Free space or choose a smaller file.');
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (/\.pdf$/i.test(file.name) && new TextDecoder().decode(head.slice(0, 5)) !== '%PDF-') throw Error('This file does not contain a PDF header.');
  const value: AssistantFile = { id: crypto.randomUUID(), projectId, name: file.name, size: file.size, type: file.type, sha256: await hashAttachment(file, progress), createdAt: new Date().toISOString() };
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['metadata', 'content'], 'readwrite');
      tx.objectStore('metadata').add(value); tx.objectStore('content').add(file.slice(), value.id);
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? Error('File could not be saved. No attachment was added.'));
      tx.onerror = () => reject(tx.error ?? Error('File storage failed.'));
    });
    return value;
  } finally { db.close(); }
}
export async function listAssistantFiles(projectId: string): Promise<AssistantFile[]> {
  const db = await open();
  try { return await new Promise((resolve, reject) => {
    const request = db.transaction('metadata').objectStore('metadata').index('projectId').getAll(projectId);
    request.onsuccess = () => resolve((request.result as AssistantFile[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    request.onerror = () => reject(request.error);
  }); } finally { db.close(); }
}
export async function getAssistantFile(projectId: string, fileId: string): Promise<{ metadata: AssistantFile; blob: Blob }> {
  const metadata = (await listAssistantFiles(projectId)).find(f => f.id === fileId);
  if (!metadata) throw Error('File not found in this project.');
  const db = await open();
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      const r = db.transaction('content').objectStore('content').get(fileId);
      r.onsuccess = () => r.result instanceof Blob ? resolve(r.result) : reject(Error('Original file content is unavailable.'));
      r.onerror = () => reject(r.error);
    });
    if (blob.size !== metadata.size) throw Error('Stored file size differs from its registered original.');
    return { metadata, blob };
  } finally { db.close(); }
}
/** Model preview only; the original blob is retained separately. */
export async function attachmentImagePreview(blob: Blob) {
  const bitmap = await createImageBitmap(blob, { resizeWidth: 1600, resizeQuality: 'high' });
  const canvas = document.createElement('canvas');
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d'); if (!ctx) throw Error('Image preview is unavailable.');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [.8, .6, .4, .2]) {
      const data = canvas.toDataURL('image/jpeg', quality).split(',')[1];
      if (data.length <= 260000) return { mimeType: 'image/jpeg' as const, data };
    }
    throw Error('Image is stored, but its preview is too complex. Retrieve the original separately.');
  } finally { bitmap.close(); canvas.width = canvas.height = 0; }
}
