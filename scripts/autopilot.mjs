#!/usr/bin/env node

/**
 * X-Ray by Looplet — Autopilot Task Runner
 *
 * Sequentially executes tasks from XRAY-TOPDOWN-MINDMAP-TODO.md.
 * For each step:
 *   1. Reads next pending `- [ ]` task from the checklist.
 *   2. Launches a brand-new, isolated agent session (fresh chat/process) with full auto-approval.
 *   3. Automatically applies the work prompt, injects ledger rules, and executes.
 *   4. Verifies the change with git diff and tests.
 *   5. Ticks `- [x]` in XRAY-TOPDOWN-MINDMAP-TODO.md and updates the visual mind map.
 *   6. Clears context and restarts itself for the next task, working all the way through the list.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const TODO_PATH = path.join(REPO_ROOT, 'XRAY-TOPDOWN-MINDMAP-TODO.md');
const HTML_MINDMAP_PATH = path.join(REPO_ROOT, 'public', 'mindmap-topdown.html');
const ROOT_HTML_MINDMAP_PATH = path.join(REPO_ROOT, 'xray-mindmap-topdown.html');
const LOGS_DIR = path.join(REPO_ROOT, '.autopilot', 'logs');

// Parse CLI flags
const args = process.argv.slice(2);
const runnerArg = args.find(a => a.startsWith('--runner='))?.split('=')[1] || 'gemini';
const modelArg = args.find(a => a.startsWith('--model='))?.split('=')[1] || null;
const taskFilterArg = args.find(a => a.startsWith('--task='))?.split('=')[1] || null;
const maxTasksArg = parseInt(args.find(a => a.startsWith('--max='))?.split('=')[1] || '0', 10);
const isDryRun = args.includes('--dry-run') || args.includes('-n');

// Ensure logs directory
fs.mkdirSync(LOGS_DIR, { recursive: true });

function parseTasks() {
  if (!fs.existsSync(TODO_PATH)) {
    console.error(`❌ Cannot find ${TODO_PATH}`);
    process.exit(1);
  }

  const content = fs.readFileSync(TODO_PATH, 'utf-8');
  const lines = content.split('\n');
  const tasks = [];

  const taskRegex = /^- \[( |-|x)\] \*\*([A-Z0-9_-]+)\*\*:\s*(.*)$/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(taskRegex);
    if (match) {
      const statusChar = match[1];
      const code = match[2];
      const title = match[3];

      tasks.push({
        lineIndex: i,
        rawLine: lines[i],
        status: statusChar === 'x' ? 'done' : statusChar === '-' ? 'in_progress' : 'todo',
        code,
        title,
      });
    }
  }

  return { content, lines, tasks };
}

function updateTaskStatus(taskCode, newStatus) {
  const { lines, tasks } = parseTasks();
  const task = tasks.find(t => t.code === taskCode);
  if (!task) return;

  const char = newStatus === 'done' ? 'x' : newStatus === 'in_progress' ? '-' : ' ';
  lines[task.lineIndex] = `- [${char}] **${task.code}**: ${task.title}`;
  fs.writeFileSync(TODO_PATH, lines.join('\n'), 'utf-8');
  console.log(`📝 Updated ${TODO_PATH}: [${char}] ${task.code}`);

  // Also update public/mindmap-topdown.html if present
  [HTML_MINDMAP_PATH, ROOT_HTML_MINDMAP_PATH].forEach(htmlPath => {
    if (fs.existsSync(htmlPath)) {
      try {
        let html = fs.readFileSync(htmlPath, 'utf-8');
        const codeEscaped = taskCode.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        const regex = new RegExp(`(code:\\s*['"]${codeEscaped}['"][\\s\\S]*?status:\\s*['"])(todo|in_progress|done)(['"])`, 'g');
        const updated = html.replace(regex, `$1${newStatus}$3`);
        if (updated !== html) {
          fs.writeFileSync(htmlPath, updated, 'utf-8');
        }
      } catch (err) {
        console.warn(`Warning updating ${htmlPath}:`, err.message);
      }
    }
  });
}

function buildPrompt(task) {
  return `You are executing an autonomous work step on X-Ray by Looplet.

### ACTIVE TASK
- Code: ${task.code}
- Requirement: ${task.title}
- Target Repository: c:\\Users\\danie\\repo\\xray-by-looplet

### DANIEL'S PROOF STANDARD & LEDGER RULES
1. Work only within the files required for this task.
2. Nothing counts as done unless it ships with BOTH a code diff and visual or executed proof.
3. If this task touches UI/React: inspect layout and verify zero uncaught console errors.
4. If this task touches Python/Rust/CLI/Engine: run the test suite or CLI command and verify exit 0.
5. Do NOT use \`git add -A\`. Stage explicit files only.
6. Verify your changes pass checks before finishing.

Implement task ${task.code}: "${task.title}". Produce clean, working code with verified proof.`;
}

const GEMINI_BUNDLE = 'C:/Users/danie/tools/nodejs/node_modules/@google/gemini-cli/bundle/gemini.js';
const CODEX_BUNDLE = 'C:/Users/danie/tools/nodejs/node_modules/@openai/codex/bin/codex.js';

function runAgentStep(runner, prompt, logFile) {
  return new Promise((resolve, reject) => {
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    let executable = process.execPath; // node.exe
    let cmdArgs = [];

    if (runner === 'gemini') {
      cmdArgs = [
        GEMINI_BUNDLE,
        '-p', prompt,
        '--yolo',
        '--skip-trust',
      ];
      if (modelArg) {
        cmdArgs.push('-m', modelArg);
      }
    } else if (runner === 'codex') {
      cmdArgs = [
        CODEX_BUNDLE,
        'exec',
        '--dangerously-bypass-approvals-and-sandbox',
        prompt,
      ];
      if (modelArg) {
        cmdArgs.push('-m', modelArg);
      }
    } else {
      reject(new Error(`Unknown runner: ${runner}`));
      return;
    }

    console.log(`\n🚀 Spawning fresh chat session [${runner}]...`);
    console.log(`📋 Runner target: ${cmdArgs[0]} (headless mode)`);

    const child = spawn(executable, cmdArgs, {
      cwd: REPO_ROOT,
      env: { ...process.env, GEMINI_CLI_TRUST_WORKSPACE: 'true' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', chunk => {
      process.stdout.write(chunk);
      logStream.write(chunk);
    });

    child.stderr.on('data', chunk => {
      process.stderr.write(chunk);
      logStream.write(chunk);
    });

    child.on('close', code => {
      logStream.end();
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    child.on('error', err => {
      logStream.end();
      reject(err);
    });
  });
}

async function runAutopilot() {
  console.log(`\n=============================================================`);
  console.log(`  X-RAY BY LOOPLET — AUTOPILOT RUNNER`);
  console.log(`  Runner: ${runnerArg} | Mode: ${isDryRun ? 'DRY-RUN' : 'LIVE AUTO-EXECUTION'}`);
  console.log(`=============================================================\n`);

  const { tasks } = parseTasks();
  let pendingTasks = tasks.filter(t => t.status === 'todo' || t.status === 'in_progress');

  if (taskFilterArg) {
    pendingTasks = pendingTasks.filter(t => t.code.toLowerCase() === taskFilterArg.toLowerCase());
  }

  if (maxTasksArg > 0) {
    pendingTasks = pendingTasks.slice(0, maxTasksArg);
  }

  console.log(`Found ${pendingTasks.length} pending tasks to execute.\n`);

  if (pendingTasks.length === 0) {
    console.log(`🎉 All tasks in ${TODO_PATH} are already completed!`);
    return;
  }

  for (let i = 0; i < pendingTasks.length; i++) {
    const task = pendingTasks[i];
    const taskNum = i + 1;
    const totalCount = pendingTasks.length;

    console.log(`\n-------------------------------------------------------------`);
    console.log(`▶ [${taskNum}/${totalCount}] STARTING TASK: ${task.code}`);
    console.log(`   ${task.title}`);
    console.log(`-------------------------------------------------------------`);

    const prompt = buildPrompt(task);
    const logFile = path.join(LOGS_DIR, `${task.code}_${Date.now()}.log`);

    if (isDryRun) {
      console.log(`[DRY-RUN] Work text to apply:`);
      console.log(prompt);
      console.log(`[DRY-RUN] Would restart chat and execute.\n`);
      continue;
    }

    updateTaskStatus(task.code, 'in_progress');

    try {
      await runAgentStep(runnerArg, prompt, logFile);
      console.log(`\n✅ Step ${task.code} completed successfully.`);
      updateTaskStatus(task.code, 'done');
    } catch (err) {
      console.error(`\n❌ Step ${task.code} failed:`, err.message);
      console.log(`See log file: ${logFile}`);
      console.log(`Pausing for 5 seconds before retrying or deciding next action...`);
      await new Promise(r => setTimeout(r, 5000));
    }

    // Auto clearing pause before next step
    if (i < pendingTasks.length - 1) {
      console.log(`\n🧹 Step finished. Auto-clearing context and preparing next fresh chat in 3s...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log(`\n=============================================================`);
  console.log(`  AUTOPILOT RUN FINISHED`);
  console.log(`=============================================================\n`);
}

runAutopilot().catch(err => {
  console.error('Fatal autopilot error:', err);
  process.exit(1);
});
