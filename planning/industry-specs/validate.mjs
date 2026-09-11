// Validates industry specifications against PROFESSIONAL-A-Z-CHECKLIST.md.
// Availability is computed from the register; a spec may never assert it.
// Usage: node planning/industry-specs/validate.mjs [--json]
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const REGISTER = join(repo, 'PROFESSIONAL-A-Z-CHECKLIST.md');

// Weakest wins. A task is only as available as its least-ready requirement.
const ORDER = ['gap', 'failed', 'dependency-blocked', 'in-progress', 'partial', 'verified'];
const rank = (s) => {
  const i = ORDER.indexOf(s);
  if (i < 0) throw new Error(`unknown state: ${s}`);
  return i;
};

export function readRegister(path = REGISTER) {
  // Normalise CRLF: these files are routinely edited on Windows, and a trailing
  // \r would otherwise be captured into every parsed value.
  const md = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  const re = /^- \[[ x]\] \*\*([A-Z]{1,2}-\d{2}) ([^*]+)\*\* — (.*?)\s*State: (verified|partial|gap|dependency-blocked|failed|in-progress|not-assessed)/gm;
  const rows = new Map();
  let m;
  while ((m = re.exec(md))) {
    rows.set(m[1], { id: m[1], title: m[2].trim(), state: m[4] });
  }
  return rows;
}

export function weakest(ids, rows) {
  let worst = 'verified';
  for (const id of ids) {
    const row = rows.get(id);
    if (!row) return 'unknown';
    if (rank(row.state) < rank(worst)) worst = row.state;
  }
  return worst;
}

function parseSpec(text, file) {
  const tasks = [];
  const errors = [];
  // #### T-1 Name  followed by key: value lines
  const blocks = text.replace(/\r\n/g, '\n').split(/^#### /m).slice(1);
  for (const block of blocks) {
    const lines = block.split('\n');
    const head = lines[0].trim();
    const idMatch = head.match(/^(T-\d+)\s+(.+)$/);
    if (!idMatch) continue;
    const task = { id: idMatch[1], name: idMatch[2], file };
    for (const line of lines.slice(1)) {
      const kv = line.match(/^(intent|inputs|outputs|requires|blocked-by|origin|source|notes|state|availability):\s*(.*)$/);
      if (!kv) continue;
      task[kv[1]] = kv[2].trim();
    }
    if (task.state || task.availability) {
      errors.push(`${file} ${task.id}: asserts availability directly; it must be derived`);
    }
    if (!task.requires) {
      errors.push(`${file} ${task.id}: missing requires:`);
    }
    task.requireIds = (task.requires || '')
      .split(/[,\s]+/)
      .map((s) => s.replace(/#.*$/, '').trim())
      .filter((s) => /^[A-Z]{1,2}-\d{2}$/.test(s));
    tasks.push(task);
  }
  const sourceKeys = new Set();
  const srcSection = text.split(/^## \d+\. Sources/m)[1];
  if (srcSection) {
    for (const m of srcSection.matchAll(/^\|\s*([A-Za-z0-9._-]+)\s*\|/gm)) {
      if (m[1] !== '---' && !/^-+$/.test(m[1])) sourceKeys.add(m[1]);
    }
  }
  return { tasks, errors, sourceKeys };
}

function main() {
  const rows = readRegister();
  const files = readdirSync(here).filter((f) => f.endsWith('.md') && f !== 'TEMPLATE.md' && f !== 'README.md');
  const allErrors = [];
  const report = [];

  for (const file of files) {
    const text = readFileSync(join(here, file), 'utf8');
    const { tasks, errors, sourceKeys } = parseSpec(text, file);
    allErrors.push(...errors);
    if (tasks.length === 0) {
      allErrors.push(`${file}: no tasks found`);
      continue;
    }
    const seen = new Set();
    const specTasks = [];
    for (const t of tasks) {
      if (seen.has(t.id)) allErrors.push(`${file} ${t.id}: duplicate task id`);
      seen.add(t.id);

      for (const id of t.requireIds) {
        if (!rows.has(id)) allErrors.push(`${file} ${t.id}: unknown requirement ${id}`);
      }
      if (t.requireIds.length === 0 && t.requires) {
        allErrors.push(`${file} ${t.id}: requires: has no valid IDs`);
      }
      if (!/^\[(S|P)\]/.test(t.origin || '')) {
        allErrors.push(`${file} ${t.id}: origin must start with [S] or [P]`);
      }
      if (/^\[S\]/.test(t.origin || '')) {
        const key = (t.source || '').split(/[\s,]/)[0];
        if (!key) allErrors.push(`${file} ${t.id}: [S] requires source:`);
        else if (!sourceKeys.has(key)) allErrors.push(`${file} ${t.id}: source "${key}" not in Sources table`);
      }
      // Template rule 5: a named missing engine floors the task at gap, however
      // ready its register rows are. Shared capability is not a validated workflow.
      const derived = weakest(t.requireIds, rows);
      const blockedBy = t['blocked-by'] || null;
      const state = blockedBy && rank(derived) > rank('gap') ? 'gap' : derived;
      specTasks.push({
        id: t.id,
        name: t.name,
        state,
        derivedFromRows: derived,
        requires: t.requireIds,
        blockedBy,
      });
    }
    report.push({ file, tasks: specTasks });
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ report, errors: allErrors }, null, 2));
  } else {
    for (const spec of report) {
      console.log(`\n${spec.file}`);
      const tally = {};
      for (const t of spec.tasks) {
        tally[t.state] = (tally[t.state] || 0) + 1;
        const floored = t.blockedBy && t.state !== t.derivedFromRows
          ? `  (rows say ${t.derivedFromRows}; floored by blocker)`
          : '';
        console.log(`  ${t.id.padEnd(5)} [${t.state.padEnd(18)}] ${t.name}${floored}`);
      }
      console.log(`  -- ${spec.tasks.length} tasks: ${JSON.stringify(tally)}`);
    }
    console.log(`\nregister rows parsed: ${rows.size}`);
    if (allErrors.length) {
      console.log(`\nERRORS (${allErrors.length}):`);
      for (const e of allErrors) console.log('  ' + e);
    } else {
      console.log('\nno errors');
    }
  }
  process.exit(allErrors.length ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('validate.mjs')) main();
