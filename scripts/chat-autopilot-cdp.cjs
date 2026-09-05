/**
 * Chat Autopilot Client via Chrome DevTools Protocol (CDP)
 *
 * Automates the chat UI directly:
 * 1. Connects to the local webview/chat debugger on localhost:9222.
 * 2. Reads the next pending item from XRAY-TOPDOWN-MINDMAP-TODO.md.
 * 3. Sends `/clear` and presses Enter to ensure a completely fresh chat.
 * 4. Types the task prompt into the chat box and presses Enter.
 * 5. Waits for response generation to complete.
 * 6. Repeats for the next item on the list.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.CDP_PORT || 9222;
const TODO_PATH = path.resolve(__dirname, '..', 'XRAY-TOPDOWN-MINDMAP-TODO.md');

function getPendingTasks() {
  if (!fs.existsSync(TODO_PATH)) return [];
  const lines = fs.readFileSync(TODO_PATH, 'utf-8').split('\n');
  const tasks = [];
  const regex = /^- \[( |-)\] \*\*([A-Z0-9_-]+)\*\*:\s*(.*)$/;
  lines.forEach((line, i) => {
    const m = line.match(regex);
    if (m) tasks.push({ lineIndex: i, code: m[2], title: m[3] });
  });
  return tasks;
}

function checkCdpAvailable() {
  return new Promise((resolve) => {
    http.get(`http://localhost:${PORT}/json`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const tabs = JSON.parse(data);
          resolve(tabs);
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function main() {
  console.log(`Checking for debugger endpoint on localhost:${PORT}...`);
  const tabs = await checkCdpAvailable();
  if (!tabs) {
    console.log(`[Info] No active CDP debugger found on port ${PORT}.`);
    console.log(`To use headless CLI autopilot directly, run:`);
    console.log(`   npm run autopilot`);
    console.log(`   or: .\\autopilot.ps1`);
    process.exit(0);
  }

  const tasks = getPendingTasks();
  console.log(`Found ${tasks.length} pending tasks in ${TODO_PATH}.`);
  console.log(`Use 'npm run autopilot' to execute across all tasks with auto-clearing fresh sessions.`);
}

main();
