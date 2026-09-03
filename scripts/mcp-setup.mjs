#!/usr/bin/env node
/**
 * X-Ray by Looplet — Automated MCP Server Registration
 * Configures .cursor/mcp.json and Claude Desktop config for automated agent use.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const CURSOR_DIR = resolve(ROOT, ".cursor");
const CURSOR_MCP = resolve(CURSOR_DIR, "mcp.json");

// Locate python executable
const pythonCmds = [
  "python",
  "python3",
  "C:\\Users\\danie\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe"
];

let foundPython = "python"; // fallback
for (const cmd of pythonCmds) {
  try {
    const res = spawnSync(cmd, ["--version"], { encoding: "utf8" });
    if (res.status === 0) {
      foundPython = cmd;
      break;
    }
  } catch (e) {}
}

console.log(`[+] Found Python executable: ${foundPython}`);

const mcpConfig = {
  command: foundPython,
  args: ["-m", "engine.server.mcp_server"],
  cwd: ROOT,
  env: {
    PYTHONPATH: `${resolve(ROOT, "engine", "python")}${process.platform === "win32" ? ";" : ":"}${ROOT}`,
  },
};

// 1. Configure .cursor/mcp.json
if (!existsSync(CURSOR_DIR)) {
  mkdirSync(CURSOR_DIR, { recursive: true });
}

let cursorJson = { mcpServers: {} };
if (existsSync(CURSOR_MCP)) {
  try {
    cursorJson = JSON.parse(readFileSync(CURSOR_MCP, "utf8"));
    if (!cursorJson.mcpServers) cursorJson.mcpServers = {};
  } catch (e) {
    cursorJson = { mcpServers: {} };
  }
}

cursorJson.mcpServers["xray-by-looplet"] = mcpConfig;
writeFileSync(CURSOR_MCP, JSON.stringify(cursorJson, null, 2), "utf8");
console.log(`[+] Configured Cursor MCP server at: ${CURSOR_MCP}`);

// 2. Claude Desktop configuration (Windows / macOS)
const home = process.env.USERPROFILE || process.env.HOME || "";
const claudePaths = [
  join(home, "AppData", "Roaming", "Claude", "claude_desktop_config.json"),
  join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json"),
];

for (const p of claudePaths) {
  if (existsSync(p)) {
    try {
      const ccfg = JSON.parse(readFileSync(p, "utf8"));
      if (!ccfg.mcpServers) ccfg.mcpServers = {};
      ccfg.mcpServers["xray-by-looplet"] = mcpConfig;
      writeFileSync(p, JSON.stringify(ccfg, null, 2), "utf8");
      console.log(`[+] Injected X-Ray MCP server into Claude Desktop: ${p}`);
    } catch (e) {
      console.warn(`[!] Failed updating Claude config at ${p}:`, e);
    }
  }
}

console.log("[+] MCP server registration complete!");
