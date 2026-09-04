import type { PhotoEvidence } from "./domain.ts";

export const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
export const PHOTO_CONTENT_DB = "xray-photo-content-v1";
export const PHOTO_CONTENT_STORE = "photo-content";

const SUPPORTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type SupportedPhotoMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

export type StoredPhotoContent = {
  id: string;
  name: string;
  mimeType: SupportedPhotoMimeType;
  sha256: string;
  bytes: ArrayBuffer;
};

export type PhotoContentVerification =
  | { status: "ready"; content: StoredPhotoContent }
  | { status: "missing"; message: string }
  | { status: "corrupt"; message: string };

export interface PhotoContentStore {
  get(id: string): Promise<StoredPhotoContent | null>;
  put(content: StoredPhotoContent): Promise<void>;
  delete(id: string): Promise<void>;
  list(): Promise<StoredPhotoContent[]>;
}

export class PhotoImportError extends Error {
  readonly code:
    "empty" | "too-large" | "unsupported" | "type-mismatch" | "malformed" | "unavailable";

  constructor(code: PhotoImportError["code"], message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PhotoImportError";
    this.code = code;
  }
}

let fallbackId = 0;

export async function importPhotoFile(
  file: File,
  order: number,
  now = new Date().toISOString(),
  source: "web" | "desktop" = "web",
): Promise<{ record: PhotoEvidence; content: StoredPhotoContent }> {
  if (
    !file ||
    typeof file.name !== "string" ||
    typeof file.type !== "string" ||
    typeof file.arrayBuffer !== "function"
  ) {
    throw new PhotoImportError(
      "malformed",
      "The selected photo did not provide readable file data.",
    );
  }
  if (!file.name.trim() || file.name.length > 300) {
    throw new PhotoImportError(
      "unsupported",
      "Choose a photo with a filename between 1 and 300 characters.",
    );
  }
  if (!Number.isSafeInteger(order) || order < 0) {
    throw new PhotoImportError("malformed", "Photo order must be a non-negative integer.");
  }
  if (source !== "web" && source !== "desktop") {
    throw new PhotoImportError("unsupported", "Photo source must be web or desktop.");
  }
  if (file.size === 0) {
    throw new PhotoImportError("empty", `${file.name} is empty.`);
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new PhotoImportError("too-large", `${file.name} exceeds the 25 MiB photo limit.`);
  }
  if (!isSupportedMimeType(file.type)) {
    throw new PhotoImportError("unsupported", `${file.name} must be a JPEG, PNG, or WebP image.`);
  }

  let rawBytes: ArrayBuffer;
  try {
    rawBytes = await file.arrayBuffer();
  } catch (error) {
    throw new PhotoImportError("malformed", `Could not read ${file.name}.`, { cause: error });
  }
  if (!(rawBytes instanceof ArrayBuffer) || rawBytes.byteLength !== file.size) {
    throw new PhotoImportError("malformed", `${file.name} returned incomplete binary content.`);
  }
  const bytes = new Uint8Array(rawBytes);
  const detectedMimeType = detectPhotoMimeType(bytes);
  if (!detectedMimeType) {
    throw new PhotoImportError(
      "malformed",
      `${file.name} does not contain a valid JPEG, PNG, or WebP signature.`,
    );
  }
  if (detectedMimeType !== file.type) {
    throw new PhotoImportError(
      "type-mismatch",
      `${file.name} declares ${file.type} but contains ${detectedMimeType} data.`,
    );
  }

  const importedAt = normaliseTimestamp(now);
  const sha256 = await sha256Hex(bytes);
  const id = createPhotoId();
  const record: PhotoEvidence = {
    id,
    revision: 1,
    name: file.name,
    mimeType: file.type,
    sizeBytes: rawBytes.byteLength,
    sha256,
    order,
    addedAt: importedAt,
    updatedAt: importedAt,
    capturedAt: null,
    source,
    caption: "",
    runIds: [],
    gateIds: [],
  };
  const content: StoredPhotoContent = {
    id,
    name: file.name,
    mimeType: detectedMimeType,
    sha256,
    bytes: rawBytes.slice(0),
  };
  return { record, content };
}

export function createMemoryPhotoStore(): PhotoContentStore {
  const contents = new Map<string, StoredPhotoContent>();
  return {
    async get(id) {
      const content = contents.get(id);
      return content ? cloneContent(content) : null;
    },
    async put(content) {
      assertStoredPhotoContent(content);
      contents.set(content.id, cloneContent(content));
    },
    async delete(id) {
      contents.delete(id);
    },
    async list() {
      return [...contents.values()].map(cloneContent);
    },
  };
}

export function createBrowserPhotoStore(): PhotoContentStore {
  let database: Promise<IDBDatabase> | null = null;

  const open = () => {
    if (!globalThis.indexedDB) {
      return Promise.reject(
        new PhotoImportError(
          "unavailable",
          "Photo storage is unavailable in this browser. Keep the source images and try a supported browser.",
        ),
      );
    }
    if (database) return database;
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = globalThis.indexedDB.open(PHOTO_CONTENT_DB, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(PHOTO_CONTENT_STORE)) {
          request.result.createObjectStore(PHOTO_CONTENT_STORE, { keyPath: "id" });
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
      request.onerror = () =>
        reject(
          new Error(
            `Could not open photo storage: ${request.error?.message ?? "unknown IndexedDB error"}`,
          ),
        );
      request.onblocked = () =>
        reject(
          new Error("Photo storage upgrade is blocked. Close other X-Ray tabs and try again."),
        );
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
      const transaction = db.transaction(PHOTO_CONTENT_STORE, mode);
      const fail = () => {
        if (failed) return;
        failed = true;
        reject(
          new Error(
            `Could not ${operation} photo content: ${transaction.error?.message ?? "the browser storage transaction failed"}`,
          ),
        );
      };
      transaction.onabort = fail;
      transaction.onerror = fail;
      transaction.oncomplete = () => {
        if (!failed) resolve(result);
      };
      try {
        issue(transaction.objectStore(PHOTO_CONTENT_STORE), (value) => {
          result = value;
        });
      } catch (error) {
        failed = true;
        transaction.abort();
        reject(
          new Error(
            `Could not ${operation} photo content: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    });
  };

  return {
    async get(id) {
      return transact<StoredPhotoContent | null>("readonly", "read", (store, setResult) => {
        const request = store.get(id);
        request.onsuccess = () => {
          if (request.result === undefined) {
            setResult(null);
            return;
          }
          try {
            assertStoredPhotoContent(request.result);
            setResult(cloneContent(request.result));
          } catch {
            request.transaction?.abort();
          }
        };
      });
    },
    async put(content) {
      assertStoredPhotoContent(content);
      await transact<void>("readwrite", "save", (store, setResult) => {
        store.put(cloneContent(content));
        setResult(undefined);
      });
    },
    async delete(id) {
      await transact<void>("readwrite", "delete", (store, setResult) => {
        store.delete(id);
        setResult(undefined);
      });
    },
    async list() {
      return transact<StoredPhotoContent[]>("readonly", "list", (store, setResult) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const values = request.result;
          try {
            values.forEach(assertStoredPhotoContent);
            setResult(values.map(cloneContent));
          } catch {
            request.transaction?.abort();
          }
        };
      });
    },
  };
}

/** Creates a preview URL. The caller must revoke it with URL.revokeObjectURL. */
export function photoContentObjectUrl(content: StoredPhotoContent): string {
  assertStoredPhotoContent(content);
  if (typeof URL.createObjectURL !== "function") {
    throw new PhotoImportError("unavailable", "Photo previews are unavailable in this browser.");
  }
  return URL.createObjectURL(new Blob([content.bytes.slice(0)], { type: content.mimeType }));
}

/** Verifies stored bytes against canonical durable metadata before they become usable. */
export async function verifyPhotoContent(
  content: StoredPhotoContent | null,
  metadata: Pick<PhotoEvidence, "id" | "name" | "mimeType" | "sizeBytes" | "sha256">,
): Promise<PhotoContentVerification> {
  if (!content) {
    return {
      status: "missing",
      message: `${metadata.name} metadata exists, but its saved original is missing.`,
    };
  }
  try {
    assertStoredPhotoContent(content);
  } catch {
    return { status: "corrupt", message: `${metadata.name} has an invalid saved content record.` };
  }
  if (metadata.sha256 === null) {
    return { status: "corrupt", message: `${metadata.name} has no canonical SHA-256 metadata.` };
  }
  if (
    content.id !== metadata.id ||
    content.name !== metadata.name ||
    content.mimeType !== metadata.mimeType ||
    content.bytes.byteLength !== metadata.sizeBytes
  ) {
    return {
      status: "corrupt",
      message: `${metadata.name} saved original does not match its canonical metadata.`,
    };
  }
  const actualSha256 = await sha256Hex(new Uint8Array(content.bytes));
  if (actualSha256 !== metadata.sha256 || actualSha256 !== content.sha256) {
    return { status: "corrupt", message: `${metadata.name} failed SHA-256 verification.` };
  }
  return { status: "ready", content: cloneContent(content) };
}

function normaliseTimestamp(now: string): string {
  const timestamp = new Date(now);
  if (!Number.isFinite(timestamp.getTime())) {
    throw new PhotoImportError("malformed", "Photo import time is invalid.");
  }
  return timestamp.toISOString();
}

function createPhotoId(): string {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return `photo-${globalThis.crypto.randomUUID()}`;
  }
  fallbackId += 1;
  return `photo-${Date.now().toString(36)}-${fallbackId.toString(36)}`;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new PhotoImportError(
      "unavailable",
      "SHA-256 verification is unavailable in this browser.",
    );
  }
  const digestInput = new Uint8Array(bytes.byteLength);
  digestInput.set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", digestInput.buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isSupportedMimeType(value: string): value is SupportedPhotoMimeType {
  return (SUPPORTED_MIME_TYPES as readonly string[]).includes(value);
}

function detectPhotoMimeType(bytes: Uint8Array): SupportedPhotoMimeType | null {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff &&
    bytes.at(-2) === 0xff &&
    bytes.at(-1) === 0xd9
  ) {
    return "image/jpeg";
  }

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const pngEnd = [0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];
  if (
    bytes.length >= 32 &&
    pngSignature.every((byte, index) => bytes[index] === byte) &&
    bytes[12] === 0x49 &&
    bytes[13] === 0x48 &&
    bytes[14] === 0x44 &&
    bytes[15] === 0x52 &&
    pngEnd.every((byte, index) => bytes[bytes.length - pngEnd.length + index] === byte)
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 16 &&
    asciiAt(bytes, 0, "RIFF") &&
    asciiAt(bytes, 8, "WEBP") &&
    ["VP8 ", "VP8L", "VP8X"].some((chunk) => asciiAt(bytes, 12, chunk)) &&
    readUint32Le(bytes, 4) === bytes.length - 8
  ) {
    return "image/webp";
  }
  return null;
}

function asciiAt(bytes: Uint8Array, offset: number, expected: string): boolean {
  return [...expected].every(
    (character, index) => bytes[offset + index] === character.charCodeAt(0),
  );
}

function readUint32Le(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function assertStoredPhotoContent(value: unknown): asserts value is StoredPhotoContent {
  if (!value || typeof value !== "object") throw new Error("the photo content record is invalid");
  const content = value as Partial<StoredPhotoContent>;
  if (
    typeof content.id !== "string" ||
    !content.id ||
    typeof content.name !== "string" ||
    !content.name.trim() ||
    content.name.length > 300 ||
    typeof content.mimeType !== "string" ||
    !isSupportedMimeType(content.mimeType) ||
    typeof content.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(content.sha256) ||
    !(content.bytes instanceof ArrayBuffer) ||
    content.bytes.byteLength === 0 ||
    content.bytes.byteLength > MAX_PHOTO_BYTES ||
    detectPhotoMimeType(new Uint8Array(content.bytes)) !== content.mimeType
  ) {
    throw new Error("the photo content record is invalid");
  }
}

function cloneContent(content: StoredPhotoContent): StoredPhotoContent {
  return { ...content, bytes: content.bytes.slice(0) };
}
