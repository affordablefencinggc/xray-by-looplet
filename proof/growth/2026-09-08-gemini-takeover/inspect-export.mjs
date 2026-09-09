import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createHash } from 'node:crypto';
const base = 'proof/growth/2026-09-08-gemini-takeover';
const bytes = fs.readFileSync(`${base}/exported-model-sheets.pdf`);
const loading = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
const pdf = await loading.promise;
assert.equal(pdf.numPages, 5);
const pages = [];
for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i), viewport = page.getViewport({ scale: 1.4 });
  assert(Math.abs(page.view[2] - 841.89) < 1 && Math.abs(page.view[3] - 595.28) < 1, 'Expected A4 landscape page');
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise;
  const png = canvas.toBuffer('image/png');
  const path = `screenshots/growth/2026-09-08-takeover-pdf-final-page-${i}.png`;
  fs.writeFileSync(path, png);
  pages.push({ page: i, path, sha256: createHash('sha256').update(png).digest('hex') });
}
await loading.destroy();
fs.writeFileSync(`${base}/pdf-inspection-final.json`, JSON.stringify({ status: 'pass', pdfSha256: createHash('sha256').update(bytes).digest('hex'), pages }, null, 2));
console.log(JSON.stringify({ pages: pages.length, status: 'pass' }));
