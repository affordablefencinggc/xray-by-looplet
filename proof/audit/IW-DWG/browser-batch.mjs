import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const [, , session, file, ...extra] = process.argv;
const commands = JSON.parse(readFileSync(file, 'utf8'));
const cli = '.temp/npm/_npx/8e62322f9a68a26a/node_modules/agent-browser/bin/agent-browser.js';
const result = spawnSync(process.execPath, [cli, '--session', session, ...extra, 'batch', '--bail'], { input: JSON.stringify(commands), encoding: 'utf8', windowsHide: true, maxBuffer: 2e6, timeout: 180000 });
process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? '');
if (result.error) console.error(result.error);
process.exit(result.status ?? 1);
