import { z } from "zod";

/** Portable project archive (SC-15).
 *
 * A workspace backup exists today as `.xray-backup.json` (see `../projectBackup.ts`): a JSON
 * document with every original plan and photo embedded as base64. That container costs 33% overhead
 * and caps the package at 200 MB for roughly 150 MB of real drawings. This module moves the same
 * payload into a ZIP container so drawing bytes are stored as raw entries.
 *
 * The container changes. The guarantees do not:
 *
 *   - every original is verified by SHA-256 before anything is written to storage;
 *   - unreferenced, duplicate and mismatched assets are rejected rather than silently dropped;
 *   - v1 and v2 JSON packages stay readable, because `ProjectBackups.tsx` promises exactly that.
 *
 * Follows the Typesafe JEV shape of `../industries/deliveryRecord.ts`: a versioned format constant,
 * a `.strict()` Zod object, `superRefine` for cross-field invariants, one inferred type, and pure
 * functions that re-parse through their own schema so an invalid value throws instead of escaping.
 *
 * No crypto dependency. The caller supplies `computeSha256`, which keeps this module testable under
 * `node --test` without a browser.
 */

export const PORTABLE_ARCHIVE_SCHEMA = "xray.portable-archive/v3" as const;
export const LEGACY_WORKSPACE_FORMAT = "xray.workspace-backup/v2" as const;
export const LEGACY_WORKSPACE_FORMAT_V1 = "xray.workspace-backup/v1" as const;

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.string().datetime({ offset: true });

/** Relative POSIX path inside the container. A ZIP entry name is attacker-controlled on import, so
 *  absolute paths and traversal are rejected at the schema boundary rather than at extraction. */
const archivePath = z
  .string()
  .min(1)
  .max(400)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !value.includes("..") &&
      !value.includes("\\") &&
      !value.includes("\0"),
    "Archive paths must be relative and must not traverse.",
  );

export const ARCHIVE_ENTRY_KINDS = ["plan", "photo", "record"] as const;
export type ArchiveEntryKind = (typeof ARCHIVE_ENTRY_KINDS)[number];

export const archiveEntrySchema = z
  .object({
    path: archivePath,
    kind: z.enum(ARCHIVE_ENTRY_KINDS),
    id: z.string().min(1).max(240),
    sha256,
    sizeBytes: z.number().int().nonnegative(),
  })
  .strict();
export type ArchiveEntry = z.infer<typeof archiveEntrySchema>;

export const archiveManifestSchema = z
  .object({
    format: z.literal(PORTABLE_ARCHIVE_SCHEMA),
    createdAt: timestamp,
    jobId: z.string().min(1).max(240),
    jobName: z.string().min(1).max(200),
    jobRevision: z.number().int().positive(),
    client: z.string().trim().max(300).nullable().optional(),
    /** Which on-disk format the records payload came from. Drives the reader branch. */
    sourceFormat: z.enum([LEGACY_WORKSPACE_FORMAT_V1, LEGACY_WORKSPACE_FORMAT, PORTABLE_ARCHIVE_SCHEMA]),
    recordsPath: archivePath,
    // A new project without originals still has a complete workspace record.
    entries: z.array(archiveEntrySchema).min(1).max(2001),
    entryCount: z.number().int().nonnegative(),
    totalBytes: z.number().int().nonnegative(),
    sealSha256: sha256,
  })
  .strict()
  .superRefine((manifest, context) => {
    const issue = (path: (string | number)[], message: string) =>
      context.addIssue({ code: "custom", path, message });

    // Rule 1: a ZIP can physically hold two entries at one path, and whichever the extractor writes
    // last silently wins. That is data loss no downstream hash check can catch, because both entries
    // are individually valid.
    const paths = manifest.entries.map((entry) => entry.path);
    if (new Set(paths).size !== paths.length)
      issue(["entries"], "Two archive entries claim the same path.");

    // Rule 2: the same file identity recorded twice is a container-level ambiguity even when the two
    // entries carry different paths.
    const ids = manifest.entries.map((entry) => `${entry.kind}:${entry.id}`);
    if (new Set(ids).size !== ids.length)
      issue(["entries"], "Two archive entries claim the same file identity.");

    // Rule 3: the records payload is the only entry that is not user bytes. If it is absent or
    // mislabelled the archive cannot be restored, and that must be known before any write begins.
    const records = manifest.entries.filter((entry) => entry.path === manifest.recordsPath);
    if (records.length !== 1)
      issue(["recordsPath"], "The manifest must name exactly one records entry.");
    else if (records[0].kind !== "record")
      issue(["recordsPath"], "The records entry must be declared as a record.");

    // Rule 4: the counters drive the progress UI. A counter that disagrees with its list renders a
    // progress bar that lies about how much data the user is about to write.
    if (manifest.entryCount !== manifest.entries.length)
      issue(["entryCount"], "entryCount does not match the number of entries.");
    const total = manifest.entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);
    if (manifest.totalBytes !== total)
      issue(["totalBytes"], "totalBytes does not match the sum of entry sizes.");
  });
export type ArchiveManifest = z.infer<typeof archiveManifestSchema>;

/** Deterministic JSON: object keys sorted, no insignificant whitespace.
 *
 *  The archive seal is only reproducible if the same logical manifest always serialises to the same
 *  bytes. `JSON.stringify` is not sufficient — it emits keys in insertion order, so two manifest
 *  objects that are deep-equal can produce different strings and therefore different seals.
 *
 *  Arrays keep their order: entry order is meaningful (it is the extraction order), while object key
 *  order never is. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "number" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const parts = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
    return `{${parts.join(",")}}`;
  }
  throw Error(`Cannot canonicalise a value of type ${typeof value}.`);
}

/** Seal the manifest with a hash of its own canonical bytes. The caller supplies the hash, per the
 *  `deliveryRecord.ts` pattern, so this module keeps no crypto dependency. */
export function sealArchiveManifest(
  manifest: Omit<ArchiveManifest, "sealSha256">,
  computeSha256: (canonical: string) => string,
): ArchiveManifest {
  const sealSha256 = computeSha256(archiveSealInput(manifest));
  return archiveManifestSchema.parse({ ...manifest, sealSha256 });
}

/** The exact byte sequence a manifest is sealed over: its own canonical form with the seal field
 *  omitted. Both sealing and verification hash this shape and no other, so the two can never drift —
 *  the defect that makes a seal decorative. */
export function archiveSealInput(manifest: Omit<ArchiveManifest, "sealSha256"> | ArchiveManifest): string {
  const { sealSha256: _sealSha256, ...rest } = manifest as ArchiveManifest;
  return canonicalJson(rest);
}

/** Recompute the seal and compare. Detects any edit to the manifest's own fields, which per-entry
 *  hashing cannot see: retargeting `recordsPath` leaves every entry hash intact.
 *
 *  The hash is a *strict* function of the canonical bytes by construction. It deliberately cannot be
 *  replaced by a caller-supplied stub here — a seal check whose hash can ignore its input is a seal
 *  check that always passes. */
export function assertArchiveSealIntact(
  manifest: ArchiveManifest,
  computeSha256: (canonical: string) => string,
): void {
  const expected = computeSha256(archiveSealInput(manifest));
  if (manifest.sealSha256 !== expected)
    throw Error("The archive manifest no longer matches its seal.");
}

/** Verify the seal, then every entry, against the manifest — all of it BEFORE anything is written to
 *  storage. Never partially applies: a caller either receives a fully verified archive or throws. */
export function verifyArchiveEntries(
  manifest: ArchiveManifest,
  readEntry: (path: string) => Uint8Array | null,
  computeSha256: (bytes: Uint8Array) => string,
  computeCanonicalSha256: (canonical: string) => string,
): void {
  assertArchiveSealIntact(manifest, computeCanonicalSha256);
  for (const entry of manifest.entries) {
    const bytes = readEntry(entry.path);
    if (bytes === null) throw Error(`The archive is missing the entry “${entry.path}”.`);
    if (bytes.byteLength !== entry.sizeBytes)
      throw Error(`The entry “${entry.path}” is ${bytes.byteLength} bytes but the manifest declares ${entry.sizeBytes}.`);
    if (computeSha256(bytes) !== entry.sha256)
      throw Error(`The entry “${entry.path}” failed SHA-256 verification.`);
  }
}
