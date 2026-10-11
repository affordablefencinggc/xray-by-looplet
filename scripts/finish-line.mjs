#!/usr/bin/env node

/**
 * X-Ray by Looplet — Finish-Line Conveyor Belt
 *
 * Rolls committing, pushing and production into controlled smaller sections,
 * driven by finish-line/LEDGER.json:
 *
 *   [SECTION] → GATES → COMMIT → PUSH → (PRODUCTION) → ledger update
 *
 * Modes:
 *   (default)      dry-run — full plan preview, zero writes
 *   --live         belt ON: gates → scoped commit → fast-forward push
 *   --deploy       additionally unlocks the PRODUCTION gate (requires --live)
 *   --section=ID   ride a single section
 *   --max=N        ride at most N sections this run
 *   --status       belt position report only
 *
 * Safety: halts on the first failed gate; stages ONLY the section's declared
 * files; refuses to run when unrelated dirty files exist; never force-pushes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const LEDGER_PATH = path.join(REPO_ROOT, 'finish-line', 'LEDGER.json');
const STATE_PATH = path.join(REPO_ROOT, 'finish-line', 'state.json');
const ACTIONS_CSV = path.join(REPO_ROOT, 'finish-line', 'ACTIONS.csv');

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const value = (p, d = null) => args.find((a) => a.startsWith(p))?.split('=')[1] ?? d;
const LIVE = has('--live');
const DEPLOY = has('--deploy');
const DRY_RUN = !LIVE;
const ONLY = value('--section=');
const MAX = parseInt(value('--max=', '0'), 10);
const STATUS_ONLY = has('--status');

const log = (...m) => console.log(...m);
const hr = () => log('─'.repeat(78));

const CMD_SHIMS = new Set(['npm', 'npx', 'pnpm', 'yarn']);

function run(cmd, cmdArgs, opts = {}) {
  if (process.platform === 'win32' && CMD_SHIMS.has(cmd)) {
    // .cmd shims (npm.cmd etc.) cannot be spawned directly on modern Node
    // (CVE-2024-27980) — route through cmd.exe. Gate args for these are simple
    // (no embedded spaces), so plain joining is safe.
    return execFileSync('cmd.exe', ['/d', '/s', '/c', [cmd, ...cmdArgs].join(' ')], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: opts.pipe ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
  }
  // Real executables (git, node, …) spawn directly — Node quotes argv properly.
  return execFileSync(cmd, cmdArgs, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: opts.pipe ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
}

function loadLedger() {
  if (!fs.existsSync(LEDGER_PATH)) {
    console.error(`❌ Missing ${LEDGER_PATH}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf-8'));
}

function loadState() {
  if (fs.existsSync(STATE_PATH)) return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
  return { completed: {}, halted: null };
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
}

function appendAction(row) {
  fs.appendFileSync(ACTIONS_CSV, row.join(',') + '\n');
}

function gitDirty() {
  const out = run('git', ['status', '--porcelain'], { pipe: true });
  const entries = out.split('\n').filter((l) => l.trim()).map((l) => ({ code: l.slice(0, 2), path: l.slice(3).trim() }));
  // Expand untracked directories into their concrete files so declared paths match.
  const expanded = [];
  for (const e of entries) {
    if (e.code === '??' && e.path.endsWith('/')) {
      const files = run('git', ['ls-files', '--others', '--exclude-standard', '--', e.path], { pipe: true })
        .split('\n').filter((l) => l.trim());
      for (const f of files) expanded.push({ code: '??', path: f });
    } else {
      expanded.push(e);
    }
  }
  return expanded;
}

function beltReport(ledger, state) {
  hr();
  log(`🏁 FINISH-LINE CONVEYOR  ·  mode=${DRY_RUN ? 'DRY-RUN' : DEPLOY ? 'LIVE+DEPLOY' : 'LIVE'}`);
  hr();
  for (const s of ledger.sections) {
    const done = state.completed[s.id];
    const mark = done ? '✅' : state.halted === s.id ? '⛔' : '⬜';
    const dest = s.production ? 'PRODUCTION' : s.push ? 'commit→push' : 'gates only';
    log(`${mark} ${s.id.padEnd(6)} ${s.title.padEnd(40)} → ${dest}${done ? `  (${done.sha.slice(0, 7)} ${done.at})` : ''}`);
  }
  hr();
}

function runSection(ledger, state, section) {
  log(`\n🚚 SECTION ${section.id} — ${section.title}  [${DRY_RUN ? 'dry-run' : 'LIVE'}]`);

  // Station 1: GATES
  for (const gate of section.gates ?? []) {
    const [cmd, ...cmdArgs] = ledger.gates[gate].split(' ');
    log(`  🔎 gate ${gate}: ${ledger.gates[gate]}`);
    if (!DRY_RUN) {
      try {
        run(cmd, cmdArgs);
      } catch {
        log(`  ❌ gate ${gate} FAILED — belt HALTED at ${section.id}`);
        state.halted = section.id;
        saveState(state);
        appendAction([new Date().toISOString(), section.id, section.title, 'live', gate, '', '', 'halted', 'gate failure']);
        process.exit(1);
      }
    }
  }

  if (section.production && !DEPLOY) {
    log('  ⏭️  production section — skipped (requires --live --deploy)');
    return false;
  }

  if (DRY_RUN || STATUS_ONLY) {
    const dest = `${section.commit ? `commit ${section.files.length} file(s) + ` : ''}${section.push ? 'push' : 'gates only'}${section.production ? ' + production chain' : ''}`;
    log(`  ✓ would: ${dest}`);
    return section.production ? false : true;
  }

  // Station 2: COMMIT (scoped staging)
  if (section.commit) {
    const dirty = gitDirty();
    const declared = new Set(ledger.sections.flatMap((s) => s.files));
    const foreign = dirty.filter((d) => !declared.has(d.path) && !d.path.startsWith('finish-line/'));
    if (foreign.length) {
      log('  ⛔ unrelated dirty files present — belt HALTED (keep commits surgical):');
      for (const f of foreign) log(`     ${f.code} ${f.path}`);
      state.halted = section.id;
      saveState(state);
      process.exit(1);
    }
    run('git', ['add', ...section.files]);
    run('git', ['commit', '-m', section.commit]);
    const sha = run('git', ['rev-parse', 'HEAD'], { pipe: true }).trim();
    log(`  📦 committed ${sha.slice(0, 7)} — ${section.commit}`);

    // Station 3: PUSH (fast-forward only)
    if (section.push) {
      run('git', ['push', 'origin', 'main']);
      log('  ☁️  pushed origin/main');
    }
    state.completed[section.id] = { sha, at: new Date().toISOString().slice(0, 16) };
  } else if (section.production) {
    state.completed[section.id] = { sha: 'production-gate', at: new Date().toISOString().slice(0, 16) };
    log('  🏁 production gate recorded');
  }

  saveState(state);
  appendAction([
    new Date().toISOString(), section.id, section.title, 'live',
    (section.gates ?? []).join('|'), state.completed[section.id]?.sha ?? '',
    section.push ? 'yes' : 'no', 'done', '',
  ]);
  return true;
}

function main() {
  const ledger = loadLedger();
  const state = loadState();
  beltReport(ledger, state);
  if (STATUS_ONLY) return;

  let sections = ledger.sections.filter((s) => !state.completed[s.id]);
  if (ONLY) sections = sections.filter((s) => s.id === ONLY);
  if (MAX > 0) sections = sections.slice(0, MAX);

  if (!sections.length) {
    log('\n🏁 Belt empty — every section is at the finish line.');
    return;
  }
  for (const s of sections) runSection(ledger, state, s);
  log(`\n🏁 Run complete  ·  mode=${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE'}  ·  last section: ${sections.at(-1)?.id ?? '—'}`);
  if (DRY_RUN) log('   Pass --live to start the belt. Pass --live --deploy for production.');
}

main();