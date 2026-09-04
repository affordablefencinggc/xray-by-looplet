import {
  MAX_PLAN_BYTES,
  PLAN_CONTENT_DB,
  PLAN_CONTENT_STORE,
  type ImportedPlan,
  type PlanContentStore,
  type StoredPlanContent,
  type SupportedPlanKind,
} from "./documentContract.ts";
import type { DocumentRevision } from "./domain.ts";

const MIME_BY_KIND: Record<SupportedPlanKind, string> = {
  pdf: "application/pdf",
  dxf: "application/dxf",
  svg: "image/svg+xml",
};

let fallbackId = 0;

export class PlanInspectionError extends Error {
  readonly code:
    | "empty"
    | "too-large"
    | "unsupported"
    | "type-mismatch"
    | "malformed"
    | "unavailable";

  constructor(
    code:
      | "empty"
      | "too-large"
      | "unsupported"
      | "type-mismatch"
      | "malformed"
      | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "PlanInspectionError";
    this.code = code;
  }
}

export async function inspectPlanBytes(
  input: {
    name: string;
    bytes: Uint8Array;
    source: "web" | "desktop";
    takeoff?: unknown | null;
  },
  now = new Date().toISOString(),
): Promise<ImportedPlan> {
  const name = input.name.trim();
  if (!name || name.length > 300) {
    throw new PlanInspectionError("unsupported", "Choose a plan with a filename between 1 and 300 characters.");
  }
  if (!(input.bytes instanceof Uint8Array)) {
    throw new PlanInspectionError("malformed", "The selected plan did not provide readable binary bytes.");
  }
  if (input.bytes.byteLength === 0) {
    throw new PlanInspectionError("empty", `${name} is empty.`);
  }
  if (input.bytes.byteLength > MAX_PLAN_BYTES) {
    throw new PlanInspectionError(
      "too-large",
      `${name} is larger than the 100 MB plan limit. Export a smaller plan set and try again.`,
    );
  }
  if (input.source !== "web" && input.source !== "desktop") {
    throw new PlanInspectionError("unsupported", "The plan source must be web or desktop.");
  }

  const expected = kindFromName(name);
  if (!expected) {
    throw new PlanInspectionError(
      "unsupported",
      `${name} is not supported. Import a PDF, DXF, or SVG plan.`,
    );
  }

  const detected = detectKind(input.bytes);
  if (detected !== expected) {
    const detail = detected ? `contains ${detected.toUpperCase()} data` : "has unrecognised file contents";
    throw new PlanInspectionError(
      "type-mismatch",
      `${name} has a .${expected} extension but ${detail}. Export it again in the correct format.`,
    );
  }

  let pageCount: number;
  if (expected === "pdf") {
    pageCount = await countPdfPages(input.bytes);
  } else {
    pageCount = 1;
  }

  let importedAt: string;
  try {
    importedAt = new Date(now).toISOString();
  } catch {
    throw new PlanInspectionError("malformed", "The document import time is invalid.");
  }

  const bytes = new Uint8Array(input.bytes);
  const sha256 = await hashBytes(bytes);
  const id = createDocumentId();
  const revision: DocumentRevision = {
    id,
    name,
    kind: expected,
    importedAt,
    pageCount,
    sha256,
    source: input.source,
  };

  return {
    revision,
    binary: {
      documentId: id,
      name,
      kind: expected,
      mimeType: MIME_BY_KIND[expected],
      sizeBytes: bytes.byteLength,
      sha256,
      bytes,
    },
    takeoff: input.takeoff ?? null,
    note: `${expected.toUpperCase()} validated from file contents; ${pageCount} page${pageCount === 1 ? "" : "s"}.`,
  };
}

function kindFromName(name: string): SupportedPlanKind | null {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  const extension = match?.[1];
  return extension === "pdf" || extension === "dxf" || extension === "svg" ? extension : null;
}

function detectKind(bytes: Uint8Array): SupportedPlanKind | null {
  const head = decode(bytes.subarray(0, Math.min(bytes.byteLength, 4096)));
  if (head.slice(0, 1024).includes("%PDF-")) return "pdf";
  if (head.startsWith("AutoCAD Binary DXF\r\n\u001a\0")) return "dxf";
  if (/(?:^|\r?\n)\s*0\s*\r?\n\s*SECTION(?:\r?\n|$)/i.test(head)) return "dxf";

  const xml = head.replace(/^\uFEFF/, "").trimStart();
  if (/^(?:<\?xml[\s\S]*?\?>\s*)?(?:<!--(?:[\s\S]*?)-->\s*)*<svg\b/i.test(xml)) return "svg";
  return null;
}

async function countPdfPages(bytes: Uint8Array): Promise<number> {
  try {
    return countSimplePdfPages(bytes);
  } catch (simpleError) {
    if (!(simpleError instanceof PlanInspectionError) || !/compressed|unavailable/.test(simpleError.message)) {
      throw simpleError;
    }
    try {
      const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const task = getDocument({
        data: Uint8Array.from(bytes),
      });
      const document = await task.promise;
      const count = document.numPages;
      await task.destroy();
      if (!Number.isSafeInteger(count) || count < 1) throw new Error("no pages");
      return count;
    } catch {
      throw simpleError;
    }
  }
}

function countSimplePdfPages(bytes: Uint8Array): number {
  const text = decode(bytes);
  if (!/%%EOF\s*$/.test(text.trimEnd())) {
    throw new PlanInspectionError("malformed", "The PDF has no complete end marker and cannot be counted safely.");
  }

  const objects = new Map<number, string>();
  const objectStart = /(?:^|[\r\n])\s*(\d+)\s+(\d+)\s+obj\b/g;
  for (let match = objectStart.exec(text); match; match = objectStart.exec(text)) {
    const end = text.indexOf("endobj", objectStart.lastIndex);
    if (end < 0) {
      throw new PlanInspectionError("malformed", "The PDF contains an incomplete object and cannot be counted safely.");
    }
    objects.set(Number(match[1]), text.slice(objectStart.lastIndex, end));
    objectStart.lastIndex = end + "endobj".length;
  }

  const catalog = [...objects.values()].find((object) => /\/Type\s*\/Catalog\b/.test(dictionaryPart(object)));
  const rootRef = catalog && dictionaryPart(catalog).match(/\/Pages\s+(\d+)\s+\d+\s+R\b/);
  if (!rootRef) {
    throw new PlanInspectionError(
      "malformed",
      "The PDF page tree is compressed or missing, so its actual page count cannot be verified in the browser.",
    );
  }

  const visiting = new Set<number>();
  const countNode = (id: number): number => {
    if (visiting.has(id)) {
      throw new PlanInspectionError("malformed", "The PDF page tree contains a cycle.");
    }
    const object = objects.get(id);
    if (!object) {
      throw new PlanInspectionError("malformed", "The PDF page tree references an unavailable object.");
    }
    const dictionary = dictionaryPart(object);
    if (/\/Type\s*\/Page\b/.test(dictionary)) return 1;
    if (!/\/Type\s*\/Pages\b/.test(dictionary)) {
      throw new PlanInspectionError("malformed", "The PDF page tree contains an object that is not a page.");
    }
    const kids = dictionary.match(/\/Kids\s*\[([\s\S]*?)\]/)?.[1];
    const refs = kids ? [...kids.matchAll(/(\d+)\s+\d+\s+R\b/g)].map((match) => Number(match[1])) : [];
    if (refs.length === 0) {
      throw new PlanInspectionError("malformed", "The PDF page tree has no countable page children.");
    }
    visiting.add(id);
    const count = refs.reduce((sum, child) => sum + countNode(child), 0);
    visiting.delete(id);
    const declared = dictionary.match(/\/Count\s+(\d+)\b/)?.[1];
    if (declared !== undefined && Number(declared) !== count) {
      throw new PlanInspectionError("malformed", "The PDF declared page count does not match its page tree.");
    }
    return count;
  };

  const count = countNode(Number(rootRef[1]));
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new PlanInspectionError("malformed", "The PDF does not contain a countable page.");
  }
  return count;
}

function dictionaryPart(object: string): string {
  const streamAt = object.search(/(?:^|[\r\n])stream(?:\r?\n|$)/);
  return streamAt < 0 ? object : object.slice(0, streamAt);
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder("latin1").decode(bytes);
}

async function hashBytes(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new PlanInspectionError(
      "unavailable",
      "Secure hashing is unavailable in this browser, so the plan was not imported.",
    );
  }
  const source = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", source);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createDocumentId(): string {
  if (globalThis.crypto && "randomUUID" in globalThis.crypto) {
    return `document-${globalThis.crypto.randomUUID()}`;
  }
  fallbackId += 1;
  return `document-${Date.now().toString(36)}-${fallbackId.toString(36)}`;
}

export function createBrowserPlanStore(): PlanContentStore {
  let database: Promise<IDBDatabase> | null = null;

  const open = () => {
    if (!globalThis.indexedDB) {
      return Promise.reject(new Error("Plan storage is unavailable in this browser. Keep the source file and try a supported browser."));
    }
    if (database) return database;
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = globalThis.indexedDB.open(PLAN_CONTENT_DB, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(PLAN_CONTENT_STORE)) {
          request.result.createObjectStore(PLAN_CONTENT_STORE, { keyPath: "documentId" });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          database = null;
        };
        resolve(db);
      };
      request.onerror = () => reject(new Error(`Could not open plan storage: ${request.error?.message ?? "unknown IndexedDB error"}`));
      request.onblocked = () => reject(new Error("Plan storage upgrade is blocked. Close other X-Ray tabs and try again."));
    }).catch((error) => {
      database = null;
      throw error;
    });
    return database;
  };

  const transact = async <T>(
    mode: IDBTransactionMode,
    operation: string,
    issue: (store: IDBObjectStore, setResult: (value: T) => void) => void,
  ): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      let result: T;
      let failed = false;
      const transaction = db.transaction(PLAN_CONTENT_STORE, mode);
      const fail = () => {
        if (failed) return;
        failed = true;
        reject(new Error(`Could not ${operation} plan content: ${transaction.error?.message ?? "the browser storage transaction failed"}`));
      };
      transaction.onabort = fail;
      transaction.onerror = fail;
      transaction.oncomplete = () => {
        if (!failed) resolve(result);
      };
      try {
        issue(transaction.objectStore(PLAN_CONTENT_STORE), (value) => {
          result = value;
        });
      } catch (error) {
        failed = true;
        transaction.abort();
        reject(new Error(`Could not ${operation} plan content: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
  };

  return {
    async get(documentId) {
      return transact<StoredPlanContent | null>("readonly", "read", (store, setResult) => {
        const request = store.get(documentId);
        request.onsuccess = () => {
          const value = request.result as StoredPlanContent | undefined;
          if (value === undefined) {
            setResult(null);
            return;
          }
          if (!isStoredPlanContent(value)) {
            request.transaction?.abort();
            return;
          }
          setResult({ ...value, bytes: value.bytes.slice(0) });
        };
      });
    },
    async put(content) {
      await transact<void>("readwrite", "save", (store, setResult) => {
        if (!isStoredPlanContent(content)) throw new Error("the plan content record is invalid");
        store.put({ ...content, bytes: content.bytes.slice(0) });
        setResult(undefined);
      });
    },
    async remove(documentId) {
      await transact<void>("readwrite", "remove", (store, setResult) => {
        store.delete(documentId);
        setResult(undefined);
      });
    },
  };
}

function isStoredPlanContent(value: unknown): value is StoredPlanContent {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<StoredPlanContent>;
  return (
    typeof record.documentId === "string" && record.documentId.length > 0 &&
    typeof record.name === "string" && record.name.length > 0 &&
    (record.kind === "pdf" || record.kind === "dxf" || record.kind === "svg") &&
    typeof record.mimeType === "string" &&
    Number.isSafeInteger(record.sizeBytes) && Number(record.sizeBytes) >= 0 &&
    typeof record.sha256 === "string" && /^[a-f0-9]{64}$/.test(record.sha256) &&
    record.bytes instanceof ArrayBuffer && record.bytes.byteLength === record.sizeBytes
  );
}
