import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseEnv } from 'node:util';
import os from 'node:os';

if (os.hostname().toLowerCase() !== 'daniel') throw Error('Authorized local campaign only');
const [name, input, mode = 'built', provider] = process.argv.slice(2);
if (!/^[a-z0-9-]{1,60}$/.test(name) || !input || !['dev', 'built'].includes(mode) || (provider && provider !== 'minimax')) throw Error('Expected unique name, scenario path, dev|built, optional minimax');
const base = 'proof/growth/2026-09-24-local-closeout';
const output = path.resolve(base, name);
if (fs.existsSync(output)) throw Error('Output already exists; prior evidence preserved');
const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const identity = spawnSync(process.execPath, [`${base}/source-identity.mjs`, 'verify'], { encoding: 'utf8', windowsHide: true });
if (identity.status !== 0) throw Error(identity.stderr || identity.stdout);
const scenario = path.resolve(input);
JSON.parse(fs.readFileSync(scenario, 'utf8').replace(/^\uFEFF/, ''));
const env = { ...process.env, VITE_AUTH_ENABLED: 'false', VITE_XRAY_BUILD_ID: 'local-e74e67d4-20260924' };
if (provider === 'minimax') {
  // Existing project provider only. Credentials stay in process environment, never logs/argv/proof.
  const existing = parseEnv(fs.readFileSync('.env.local', 'utf8'));
  if (!existing.MINIMAX_API_KEY) throw Error('Existing project MiniMax configuration absent');
  env.MINIMAX_API_KEY = existing.MINIMAX_API_KEY;
  env.MINIMAX_MODEL = existing.MINIMAX_MODEL || 'MiniMax-M3';
  env.XRAY_AI_WEB_ENABLED = 'true';
}
const startedAt = new Date().toISOString();
const result = spawnSync('powershell.exe', [
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/run-fast-cdp.ps1',
  '-AllowLocalExecution', '-Scenario', scenario, '-Output', output, '-Workspace', process.cwd(),
  '-RunId', `local-${name}`, '-PreviewMode', mode, '-PreviewPort', '8081', '-CdpPort', '9351',
], { env, windowsHide: true, stdio: 'inherit' });
fs.writeFileSync(`${base}/${name}-invocation.json`, JSON.stringify({
  host: os.hostname(), startedAt, completedAt: new Date().toISOString(), mode,
  sourceIdentitySha256: hash(`${base}/source-identity.json`), input, scenarioSha256: hash(scenario),
  existingProvider: provider || null, exitCode: result.status, output,
}, null, 2) + '\n', { flag: 'wx' });
if (result.status !== 0) throw Error(`Journey failed (${result.status}); all output retained`);
