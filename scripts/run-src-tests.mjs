import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Keep the reviewed suite list, but bypass cmd.exe's 8191-character limit.
// Batches also stay below Windows CreateProcess's separate 32767-character limit.
const root = fileURLToPath(new URL('../', import.meta.url));
const files = JSON.parse(readFileSync(new URL('./src-test-files.json', import.meta.url), 'utf8'));
if (!Array.isArray(files) || !files.length || new Set(files).size !== files.length ||
    files.some(file => typeof file !== 'string' || !/^src\/[\w./-]+\.test\.ts$/.test(file))) {
  throw new Error('Invalid or duplicate source test manifest entry');
}
let failed = false;
for (let offset = 0; offset < files.length; offset += 40) {
  const batch = files.slice(offset, offset + 40);
  console.log(`Source test batch ${Math.floor(offset / 40) + 1}: ${batch.length} files`);
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', ...batch], {
    cwd: root, stdio: 'inherit', shell: false, windowsHide: true,
  });
  if (result.error) console.error(result.error);
  if (result.status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
