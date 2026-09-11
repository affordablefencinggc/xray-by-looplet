import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const base = 'C:/Users/danie/repo/xray-by-looplet/proof/growth/2026-09-11-d13-export';

for (const tag of ['a3', 'a1']) {
  const s = readFileSync(`${base}/title-block-${tag}-max-address.pdf`).toString('latin1');
  let out = '';
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m;
  while ((m = re.exec(s))) {
    try {
      out += inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1');
    } catch {}
  }
  // pdf-lib writes hex strings: <48656C6C6F> Tj
  const texts = [...out.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)].map((x) =>
    Buffer.from(x[1], 'hex').toString('latin1'),
  );
  const addr = texts.find((t) => t.startsWith('xxx'));
  const name = texts.find((t) => t.includes('Redevelopment'));
  const num = texts.find((t) => /REV/.test(t));
  console.log(`--- ${tag.toUpperCase()} ---`);
  console.log('  text nodes drawn :', texts.length);
  console.log(
    '  address chars    :',
    addr ? addr.length : 'NOT FOUND',
    addr ? (addr.endsWith('...') ? '(TRUNCATED with marker)' : '(full, no marker)') : '',
  );
  console.log('  name             :', name ? `${name.length} chars` : 'NOT FOUND');
  console.log('  number           :', num ?? 'NOT FOUND');
}
