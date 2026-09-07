import { spawn } from 'node:child_process';
import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = resolve(root, 'proof/audit/IW-BASELINE/runtime');
await mkdir(runtime, { recursive: true });
try {
  const response = await fetch('http://127.0.0.1:8080/', { signal: AbortSignal.timeout(2000) });
  if (response.ok) { console.log('Development preview is healthy; no process changed.'); process.exit(0); }
} catch { /* Missing listener is expected before startup. */ }
try {
  const record = JSON.parse(await readFile(resolve(runtime, 'launcher.json'), 'utf8'));
  // A living npm launcher is not proof that its server is healthy. Give a recent
  // launch time to bind, then use the actual listener probe below. Never kill it.
  if (Date.now() - Date.parse(record.startedAt) < 15000) {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const response = await fetch('http://127.0.0.1:8080/', { signal: AbortSignal.timeout(1000) });
        if (response.ok) { console.log('Development preview is healthy; no process changed.'); process.exit(0); }
      } catch { /* A new server may still be starting. */ }
      await new Promise(resolveWait => setTimeout(resolveWait, 500));
    }
  }
} catch { /* No readable recent launch record. */ }
await new Promise((resolveProbe, rejectProbe) => {
  const probe = createServer();
  probe.once('error', () => rejectProbe(new Error('Port 8080 is occupied; no listener was stopped.')));
  probe.listen(8080, '0.0.0.0', () => probe.close(resolveProbe));
});
const stdout = await open(resolve(runtime, 'dev.stdout.log'), 'a');
const stderr = await open(resolve(runtime, 'dev.stderr.log'), 'a');
const npmCli = resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const child = spawn(process.execPath, [npmCli, 'run', 'dev'], {
  cwd: root, detached: true, windowsHide: true, stdio: ['ignore', stdout.fd, stderr.fd],
});
await new Promise((resolveSpawn, rejectSpawn) => { child.once('spawn', resolveSpawn); child.once('error', rejectSpawn); });
await writeFile(resolve(runtime, 'launcher.json'), JSON.stringify({ pid: child.pid, startedAt: new Date().toISOString(), command: 'npm run dev' }, null, 2));
child.unref();
await stdout.close();
await stderr.close();
console.log(`Started hidden development launcher PID ${child.pid}.`);
