import { storeAssistantFile, getAssistantFile } from "./attachmentFiles";
import { indexNccPage, type NccDocument } from "./nccReferences";

const LIBRARY = "xray:ncc-reference-library";
function openLibrary(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("xray-ncc-library-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("documents", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error("NCC library is blocked by another window."));
  });
}
export async function listNccDocuments(): Promise<NccDocument[]> {
  const db = await openLibrary();
  try { return await new Promise((resolve, reject) => {
    const request = db.transaction("documents").objectStore("documents").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }); } finally { db.close(); }
}
export async function importNccPdf(file: File, edition: string, progress: (message: string) => void): Promise<NccDocument> {
  if (!edition.trim()) throw Error("Enter the edition and volume printed on this document.");
  if (!/\.pdf$/i.test(file.name)) throw Error("Choose an NCC PDF.");
  progress("Saving original PDF…");
  const stored = await storeAssistantFile(LIBRARY, file);
  const [{ getDocument, GlobalWorkerOptions }, { default: worker }] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"), import("pdfjs-dist/legacy/build/pdf.worker.mjs?url"),
  ]);
  GlobalWorkerOptions.workerSrc = worker;
  const url = URL.createObjectURL(file), task = getDocument({ url, disableAutoFetch: true, disableStream: true });
  try {
    const pdf = await task.promise;
    const document: NccDocument = { id: stored.id, name: file.name, edition: edition.trim(), sha256: stored.sha256, pageCount: pdf.numPages, passages: [] };
    for (let number = 1; number <= pdf.numPages; number++) {
      progress(`Indexing PDF page ${number} of ${pdf.numPages}…`);
      const page = await pdf.getPage(number);
      try {
        const text = (await page.getTextContent()).items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("");
        document.passages.push(...indexNccPage(stored.id, number, text));
      } finally { page.cleanup(); }
    }
    if (!document.passages.length) throw Error("No searchable text found. This PDF needs OCR before topic search; the original file is retained on this device.");
    const db = await openLibrary();
    try { await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("documents", "readwrite");
      tx.objectStore("documents").add(document);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? Error("NCC index could not be saved."));
      tx.onerror = () => reject(tx.error);
    }); } finally { db.close(); }
    return document;
  } finally { await task.destroy(); URL.revokeObjectURL(url); }
}
export async function nccOriginal(documentId: string): Promise<Blob> {
  return (await getAssistantFile(LIBRARY, documentId)).blob;
}
