import { readFile, writeFile } from 'node:fs/promises';
import DxfParser from 'dxf-parser';

const source = await readFile(new URL('../IW-ARCHITECT-SKETCH/installed-ui-design.dxf', import.meta.url), 'utf8');
const parsed = new DxfParser().parseSync(source);
const layers = [...new Set(parsed.entities.map(e => e.layer))];
const tables = ['0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', String(layers.length),
  ...layers.flatMap(name => ['0', 'LAYER', '2', name, '70', '0', '62', '7', '6', 'CONTINUOUS']),
  '0', 'ENDTAB', '0', 'ENDSEC', ''];
await writeFile(new URL('./prepared.dxf', import.meta.url), source.replace('0\nSECTION\n2\nENTITIES\n', tables.join('\n') + '0\nSECTION\n2\nENTITIES\n'));
console.log(JSON.stringify({ entities: parsed.entities.length, layers, note: 'Isolated fixture adds missing layer declarations; product export unchanged.' }));
