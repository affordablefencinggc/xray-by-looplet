import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const [, , session, file, ...extra] = process.argv;

if (!session || !file) {
  console.error('Usage: node browser-batch.mjs <session-name> <scenario.json> [--cdp <port>]');
  process.exit(1);
}

if (!existsSync(file)) {
  console.error(`Error: Scenario file not found: ${file}`);
  process.exit(1);
}

const commands = JSON.parse(readFileSync(file, 'utf8'));

// Support local, environment, or global agent-browser CLI
const cliCandidates = [
  process.env.AGENT_BROWSER_CLI,
  resolve('.temp/npm/_npx/8e62322f9a68a26a/node_modules/agent-browser/bin/agent-browser.js'),
  'agent-browser'
].filter(Boolean);

let cli = cliCandidates.find(c => existsSync(c)) || 'agent-browser';

const result = spawnSync(
  process.execPath,
  [cli, '--session', session, ...extra, 'batch', '--bail'],
  {
    input: JSON.stringify(commands),
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 2e6,
    timeout: 180000,
    shell: process.platform === 'win32'
  }
);

process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');

if (result.error) {
  console.error(result.error);
}

process.exit(result.status ?? 1);
