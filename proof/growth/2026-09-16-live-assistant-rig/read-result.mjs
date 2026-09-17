/**
 * Summarise one live-assistant runner log without pasting the whole archive.
 * Usage: node proof/growth/2026-09-16-live-assistant-rig/read-result.mjs <runner.log> [--full]
 */
import { readFileSync } from "node:fs";

const [, , logPath, flag] = process.argv;
if (!logPath) throw Error("usage: node read-result.mjs <runner.log> [--full]");

const lines = readFileSync(logPath, "utf8").split(/\r?\n/).filter(Boolean);
let archive = null;
for (const line of lines) {
  if (!line.startsWith('"') || !line.includes('\\"entries\\"')) continue;
  try {
    const parsed = JSON.parse(JSON.parse(line));
    if (parsed && Array.isArray(parsed.entries)) archive = parsed;
  } catch { /* not the archive line */ }
}

console.log(`lines=${lines.length}`);
const tail = lines.slice(0, lines.findIndex(l => l.startsWith('"') && l.includes('\\"entries\\"')) + 1);
for (const line of tail) {
  if (line.length > 300) { console.log(`  [${line.length} chars omitted]`); continue; }
  console.log(`  ${line}`);
}

if (!archive) { console.log("\nNO ARCHIVE LINE FOUND"); process.exit(0); }

console.log(`\nprojectId=${archive.projectId} threads=${archive.threads} busy=${archive.busy}`);
console.log(`error=${archive.error === null ? "null" : JSON.stringify(archive.error)}`);
console.log(`workPacket=${JSON.stringify(archive.workPacket, null, 2)}`);
for (const entry of archive.entries) {
  const meta = [entry.kind, entry.tool ? `tool=${entry.tool}` : null, entry.failed ? "FAILED" : null,
    entry.origin ? `origin=${entry.origin}` : null, entry.projectName ? `on=${entry.projectName}@r${entry.projectRevision}` : null]
    .filter(Boolean).join(" ");
  const text = entry.text ?? "";
  console.log(`\n--- ${meta} (${text.length} chars) ---`);
  console.log(flag === "--full" ? text : text.slice(0, 1200) + (text.length > 1200 ? "\n…[truncated; rerun with --full]" : ""));
}
