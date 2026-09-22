import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { deflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { buildBlueprintPdf } from "../../../../src/studio/blueprintBook.ts";
import { createDefaultJob } from "../../../../src/studio/domain.ts";
import { inspectPlanBytes } from "../../../../src/studio/documents.ts";
import { captureProjectBackup, emptyBackupRecords } from "../../../../src/studio/projectBackup.ts";
import { createProjectArchive, parseProjectArchive } from "../../../../src/studio/persistence/projectArchive.ts";

const TARGET = 20 * 1024 * 1024;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
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
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), out.length - 4);
  return out;
}
function noisePng(width, height, seed) {
  const raw = Buffer.alloc(height * (1 + width * 4));
  let state = seed >>> 0;
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 4);
    raw[row] = 0;
    for (let x = 0; x < width * 4; x += 1) {
      state = (state * 1664525 + 1013904223) >>> 0;
      raw[row + 1 + x] = state >>> 24;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 0 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const generatedAt = "2026-09-22T00:00:00.000Z";
const sheets = [];
let pdfBytes = new Uint8Array();
while (pdfBytes.length < TARGET) {
  if (sheets.length >= 8) throw Error(`PDF stayed under 20 MB at ${pdfBytes.length} bytes.`);
  sheets.push({ dataUrl: `data:image/png;base64,${noisePng(1600, 2000, sheets.length + 1).toString("base64")}` });
  pdfBytes = await buildBlueprintPdf(sheets, { title: "SC-15 large source plan", generatedAt });
  console.log(`sheet ${sheets.length} pdf ${pdfBytes.length}`);
}
const reopened = await PDFDocument.load(pdfBytes);
if (reopened.getPageCount() !== sheets.length) throw Error("The product PDF writer did not reopen the fixture.");
const sourceSha = sha256(pdfBytes);
const inspected = await inspectPlanBytes({ name: "Large source plan.pdf", bytes: pdfBytes, source: "web" });
const job = { ...createDefaultJob(), documents: [inspected.revision], activeDocumentId: inspected.revision.id };
const records = emptyBackupRecords();
const runs = [];
for (let run = 1; run <= 2; run += 1) {
  const exportStart = performance.now();
  const captured = await captureProjectBackup(job, "SC-15 large source plan", {
    currentJob: () => job,
    records: async () => records,
    photo: async () => null,
    plan: async () => ({ ...inspected.binary, bytes: Uint8Array.from(pdfBytes).buffer }),
  });
  const archive = await createProjectArchive(captured, "SC-15 fixture client");
  const exportMs = performance.now() - exportStart;
  const parsed = await parseProjectArchive(archive.bytes);
  const restored = Buffer.from(parsed.backup.assets[0].bytesBase64, "base64");
  const restoredSha = sha256(restored);
  const row = { run, exportMs: Math.round(exportMs * 100) / 100, restoredBytes: restored.length, restoredSha, match: restoredSha === sourceSha && restored.length === pdfBytes.length };
  console.log(JSON.stringify(row));
  if (!(exportMs < 2000)) throw Error(`Export run ${run} took ${exportMs} ms.`);
  if (!row.match) throw Error(`Run ${run} did not restore the original bytes.`);
  runs.push(row);
}
console.log(JSON.stringify({ ok: true, pdfBytes: pdfBytes.length, pages: sheets.length, sourceSha, runs }));
