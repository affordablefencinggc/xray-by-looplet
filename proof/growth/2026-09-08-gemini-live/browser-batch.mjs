import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
const [session, file, ...extra] = process.argv.slice(2);
const result = spawnSync('.temp/npm/_npx/8e62322f9a68a26a/node_modules/agent-browser/bin/agent-browser-win32-x64.exe', [ '--session', session, ...extra, 'batch', '--bail'], {
  input: fs.readFileSync(file, 'utf8'), encoding: 'utf8', windowsHide: true, timeout: 180000, maxBuffer: 2000000,
});
fs.writeFileSync(file + '.log', (result.stdout || '') + (result.stderr || ''));
console.log(result.stdout || result.stderr);
process.exit(result.status ?? 1);
