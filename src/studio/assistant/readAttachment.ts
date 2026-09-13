import { getAssistantFile, listAssistantFiles, attachmentImagePreview, hashAttachment } from './attachmentFiles.ts';
import type { PlanBinary } from '../documentContract.ts';

export async function readAttachment(projectId: string, fileId?: string, pageNumber = 1, offset = 0, source?: PlanBinary | null) {
  const sourceMetadata = source ? { id: source.documentId, projectId, name: source.name, size: source.sizeBytes, type: source.mimeType, sha256: source.sha256, origin: 'Imported project source' } : null;
  if (!fileId) {
    const all = [...(sourceMetadata ? [sourceMetadata] : []), ...await listAssistantFiles(projectId)];
    return { content: [{ type: 'text' as const, text: JSON.stringify({ files: all.slice(offset, offset + 20), total: all.length, nextOffset: offset + 20 < all.length ? offset + 20 : null, evidence: 'User attachments; governing revision and calibration not established.' }) }] };
  }
  const importedSource = source && fileId === source.documentId;
  const { metadata, blob } = importedSource
    ? { metadata: sourceMetadata!, blob: new Blob([Uint8Array.from(source.bytes)], { type: source.mimeType }) }
    : await getAssistantFile(projectId, fileId);
  if (importedSource && (blob.size !== metadata.size || await hashAttachment(blob) !== metadata.sha256)) throw Error('Imported source bytes do not match the registered document. Reopen the source before reading it.');
  const extension = metadata.name.split('.').at(-1)!.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'webp'].includes(extension)) {
    const preview = await attachmentImagePreview(blob);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ...metadata, evidence: 'unverified', preview: 'Resized image; original retained.' }) }, { type: 'image' as const, ...preview }] };
  }
  if (extension === 'pdf') {
    const [{ getDocument, GlobalWorkerOptions }, { default: worker }] = await Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.mjs?url')]);
    GlobalWorkerOptions.workerSrc = worker;
    const url = URL.createObjectURL(blob), task = getDocument({ url, disableAutoFetch: true, disableStream: true });
    try {
      const pdf = await task.promise;
      if (pageNumber < 1 || pageNumber > pdf.numPages) throw Error(`Choose a PDF page between 1 and ${pdf.numPages}.`);
      const page = await pdf.getPage(pageNumber), base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2, 1600 / Math.max(base.width, base.height)) });
      const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      try {
        await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
        const extracted = (await page.getTextContent()).items.map(item => 'str' in item ? item.str : '').join(' ');
        const imageBlob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(Error('Page image unavailable.')), 'image/jpeg', .8));
        const preview = await attachmentImagePreview(imageBlob);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ ...metadata, page: pageNumber, pageCount: pdf.numPages, text: extracted.slice(offset, offset + 16000), nextOffset: offset + 16000 < extracted.length ? offset + 16000 : null, evidence: 'Unverified attachment page; page pixels are not calibrated measurements.' }) }, { type: 'image' as const, ...preview }] };
      } finally { canvas.width = canvas.height = 0; page.cleanup(); }
    } finally { await task.destroy(); URL.revokeObjectURL(url); }
  }
  if (offset >= blob.size) throw Error('Text offset is past the end of the file.');
  const end = Math.min(blob.size, offset + 32000);
  const text = await blob.slice(offset, end).text();
  return { content: [{ type: 'text' as const, text: JSON.stringify({ ...metadata, byteOffset: offset, nextOffset: end < blob.size ? end : null, text, evidence: 'Raw unverified file excerpt; CAD/BIM text is not a validated geometric model. Byte-range boundaries may split a UTF-8 character.' }) }] };
}
