import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
import DxfParser from 'dxf-parser';
import { demonstration } from '../../../src/studio/architect/model.ts';
import { exportDxf, importDxf } from '../../../src/studio/architect/exchange.ts';

const dir = 'proof/audit/IW-DWG';
const exe = path.resolve('engine/cad/bin/XRayCad.exe');
function convert(action: string, input: Buffer) {
  const result = spawnSync(exe, [action], { input, windowsHide: true, maxBuffer: 24_000_000, timeout: 35_000 });
  const output = JSON.parse(result.stdout.toString());
  assert.equal(result.status, 0, JSON.stringify(output));
  assert.equal(output.ok, true);
  return { ...output, bytes: Buffer.from(output.bytesBase64, 'base64') };
}
const p = demonstration('dwg-proof');
p.lines.push({ id: 'line-proof', revision: 1, levelId: p.levels[0].id, a: [-2000, 500], b: [15000, 500] });
p.circles.push({ id: 'circle-proof', revision: 1, levelId: p.levels[0].id, center: [13000, 3000], radius: 1234.5 });
p.arcs.push({ id: 'arc-proof', revision: 1, levelId: p.levels[0].id, center: [13000, 3000], radius: 2222, startAngle: .25, endAngle: 2.75, clockwise: false });
p.levels.push({ ...p.levels[0], id: 'upper-proof', name: 'Upper proof', elevation: 3200 });
p.lines.push({ id: 'upper-line', revision: 1, levelId: 'upper-proof', a: [1234.5, 6789.25], b: [9999.125, 6789.25] });
const source = await exportDxf(p);
writeFileSync(`${dir}/source.dxf`, source);
const exported = convert('to-dwg', Buffer.from(source));
writeFileSync(`${dir}/native.dwg`, exported.bytes);
assert.equal(exported.bytes.subarray(0, 6).toString(), 'AC1027');
const imported = convert('to-dxf', exported.bytes);
writeFileSync(`${dir}/native-roundtrip.dxf`, imported.bytes);
const independent = spawnSync(path.resolve(`${dir}/runtime/libredwg/dwg2dxf.exe`), ['--overwrite', '-o', path.resolve(`${dir}/independent.dxf`), path.resolve(`${dir}/native.dwg`)], { windowsHide: true, encoding: 'utf8', timeout: 35_000 });
writeFileSync(`${dir}/independent-reader.log`, `${independent.stdout}\n${independent.stderr}`);
assert.equal(independent.status, 0, independent.stderr);
function canonical(text: string) {
  const doc = new DxfParser().parseSync(text)!;
  const num = (v: number | undefined) => Math.round((v ?? 0) * 1e7) / 1e7;
  const pt = (p: any) => [num(p.x), num(p.y), num(p.z)];
  const entities = doc.entities.map((e: any) => {
    const base = { type: e.type, layer: e.layer };
    if (e.type === 'LINE') return { ...base, vertices: e.vertices.map(pt) };
    if (e.type === 'LWPOLYLINE') return { ...base, vertices: e.vertices.map(pt), elevation: num(e.elevation), closed: !!e.shape };
    if (e.type === 'TEXT') return { ...base, text: e.text, at: pt(e.startPoint), height: num(e.textHeight) };
    if (e.type === 'CIRCLE') return { ...base, center: pt(e.center), radius: num(e.radius) };
    if (e.type === 'ARC') return { ...base, center: pt(e.center), radius: num(e.radius), start: num(e.startAngle), end: num(e.endAngle) };
    throw Error(`Unexpected entity ${e.type}`);
  }).map(e => JSON.stringify(e)).sort();
  return { units: doc.header!.$INSUNITS, entities };
}
const expected = canonical(source);
assert.deepEqual(canonical(imported.bytes.toString()), expected);
assert.deepEqual(canonical(readFileSync(`${dir}/independent.dxf`, 'utf8')), expected);
const reference = await importDxf(imported.bytes.toString(), 'dwg-proof');
assert.equal(reference.parametric, false);
assert.equal(reference.project.walls.length, 0);
assert.ok(reference.project.lines.length > 0 && reference.project.arcs.length > 0 && reference.project.circles.length > 0);
const malformed = spawnSync(exe, ['to-dxf'], { input: Buffer.from('AC1027damaged'), windowsHide: true, encoding: 'utf8' });
assert.equal(malformed.status, 1);
assert.equal(JSON.parse(malformed.stdout).ok, false);
const report = { pass: true, translator: exported.translator, independentReader: 'LibreDWG 0.14 (QA only; not bundled)', entityCount: expected.entities.length, units: expected.units, layers: ['LEVEL_Ground','LEVEL_Upper_proof'], coordinateToleranceMm: 1e-7, signature: 'AC1027', sourceDxf: 'source.dxf', nativeDwg: 'native.dwg', referenceLines: reference.project.lines.length, referenceCircles: reference.project.circles.length, referenceArcs: reference.project.arcs.length, parametricMetadataRetained: false, corruptInputRejected: true, warnings: exported.warnings };
writeFileSync(`${dir}/converter-proof.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
