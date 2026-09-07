import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Isolated evaluation dependencies; nothing is added to the application bundle.
const root = new URL('./runtime/', import.meta.url);
await mkdir(root, { recursive: true });
const packages = [
  ['acadsharp', '3.7.1'],
  ['system.memory', '4.6.3'],
  ['system.buffers', '4.6.1'],
  ['system.numerics.vectors', '4.6.1'],
  ['system.runtime.compilerservices.unsafe', '6.1.2'],
];
const records = [];
for (const [name, version] of packages) {
  const url = `https://api.nuget.org/v3-flatcontainer/${name}/${version}/${name}.${version}.nupkg`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(new URL(`${name}.zip`, root), bytes);
  records.push({ name, version, url, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await writeFile(new URL('./dependencies.json', import.meta.url), JSON.stringify(records, null, 2) + '\n');
console.log(JSON.stringify(records, null, 2));
