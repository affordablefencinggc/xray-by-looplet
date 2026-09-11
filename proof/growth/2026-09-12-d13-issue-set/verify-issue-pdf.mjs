// Reads the issued PDF back and reports what it actually contains.
// Run: node proof/growth/2026-09-12-d13-issue-set/verify-issue-pdf.mjs
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { PDFDocument } from 'pdf-lib';

const file = new URL('./issue-set-4-sheets.pdf', import.meta.url);
const bytes = readFileSync(file);

const doc = await PDFDocument.load(bytes);
console.log('pages          :', doc.getPageCount());
console.log('title          :', doc.getTitle());
console.log('subject        :', doc.getSubject());
doc.getPages().forEach((page, i) => {
  const w = Math.round(page.getWidth());
  const h = Math.round(page.getHeight());
  const kind = i === 0 ? 'register' : 'drawing';
  console.log(`  page ${i + 1} (${kind}) : ${w} x ${h} pt ${h > w ? 'portrait' : 'landscape'}`);
});

// Decode the register page's drawn text from the content stream.
const raw = bytes.toString('latin1');
let inflated = '';
const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
let m;
while ((m = re.exec(raw))) {
  try {
    inflated += inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1') + '\n@@\n';
  } catch {}
}
const texts = [...inflated.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)].map((x) =>
  Buffer.from(x[1], 'hex').toString('latin1'),
);
console.log('\nregister page text drawn:');
for (const line of texts.filter((t) => /REGISTER|Purpose|revision|sheets in this issue|^\s*\d+\s+/.test(t))) {
  console.log('  ' + line);
}
