import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  MAX_PHOTO_BYTES,
  PhotoImportError,
  createBrowserPhotoStore,
  createMemoryPhotoStore,
  importPhotoFile,
  photoContentObjectUrl,
  verifyPhotoContent,
  type StoredPhotoContent,
} from "./evidence.ts";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_END = [0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];

function pngBytes(size = 40): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set(PNG_SIGNATURE, 0);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  bytes.set(PNG_END, size - PNG_END.length);
  return bytes;
}

const jpegBytes = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00, 0xff, 0xd9]);

function webpBytes(): Uint8Array {
  const bytes = new Uint8Array(20);
  bytes.set(new TextEncoder().encode("RIFF"), 0);
  new DataView(bytes.buffer).setUint32(4, bytes.byteLength - 8, true);
  bytes.set(new TextEncoder().encode("WEBPVP8X"), 8);
  return bytes;
}

function ownedBuffer(bytes: Uint8Array | readonly number[]): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

describe("photo evidence import", () => {
  it("hashes real bytes and produces matching v2 metadata/content", async () => {
    const bytes = pngBytes();
    const file = new File([ownedBuffer(bytes)], "yard.png", { type: "image/png", lastModified: 1 });
    const imported = await importPhotoFile(file, 3, "2026-09-04T01:02:03.000Z", "desktop");
    const expectedHash = createHash("sha256").update(bytes).digest("hex");

    assert.deepEqual(imported.record, {
      id: imported.content.id,
      revision: 1,
      name: "yard.png",
      mimeType: "image/png",
      sizeBytes: bytes.byteLength,
      sha256: expectedHash,
      order: 3,
      addedAt: "2026-09-04T01:02:03.000Z",
      updatedAt: "2026-09-04T01:02:03.000Z",
      capturedAt: null,
      source: "desktop",
      caption: "",
      runIds: [],
      gateIds: [],
    });
    assert.equal(imported.content.sha256, expectedHash);
    assert.equal(imported.content.name, file.name);
    assert.equal(imported.content.mimeType, file.type);
    assert.deepEqual(new Uint8Array(imported.content.bytes), bytes);
  });

  it("generates a unique ID for each import", async () => {
    const first = await importPhotoFile(
      new File([ownedBuffer(jpegBytes())], "one.jpg", { type: "image/jpeg" }),
      0,
    );
    const second = await importPhotoFile(
      new File([ownedBuffer(jpegBytes())], "two.jpg", { type: "image/jpeg" }),
      1,
    );
    assert.notEqual(first.record.id, second.record.id);
    assert.match(first.record.id, /^photo-/);
  });

  it("accepts declared WebP content with a matching RIFF/WEBP signature", async () => {
    const imported = await importPhotoFile(
      new File([ownedBuffer(webpBytes())], "wide-angle.webp", { type: "image/webp" }),
      0,
    );
    assert.equal(imported.record.mimeType, "image/webp");
    assert.equal(imported.content.mimeType, "image/webp");
  });

  it("accepts the exact 25 MiB boundary and rejects one byte beyond it before reading", async () => {
    const boundary = pngBytes(MAX_PHOTO_BYTES);
    const accepted = await importPhotoFile(
      new File([ownedBuffer(boundary)], "boundary.png", { type: "image/png" }),
      0,
    );
    assert.equal(accepted.record.sizeBytes, MAX_PHOTO_BYTES);

    let read = false;
    const oversized = {
      name: "oversized.png",
      type: "image/png",
      size: MAX_PHOTO_BYTES + 1,
      arrayBuffer: async () => {
        read = true;
        return new ArrayBuffer(0);
      },
    } as File;
    await assert.rejects(importPhotoFile(oversized, 1), (error: unknown) => {
      assert.ok(error instanceof PhotoImportError);
      return error.code === "too-large";
    });
    assert.equal(read, false);
  });

  it("fails closed for empty, unsupported, malformed, and type-mismatched files", async () => {
    await assert.rejects(
      importPhotoFile(new File([], "empty.png", { type: "image/png" }), 0),
      (error: unknown) => error instanceof PhotoImportError && error.code === "empty",
    );
    await assert.rejects(
      importPhotoFile(
        new File([ownedBuffer([0x47, 0x49, 0x46])], "image.gif", { type: "image/gif" }),
        0,
      ),
      (error: unknown) => error instanceof PhotoImportError && error.code === "unsupported",
    );
    await assert.rejects(
      importPhotoFile(
        new File([ownedBuffer(PNG_SIGNATURE)], "truncated.png", { type: "image/png" }),
        0,
      ),
      (error: unknown) => error instanceof PhotoImportError && error.code === "malformed",
    );
    await assert.rejects(
      importPhotoFile(
        new File([ownedBuffer(jpegBytes())], "disguised.png", { type: "image/png" }),
        0,
      ),
      (error: unknown) => error instanceof PhotoImportError && error.code === "type-mismatch",
    );
  });

  it("rejects invalid ordering and timestamps", async () => {
    const file = new File([ownedBuffer(pngBytes())], "site.png", { type: "image/png" });
    await assert.rejects(importPhotoFile(file, -1), /order/i);
    await assert.rejects(importPhotoFile(file, 0, "not-a-date"), /time/i);
  });
});

describe("photo content stores", () => {
  it("rehashes retrieved bytes instead of trusting stored hash metadata", async () => {
    const imported = await importPhotoFile(
      new File([ownedBuffer(pngBytes())], "verified.png", { type: "image/png" }),
      0,
    );
    assert.equal((await verifyPhotoContent(imported.content, imported.record)).status, "ready");
    const corrupted = { ...imported.content, bytes: imported.content.bytes.slice(0) };
    new Uint8Array(corrupted.bytes)[20] ^= 0xff;
    const result = await verifyPhotoContent(corrupted, imported.record);
    assert.equal(result.status, "corrupt");
    assert.match(result.message, /SHA-256/i);
    assert.equal((await verifyPhotoContent(null, imported.record)).status, "missing");
  });
  it("supports isolated memory CRUD and listing", async () => {
    const imported = await importPhotoFile(
      new File([ownedBuffer(pngBytes())], "stored.png", { type: "image/png" }),
      0,
    );
    const store = createMemoryPhotoStore();
    await store.put(imported.content);

    new Uint8Array(imported.content.bytes)[20] = 0xff;
    const stored = await store.get(imported.content.id);
    assert.ok(stored);
    assert.notEqual(new Uint8Array(stored.bytes)[20], 0xff);
    assert.equal((await store.list()).length, 1);

    await store.delete(imported.content.id);
    assert.equal(await store.get(imported.content.id), null);
    assert.deepEqual(await store.list(), []);
  });

  it("fails clearly when browser IndexedDB is unavailable", async () => {
    if (globalThis.indexedDB) return;
    await assert.rejects(createBrowserPhotoStore().list(), (error: unknown) => {
      assert.ok(error instanceof PhotoImportError);
      return error.code === "unavailable" && /unavailable/i.test(error.message);
    });
  });

  it("creates a revocable object URL for verified content", async () => {
    if (typeof URL.createObjectURL !== "function") return;
    const { content } = await importPhotoFile(
      new File([ownedBuffer(pngBytes())], "preview.png", { type: "image/png" }),
      0,
    );
    const url = photoContentObjectUrl(content as StoredPhotoContent);
    assert.match(url, /^blob:/);
    URL.revokeObjectURL(url);
  });
});
