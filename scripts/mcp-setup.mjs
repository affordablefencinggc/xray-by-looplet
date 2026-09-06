#!/usr/bin/env node
/**
 * X-Ray by Looplet — Automated MCP Server Registration
 * Configures:
 * 1. .cursor/mcp.json (Cursor IDE)
 * 2. Claude Desktop config (Windows / macOS)
 * 3. .agents/mcp_config.json (Antigravity Workspace)
 * 4. ~/.gemini/config/mcp_config.json (Antigravity Global)
 *
 * Registers:
 * - xray-by-looplet (Local FastMCP server)
 * - looplet-crm (Remote Looplet CRM MCP worker)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

export const ROOT = process.cwd();
export const CURSOR_DIR = resolve(ROOT, ".cursor");
export const CURSOR_MCP = resolve(CURSOR_DIR, "mcp.json");
export const AGENTS_DIR = resolve(ROOT, ".agents");
export const AGENTS_MCP = resolve(AGENTS_DIR, "mcp_config.json");

const REMOTE_MCP_URL = "https://mcp.looplet.com.au/mcp";

// 1. Locate python executable
export function findPython() {
  const pythonCmds = [
    "C:\\Users\\danie\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe",
    "python",
    "python3",
  ];

  for (const cmd of pythonCmds) {
    try {
      const res = spawnSync(cmd, ["-c", "import mcp; print('ok')"], { encoding: "utf8" });
      if (res.status === 0 && res.stdout.includes("ok")) {
        return cmd;
      }
    } catch {
      // try next
    }
  }

  // Fallback to basic python check
  for (const cmd of pythonCmds) {
    try {
      const res = spawnSync(cmd, ["--version"], { encoding: "utf8" });
      if (res.status === 0) {
        return cmd;
      }
    } catch {
      // try next
    }
  }

  return "python";
}

export function generateMcpConfigs(pythonPath) {
  const localStdioConfig = {
    command: pythonPath,
    args: ["-m", "engine.server.mcp_server"],
    cwd: ROOT,
    env: {
      PYTHONPATH: `${resolve(ROOT, "engine", "python")}${process.platform === "win32" ? ";" : ":"}${resolve(ROOT, "engine")}${process.platform === "win32" ? ";" : ":"}${ROOT}`,
    },
  };

  const cursorAndClaude = {
    mcpServers: {
      "xray-by-looplet": localStdioConfig,
      "looplet-crm": {
        url: REMOTE_MCP_URL,
      },
    },
  };

  const antigravity = {
    mcpServers: {
      "xray-by-looplet": localStdioConfig,
      "looplet-crm": {
        serverUrl: REMOTE_MCP_URL,
      },
    },
  };

  return { cursorAndClaude, antigravity, localStdioConfig };
}

export function updateJsonFile(filePath, updater) {
  const dir = resolve(filePath, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  let existing = {};
  if (existsSync(filePath)) {
    try {
      const raw = readFileSync(filePath, "utf8").trim();
      if (raw) existing = JSON.parse(raw);
    } catch (e) {
      existing = {};
    }
  }

  const updated = updater(existing);
  writeFileSync(filePath, JSON.stringify(updated, null, 2), "utf8");
  return updated;
}

export function runSetup() {
  const pythonPath = findPython();
  console.log(`[+] Found Python executable: ${pythonPath}`);

  const { cursorAndClaude, antigravity } = generateMcpConfigs(pythonPath);

  // 1. Cursor: .cursor/mcp.json
  updateJsonFile(CURSOR_MCP, (existing) => {
    const servers = existing.mcpServers || {};
    servers["xray-by-looplet"] = cursorAndClaude.mcpServers["xray-by-looplet"];
    servers["looplet-crm"] = cursorAndClaude.mcpServers["looplet-crm"];
    return { ...existing, mcpServers: servers };
  });
  console.log(`[+] Configured Cursor MCP server at: ${CURSOR_MCP}`);

  // 2. Antigravity Workspace: .agents/mcp_config.json
  updateJsonFile(AGENTS_MCP, (existing) => {
    const servers = existing.mcpServers || {};
    servers["xray-by-looplet"] = antigravity.mcpServers["xray-by-looplet"];
    servers["looplet-crm"] = antigravity.mcpServers["looplet-crm"];
    return { ...existing, mcpServers: servers };
  });
  console.log(`[+] Configured Antigravity Workspace MCP at: ${AGENTS_MCP}`);

  // 3. Antigravity Global: ~/.gemini/config/mcp_config.json
  const home = process.env.USERPROFILE || process.env.HOME || "";
  if (home) {
    const geminiGlobal = join(home, ".gemini", "config", "mcp_config.json");
    try {
      updateJsonFile(geminiGlobal, (existing) => {
        const servers = existing.mcpServers || {};
        servers["xray-by-looplet"] = antigravity.mcpServers["xray-by-looplet"];
        servers["looplet-crm"] = antigravity.mcpServers["looplet-crm"];
        return { ...existing, mcpServers: servers };
      });
      console.log(`[+] Configured Antigravity Global MCP at: ${geminiGlobal}`);
    } catch (e) {
      console.warn(`[!] Failed updating Gemini global config:`, e.message);
    }

    // 4. Claude Desktop configuration (Windows / macOS)
    const claudePaths = [
      join(home, "AppData", "Roaming", "Claude", "claude_desktop_config.json"),
      join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json"),
    ];

    for (const p of claudePaths) {
      const parentDir = resolve(p, "..");
      if (existsSync(parentDir)) {
        try {
          updateJsonFile(p, (existing) => {
            const servers = existing.mcpServers || {};
            servers["xray-by-looplet"] = cursorAndClaude.mcpServers["xray-by-looplet"];
            servers["looplet-crm"] = cursorAndClaude.mcpServers["looplet-crm"];
            return { ...existing, mcpServers: servers };
          });
          console.log(`[+] Injected X-Ray MCP server into Claude Desktop: ${p}`);
        } catch (e) {
          console.warn(`[!] Failed updating Claude config at ${p}:`, e.message);
        }
      }
    }
  }

  // 5. Verify FastMCP Server Tool Discovery
  console.log("[*] Verifying FastMCP server tools...");
  const probePy = `
import sys, asyncio
from pathlib import Path
root = Path(r"${ROOT}")
sys.path.extend([str(root / "engine" / "python"), str(root / "engine"), str(root)])
from engine.server.mcp_server import mcp
tools = asyncio.run(mcp.list_tools())
print("TOOLS:" + ",".join(t.name for t in tools))
`;
  try {
    const probe = spawnSync(pythonPath, ["-c", probePy], { encoding: "utf8" });
    if (probe.status === 0 && probe.stdout.includes("TOOLS:")) {
      const line = probe.stdout.split("\n").find((l) => l.startsWith("TOOLS:"));
      const toolNames = line ? line.replace("TOOLS:", "").trim() : "";
      console.log(`[+] FastMCP verified! Registered tools (${toolNames.split(",").length}): ${toolNames}`);
    } else {
      console.warn(`[!] MCP probe returned code ${probe.status}:\n${probe.stderr || probe.stdout}`);
    }
  } catch (e) {
    console.warn("[!] Could not execute FastMCP probe:", e.message);
  }

  console.log("[+] MCP server registration & connection complete!");
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(ROOT, "scripts", "mcp-setup.mjs")) {
  runSetup();
}
