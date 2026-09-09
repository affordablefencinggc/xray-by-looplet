#!/usr/bin/env node
// X-Ray skill guardrails — harness-enforced rules from .agents/skills/{ledger,xray-engine,fast-cdp-testing}.
// Runs as a Claude Code hook (see .claude/settings.json). Model-independent: the harness applies it to any model.
// Usage: node scripts/guardrails/hook.mjs <session-start|pre-tool|stop>   (hook JSON on stdin)
import fs from 'node:fs';
import path from 'node:path';

const event = process.argv[2];
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const input = readStdin();

const RULES = [
  'Never `git add -A`, `git add .` or `git add --all`; stage explicit paths only (ledger skill).',
  'No commit, push, merge, reset --hard, checkout --, stash or worktree unless Daniel names the checkpoint; the command must carry `# checkpoint: <name>`.',
  'Never kill a process you do not own; stop owned processes only through an identity-checked cleanup script (AGENTS.project.md 10-minute rule).',
  'Nothing is done without a code diff plus executed/inspected proof (runner report + screenshot under proof/growth or screenshots/growth).',
  'LATEST-VERIFIED-BUILD.md changes only after every gate including native shutdown passes.',
];

if (event === 'session-start') {
  const skills = ['ledger', 'xray-engine', 'fast-cdp-testing']
    .map(name => path.join(root, '.agents', 'skills', name, 'SKILL.md'))
    .filter(p => fs.existsSync(p))
    .map(p => path.relative(root, p).replace(/\\/g, '/'));
  out({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext:
        `X-Ray guardrails (harness-enforced, apply to every model):\n- ${RULES.join('\n- ')}\nRepo skills to read before building: ${skills.join(', ')}. Ledger: AZ-WAVE3-LEDGER.md; proof ledger: walkthrough.md.`,
    },
  });
}

if (event === 'pre-tool') {
  const tool = input.tool_name || '';
  const ti = input.tool_input || {};
  if (tool === 'Bash' || tool === 'PowerShell') {
    const cmd = String(ti.command || '');
    const checkpoint = /#\s*checkpoint:\s*\S+/i.test(cmd);
    if (/\bgit\s+(add\s+(-A\b|--all\b|\.(\s|$))|add\s+.*\s-A\b)/.test(cmd)) {
      deny(`Blocked by X-Ray guardrails: "git add -A/." stages the shared tree. Stage explicit paths (ledger skill).`);
    }
    if (/\bgit\s+(commit|push|merge|rebase|stash|worktree\s+add|reset\s+--hard|checkout\s+--)\b/.test(cmd) && !checkpoint) {
      ask(`X-Ray guardrails: git history/worktree mutation needs Daniel's named checkpoint. Add "# checkpoint: <name>" to the command after he names it.`);
    }
    if (/\b(taskkill|Stop-Process|kill\s+(-9|-KILL|-TERM)?\s*\d+|pkill|killall)\b/i.test(cmd) && !/cleanup[\w-]*\.(ps1|mjs|sh)/i.test(cmd)) {
      ask(`X-Ray guardrails: process termination must go through an identity-checked cleanup script (e.g. proof/growth/<stage>/cleanup-owned.ps1); never kill processes you do not own.`);
    }
  }
  if ((tool === 'Write' || tool === 'Edit') && /LATEST-VERIFIED-BUILD\.md$/i.test(String(ti.file_path || ''))) {
    ask(`X-Ray guardrails: LATEST-VERIFIED-BUILD.md changes only after every gate including native graceful shutdown passed. Confirm the shutdown evidence path before proceeding.`);
  }
  out({});
}

if (event === 'stop') {
  if (input.stop_hook_active) out({});
  const text = lastAssistantText(input.transcript_path);
  const claimsDone = /\b(marked|mark(?:ing)?|is|now|slice|SC-\d+)\s*(?:\[?done\]?|complete[d]?|finished|verified|accepted|passed)\b/i.test(text);
  const hasProof = /(proof\/growth\/|screenshots\/growth\/|proof\/growth\/runner\/|\.png\b|tests?\s+\d+.*pass\s+\d+|exit\s*(code)?\s*0)/i.test(text);
  if (claimsDone && !hasProof) {
    out({
      decision: 'block',
      reason: 'X-Ray proof standard: the reply claims completion but cites no proof (runner report, screenshot path or executed test output). Add the evidence paths or mark the item open/blocked.',
    });
  }
  out({});
}

out({});

function readStdin() {
  try { const raw = fs.readFileSync(0, 'utf8'); return raw.trim() ? JSON.parse(raw) : {}; } catch { return {}; }
}
function out(obj) { process.stdout.write(JSON.stringify(obj)); process.exit(0); }
function deny(reason) { out({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }); }
function ask(reason) { out({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason } }); }
function lastAssistantText(transcriptPath) {
  try {
    const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      let rec; try { rec = JSON.parse(lines[i]); } catch { continue; }
      const msg = rec.message || rec;
      if ((rec.type === 'assistant' || msg.role === 'assistant') && Array.isArray(msg.content)) {
        const t = msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
        if (t.trim()) return t;
      }
    }
  } catch { /* no transcript: never block */ }
  return '';
}
