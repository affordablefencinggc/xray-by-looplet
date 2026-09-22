// SC-15 named criterion: "Exporting a project with a 20MB source PDF completes in
// < 2 seconds." The UI path also captures records, base64-encodes for the backup
// package and hands a Blob to the download API; this harness measures only the
// container steps on a real 20 MB PDF and reports the numbers without claiming the
// UI criterion. Run: node --experimental-strip-types <this file>
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { unzipSync, zipSync } from "fflate";
import { buildBlueprintPdf } from "../../../../src/studio/blueprintBook.ts";
import { createDefaultJob } from "../../../../src/studio/domain.ts";
import { inspectPlanBytes } from "../../../../src/studio/documents.ts";
import { captureProjectBackup, decodeBackupBytes, emptyBackupRecords, encodeBackupBytes, parseProjectBackup } from "../../../../src/studio/projectBackup.ts";
import { createProjectArchive, parseProjectArchive } from "../../../../src/studio/persistence/projectArchive.ts";

const here = dirname(fileURLToPath(import.meta.url));
const TARGET_BYTES = 20 * 1024 * 1024;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

// A real PNG: pdf-lib rejects anything that is not a parseable image, and the
// fixture must be a genuine plan-sized PDF rather than a padded header.
const CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc32(body), out.length - 4);
  return out;
}
function noisePng(width, height, seed) {
  const raw = Buffer.alloc(height * (1 + width * 4));
  let state = seed >>> 0;
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 4); raw[row] = 0;
    for (let x = 0; x < width * 4; x++) {
      state = (state * 1664525 + 1013904223) >>> 0;
      raw[row + 1 + x] = state >>> 24;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 0 })), chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Pinning the writer's date makes the fixture reproducible: the digest below is
// then a property of this script rather than of the run, so the PDF need not be kept.
const generatedAt = process.env.SC15_FIXTURE_AT ?? new Date().toISOString();
const sheets = [];
let pdfBytes = new Uint8Array();
// Incompressible sheet imagery, as a real plan PDF carries: add sheets until the
// exported PDF is genuinely past 20 MB rather than assuming a size.
while (pdfBytes.length < TARGET_BYTES) {
  if (sheets.length >= 60) throw Error("Could not reach 20 MB within the writer's 100-sheet bound.");
  sheets.push({ dataUrl: `data:image/png;base64,${noisePng(760, 900, sheets.length + 1).toString("base64")}` });
  pdfBytes = await buildBlueprintPdf(sheets, { title: "SC-15 large source plan", generatedAt });
}
const pdfPath = join(tmpdir(), "xray-sc15-large-source-plan.pdf");
writeFileSync(pdfPath, pdfBytes);
const sourceSha = sha256(pdfBytes);
const reopened = await PDFDocument.load(pdfBytes);
const parsedPages = reopened.getPageCount();
if (parsedPages !== sheets.length) throw Error(`The exported fixture does not reopen as ${sheets.length} pages.`);

const inspected = await inspectPlanBytes({ name: "Large source plan.pdf", bytes: pdfBytes, source: "web" });
const job = { ...createDefaultJob(), documents: [inspected.revision], activeDocumentId: inspected.revision.id };
const records = emptyBackupRecords();
const captureStart = performance.now();
const backup = await captureProjectBackup(job, "SC-15 large source plan", {
  currentJob: () => job, records: async () => records, photo: async () => null,
  plan: async () => ({ ...inspected.binary, bytes: Uint8Array.from(pdfBytes).buffer }),
});
const captureMs = performance.now() - captureStart;

const exportStart = performance.now();
const archive = await createProjectArchive(backup, "SC-15 fixture client");
const exportMs = performance.now() - exportStart;
const importStart = performance.now();
const parsed = await parseProjectArchive(archive.bytes);
const importMs = performance.now() - importStart;

const restored = Uint8Array.from(Buffer.from(parsed.backup.assets[0].bytesBase64, "base64"));

// Locate the cost inside the container steps: the same primitives the module
// uses, timed individually, so a slow phase is identified rather than inferred.
const time = async (run) => { const at = performance.now(); const value = await run(); return { ms: Math.round((performance.now() - at) * 100) / 100, value }; };
const phases = {};
const serialized = await time(async () => JSON.stringify(backup));
phases.serializeBackupMs = serialized.ms;
phases.serializedChars = serialized.value.length;
phases.reparseBackupMs = (await time(() => parseProjectBackup(serialized.value))).ms;
phases.base64DecodeMs = (await time(() => decodeBackupBytes(backup.assets[0].bytesBase64))).ms;
phases.base64EncodeMs = (await time(() => encodeBackupBytes(Uint8Array.from(pdfBytes).buffer))).ms;
phases.zipStoreMs = (await time(() => zipSync({ "drawings/0.pdf": pdfBytes }, { level: 0 }))).ms;
phases.unzipMs = (await time(() => unzipSync(archive.bytes))).ms;

const receipt = {
  schema: "xray.sc15-large-pdf-container-timing/v1",
  generatedAt,
  fixture: {
    path: pdfPath, parseablePages: parsedPages, bytes: pdfBytes.length,
    sha256: sourceSha, appDetectedKind: inspected.revision.kind,
    // pdfjs is the browser parser; countSimplePdfPages is the in-process fallback.
    appPageCount: inspected.revision.pageCount ?? null,
  },
  timings: {
    captureMs: Math.round(captureMs * 100) / 100,
    exportContainerMs: Math.round(exportMs * 100) / 100,
    importContainerMs: Math.round(importMs * 100) / 100,
    exportUnderTwoSeconds: exportMs < 2000,
  },
  phases,
  sizes: {
    sourcePdfBytes: pdfBytes.length, archiveBytes: archive.bytes.length,
    manifestEntries: archive.manifest.entryCount, manifestTotalBytes: archive.manifest.totalBytes,
  },
  fidelity: {
    storedDrawingSha256: archive.manifest.entries.find((e) => e.kind === "plan").sha256,
    sourceMatchesStored: archive.manifest.entries.find((e) => e.kind === "plan").sha256 === sourceSha,
    restoredMatchesSource: sha256(restored) === sourceSha,
    restoredBytes: restored.length,
  },
  uiAcceptance: false,
  limits: "Node container measurement on a real 20 MB PDF: no browser, no UI capture, no Blob download, no DANS1 receipt, no IndexedDB restore. The UI criterion is not claimed.",
};
writeFileSync(join(here, "large-pdf-archive-timing.json"), JSON.stringify(receipt, null, 2) + "\n");
process.stdout.write(JSON.stringify(receipt, null, 2) + "\n");
process.exit(receipt.fidelity.sourceMatchesStored && receipt.fidelity.restoredMatchesSource ? 0 : 1);
