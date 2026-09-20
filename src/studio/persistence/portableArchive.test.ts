import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PORTABLE_ARCHIVE_SCHEMA,
  archiveManifestSchema,
  archiveSealInput,
  canonicalJson,
  sealArchiveManifest,
  verifyArchiveEntries,
  type ArchiveEntry,
  type ArchiveManifest,
} from "./portableArchive.ts";

/** Real SHA-256. `crypto.subtle` is present in Node 24, so the seal tests exercise genuine hashing
 *  rather than a stand-in that could hide a canonicalisation defect. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, "0")).join("");
}

const encoder = new TextEncoder();
export async function sha256Text(value: string): Promise<string> {
  return sha256Hex(encoder.encode(value));
}

const RECORDS_PATH = "records/workspace.json";

/** A two-entry fixture with one original plus the workspace record. A project
 *  without originals is also valid and needs only its workspace record. */
export async function buildInput(overrides: Partial<Omit<ArchiveManifest, "sealSha256">> = {}) {
  const recordsBytes = encoder.encode('{"architecture":null}');
  const planBytes = encoder.encode("PLAN-BYTES");
  const entries: ArchiveEntry[] = [
    { path: "plans/site.pdf", kind: "plan", id: "doc-1", sha256: await sha256Hex(planBytes), sizeBytes: planBytes.byteLength },
    { path: RECORDS_PATH, kind: "record", id: "records", sha256: await sha256Hex(recordsBytes), sizeBytes: recordsBytes.byteLength },
  ];
  const base: Omit<ArchiveManifest, "sealSha256"> = {
    format: PORTABLE_ARCHIVE_SCHEMA,
    createdAt: "2026-09-19T04:00:00.000Z",
    jobId: "job-1",
    jobName: "Whitfield extension",
    jobRevision: 3,
    sourceFormat: PORTABLE_ARCHIVE_SCHEMA,
    recordsPath: RECORDS_PATH,
    entries,
    entryCount: entries.length,
    totalBytes: entries.reduce((sum, entry) => sum + entry.sizeBytes, 0),
    ...overrides,
  };
  return { base, recordsBytes, planBytes };
}

/** `sealArchiveManifest` is synchronous by design (deliveryRecord.ts keeps crypto out of the module),
 *  so the tests pre-compute the digest it would compute and hand it back. */
export async function sealSync(input: Omit<ArchiveManifest, "sealSha256">): Promise<ArchiveManifest> {
  const digest = await sha256Text(canonicalJson(input));
  return sealArchiveManifest(input, () => digest);
}

describe("SC-15 portable archive manifest", () => {
  it("A1 rejects two entries claiming the same path", async () => {
    const { base, recordsBytes } = await buildInput();
    const entries = [
      base.entries[0],
      { ...base.entries[1], path: base.entries[0].path, kind: "record" as const },
      {
        path: RECORDS_PATH,
        kind: "record" as const,
        id: "records",
        sha256: await sha256Hex(recordsBytes),
        sizeBytes: recordsBytes.byteLength,
      },
    ];
    await assert.rejects(
      sealSync({ ...base, entries, entryCount: entries.length, totalBytes: base.totalBytes }),
      /same path/,
    );
  });

  it("A2 rejects two entries claiming the same file identity", async () => {
    const { base } = await buildInput();
    const entries = [base.entries[0], { ...base.entries[0], path: "plans/site-copy.pdf" }, base.entries[1]];
    await assert.rejects(
      sealSync({ ...base, entries, entryCount: entries.length, totalBytes: base.totalBytes + base.entries[0].sizeBytes }),
      /same file identity/,
    );
  });

  it("A3 rejects a recordsPath that names no entry", async () => {
    const { base } = await buildInput({ recordsPath: "records/missing.json" });
    await assert.rejects(sealSync(base), /exactly one records entry/);
  });

  it("A4 rejects an entryCount that disagrees with the entries", async () => {
    const { base } = await buildInput({ entryCount: 3 });
    await assert.rejects(sealSync(base), /entryCount does not match/);
  });

  it("A5 rejects a totalBytes that disagrees with the sum of entry sizes", async () => {
    const { base } = await buildInput({ totalBytes: 1 });
    await assert.rejects(sealSync(base), /totalBytes does not match/);
  });

  it("A6 rejects a traversing entry path", async () => {
    const { base } = await buildInput();
    const entries = [{ ...base.entries[0], path: "../../etc/passwd" }, base.entries[1]];
    await assert.rejects(sealSync({ ...base, entries }), /relative and must not traverse/);
  });

  it("A7 rejects an absolute entry path", async () => {
    const { base } = await buildInput();
    const entries = [{ ...base.entries[0], path: "/abs/path" }, base.entries[1]];
    await assert.rejects(sealSync({ ...base, entries }), /relative and must not traverse/);
  });

  it("A8 rejects an unknown key on the manifest", async () => {
    const { base } = await buildInput();
    await assert.rejects(sealSync({ ...base, unexpected: true } as never));
  });

  it("A9 verifies the seal, then every entry, before anything is written", async () => {
    const manifest = await sealSync((await buildInput()).base);
    const { planBytes, recordsBytes } = await buildInput();
    const tampered = encoder.encode("PLAN-BYTEZ");
    assert.equal(tampered.byteLength, planBytes.byteLength, "the tamper must preserve length so only the hash can catch it");
    const entries = new Map<string, Uint8Array>([
      ["plans/site.pdf", tampered],
      [RECORDS_PATH, recordsBytes],
    ]);
    // A genuine canonical hash. `assertArchiveSealIntact` compares the stored seal against the hash
    // of the canonical bytes, so this must be a real function of its input — passing a constant would
    // make the seal check vacuous and every assertion below would pass regardless of the module.
    const sealFor = async (candidate: ArchiveManifest) => sha256Text(archiveSealInput(candidate));
    const renamedHash = await sealFor({ ...manifest, jobName: "Renamed after sealing" });
    const canonicalHash = (canonical: string) => (canonical === archiveSealInput(manifest) ? manifest.sealSha256 : renamedHash);
    const planDigest = await sha256Hex(planBytes);
    const recordsDigest = await sha256Hex(recordsBytes);

    // A stub that hashes each entry correctly: the container is intact, only the manifest's own
    // bytes may be in question. Compared by content, not identity — each `buildInput()` call mints
    // fresh typed arrays, so `===` would never match.
    const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
    const honestHash = (bytes: Uint8Array) => (text(bytes) === "PLAN-BYTES" ? planDigest : recordsDigest);

    // (a) An edited manifest field that no entry hash covers and that does not disturb the entry list.
    //     Every entry verifies clean, so only the seal can catch this — the reason it exists. This is
    //     the assertion that fails if the seal check is removed from verifyArchiveEntries.
    const renamed = { ...manifest, jobName: "Renamed after sealing" };
    assert.throws(
      () => verifyArchiveEntries(renamed, (path) => entries.get(path) ?? null, honestHash, canonicalHash),
      /no longer matches its seal/,
    );

    // (b) A manifest swapped for a differently-sealed one, with intact entries: same guard, reached
    //     through the seal value rather than the manifest fields.
    assert.throws(
      () => verifyArchiveEntries(manifest, (path) => entries.get(path) ?? null, honestHash, () => "2".repeat(64)),
      /no longer matches its seal/,
    );

    // (c) A sealed manifest whose entry bytes changed. The seal cannot see this, so the per-entry
    //     hash check must fire.
    assert.throws(
      () =>
        verifyArchiveEntries(
          manifest,
          (path) => entries.get(path) ?? null,
          (bytes) => (bytes === tampered ? "1".repeat(64) : recordsDigest),
          canonicalHash,
        ),
      /failed SHA-256 verification/,
    );

    // (d) A missing entry is refused rather than silently skipped.
    assert.throws(
      () => verifyArchiveEntries(manifest, () => null, () => planDigest, canonicalHash),
      /missing the entry/,
    );

    // (e) A length mismatch is refused before hashing, so a truncated container cannot be mistaken
    //     for an intact one.
    assert.throws(
      () =>
        verifyArchiveEntries(
          manifest,
          (path) => (path === "plans/site.pdf" ? planBytes.subarray(0, 4) : entries.get(path)!),
          () => planDigest,
          canonicalHash,
        ),
      /but the manifest declares/,
    );
  });

  it("A10 canonicalJson is order-independent and pinned to an exact byte sequence", async () => {
    const { base } = await buildInput();
    const reordered = {
      totalBytes: base.totalBytes,
      entries: base.entries.map((entry) => ({ sizeBytes: entry.sizeBytes, sha256: entry.sha256, id: entry.id, kind: entry.kind, path: entry.path })),
      entryCount: base.entryCount,
      recordsPath: base.recordsPath,
      sourceFormat: base.sourceFormat,
      jobRevision: base.jobRevision,
      jobName: base.jobName,
      jobId: base.jobId,
      createdAt: base.createdAt,
      format: base.format,
    };

    // (a) The same logical manifest built in two insertion orders serialises identically. Comparing
    //     the two results to *each other* alone would pass for any consistent implementation,
    //     including one that sorts backwards, so (b) pins the bytes.
    assert.equal(canonicalJson(base), canonicalJson(reordered));

    // (b) An exact expected prefix: keys sorted, no whitespace. This is the assertion that fails if
    //     the canonical form ever changes, which is what the archive seal's reproducibility rests on.
    const canonical = canonicalJson({ b: 1, a: { d: [3, 1], c: "x" }, "": true });
    assert.equal(canonical, '{"":true,"a":{"c":"x","d":[3,1]},"b":1}');
    assert.equal(canonicalJson(base).startsWith('{"createdAt":'), true, "manifest keys are emitted in sorted order");

    // (c) A stable canonical form must produce a stable seal.
    const first = await sealSync(base);
    const second = await sealSync(reordered);
    assert.equal(first.sealSha256, second.sealSha256);
    assert.deepEqual(first, archiveManifestSchema.parse(second));
  });
});

function assertArchivesEqual(left: ArchiveManifest, right: ArchiveManifest): void {
  assert.deepEqual(left, archiveManifestSchema.parse(right));
}
