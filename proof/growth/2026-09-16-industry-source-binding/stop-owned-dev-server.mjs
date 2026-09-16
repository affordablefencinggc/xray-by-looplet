/**
 * Identity-checked cleanup for the one dev server this campaign started.
 *
 * Refuses to stop anything unless the live process still matches the recorded launch on three
 * independent facts: the PID, its creation timestamp, and its full command line (which must name
 * this repository's vite binary and port 8080). A PID alone is not identity — Windows recycles them.
 *
 * Run: node proof/growth/2026-09-16-industry-source-binding/stop-owned-dev-server.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const launch = JSON.parse(readFileSync(join(here, "dev-launch.json"), "utf8"));

const ps = (script) =>
  execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8" }).trim();

const pid = launch.vitePid;
const record = ps(
  `$p = Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" -ErrorAction SilentlyContinue; ` +
    `if ($null -eq $p) { 'GONE' } else { $p.CreationDate.ToString('yyyy-MM-ddTHH:mm:ss') + "\`n" + $p.CommandLine }`,
);

if (record === "GONE") {
  console.log(`PID ${pid} is not running. Nothing to stop.`);
  process.exit(0);
}

const [created, commandLine = ""] = record.split(/\r?\n/);
const recordedCreated = launch.viteCreated;
const startedAt = new Date(created);
const recordedAt = new Date(recordedCreated);
const sameStart = Math.abs(startedAt.getTime() - recordedAt.getTime()) < 2000;
const namesRepoVite = commandLine.includes("xray-by-looplet") && commandLine.includes("vite");
const namesPort = commandLine.includes("--port 8080");
const ownsListener = ps(
  `(Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | ` +
    `Where-Object OwningProcess -eq ${pid} | Measure-Object).Count`,
);

console.log(`candidate PID   : ${pid}`);
console.log(`recorded start  : ${recordedCreated}`);
console.log(`actual start    : ${created}   match=${sameStart}`);
console.log(`command line    : ${commandLine}`);
console.log(`names repo vite : ${namesRepoVite}   names port 8080: ${namesPort}`);
console.log(`owns 8080       : ${ownsListener}`);

if (!sameStart || !namesRepoVite || !namesPort || ownsListener !== "1") {
  console.error("REFUSED: the live process does not match the recorded launch. Leaving it alone.");
  process.exit(1);
}

ps(`Stop-Process -Id ${pid} -Force`);
const after = ps(
  `(Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | Measure-Object).Count`,
);
const stillThere = ps(`(Get-Process -Id ${pid} -ErrorAction SilentlyContinue | Measure-Object).Count`);
console.log(`stopped PID ${pid}: process gone=${stillThere === "0"} listeners on 8080 now=${after}`);
